// src/lib/firebase-api.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db, app } from './firebase'
import { auth } from './firebase'
import type { ExamSubject, ExamQuestion, ExamItem, ExamSessionResult, ExamStudent, ExamStudentResultItem, TeacherProfile, TeacherFeedback } from './api'

const functions = getFunctions(app, 'asia-southeast1')

// Helper: generate random access code
function genAccessCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

function createdAtMs(value: any): number {
  if (!value) return 0
  if (typeof value === 'string') return new Date(value).getTime() || 0
  if (typeof value === 'number') return value
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  return 0
}

function pageItems<T>(items: T[], page = 1, pageSize = 50): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize)
}

function currentOwnerId(): string {
  return auth.currentUser?.uid || ''
}

function ownedByCurrentUser(item: any): boolean {
  const ownerId = currentOwnerId()
  return !item.ownerId || !ownerId || item.ownerId === ownerId
}

function withOwner<T extends Record<string, any>>(data: T): T & { ownerId: string } {
  return { ...data, ownerId: currentOwnerId() }
}

type DocxParagraph = {
  text: string
  hasUnderline: boolean
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes)
}

async function inflateZipEntry(bytes: Uint8Array): Promise<Uint8Array> {
  const Decompression = (globalThis as any).DecompressionStream
  if (!Decompression) {
    throw new Error('Trình duyệt chưa hỗ trợ đọc file .docx trực tiếp. Vui lòng dùng Chrome/Edge/Safari mới hoặc dùng file JSON.')
  }
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const stream = new Blob([buffer]).stream().pipeThrough(new Decompression('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function readDocxXml(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('File .docx không hợp lệ.')

  const entryCount = view.getUint16(eocd + 10, true)
  const cdOffset = view.getUint32(eocd + 16, true)
  let ptr = cdOffset

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) throw new Error('Không đọc được cấu trúc file .docx.')
    const method = view.getUint16(ptr + 10, true)
    const compressedSize = view.getUint32(ptr + 20, true)
    const nameLen = view.getUint16(ptr + 28, true)
    const extraLen = view.getUint16(ptr + 30, true)
    const commentLen = view.getUint16(ptr + 32, true)
    const localOffset = view.getUint32(ptr + 42, true)
    const name = decodeUtf8(bytes.slice(ptr + 46, ptr + 46 + nameLen))

    if (name === 'word/document.xml') {
      const localNameLen = view.getUint16(localOffset + 26, true)
      const localExtraLen = view.getUint16(localOffset + 28, true)
      const dataStart = localOffset + 30 + localNameLen + localExtraLen
      const data = bytes.slice(dataStart, dataStart + compressedSize)
      if (method === 0) return decodeUtf8(data)
      if (method === 8) return decodeUtf8(await inflateZipEntry(data))
      throw new Error('File .docx dùng kiểu nén chưa được hỗ trợ.')
    }

    ptr += 46 + nameLen + extraLen + commentLen
  }

  throw new Error('Không tìm thấy nội dung Word trong file .docx.')
}

function extractDocxParagraphs(xml: string): DocxParagraph[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const paragraphs = Array.from(doc.getElementsByTagName('w:p'))

  return paragraphs.map(p => {
    const runs = Array.from(p.getElementsByTagName('w:r'))
    let text = ''
    let hasUnderline = false

    for (const run of runs) {
      const runText = Array.from(run.getElementsByTagName('w:t')).map(t => t.textContent || '').join('')
      text += runText
      const underline = run.getElementsByTagName('w:u')[0]
      const val = underline?.getAttribute('w:val') || underline?.getAttribute('val')
      if (underline && val !== 'none' && val !== 'false') hasUnderline = true
    }

    return { text: text.trim(), hasUnderline }
  }).filter(p => p.text)
}

function buildQuestionsFromDocx(paragraphs: DocxParagraph[]): any[] {
  const questions: any[] = []
  let section: 'NONE' | 'PART1' | 'PART2' | 'PART3' = 'NONE'
  let currentType: string | null = null
  let currentContent: string[] = []
  let currentOptions: { key: string; content: string }[] = []
  let currentCorrect = ''
  let currentStatements: { key: string; content: string; answer: boolean }[] = []
  let currentShortAnswer = ''
  let inAnswerBlock = false

  const flush = () => {
    const content = currentContent.join('\n').trim()
    if (!currentType || !content) return
    if (currentType === 'MULTIPLE_CHOICE') {
      questions.push({ type: currentType, content, options: currentOptions, correctAnswer: currentCorrect || undefined, difficulty: 'NHAN_BIET' })
    } else if (currentType === 'TRUE_FALSE' && currentStatements.length > 0) {
      questions.push({ type: currentType, content, statements: currentStatements, difficulty: 'NHAN_BIET' })
    } else if (currentType === 'SHORT_ANSWER') {
      questions.push({ type: currentType, content, shortAnswer: currentShortAnswer || undefined, difficulty: 'NHAN_BIET' })
    }
    currentType = null
    currentContent = []
    currentOptions = []
    currentCorrect = ''
    currentStatements = []
    currentShortAnswer = ''
    inAnswerBlock = false
  }

  for (const para of paragraphs) {
    const t = para.text
    if (/PHẦN\s*I\.?\s*(Câu|trắc|trắc nghiệm)/i.test(t) || /^PHẦN\s+I[\.\s]/i.test(t)) {
      flush(); section = 'PART1'; continue
    }
    if (/PHẦN\s*II\.?\s*(Câu|trắc|đúng|sai)/i.test(t) || /^PHẦN\s+II[\.\s]/i.test(t)) {
      flush(); section = 'PART2'; continue
    }
    if (/PHẦN\s*III\.?\s*(Câu|trắc|trả|ngắn)/i.test(t) || /^PHẦN\s+III[\.\s]/i.test(t)) {
      flush(); section = 'PART3'; continue
    }
    if (!t || /^[-─═\s]+$/.test(t) || /HẾT|END/i.test(t)) continue

    if (section === 'PART1') {
      const questionMatch = t.match(/^Câu\s+(\d+)\.\s*(.*)/)
      if (questionMatch) {
        flush()
        currentType = 'MULTIPLE_CHOICE'
        currentContent = questionMatch[2].trim() ? [questionMatch[2].trim()] : []
        continue
      }
      const optionMatch = t.match(/^([A-D])\.\s*(.+)/)
      if (optionMatch && currentType === 'MULTIPLE_CHOICE') {
        currentOptions.push({ key: optionMatch[1], content: optionMatch[2].trim() })
        if (para.hasUnderline) currentCorrect = optionMatch[1]
        continue
      }
      if (currentType === 'MULTIPLE_CHOICE' && currentOptions.length === 0) currentContent.push(t)
    } else if (section === 'PART2') {
      const questionMatch = t.match(/^Câu\s+(\d+)\.\s*(.*)/)
      if (questionMatch) {
        flush()
        currentType = 'TRUE_FALSE'
        currentContent = questionMatch[2].trim() ? [questionMatch[2].trim()] : []
        continue
      }
      const stmtMatch = t.match(/^([a-d])\)\s*(.+)/)
      if (stmtMatch && currentType === 'TRUE_FALSE') {
        currentStatements.push({ key: stmtMatch[1], content: stmtMatch[2].trim(), answer: para.hasUnderline })
        continue
      }
      if (currentType === 'TRUE_FALSE' && currentStatements.length === 0 && !/^\d[\d\s,.]*$/.test(t)) currentContent.push(t)
    } else if (section === 'PART3') {
      const questionMatch = t.match(/^Câu\s+(\d+)\.\s*(.*)/)
      if (questionMatch) {
        flush()
        currentType = 'SHORT_ANSWER'
        currentContent = questionMatch[2].trim() ? [questionMatch[2].trim()] : []
        inAnswerBlock = false
        continue
      }
      if (/^Lời\s+giải/i.test(t)) {
        inAnswerBlock = true
        continue
      }
      const answerMatch = t.match(/^Đáp\s+án\s*:\s*(.+)/i)
      if (answerMatch && currentType === 'SHORT_ANSWER') {
        currentShortAnswer = answerMatch[1].trim()
        continue
      }
      if (currentType === 'SHORT_ANSWER' && !inAnswerBlock && !currentShortAnswer && !/^\d[\d\s,.]*$/.test(t) && !/^Năm$/i.test(t) && !/^Nguồn:/i.test(t)) {
        currentContent.push(t)
      }
    }
  }

  flush()
  return questions
}

export const profiles = {
  getCurrent: async (): Promise<TeacherProfile> => {
    await auth.authStateReady()
    const user = auth.currentUser
    if (!user) throw new Error('Bạn chưa đăng nhập.')
    const snap = await getDoc(doc(db, 'users', user.uid))
    const data = snap.exists() ? snap.data() : {}
    return {
      uid: user.uid,
      email: user.email || '',
      fullName: String(data.fullName || user.displayName || user.email?.split('@')[0] || ''),
      phone: String(data.phone || ''),
      position: String(data.position || ''),
      subjectSpecialization: String(data.subjectSpecialization || ''),
      workplaces: Array.isArray(data.workplaces) ? data.workplaces : [],
      defaultWorkplace: String(data.defaultWorkplace || ''),
      gradeLevels: Array.isArray(data.gradeLevels) && data.gradeLevels.length ? data.gradeLevels : [10, 11, 12],
      bio: String(data.bio || ''),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || '',
    }
  },

  updateCurrent: async (data: Omit<TeacherProfile, 'uid' | 'email' | 'updatedAt'>): Promise<TeacherProfile> => {
    await auth.authStateReady()
    const user = auth.currentUser
    if (!user) throw new Error('Bạn chưa đăng nhập.')
    const workplaces = Array.from(new Set((data.workplaces || []).map(v => v.trim()).filter(Boolean)))
    const defaultWorkplace = workplaces.includes(data.defaultWorkplace || '')
      ? data.defaultWorkplace
      : workplaces[0] || ''
    const payload = {
      ...data,
      fullName: data.fullName.trim(),
      workplaces,
      defaultWorkplace,
      gradeLevels: (data.gradeLevels || []).filter(v => [10, 11, 12].includes(v)).sort(),
      email: user.email || '',
      updatedAt: serverTimestamp(),
    }
    await setDoc(doc(db, 'users', user.uid), payload, { merge: true })
    const { updateProfile } = await import('firebase/auth')
    if (payload.fullName && user.displayName !== payload.fullName) {
      await updateProfile(user, { displayName: payload.fullName })
    }
    return profiles.getCurrent()
  },
}

export const feedback = {
  create: async (data: Omit<TeacherFeedback, '_id' | 'ownerId' | 'createdAt' | 'status'>) => {
    await auth.authStateReady()
    const user = auth.currentUser
    if (!user) throw new Error('Bạn chưa đăng nhập.')
    const payload = withOwner({
      ...data,
      title: data.title.trim(),
      message: data.message.trim(),
      email: user.email || '',
      displayName: user.displayName || '',
      status: 'NEW',
      createdAt: serverTimestamp(),
    })
    const ref = await addDoc(collection(db, 'feedback'), payload)
    return {
      _id: ref.id,
      ...data,
      title: data.title.trim(),
      message: data.message.trim(),
      ownerId: user.uid,
      status: 'NEW',
      createdAt: new Date().toISOString(),
    } as TeacherFeedback
  },
}

export const exams = {
  getStats: async (_token: string) => {
    const examsCol = collection(db, 'exams')
    const attemptsCol = collection(db, 'attempts')
    const questionsCol = collection(db, 'questions')

    const [examsSnap, attemptsSnap, questionsSnap] = await Promise.all([
      getDocs(examsCol),
      getDocs(attemptsCol),
      getDocs(questionsCol)
    ])
    const examItems = examsSnap.docs.map(d => d.data()).filter(ownedByCurrentUser)
    const attemptItems = attemptsSnap.docs.map(d => d.data()).filter(ownedByCurrentUser)
    const questionItems = questionsSnap.docs.map(d => d.data()).filter(ownedByCurrentUser)

    return {
      totalExams: examItems.length,
      activeExams: examItems.filter(item => item.status === 'ACTIVE').length,
      totalSessions: attemptItems.length,
      totalQuestions: questionItems.length
    }
  },

  // Subjects
  getSubjects: async (_token: string) => {
    const col = collection(db, 'subjects')
    const snap = await getDocs(col)
    return snap.docs
      .map(d => ({ _id: d.id, ...d.data() }) as ExamSubject)
      .filter(ownedByCurrentUser)
      .filter(s => s.isActive !== false)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi'))
  },

  createSubject: async (token: string, data: Partial<ExamSubject>) => {
    const col = collection(db, 'subjects')
    const payload = withOwner({ ...data, isActive: true })
    const docRef = await addDoc(col, payload)
    return { _id: docRef.id, ...payload } as ExamSubject
  },

  updateSubject: async (token: string, id: string, data: Partial<ExamSubject>) => {
    const docRef = doc(db, 'subjects', id)
    await updateDoc(docRef, data)
    return { _id: id, ...data } as ExamSubject
  },

  deleteSubject: async (token: string, id: string) => {
    const docRef = doc(db, 'subjects', id)
    await updateDoc(docRef, { isActive: false })
  },

  // Questions
  getQuestions: async (token: string, p: { subjectId?: string; gradeLevel?: number; type?: string; difficulty?: string; page?: number; limit?: number }) => {
    const col = collection(db, 'questions')
    const pageSize = p.limit || 50
    const pageNum = p.page || 1
    const snap = await getDocs(col)
    const filtered = snap.docs
      .map(d => ({ _id: d.id, ...d.data() }) as ExamQuestion)
      .filter(ownedByCurrentUser)
      .filter(item => item.isActive !== false)
      .filter(item => !p.subjectId || item.subjectId === p.subjectId)
      .filter(item => !p.gradeLevel || Number(item.gradeLevel) === Number(p.gradeLevel))
      .filter(item => !p.type || item.type === p.type)
      .filter(item => !p.difficulty || item.difficulty === p.difficulty)
      .sort((a, b) => createdAtMs((b as any).createdAt) - createdAtMs((a as any).createdAt))
    const total = filtered.length
    const items = pageItems(filtered, pageNum, pageSize)

    return {
      total,
      page: pageNum,
      limit: pageSize,
      items
    }
  },

  createQuestion: async (token: string, data: any) => {
    const col = collection(db, 'questions')
    const payload = withOwner({
      ...data,
      usageCount: 0,
      isActive: true,
      createdAt: new Date().toISOString()
    })
    const docRef = await addDoc(col, payload)
    return { _id: docRef.id, ...payload } as ExamQuestion
  },

  updateQuestion: async (token: string, id: string, data: any) => {
    const docRef = doc(db, 'questions', id)
    await updateDoc(docRef, data)
    return { _id: id, ...data } as ExamQuestion
  },

  deleteQuestion: async (token: string, id: string) => {
    const docRef = doc(db, 'questions', id)
    await updateDoc(docRef, { isActive: false })
  },

  parseDocx: async (token: string, file: File) => {
    const xml = await readDocxXml(file)
    const questions = buildQuestionsFromDocx(extractDocxParagraphs(xml))
    return { questions, total: questions.length }
  },

  importQuestions: async (token: string, data: { questions: any[]; defaultSubjectId: string; defaultGradeLevel: number }) => {
    const col = collection(db, 'questions')
    const ids = { part1: [] as string[], part2: [] as string[], part3: [] as string[] }
    let imported = 0
    let skipped = 0

    for (const q of data.questions) {
      if (!q.content?.trim() || !q.type) {
        skipped++
        continue
      }
      const payload = withOwner({
        type: q.type,
        content: q.content,
        gradeLevel: q.gradeLevel || data.defaultGradeLevel,
        subjectId: q.subjectId || data.defaultSubjectId,
        difficulty: q.difficulty || 'NHAN_BIET',
        chapter: q.chapter || null,
        topic: q.topic || null,
        tags: q.tags || [],
        options: q.options || null,
        correctAnswer: q.correctAnswer || null,
        statements: q.statements || null,
        shortAnswer: q.shortAnswer || null,
        isActive: true,
        usageCount: 0,
        createdAt: new Date().toISOString()
      })
      const ref = await addDoc(col, payload)
      if (q.type === 'MULTIPLE_CHOICE') ids.part1.push(ref.id)
      else if (q.type === 'TRUE_FALSE') ids.part2.push(ref.id)
      else if (q.type === 'SHORT_ANSWER') ids.part3.push(ref.id)
      imported++
    }

    return { imported, skipped, ids }
  },

  // Exams
  getExams: async (token: string, p: { subjectId?: string; gradeLevel?: number; status?: string; page?: number; limit?: number }) => {
    const col = collection(db, 'exams')
    const pageSize = p.limit || 20
    const pageNum = p.page || 1
    const snap = await getDocs(col)
    const filtered = snap.docs
      .map(d => ({ _id: d.id, ...d.data() }) as ExamItem)
      .filter(ownedByCurrentUser)
      .filter(item => !p.subjectId || item.subjectId === p.subjectId)
      .filter(item => !p.gradeLevel || Number(item.gradeLevel) === Number(p.gradeLevel))
      .filter(item => !p.status || item.status === p.status)
      .sort((a, b) => createdAtMs((b as any).createdAt) - createdAtMs((a as any).createdAt))
    const total = filtered.length
    const items = pageItems(filtered, pageNum, pageSize)

    return { total, items }
  },

  createExam: async (token: string, data: any) => {
    const col = collection(db, 'exams')
    const payload = withOwner({
      ...data,
      status: 'DRAFT',
      sessionCount: 0,
      createdAt: new Date().toISOString()
    })
    const docRef = await addDoc(col, payload)
    return { _id: docRef.id, ...payload } as ExamItem
  },

  updateExam: async (token: string, id: string, data: any) => {
    const docRef = doc(db, 'exams', id)
    await updateDoc(docRef, data)
    return { _id: id, ...data } as ExamItem
  },

  deleteExam: async (token: string, id: string) => {
    const docRef = doc(db, 'exams', id)
    await deleteDoc(docRef)
  },

  publishExam: async (token: string, id: string) => {
    const docRef = doc(db, 'exams', id)
    const examSnap = await getDoc(docRef)
    if (!examSnap.exists()) throw new Error('Exam not found')

    const examData = examSnap.data()!
    const accessCode = examData.accessCode || genAccessCode()

    // Query questions to extract correct answers for the master key
    const p1Ids = examData.part1Questions || []
    const p2Ids = examData.part2Questions || []
    const p3Ids = examData.part3Questions || []

    const qCol = collection(db, 'questions')
    const answerKeyPart1: Record<string, string> = {}
    const answerKeyPart2: Record<string, boolean[]> = {}
    const answerKeyPart3: Record<string, string> = {}

    for (const qid of p1Ids) {
      const qSnap = await getDoc(doc(qCol, qid))
      if (qSnap.exists()) answerKeyPart1[qid] = qSnap.data().correctAnswer || ''
    }
    for (const qid of p2Ids) {
      const qSnap = await getDoc(doc(qCol, qid))
      if (qSnap.exists()) {
        answerKeyPart2[qid] = (qSnap.data().statements || []).map((s: any) => s.answer === true)
      }
    }
    for (const qid of p3Ids) {
      const qSnap = await getDoc(doc(qCol, qid))
      if (qSnap.exists()) answerKeyPart3[qid] = qSnap.data().shortAnswer || ''
    }

    // Save secure answer key in subcollection
    const secureKeyRef = doc(db, 'exams', id, 'answerKeys', 'master')
    await setDoc(secureKeyRef, {
      part1: answerKeyPart1,
      part2: answerKeyPart2,
      part3: answerKeyPart3
    })

    const activatedAt = new Date().toISOString()
    const autoEndTime = examData.endTime || new Date(Date.now() + (examData.timeLimit || 90) * 60 * 1000).toISOString()

    const updatePayload = {
      accessCode,
      status: 'ACTIVE',
      activatedAt,
      endTime: autoEndTime
    }

    await updateDoc(docRef, updatePayload)
    return { accessCode, qrUrl: `/e/${accessCode}`, variants: [] }
  },

  getExamQuestions: async (token: string, id: string) => {
    const docRef = doc(db, 'exams', id)
    const examSnap = await getDoc(docRef)
    if (!examSnap.exists()) throw new Error('Exam not found')

    const examData = examSnap.data()!
    const p1Ids = examData.part1Questions || []
    const p2Ids = examData.part2Questions || []
    const p3Ids = examData.part3Questions || []

    const qCol = collection(db, 'questions')
    const part1: ExamQuestion[] = []
    const part2: ExamQuestion[] = []
    const part3: ExamQuestion[] = []

    for (const qid of p1Ids) {
      const snap = await getDoc(doc(qCol, qid))
      if (snap.exists()) part1.push({ _id: snap.id, ...snap.data() } as ExamQuestion)
    }
    for (const qid of p2Ids) {
      const snap = await getDoc(doc(qCol, qid))
      if (snap.exists()) part2.push({ _id: snap.id, ...snap.data() } as ExamQuestion)
    }
    for (const qid of p3Ids) {
      const snap = await getDoc(doc(qCol, qid))
      if (snap.exists()) part3.push({ _id: snap.id, ...snap.data() } as ExamQuestion)
    }

    return {
      total: part1.length + part2.length + part3.length,
      part1,
      part2,
      part3
    }
  },

  // Results
  getResults: async (token: string, examId: string, _page = 1) => {
    const col = collection(db, 'attempts')
    const snap = await getDocs(col)
    const sessions = snap.docs.map(d => ({
      _id: d.id,
      ...d.data(),
      submittedAt: d.data().submittedAt?.toDate?.()?.toISOString() || d.data().submittedAt
    }))
      .filter(ownedByCurrentUser)
      .filter((item: any) => item.exam_id === examId)
      .sort((a: any, b: any) => createdAtMs(b.submittedAt) - createdAtMs(a.submittedAt)) as unknown as ExamSessionResult[]
    return {
      total: sessions.length,
      sessions
    }
  },

  // Students & yearly reports
  getStudents: async (token: string, p: { academicYear?: string; className?: string; school?: string; keyword?: string; examType?: string; customExamLabel?: string; page?: number; limit?: number }) => {
    const col = collection(db, 'students')
    const constraints: any[] = []
    if (p.academicYear) constraints.push(where('academicYear', '==', p.academicYear))
    if (p.className) constraints.push(where('className', '==', p.className))
    if (p.school) constraints.push(where('school', '==', p.school))

    const snap = await getDocs(query(col, ...constraints))
    let items = snap.docs.map(d => ({ _id: d.id, ...d.data() })) as ExamStudent[]
    items = items.filter(ownedByCurrentUser)

    if (p.keyword) {
      const kw = p.keyword.toLowerCase()
      items = items.filter(i => i.fullName?.toLowerCase().includes(kw))
    }

    return {
      total: items.length,
      page: p.page || 1,
      limit: p.limit || 50,
      items,
      scoreColumns: [],
      filterOptions: {
        academicYears: Array.from(new Set(items.map(i => i.academicYear))).filter(Boolean),
        classNames: Array.from(new Set(items.map(i => i.className))).filter(Boolean),
        schools: Array.from(new Set(items.map(i => i.school))).filter(Boolean)
      }
    }
  },

  createStudent: async (token: string, data: { fullName: string; className: string; academicYear: string; school?: string }) => {
    const col = collection(db, 'students')
    const payload = withOwner(data)
    const docRef = await addDoc(col, payload)
    return { _id: docRef.id, ...payload } as ExamStudent
  },

  updateStudent: async (token: string, id: string, data: Partial<{ fullName: string; className: string; academicYear: string; school: string }>) => {
    const docRef = doc(db, 'students', id)
    await updateDoc(docRef, data)
    return { _id: id, ...data } as ExamStudent
  },

  getStudentResults: async (token: string, studentId: string, p: { academicYear?: string; examId?: string; page?: number; limit?: number } = {}) => {
    const col = collection(db, 'attempts')
    const q = query(col, where('studentId', '==', studentId))
    const snap = await getDocs(q)
    const items = snap.docs.map(d => ({
      _id: d.id,
      ...d.data(),
      submittedAt: d.data().submittedAt?.toDate?.()?.toISOString() || d.data().submittedAt
    })).filter(ownedByCurrentUser) as unknown as ExamStudentResultItem[]

    return {
      total: items.length,
      page: p.page || 1,
      limit: p.limit || 50,
      items
    }
  },

  scanAndGrade: async (_token: string, _examId: string, _imageUrl: string) => {
    // Fallback/mock camera OCR grading
    return { success: true, score: 8.5, sbd: '123456', variantCode: 101 }
  },

  getResultReport: async (token: string, p: { academicYear?: string; className?: string; school?: string; examId?: string; examType?: string; customExamLabel?: string } = {}) => {
    const col = collection(db, 'attempts')
    const constraints: any[] = []
    if (p.examId) constraints.push(where('exam_id', '==', p.examId))

    const snap = await getDocs(query(col, ...constraints))
    let items = snap.docs.map(d => d.data())
    items = items.filter(ownedByCurrentUser)

    if (p.academicYear) items = items.filter(i => i.studentInfo?.academicYear === p.academicYear)
    if (p.className) items = items.filter(i => i.studentInfo?.className === p.className)
    if (p.school) items = items.filter(i => i.studentInfo?.school === p.school)

    const scores = items.map(i => i.score || 0)
    const avgScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0
    const maxScore = scores.length ? Math.max(...scores) : 0
    const minScore = scores.length ? Math.min(...scores) : 0
    const passCount = scores.filter(s => s >= 5.0).length

    return {
      totalResults: items.length,
      avgScore,
      maxScore,
      minScore,
      passRate: items.length ? Math.round((passCount / items.length) * 10000) / 100 : 0,
      topResults: items.slice(0, 20) as any
    }
  },

  // ── Public (học sinh thi) ─────────────────────────
  getPublicExam: async (code: string) => {
    const col = collection(db, 'exams')
    const q = query(col, where('accessCode', '==', code))
    const snap = await getDocs(q)
    if (snap.empty) throw new Error('Đề thi không tồn tại')
    const d = snap.docs[0]
    const data = d.data()
    return {
      id: d.id,
      title: data.title,
      subject: { name: data.subjectName || 'Môn học', code: data.subjectCode || 'SUBJ' },
      gradeLevel: data.gradeLevel || 10,
      timeLimit: data.timeLimit || 90,
      timeLeftSeconds: Math.max(0, Math.floor((new Date(data.endTime).getTime() - Date.now()) / 1000)),
      structure: data.structure || {},
      defaultSchool: data.defaultSchool || '',
      startTime: data.startTime,
      endTime: data.endTime,
      activatedAt: data.activatedAt
    }
  },

  startSession: async (code: string, _body: { fullName: string; className: string; academicYear?: string; school?: string; deviceFingerprint?: string }) => {
    const col = collection(db, 'exams')
    const q = query(col, where('accessCode', '==', code))
    const snap = await getDocs(q)
    if (snap.empty) throw new Error('Đề thi không tồn tại')
    const d = snap.docs[0]
    const examData = d.data()

    // In a 100% Serverless model, we fetch exam questions client-side without returning correct answers
    const p1Ids = examData.part1Questions || []
    const p2Ids = examData.part2Questions || []
    const p3Ids = examData.part3Questions || []

    const qCol = collection(db, 'questions')
    const part1: any[] = []
    const part2: any[] = []
    const part3: any[] = []

    for (const qid of p1Ids) {
      const s = await getDoc(doc(qCol, qid))
      if (s.exists()) {
        const rest = { ...s.data() }
        delete rest.correctAnswer
        part1.push({ _id: s.id, ...rest })
      }
    }
    for (const qid of p2Ids) {
      const s = await getDoc(doc(qCol, qid))
      if (s.exists()) {
        const qdata = s.data()
        const statements = (qdata.statements || []).map((st: any) => {
          const stRest = { ...st }
          delete stRest.answer
          return stRest
        })
        part2.push({ _id: s.id, ...qdata, statements })
      }
    }
    for (const qid of p3Ids) {
      const s = await getDoc(doc(qCol, qid))
      if (s.exists()) {
        const rest = { ...s.data() }
        delete rest.shortAnswer
        part3.push({ _id: s.id, ...rest })
      }
    }

    return {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      variantCode: 101,
      timeLeftSeconds: Math.max(0, Math.floor((new Date(examData.endTime).getTime() - Date.now()) / 1000)),
      exam: {
        title: examData.title,
        timeLimit: examData.timeLimit,
        structure: examData.structure
      },
      questions: {
        part1,
        part2,
        part3
      }
    }
  },

  submitSession: async (sessionId: string, answers: { part1: Record<string, string>; part2: Record<string, boolean[]>; part3: Record<string, string> }) => {
    // Locate target exam using frontend context store (since sessionId client-side is mock session, we pass current examId)
    // Wait, let's read the current examId from store/session or context
    const currentExamId = localStorage.getItem('current_exam_id') || ''
    const studentInfoRaw = localStorage.getItem('student_info')
    const studentInfo = studentInfoRaw ? JSON.parse(studentInfoRaw) : { fullName: 'Học sinh', className: 'Lớp' }

    const gradeExamFn = httpsCallable<any, any>(functions, 'gradeExam')
    const res = await gradeExamFn({
      examId: currentExamId,
      studentInfo,
      answers
    })

    const resultData = res.data as { score: number; scoreBreakdown: { part1Score: number; part2Score: number; part3Score: number } }

    return {
      score: resultData.score,
      timeSpent: 0,
      scoreBreakdown: {
        part1: resultData.scoreBreakdown.part1Score,
        part2: resultData.scoreBreakdown.part2Score,
        part3: resultData.scoreBreakdown.part3Score
      }
    }
  },

  // ── Quiz Live Mock / Cloud implementation (if used, else empty stub) ────────
  getPublicQuizSet: async (_id: string) => { return null as any },
  getQuizSets: async (_token: string) => { return [] },
  createQuizSet: async (_token: string, _data: any) => { return null as any },
  updateQuizSet: async (_token: string, _id: string, _data: any) => { return null as any },
  deleteQuizSet: async (_token: string, _id: string) => { return { success: true } },
  startQuizSession: async (_token: string, _data: any) => { return null as any },
  beginQuizSession: async (_token: string, _id: string) => { return null as any },
  getQuizSession: async (_token: string, _id: string) => { return null as any },
  nextQuizQuestion: async (_token: string, _id: string) => { return null as any },
  endQuizSession: async (_token: string, _id: string) => { return { success: true } },
  joinQuiz: async (_code: string, _name: string) => { return { participantId: '' } },
  getQuizState: async (_code: string, _participantId?: string) => { return null as any },
  submitQuizAnswer: async (_code: string, _data: any) => { return { correct: true, gained: 10, totalScore: 10 } },

  // ── Poll Live Mock / Cloud implementation (if used, else empty stub) ────────
  getPollSets: async (_token: string) => { return [] },
  createPollSet: async (_token: string, _data: any) => { return null as any },
  updatePollSet: async (_token: string, _id: string, _data: any) => { return null as any },
  deletePollSet: async (_token: string, _id: string) => { return { success: true } },
  startPollSession: async (_token: string, _data: any) => { return null as any },
  getPollSession: async (_token: string, _id: string) => { return null as any },
  nextPollQuestion: async (_token: string, _id: string) => { return null as any },
  endPollSession: async (_token: string, _id: string) => { return { success: true } },
  joinPoll: async (_code: string, _name: string, _isAnonymous?: boolean) => { return { participantId: '' } },
  getPollState: async (_code: string, _participantId?: string) => { return null as any },
  submitPollResponse: async (_code: string, _data: any) => { return { success: true, results: null } },

  getQuestionAnalytics: async (token: string, examId: string) => {
    return {
      examId,
      totalSessions: 0,
      analytics: { part1: [], part2: [], part3: [] }
    }
  },

  downloadPdfReport: async (_token: string, _examId: string, _className?: string, _academicYear?: string) => {
    return null as any
  },

  getAnswerExplanation: async (_sessionId: string) => {
    return {}
  },

  // Flashcards
  getFlashcardSets: async (_token: string) => {
    const snap = await getDocs(collection(db, 'flashcard_sets'))
    return snap.docs
      .map(d => ({ _id: d.id, ...d.data() }))
      .filter(ownedByCurrentUser)
      .filter((item: any) => item.isActive !== false)
      .sort((a: any, b: any) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt))
  },

  createFlashcardSet: async (token: string, data: any) => {
    await auth.authStateReady()
    const user = auth.currentUser
    if (!user) throw new Error('Bạn chưa đăng nhập.')

    let cards = Array.isArray(data.cards) ? data.cards.filter((card: any) => card?.front && card?.back) : []
    if (Array.isArray(data.questionIds) && data.questionIds.length > 0) {
      const generatedCards: any[] = []
      for (const questionId of data.questionIds) {
        const snap = await getDoc(doc(db, 'questions', questionId))
        if (!snap.exists()) continue
        const q: any = snap.data()
        let front = q.content || ''
        let back = ''

        if (q.type === 'MULTIPLE_CHOICE') {
          const options = Array.isArray(q.options) ? q.options : []
          front = `${front}<br><br>${options.map((o: any) => `${o.key}. ${o.content}`).join('<br>')}`
          const correct = options.find((o: any) => o.key === q.correctAnswer)
          back = `<strong>Đáp án: ${q.correctAnswer || ''}</strong>${correct?.content ? `<br>${correct.content}` : ''}`
        } else if (q.type === 'TRUE_FALSE') {
          const statements = Array.isArray(q.statements) ? q.statements : []
          front = `${front}<br><br>${statements.map((s: any) => `${s.key}. ${s.content}`).join('<br>')}`
          back = `<strong>Đáp án:</strong><br>${statements.map((s: any) => `${s.key}. ${s.answer ? 'Đúng' : 'Sai'}`).join('<br>')}`
        } else if (q.type === 'SHORT_ANSWER') {
          back = `<strong>Đáp án: ${q.shortAnswer || ''}</strong>`
        }

        if (front && back) generatedCards.push({ front, back, questionId })
      }
      cards = generatedCards
    }

    const payload = withOwner({
      title: String(data.title || '').trim(),
      description: data.description ? String(data.description).trim() : '',
      subjectId: data.subjectId || '',
      gradeLevel: data.gradeLevel || null,
      cards,
      matchingItems: Array.isArray(data.matchingItems) ? data.matchingItems : [],
      accessCode: genAccessCode(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    if (!payload.title) throw new Error('Vui lòng nhập tên bộ flashcard.')

    const ref = await addDoc(collection(db, 'flashcard_sets'), payload)
    return { _id: ref.id, ...payload }
  },

  updateFlashcardSet: async (token: string, setId: string, data: any) => {
    const payload = {
      ...data,
      updatedAt: new Date().toISOString(),
    }
    await updateDoc(doc(db, 'flashcard_sets', setId), payload)
    return { _id: setId, ...payload }
  },

  deleteFlashcardSet: async (token: string, setId: string) => {
    await updateDoc(doc(db, 'flashcard_sets', setId), { isActive: false, updatedAt: new Date().toISOString() })
    return { success: true }
  },

  getPublicFlashcardSet: async (code: string, sessionKey?: string) => {
    let sourceCollection = 'flashcard_sets'
    let snap = await getDocs(query(collection(db, sourceCollection), where('accessCode', '==', code)))
    if (snap.empty) {
      sourceCollection = 'flashcardSets'
      snap = await getDocs(query(collection(db, sourceCollection), where('accessCode', '==', code)))
    }
    const found = snap.docs
      .map(d => ({ _id: d.id, ...d.data() } as any))
      .find(item => item.isActive !== false)
    if (!found) throw new Error('Bộ flashcard không tồn tại hoặc đã bị xóa.')

    let subject: any = null
    if (found.subjectId) {
      const subjectSnap = await getDoc(doc(db, 'subjects', found.subjectId))
      if (subjectSnap.exists()) subject = { _id: subjectSnap.id, ...subjectSnap.data() }
    }

    const progressMap: Record<number, any> = {}
    if (sessionKey) {
      const progressSnap = await getDocs(query(
        collection(db, 'flashcard_progress'),
        where('setId', '==', found._id),
        where('sessionKey', '==', sessionKey),
      ))
      progressSnap.docs.forEach(d => {
        const p: any = d.data()
        progressMap[Number(p.cardIndex)] = p
      })
    }

    const now = Date.now()
    const cards = (found.cards || []).map((card: any, index: number) => {
      const progress = progressMap[index] || null
      const nextReviewMs = progress?.nextReviewAt ? createdAtMs(progress.nextReviewAt) : 0
      return {
        ...card,
        index,
        progress,
        isDueToday: !progress || !nextReviewMs || nextReviewMs <= now,
      }
    })

    return {
      setId: found._id,
      title: found.title,
      description: found.description,
      subject,
      gradeLevel: found.gradeLevel,
      totalCards: cards.length,
      dueCount: cards.filter((card: any) => card.isDueToday).length,
      cards,
      matchingItems: Array.isArray(found.matchingItems) ? found.matchingItems : [],
    }
  },

  updateFlashcardProgress: async (code: string, data: any) => {
    let snap = await getDocs(query(collection(db, 'flashcard_sets'), where('accessCode', '==', code)))
    if (snap.empty) snap = await getDocs(query(collection(db, 'flashcardSets'), where('accessCode', '==', code)))
    const found = snap.docs
      .map(d => ({ _id: d.id, ...d.data() } as any))
      .find(item => item.isActive !== false)
    if (!found) throw new Error('Bộ flashcard không tồn tại.')

    const rating = Number(data.rating) as 0 | 1 | 2 | 3
    const cardIndex = Number(data.cardIndex)
    const sessionKey = String(data.sessionKey || '')
    if (!sessionKey) throw new Error('Thiếu phiên học.')

    const progressSnap = await getDocs(query(
      collection(db, 'flashcard_progress'),
      where('setId', '==', found._id),
      where('sessionKey', '==', sessionKey),
      where('cardIndex', '==', cardIndex),
    ))
    const existingDoc = progressSnap.docs[0]
    const existing: any = existingDoc?.data()

    let easeFactor = existing?.easeFactor ?? 2.5
    let interval = existing?.interval ?? 1
    let repetitions = existing?.repetitions ?? 0

    if (rating >= 3) {
      if (repetitions === 0) interval = 1
      else if (repetitions === 1) interval = 6
      else interval = Math.round(interval * easeFactor)
      repetitions++
    } else if (rating === 2) {
      interval = Math.max(1, Math.round(interval * 1.2))
      repetitions++
    } else {
      interval = 1
      repetitions = 0
    }

    easeFactor = Math.max(1.3, easeFactor + 0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02))
    const nextReviewAt = new Date()
    nextReviewAt.setDate(nextReviewAt.getDate() + interval)

    const payload = {
      setId: found._id,
      sessionKey,
      cardIndex,
      easeFactor,
      interval,
      repetitions,
      nextReviewAt: nextReviewAt.toISOString(),
      lastRating: rating,
      updatedAt: new Date().toISOString(),
    }

    if (existingDoc) await updateDoc(doc(db, 'flashcard_progress', existingDoc.id), payload)
    else await addDoc(collection(db, 'flashcard_progress'), payload)

    return { success: true, nextReviewAt: nextReviewAt.toISOString(), interval }
  }
}
