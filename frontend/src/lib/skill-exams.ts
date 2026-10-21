import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc,
  serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from './firebase'

export type SkillType = 'READING' | 'LISTENING' | 'WRITING' | 'QUIZ'

export type SkillQuestion = {
  id: string
  prompt: string
  points: number
  options?: string[]
  correctOption?: number
  requiresRecording?: boolean
}

export type SkillSection = {
  id: string
  skill: SkillType
  title: string
  instructions: string
  content?: string
  questions: SkillQuestion[]
}

export type SkillExamTemplate = {
  id: string
  ownerId: string
  title: string
  subject: string
  gradeLevel: number
  durationMinutes: number
  instructions: string
  inviteEmails: string[]
  sections: SkillSection[]
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
  accessCode: string
  createdAt?: any
  updatedAt?: any
}

export type SkillExamSubmission = {
  id?: string
  templateId: string
  accessCode: string
  ownerId: string
  student: { fullName: string; className: string; email: string }
  answers: Record<string, string | number>
  recordings: Record<string, { url: string; durationSeconds: number }>
  submittedAt?: any
}

const templateCol = collection(db, 'skillExamTemplates')

function randomCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

function mapTemplate(snapshot: any): SkillExamTemplate {
  return { id: snapshot.id, ...snapshot.data() } as SkillExamTemplate
}

export const skillExams = {
  async listMine(): Promise<SkillExamTemplate[]> {
    const ownerId = auth.currentUser?.uid
    if (!ownerId) throw new Error('Phiên đăng nhập đã hết hạn.')
    const snap = await getDocs(query(templateCol, where('ownerId', '==', ownerId)))
    return snap.docs.map(mapTemplate).sort((a, b) => {
      const toMs = (value: any) => value?.toDate?.().getTime?.() || 0
      return toMs(b.updatedAt) - toMs(a.updatedAt)
    })
  },

  async create(input: Omit<SkillExamTemplate, 'id' | 'ownerId' | 'accessCode' | 'status' | 'createdAt' | 'updatedAt'>) {
    const ownerId = auth.currentUser?.uid
    if (!ownerId) throw new Error('Phiên đăng nhập đã hết hạn.')
    const accessCode = randomCode()
    const templateRef = doc(db, 'skillExamTemplates', accessCode)
    await setDoc(templateRef, {
      ...input,
      ownerId,
      accessCode,
      status: 'DRAFT',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return templateRef.id
  },

  async update(id: string, input: Partial<SkillExamTemplate>) {
    await updateDoc(doc(db, 'skillExamTemplates', id), { ...input, updatedAt: serverTimestamp() })
  },

  async remove(id: string) {
    await deleteDoc(doc(db, 'skillExamTemplates', id))
  },

  async getById(id: string) {
    const snap = await getDoc(doc(db, 'skillExamTemplates', id))
    if (!snap.exists()) throw new Error('Không tìm thấy mẫu đề.')
    return mapTemplate(snap)
  },

  async getPublic(accessCode: string) {
    const snap = await getDoc(doc(db, 'skillExamTemplates', accessCode))
    if (!snap.exists() || snap.data().status !== 'PUBLISHED') throw new Error('Đề thi không tồn tại hoặc chưa được mở.')
    return mapTemplate(snap)
  },

  async submit(input: Omit<SkillExamSubmission, 'id' | 'submittedAt'>) {
    const ref = await addDoc(collection(db, 'skillExamSubmissions'), {
      ...input,
      submittedAt: serverTimestamp(),
    })
    return ref.id
  },

  async uploadRecording(ownerId: string, templateId: string, questionId: string, blob: Blob) {
    const name = `${Date.now()}-${crypto.randomUUID()}.webm`
    const objectRef = ref(storage, `skill-exam-recordings/${ownerId}/${templateId}/${questionId}/${name}`)
    await uploadBytes(objectRef, blob, { contentType: blob.type || 'audio/webm' })
    return getDownloadURL(objectRef)
  },
}
