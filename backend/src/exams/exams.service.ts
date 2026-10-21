import { scoreTrueFalse } from './scoring'
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import * as crypto from 'crypto'
import { Subject } from './schemas/subject.schema'
import { Question } from './schemas/question.schema'
import { Exam } from './schemas/exam.schema'
import { ExamVariant } from './schemas/exam-variant.schema'
import { ExamSession } from './schemas/exam-session.schema'
import { AnswerSheet } from './schemas/answer-sheet.schema'
import { ExamSessionLog } from './schemas/exam-session-log.schema'
import { Student } from './schemas/student.schema'
import { ExamResult } from './schemas/exam-result.schema'
import { QuizSet } from './schemas/quiz-set.schema'
import { QuizSession } from './schemas/quiz-session.schema'
import { QuizParticipant } from './schemas/quiz-participant.schema'
import { QuizAnswer } from './schemas/quiz-answer.schema'
import { PollSet, PollQuestionType } from './schemas/poll-set.schema'
import { PollSession } from './schemas/poll-session.schema'
import { PollParticipant } from './schemas/poll-participant.schema'
import { PollResponse } from './schemas/poll-response.schema'
import { SubmitExamDto } from './dtos/exam-analytics.dto'
import { ExamAiService } from './services/exam-ai.service'
import { PdfReportService } from './services/pdf-report.service'
import { FlashcardSet } from './schemas/flashcard-set.schema'
import { FlashcardProgress } from './schemas/flashcard-progress.schema'
import { LicensingService } from '../licensing/licensing.service'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Shuffle mảng (Fisher-Yates) — dùng seed để deterministic */
function shuffleArray<T>(arr: T[], seed: string): T[] {
  const a = [...arr]
  let hash = [...seed].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0)
  const rand = () => {
    hash ^= hash << 13
    hash ^= hash >> 17
    hash ^= hash << 5
    return (hash >>> 0) / 0xffffffff
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Tạo accessCode ngắn (8 ký tự, URL-safe) */
function genAccessCode(): string {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8)
}

function genQuizRoomCode(): string {
  return crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase()
}

function normalizePollQuestions(questions: any[]): any[] {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new BadRequestException('Bộ poll phải có ít nhất 1 câu hỏi')
  }

  return questions.map((item, idx) => {
    const prompt = String(item?.prompt || '').trim()
    const type = String(item?.type || '').trim() as PollQuestionType
    if (!prompt) throw new BadRequestException(`Câu hỏi #${idx + 1} không được để trống`)
    if (!['SINGLE_CHOICE', 'YES_NO', 'TEXT'].includes(type)) {
      throw new BadRequestException(`Loại câu hỏi #${idx + 1} không hợp lệ`)
    }

    if (type === 'TEXT') {
      return {
        prompt,
        type,
        options: [],
        durationSeconds: Math.max(5, Number(item?.durationSeconds || 20)),
        showResults: item?.showResults !== false,
      }
    }

    const options = type === 'YES_NO'
      ? [{ text: 'Có' }, { text: 'Không' }]
      : (Array.isArray(item?.options) ? item.options : [])
        .map((opt: any) => ({ text: String(opt?.text || '').trim() }))
        .filter((opt: any) => opt.text)

    if (options.length < 2) {
      throw new BadRequestException(`Câu hỏi #${idx + 1} cần ít nhất 2 lựa chọn`)
    }

    return {
      prompt,
      type,
      options,
      durationSeconds: Math.max(5, Number(item?.durationSeconds || 20)),
      showResults: item?.showResults !== false,
    }
  })
}

function getPollQuestionTiming(session: any, question: any) {
  const durationSeconds = Math.max(5, Number(question?.durationSeconds || 20))
  const startedAt = session?.questionStartedAt || session?.startedAt || session?.createdAt
  const endsAt = startedAt ? new Date(new Date(startedAt).getTime() + durationSeconds * 1000) : null
  const secondsLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 1000)) : 0
  const isQuestionClosed = session?.status !== 'LIVE' || secondsLeft <= 0
  return {
    durationSeconds,
    questionStartedAt: startedAt || null,
    questionEndsAt: endsAt,
    secondsLeft,
    isQuestionClosed,
  }
}

/** Tạo sheetCode cho phiếu trả lời */
function genSheetCode(examId: string, variantCode: number): string {
  const rand = crypto.randomBytes(4).toString('hex')
  return `${examId.slice(-6)}-${variantCode}-${rand}`
}

/**
 * Gán variantIndex cho học sinh — deterministic theo thông tin học sinh.
 * Cùng họ tên + lớp + trường → cùng mã đề.
 */
function pickVariantIndex(fullName: string, className: string, school: string, variantCount: number): number {
  const key = `${fullName.trim().toLowerCase()}|${className.trim()}|${school.trim()}`
  const hash = [...key].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0)
  return Math.abs(hash) % variantCount
}

/**
 * Chấm điểm TRUE_FALSE theo thang BGD 2025.
 * correct1/2/3/4 là số điểm khi đúng 1/2/3/4 mệnh đề.
 */

/**
 * Deadline thực tế của đề thi.
 * - Ưu tiên endTime nếu đã có
 * - Nếu chưa có endTime (dữ liệu cũ), tính từ activatedAt/startTime/updatedAt/createdAt + timeLimit
 */
function resolveEffectiveEndTime(exam: any): Date | null {
  if (exam?.endTime) return new Date(exam.endTime)
  const base = exam?.activatedAt || exam?.startTime || exam?.updatedAt || exam?.createdAt
  if (!base || !exam?.timeLimit) return null
  return new Date(new Date(base).getTime() + Number(exam.timeLimit) * 60 * 1000)
}

function formatVNDateTime(date?: Date | null): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
  }).format(date)
}

function resolveAcademicYear(date = new Date()): string {
  const year = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1
  return `${year}-${year + 1}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getExamTypeColumnLabel(exam: any): string {
  if (!exam) return 'Khác'
  if (exam.examType === 'GK') return exam.semester === 2 ? 'Giữa HK2' : 'Giữa HK1'
  if (exam.examType === 'CK') return exam.semester === 2 ? 'HK2' : 'HK1'
  if (exam.examType === 'TN_THPT') return 'TN THPT'
  if (exam.examType === 'PRACTICE') return 'Luyện tập'
  if (exam.examType === 'CUSTOM') return (exam.title || 'Custom').trim()
  return (exam.title || exam.examType || 'Khác').trim()
}

function getExamColumnSortWeight(label: string): number {
  const order = ['Giữa HK1', 'HK1', 'Giữa HK2', 'HK2', 'TN THPT', 'Luyện tập']
  const idx = order.indexOf(label)
  return idx >= 0 ? idx : order.length + 1
}

function getSelectedExamColumnLabel(examType?: string, customExamLabel?: string): string {
  switch (examType) {
    case 'MIDTERM_1': return 'Giữa HK1'
    case 'FINAL_1': return 'HK1'
    case 'MIDTERM_2': return 'Giữa HK2'
    case 'FINAL_2': return 'HK2'
    case 'TN_THPT': return 'TN THPT'
    case 'PRACTICE': return 'Luyện tập'
    case 'CUSTOM': return (customExamLabel || 'Custom').trim()
    default: return ''
  }
}

function withOrgScope(query: any, organizationId?: string) {
  if (!organizationId) return query
  const org = new Types.ObjectId(organizationId)
  query.$or = [
    { organizationId: org },
    { organizationId: { $exists: false } },
    { organizationId: null },
  ]
  return query
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ExamsService {
  constructor(
    @InjectModel(Subject.name, 'mgmt') private subjectModel: Model<Subject>,
    @InjectModel(Question.name, 'mgmt') private questionModel: Model<Question>,
    @InjectModel(Exam.name, 'mgmt') private examModel: Model<Exam>,
    @InjectModel(ExamVariant.name, 'mgmt') private variantModel: Model<ExamVariant>,
    @InjectModel(ExamSession.name, 'mgmt') private sessionModel: Model<ExamSession>,
    @InjectModel(AnswerSheet.name, 'mgmt') private sheetModel: Model<AnswerSheet>,
    @InjectModel(ExamSessionLog.name, 'mgmt') private sessionLogModel: Model<ExamSessionLog>,
    @InjectModel(Student.name, 'mgmt') private studentModel: Model<Student>,
    @InjectModel(ExamResult.name, 'mgmt') private examResultModel: Model<ExamResult>,
    @InjectModel(QuizSet.name, 'mgmt') private quizSetModel: Model<QuizSet>,
    @InjectModel(QuizSession.name, 'mgmt') private quizSessionModel: Model<QuizSession>,
    @InjectModel(QuizParticipant.name, 'mgmt') private quizParticipantModel: Model<QuizParticipant>,
    @InjectModel(QuizAnswer.name, 'mgmt') private quizAnswerModel: Model<QuizAnswer>,
    @InjectModel(PollSet.name, 'mgmt') private pollSetModel: Model<PollSet>,
    @InjectModel(PollSession.name, 'mgmt') private pollSessionModel: Model<PollSession>,
    @InjectModel(PollParticipant.name, 'mgmt') private pollParticipantModel: Model<PollParticipant>,
    @InjectModel(PollResponse.name, 'mgmt') private pollResponseModel: Model<PollResponse>,
    @InjectModel(FlashcardSet.name, 'mgmt') private flashcardSetModel: Model<FlashcardSet>,
    @InjectModel(FlashcardProgress.name, 'mgmt') private flashcardProgressModel: Model<FlashcardProgress>,
    private aiSvc: ExamAiService,
    private pdfReportSvc: PdfReportService,
    private licensingService: LicensingService,
  ) { }

  // ══════════════════════════════════════════════════════
  //  SUBJECTS
  // ══════════════════════════════════════════════════════

  async getSubjects(organizationId?: string) {
    const query: any = { isActive: true }
    withOrgScope(query, organizationId)
    return this.subjectModel.find(query).sort({ name: 1 }).lean()
  }

  async createSubject(data: any, organizationId?: string) {
    return this.subjectModel.create({ ...data, organizationId: organizationId ? new Types.ObjectId(organizationId) : undefined })
  }

  async updateSubject(id: string, data: any, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(id) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const doc = await this.subjectModel.findOneAndUpdate(query, data, { new: true })
    if (!doc) throw new NotFoundException('Subject not found or access denied')
    return doc
  }

  // ══════════════════════════════════════════════════════
  //  STUDENTS & RESULTS MANAGEMENT (THEO NĂM HỌC)
  // ══════════════════════════════════════════════════════

  async getStudents(filter: {
    academicYear?: string
    className?: string
    school?: string
    keyword?: string
    examType?: string
    customExamLabel?: string
    page?: number
    limit?: number
  }, organizationId?: string) {
    const { page = 1, limit = 50, ...rest } = filter
    const query: any = {}
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    if (rest.academicYear) query.academicYear = rest.academicYear
    if (rest.className) query.className = rest.className
    if (rest.school) query.school = rest.school
    if (rest.keyword) query.fullName = { $regex: rest.keyword, $options: 'i' }

    const examIds = await this.findExamIdsByType(rest.examType, rest.customExamLabel, organizationId)

    const [total, items, academicYears, classNames, schools] = await Promise.all([
      this.studentModel.countDocuments(query),
      this.studentModel
        .find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ academicYear: -1, className: 1, fullName: 1 })
        .lean(),
      this.studentModel.distinct('academicYear'),
      this.studentModel.distinct('className'),
      this.studentModel.distinct('school'),
    ])

    const studentIds = items.map((item: any) => item._id).filter(Boolean)
    const scoresByStudent: Record<string, Record<string, any>> = {}
    const scoreColumnsSet = new Set<string>()

    if (studentIds.length > 0) {
      const resultQuery: any = { studentId: { $in: studentIds } }
      if (rest.academicYear) resultQuery.academicYear = rest.academicYear
      if (examIds) resultQuery.examId = { $in: examIds }

      const results = await this.examResultModel
        .find(resultQuery)
        .populate('examId', 'title examType semester schoolYear')
        .sort({ submittedAt: -1 })
        .lean()

      for (const result of results as any[]) {
        const studentId = String(result.studentId)
        const exam = typeof result.examId === 'string' ? null : result.examId
        const column = getExamTypeColumnLabel(exam)

        scoreColumnsSet.add(column)
        if (!scoresByStudent[studentId]) scoresByStudent[studentId] = {}
        if (scoresByStudent[studentId][column]) continue

        scoresByStudent[studentId][column] = {
          resultId: String(result._id),
          score: result.score,
          percentage: result.percentage,
          examTitle: exam?.title || column,
          submittedAt: result.submittedAt,
          examType: exam?.examType,
          semester: exam?.semester,
        }
      }
    }

    const selectedColumn = getSelectedExamColumnLabel(rest.examType, rest.customExamLabel)
    if (selectedColumn) scoreColumnsSet.add(selectedColumn)

    const scoreColumns = Array.from(scoreColumnsSet).sort((a, b) => {
      const weightDiff = getExamColumnSortWeight(a) - getExamColumnSortWeight(b)
      return weightDiff !== 0 ? weightDiff : a.localeCompare(b, 'vi')
    })

    return {
      total,
      page,
      limit,
      items: items.map((item: any) => ({
        ...item,
        scoresByExamType: scoresByStudent[String(item._id)] || {},
      })),
      scoreColumns,
      filterOptions: {
        academicYears: academicYears.sort((a: string, b: string) => b.localeCompare(a, 'vi')),
        classNames: classNames.sort((a: string, b: string) => a.localeCompare(b, 'vi', { numeric: true })),
        schools: schools.sort((a: string, b: string) => a.localeCompare(b, 'vi')),
      },
    }
  }

  async createStudent(data: { fullName: string; className: string; academicYear: string; school?: string }, organizationId?: string) {
    return this.studentModel.create({
      fullName: data.fullName.trim(),
      className: data.className.trim(),
      academicYear: data.academicYear.trim(),
      school: (data.school || 'GDTX Lê Quí Đôn').trim(),
      organizationId: organizationId ? new Types.ObjectId(organizationId) : undefined,
    })
  }

  async updateStudent(id: string, data: any, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(id) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const doc = await this.studentModel.findOneAndUpdate(query, data, { new: true })
    if (!doc) throw new NotFoundException('Student not found or access denied')
    return doc
  }

  async getStudentResults(studentId: string, filter: { academicYear?: string; examId?: string; page?: number; limit?: number }, organizationId?: string) {
    const { page = 1, limit = 50, ...rest } = filter
    if (!Types.ObjectId.isValid(studentId)) {
      throw new BadRequestException('Mã học sinh không hợp lệ')
    }

    const query: any = { studentId: new Types.ObjectId(studentId) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    if (rest.academicYear) query.academicYear = rest.academicYear
    if (rest.examId) {
      if (!Types.ObjectId.isValid(rest.examId)) {
        throw new BadRequestException('Mã bài thi không hợp lệ')
      }
      query.examId = new Types.ObjectId(rest.examId)
    }

    const [total, items] = await Promise.all([
      this.examResultModel.countDocuments(query),
      this.examResultModel
        .find(query)
        .populate('examId', 'title gradeLevel examType semester schoolYear')
        .sort({ submittedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ])
    return { total, page, limit, items }
  }

  async getResultReport(filter: { academicYear?: string; className?: string; school?: string; examId?: string; examType?: string; customExamLabel?: string }) {
    const query: any = {}
    if (filter.academicYear) query.academicYear = filter.academicYear
    if (filter.className) query.className = filter.className
    if (filter.school) query.school = filter.school
    if (filter.examId) {
      if (!Types.ObjectId.isValid(filter.examId)) {
        throw new BadRequestException('Mã bài thi không hợp lệ')
      }
      query.examId = new Types.ObjectId(filter.examId)
    }

    if (!filter.examId && filter.examType) {
      const examIds = await this.findExamIdsByType(filter.examType, filter.customExamLabel)
      query.examId = { $in: examIds }
    }

    const [totalResults, topResults, stats] = await Promise.all([
      this.examResultModel.countDocuments(query),
      this.examResultModel
        .find(query)
        .select('fullName className academicYear school score percentage submittedAt examId')
        .populate('examId', 'title')
        .sort({ score: -1, submittedAt: 1 })
        .limit(20)
        .lean(),
      this.examResultModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            avgScore: { $avg: '$score' },
            maxScore: { $max: '$score' },
            minScore: { $min: '$score' },
            passCount: {
              $sum: {
                $cond: [{ $gte: ['$score', 5] }, 1, 0],
              },
            },
          },
        },
      ]),
    ])

    const stat = stats[0] || { avgScore: 0, maxScore: 0, minScore: 0, passCount: 0 }
    return {
      totalResults,
      avgScore: Math.round((stat.avgScore || 0) * 100) / 100,
      maxScore: stat.maxScore || 0,
      minScore: stat.minScore || 0,
      passRate: totalResults > 0 ? Math.round((stat.passCount / totalResults) * 10000) / 100 : 0,
      topResults,
    }
  }

  private async findExamIdsByType(examType?: string, customExamLabel?: string, organizationId?: string) {
    if (!examType) return null

    const query: any = {}
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    switch (examType) {
      case 'MIDTERM_1':
        query.examType = 'GK'
        query.semester = 1
        break
      case 'FINAL_1':
        query.examType = 'CK'
        query.semester = 1
        break
      case 'MIDTERM_2':
        query.examType = 'GK'
        query.semester = 2
        break
      case 'FINAL_2':
        query.examType = 'CK'
        query.semester = 2
        break
      case 'PRACTICE':
        query.examType = 'PRACTICE'
        break
      case 'TN_THPT':
        query.examType = 'TN_THPT'
        break
      case 'CUSTOM':
        query.examType = 'CUSTOM'
        if (customExamLabel?.trim()) {
          query.title = { $regex: escapeRegExp(customExamLabel.trim()), $options: 'i' }
        }
        break
      default:
        return null
    }

    const exams = await this.examModel.find(query).select('_id').lean()
    return exams.map((exam: any) => exam._id)
  }

  // ══════════════════════════════════════════════════════
  //  QUESTION BANK
  // ══════════════════════════════════════════════════════

  async getQuestions(filter: {
    subjectId?: string
    gradeLevel?: number
    type?: string
    difficulty?: string
    chapter?: string
    tags?: string[]
    page?: number
    limit?: number
  }, organizationId?: string) {
    const { page = 1, limit = 50, ...rest } = filter
    const query: any = { isActive: true }
    withOrgScope(query, organizationId)
    if (rest.subjectId) query.subjectId = new Types.ObjectId(rest.subjectId)
    if (rest.gradeLevel) query.gradeLevel = rest.gradeLevel
    if (rest.type) query.type = rest.type
    if (rest.difficulty) query.difficulty = rest.difficulty
    if (rest.chapter) query.chapter = { $regex: rest.chapter, $options: 'i' }
    if (rest.tags?.length) query.tags = { $in: rest.tags }

    const [total, items] = await Promise.all([
      this.questionModel.countDocuments(query),
      this.questionModel
        .find(query)
        .populate('subjectId', 'name code')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
    ])
    return { total, page, limit, items }
  }

  async createQuestion(data: any, createdBy?: string, organizationId?: string) {
    return this.questionModel.create({
      ...data,
      createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
      organizationId: organizationId ? new Types.ObjectId(organizationId) : undefined
    })
  }

  async updateQuestion(id: string, data: any, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(id) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const doc = await this.questionModel.findOneAndUpdate(query, data, { new: true })
    if (!doc) throw new NotFoundException('Question not found or access denied')
    return doc
  }

  async deleteQuestion(id: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(id) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const doc = await this.questionModel.findOneAndUpdate(query, { isActive: false })
    if (!doc) throw new NotFoundException('Question not found or access denied')
  }

  /** Bulk import câu hỏi từ file JSON */
  async importQuestions(
    rows: any[],
    defaultSubjectId: string,
    defaultGradeLevel: number,
    createdBy?: string,
    organizationId?: string,
  ): Promise<{ imported: number; skipped: number; ids: { part1: string[]; part2: string[]; part3: string[] } }> {
    const valid = rows.filter(r => r.content?.trim() && r.type)
    const skipped = rows.length - valid.length
    const docs = valid.map(r => ({
      type: r.type,
      content: r.content,
      gradeLevel: r.gradeLevel || defaultGradeLevel,
      subjectId: r.subjectId
        ? new Types.ObjectId(r.subjectId)
        : new Types.ObjectId(defaultSubjectId),
      difficulty: r.difficulty || 'NHAN_BIET',
      chapter: r.chapter || undefined,
      topic: r.topic || undefined,
      tags: r.tags || [],
      options: r.options || undefined,
      correctAnswer: r.correctAnswer || undefined,
      statements: r.statements || undefined,
      shortAnswer: r.shortAnswer || undefined,
      isActive: true,
      usageCount: 0,
      createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
      organizationId: organizationId ? new Types.ObjectId(organizationId) : undefined,
    }))
    const result = await this.questionModel.insertMany(docs, { ordered: false }).catch((e: any) => {
      if (e.code === 11000) return e.insertedDocs || []
      throw e
    })
    const inserted: any[] = Array.isArray(result) ? result : []
    const ids = { part1: [] as string[], part2: [] as string[], part3: [] as string[] }
    for (const doc of inserted) {
      if (doc.type === 'MULTIPLE_CHOICE') ids.part1.push(doc._id.toString())
      else if (doc.type === 'TRUE_FALSE') ids.part2.push(doc._id.toString())
      else if (doc.type === 'SHORT_ANSWER') ids.part3.push(doc._id.toString())
    }
    return { imported: inserted.length, skipped, ids }
  }

  /** Lấy câu hỏi ngẫu nhiên theo tiêu chí — dùng khi tạo đề thi tự động */
  async sampleQuestions(subjectId: string, gradeLevel: number, type: string, count: number, difficultyMap?: Record<string, number>, organizationId?: string): Promise<any[]> {
    const baseMatch: any = { subjectId: new Types.ObjectId(subjectId), gradeLevel, type, isActive: true }
    if (organizationId) baseMatch.organizationId = new Types.ObjectId(organizationId)

    if (!difficultyMap) {
      return this.questionModel
        .aggregate([
          { $match: baseMatch },
          { $sample: { size: count } },
        ])
        .exec()
    }
    const results: any[] = []
    for (const [difficulty, n] of Object.entries(difficultyMap)) {
      const batch = await this.questionModel
        .aggregate([
          { $match: { ...baseMatch, difficulty } },
          { $sample: { size: n } },
        ])
        .exec()
      results.push(...batch)
    }
    return results
  }

  // ══════════════════════════════════════════════════════
  //  EXAMS (tạo & quản lý bài thi)
  // ══════════════════════════════════════════════════════

  async getExams(filter: { subjectId?: string; gradeLevel?: number; status?: string; page?: number; limit?: number }, organizationId?: string) {
    const { page = 1, limit = 20, ...rest } = filter
    const query: any = {}
    withOrgScope(query, organizationId)
    if (rest.subjectId) query.subjectId = new Types.ObjectId(rest.subjectId)
    if (rest.gradeLevel) query.gradeLevel = rest.gradeLevel
    if (rest.status) query.status = rest.status

    const [total, items] = await Promise.all([
      this.examModel.countDocuments(query),
      this.examModel
        .find(query)
        .populate('subjectId', 'name code color')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
    ])
    return { total, page, limit, items }
  }

  async getExamById(id: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(id) }
    withOrgScope(query, organizationId)
    const exam = await this.examModel.findOne(query).populate('subjectId', 'name code color').lean()
    if (!exam) throw new NotFoundException('Bài thi không tồn tại')
    return exam
  }

  /** Lấy danh sách câu hỏi được gán cho một bài thi (dùng để preview trước khi publish) */
  async getExamQuestions(id: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(id) }
    withOrgScope(query, organizationId)
    const exam = await this.examModel.findOne(query).lean()
    if (!exam) throw new NotFoundException('Bài thi không tồn tại')
    const [part1, part2, part3] = await Promise.all([
      this.questionModel.find({ _id: { $in: (exam as any).part1Questions || [] } }).lean(),
      this.questionModel.find({ _id: { $in: (exam as any).part2Questions || [] } }).lean(),
      this.questionModel.find({ _id: { $in: (exam as any).part3Questions || [] } }).lean(),
    ])
    return {
      total: part1.length + part2.length + part3.length,
      part1,
      part2,
      part3,
    }
  }

  async createExam(data: any, createdBy?: string, organizationId?: string) {
    // Cấu hình mặc định BGD 2025
    const defaultStructure = {
      part1Count: 18, part1ScorePerQ: 0.25,
      part1Difficulty: { NHAN_BIET: 6, THONG_HIEU: 6, VAN_DUNG: 4, VAN_DUNG_CAO: 2 },
      part2Count: 4,
      part2Scoring: { correct1: 0, correct2: 0.25, correct3: 0.5, correct4: 1.0 },
      part3Count: 6, part3ScorePerQ: 0.25,
    }
    return this.examModel.create({
      ...data,
      structure: { ...defaultStructure, ...(data.structure || {}) },
      defaultSchool: data.defaultSchool || 'GDTX Lê Quí Đôn',
      createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
      organizationId: organizationId ? new Types.ObjectId(organizationId) : undefined,
    })
  }

  async updateExam(id: string, data: any, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(id) }
    withOrgScope(query, organizationId)
    const doc = await this.examModel.findOneAndUpdate(query, data, { new: true })
    if (!doc) throw new NotFoundException('Exam not found or access denied')
    return doc
  }

  async deleteExam(id: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(id) }
    withOrgScope(query, organizationId)
    const doc = await this.examModel.findOneAndDelete(query)
    if (!doc) throw new NotFoundException('Exam not found or access denied')
    await this.variantModel.deleteMany({ examId: new Types.ObjectId(id) })
  }

  /**
   * Publish exam: tạo accessCode, QR code và sinh các ExamVariant.
   * Nếu chưa gán câu hỏi thủ công, tự động lấy từ ngân hàng theo cấu trúc đề.
   * Sau bước này học sinh có thể truy cập qua link/QR.
   */
  async publishExam(id: string, organizationId?: string): Promise<{ accessCode: string; qrUrl: string; variants: any[]; autoSampled?: boolean }> {
    const query: any = { _id: new Types.ObjectId(id) }
    withOrgScope(query, organizationId)
    const exam = await this.examModel.findOne(query)
    if (!exam) throw new NotFoundException('Bài thi không tồn tại')

    const accessCode = exam.accessCode || genAccessCode()
    const structure = (exam.structure || {}) as any
    const subjectId = (exam.subjectId as any)?.toString()
    const gradeLevel = exam.gradeLevel

    // Lấy câu hỏi đã gán thủ công
    let [p1, p2, p3] = await Promise.all([
      this.questionModel.find({ _id: { $in: (exam as any).part1Questions || [] } }).lean(),
      this.questionModel.find({ _id: { $in: (exam as any).part2Questions || [] } }).lean(),
      this.questionModel.find({ _id: { $in: (exam as any).part3Questions || [] } }).lean(),
    ])

    // Nếu chưa có câu nào → tự động lấy từ ngân hàng
    let autoSampled = false
    if (p1.length === 0 && subjectId) {
      p1 = await this.sampleQuestions(
        subjectId, gradeLevel, 'MULTIPLE_CHOICE',
        structure.part1Count || 18,
        structure.part1Difficulty,
        organizationId,
      )
      autoSampled = true
    }
    if (p2.length === 0 && subjectId) {
      p2 = await this.sampleQuestions(
        subjectId, gradeLevel, 'TRUE_FALSE',
        structure.part2Count || 4,
        undefined,
        organizationId,
      )
      autoSampled = true
    }
    if (p3.length === 0 && subjectId) {
      p3 = await this.sampleQuestions(
        subjectId, gradeLevel, 'SHORT_ANSWER',
        structure.part3Count || 6,
        undefined,
        organizationId,
      )
      autoSampled = true
    }

    if (p1.length === 0 && p2.length === 0 && p3.length === 0) {
      throw new BadRequestException(
        'Ngân hàng câu hỏi chưa có câu nào cho môn/khối này. Hãy import hoặc thêm câu hỏi trước khi publish.'
      )
    }

    // Xóa variants cũ trước khi tạo mới
    await this.variantModel.deleteMany({ examId: exam._id })

    const variants: any[] = []
    for (let i = 0; i < (exam.variantCount || 4); i++) {
      const seed = `${id}-variant-${i}`
      const variantCode = 100 + i + 1 // 101, 102, 103, 104

      // Trộn thứ tự câu hỏi
      const part1Order = shuffleArray(p1.map((q: any) => q._id), seed + '-p1')
      const part2Order = shuffleArray(p2.map((q: any) => q._id), seed + '-p2')
      const part3Order = shuffleArray(p3.map((q: any) => q._id), seed + '-p3')

      // Giữ nguyên thứ tự A/B/C/D — chỉ đảo thứ tự câu hỏi giữa các mã đề
      const optionShuffleMap: Record<string, string[]> = {}
      const answerKeyPart1: Record<string, string> = {}
      for (const q of p1 as any[]) {
        optionShuffleMap[q._id.toString()] = ['A', 'B', 'C', 'D']
        answerKeyPart1[q._id.toString()] = q.correctAnswer
      }

      // Đáp án Phần II và III không thay đổi vì không trộn
      const answerKeyPart2: Record<string, boolean[]> = {}
      for (const q of p2 as any[]) {
        answerKeyPart2[q._id.toString()] = (q.statements || []).map((s: any) => s.answer)
      }
      const answerKeyPart3: Record<string, string> = {}
      for (const q of p3 as any[]) {
        answerKeyPart3[q._id.toString()] = q.shortAnswer || ''
      }

      const variant = await this.variantModel.create({
        examId: exam._id,
        variantCode,
        part1Order, part2Order, part3Order,
        optionShuffleMap,
        answerKey: { part1: answerKeyPart1, part2: answerKeyPart2, part3: answerKeyPart3 },
      })
      variants.push(variant)
    }

    // Cập nhật exam: lưu question IDs và đánh dấu active
    const activatedAt = new Date()
    const examDoc = await this.examModel.findById(id).lean()
    // Tự tính endTime từ lúc publish nếu admin chưa set thủ công
    const autoEndTime = examDoc?.endTime ? undefined : new Date(activatedAt.getTime() + (examDoc?.timeLimit ?? 90) * 60 * 1000)
    await this.examModel.findByIdAndUpdate(id, {
      accessCode,
      status: 'ACTIVE',
      activatedAt,
      ...(autoEndTime && { endTime: autoEndTime }),
      ...(autoSampled && {
        part1Questions: p1.map((q: any) => q._id),
        part2Questions: p2.map((q: any) => q._id),
        part3Questions: p3.map((q: any) => q._id),
      }),
    })

    return { accessCode, qrUrl: `/e/${accessCode}`, variants, autoSampled }
  }

  /** Lấy thông tin đề thi public (dùng cho trang học sinh) */
  async getPublicExam(accessCode: string) {
    const exam = await this.examModel
      .findOne({ accessCode })
      .populate('subjectId', 'name code')
      .lean()
    if (!exam) throw new NotFoundException('Đề thi không tồn tại')

    const effectiveEndTime = resolveEffectiveEndTime(exam)
    if (exam.status !== 'ACTIVE') {
      if (exam.status === 'CLOSED') {
        const timeText = formatVNDateTime(effectiveEndTime)
        throw new BadRequestException(timeText ? `Đề thi đã kết thúc lúc ${timeText}` : 'Đề thi đã kết thúc')
      }
      throw new BadRequestException('Đề thi chưa được phát hành')
    }

    // Kiểm tra thời gian
    const now = new Date()
    if (exam.startTime && now < exam.startTime) throw new BadRequestException('Đề thi chưa bắt đầu')
    if (effectiveEndTime && now > effectiveEndTime) {
      await this.examModel.findByIdAndUpdate(exam._id, {
        status: 'CLOSED',
        ...(exam.endTime ? {} : { endTime: effectiveEndTime }),
      })
      const timeText = formatVNDateTime(effectiveEndTime)
      throw new BadRequestException(timeText ? `Đề thi đã kết thúc lúc ${timeText}` : 'Đề thi đã kết thúc')
    }

    // Lấy số câu thực từ variant đầu tiên
    const variant = await this.variantModel.findOne({ examId: exam._id }).lean()
    const actualCounts = {
      part1Count: variant?.part1Order?.length ?? (exam.structure as any)?.part1Count ?? 0,
      part2Count: variant?.part2Order?.length ?? (exam.structure as any)?.part2Count ?? 0,
      part3Count: variant?.part3Order?.length ?? (exam.structure as any)?.part3Count ?? 0,
    }

    const timeLeftSeconds = effectiveEndTime
      ? Math.max(0, Math.floor((new Date(effectiveEndTime).getTime() - Date.now()) / 1000))
      : exam.timeLimit * 60

    return {
      id: exam._id,
      title: exam.title,
      subject: exam.subjectId,
      gradeLevel: exam.gradeLevel,
      timeLimit: exam.timeLimit,
      timeLeftSeconds,
      structure: { ...(exam.structure as any), ...actualCounts },
      defaultSchool: exam.defaultSchool,
      startTime: exam.startTime,
      endTime: effectiveEndTime || exam.endTime,
      activatedAt: (exam as any).activatedAt,
    }
  }

  // ══════════════════════════════════════════════════════
  //  EXAM SESSIONS (học sinh bắt đầu & nộp bài)
  // ══════════════════════════════════════════════════════

  /**
   * Bắt đầu phiên thi — gán variant, trả về câu hỏi đã trộn.
   * Deterministic: cùng học sinh + cùng đề → cùng mã đề.
   * Chặn nếu học sinh đã nộp bài (SUBMITTED) cho đề này rồi.
   */
  async startSession(
    accessCode: string,
    studentInfo: { fullName: string; className: string; school: string; academicYear?: string },
    deviceFingerprint?: string,
    ipAddress?: string,
  ) {
    const exam = await this.examModel.findOne({ accessCode }).lean()
    if (!exam) throw new NotFoundException('Đề thi không tồn tại')

    const effectiveEndTime = resolveEffectiveEndTime(exam)
    if (exam.status !== 'ACTIVE') {
      if (exam.status === 'CLOSED') {
        const timeText = formatVNDateTime(effectiveEndTime)
        throw new BadRequestException(timeText ? `Đề thi đã kết thúc lúc ${timeText}` : 'Đề thi đã kết thúc')
      }
      throw new BadRequestException('Đề thi chưa được phát hành')
    }

    // Kiểm tra đã nộp bài chưa — theo tên+lớp
    const existing = await this.sessionModel.findOne({
      examId: exam._id,
      'studentInfo.fullName': studentInfo.fullName,
      'studentInfo.className': studentInfo.className,
      status: 'SUBMITTED',
    }).lean()
    if (existing) {
      throw new BadRequestException(
        `Bạn đã nộp bài đề thi này rồi (điểm: ${(existing as any).score ?? '?'}/10). Không thể thi lại.`
      )
    }

    // Kiểm tra theo thiết bị (deviceFingerprint)
    if (deviceFingerprint) {
      const deviceExisting = await this.sessionModel.findOne({
        examId: exam._id,
        deviceFingerprint,
        status: 'SUBMITTED',
      }).lean()
      if (deviceExisting) {
        throw new BadRequestException(
          `Thiết bị này đã được dùng để nộp bài đề thi (điểm: ${(deviceExisting as any).score ?? '?'}/10). Không thể thi lại.`
        )
      }
    }

    const now = new Date()
    if (exam.startTime && now < exam.startTime) throw new BadRequestException('Đề thi chưa bắt đầu')
    if (effectiveEndTime && now > effectiveEndTime) {
      await this.examModel.findByIdAndUpdate(exam._id, {
        status: 'CLOSED',
        ...(exam.endTime ? {} : { endTime: effectiveEndTime }),
      })
      const timeText = formatVNDateTime(effectiveEndTime)
      throw new BadRequestException(timeText ? `Đề thi đã kết thúc lúc ${timeText}` : 'Đề thi đã kết thúc')
    }

    const effectiveStudentInfo = {
      ...studentInfo,
      school: studentInfo.school || (exam as any).defaultSchool || 'GDTX Lê Quí Đôn',
      academicYear: studentInfo.academicYear || exam.schoolYear || resolveAcademicYear(exam.startTime || new Date()),
    }

    // Gán variant theo thông tin học sinh
    const variantIndex = pickVariantIndex(
      effectiveStudentInfo.fullName,
      effectiveStudentInfo.className,
      effectiveStudentInfo.school,
      exam.variantCount || 4,
    )
    const variantCode = 100 + variantIndex + 1

    const variant = await this.variantModel.findOne({ examId: exam._id, variantCode }).lean()
    if (!variant) throw new NotFoundException('Không tìm thấy mã đề, vui lòng thử lại')

    // Tạo session
    const session = await this.sessionModel.create({
      examId: exam._id,
      variantId: variant._id,
      variantCode,
      studentInfo: effectiveStudentInfo,
      deviceFingerprint,
      ipAddress,
      mode: 'ONLINE',
      startedAt: new Date(),
      status: 'IN_PROGRESS',
    })

    // Tăng sessionCount
    await this.examModel.findByIdAndUpdate(exam._id, { $inc: { sessionCount: 1 } })

    // Lấy câu hỏi theo thứ tự đã trộn (KHÔNG gửi đáp án)
    const [p1, p2, p3] = await Promise.all([
      this.questionModel.find({ _id: { $in: variant.part1Order } }).select('-correctAnswer -statements.answer -shortAnswer').lean(),
      this.questionModel.find({ _id: { $in: variant.part2Order } }).select('-statements.answer').lean(),
      this.questionModel.find({ _id: { $in: variant.part3Order } }).select('-shortAnswer').lean(),
    ])

    // Sắp xếp lại theo thứ tự đã trộn
    const sortById = (arr: any[], order: any[]) =>
      order.map((id) => arr.find((q) => q._id.toString() === id.toString())).filter(Boolean)

    // Trộn đáp án theo optionShuffleMap
    const applyOptionShuffle = (questions: any[]) =>
      questions.map((q) => {
        const shuffled = variant.optionShuffleMap[q._id.toString()]
        if (!shuffled || !q.options) return q
        return { ...q, options: shuffled.map((key: string) => q.options.find((o: any) => o.key === key)).filter(Boolean) }
      })

    const timeLeftSeconds = effectiveEndTime
      ? Math.max(0, Math.floor((new Date(effectiveEndTime).getTime() - Date.now()) / 1000))
      : exam.timeLimit * 60

    if (timeLeftSeconds <= 0) throw new BadRequestException('Thời gian làm bài đã hết, đề thi đã kết thúc.')

    return {
      sessionId: session._id,
      variantCode,
      timeLeftSeconds,
      exam: { title: exam.title, timeLimit: exam.timeLimit, structure: exam.structure },
      questions: {
        part1: applyOptionShuffle(sortById(p1, variant.part1Order)),
        part2: sortById(p2, variant.part2Order),
        part3: sortById(p3, variant.part3Order),
      },
    }
  }

  /** Nộp bài — chấm điểm tự động */
  async submitSession(sessionId: string, answers: { part1: Record<string, string>; part2: Record<string, boolean[]>; part3: Record<string, string> }) {
    const session = await this.sessionModel.findById(sessionId)
    if (!session) throw new NotFoundException('Phiên thi không tồn tại')
    if (session.status !== 'IN_PROGRESS') throw new BadRequestException('Phiên thi đã kết thúc')

    const variant = await this.variantModel.findById(session.variantId).lean()
    if (!variant) throw new NotFoundException('Không tìm thấy mã đề')

    const exam = await this.examModel.findById(session.examId).lean()
    const scoring = (exam?.structure as any)?.part2Scoring || { correct1: 0, correct2: 0.25, correct3: 0.5, correct4: 1.0 }

    // ── Chấm Phần I ──────────────────────────────────────
    const key1 = variant.answerKey?.part1 || {}
    let p1Score = 0, p1Correct = 0
    for (const [qid, ans] of Object.entries(answers.part1 || {})) {
      if (key1[qid] === ans) { p1Score += (exam?.structure as any)?.part1ScorePerQ || 0.25; p1Correct++ }
    }

    // ── Chấm Phần II ─────────────────────────────────────
    const key2 = variant.answerKey?.part2 || {}
    let p2Score = 0, p2Full = 0, p2Partial = 0
    for (const [qid, studentBools] of Object.entries(answers.part2 || {})) {
      const correctBools = key2[qid]
      if (!correctBools) continue
      const s = scoreTrueFalse(studentBools, correctBools, scoring)
      p2Score += s
      const correctCount = studentBools.filter((a, i) => a === correctBools[i]).length
      if (correctCount === 4) p2Full++
      else if (correctCount >= 2) p2Partial++
    }

    // ── Chấm Phần III ────────────────────────────────────
    const key3 = variant.answerKey?.part3 || {}
    let p3Score = 0, p3Correct = 0
    for (const [qid, ans] of Object.entries(answers.part3 || {})) {
      const expected = key3[qid]
      if (!expected) continue
      const tolerance = 0 // TODO: lấy từ Question.shortAnswerTolerance
      const numAns = parseFloat(ans), numExp = parseFloat(expected)
      const match = !isNaN(numAns) && !isNaN(numExp)
        ? Math.abs(numAns - numExp) <= tolerance
        : ans.trim().toLowerCase() === expected.trim().toLowerCase()
      if (match) { p3Score += (exam?.structure as any)?.part3ScorePerQ || 0.25; p3Correct++ }
    }

    const totalScore = Math.round((p1Score + p2Score + p3Score) * 100) / 100
    const timeSpent = Math.round((Date.now() - session.startedAt.getTime()) / 1000)
    const totalQuestions = Object.keys(key1).length + Object.keys(key2).length + Object.keys(key3).length
    const answeredCount = Object.keys(answers.part1 || {}).length + Object.keys(answers.part2 || {}).length + Object.keys(answers.part3 || {}).length
    const unansweredCount = Math.max(0, totalQuestions - answeredCount)

    await this.sessionModel.findByIdAndUpdate(sessionId, {
      answers,
      score: totalScore,
      scoreBreakdown: {
        part1Score: p1Score, part1Correct: p1Correct, part1Total: Object.keys(key1).length,
        part2Score: p2Score, part2FullCorrect: p2Full, part2Partial: p2Partial, part2Total: Object.keys(key2).length,
        part3Score: p3Score, part3Correct: p3Correct, part3Total: Object.keys(key3).length,
      },
      status: 'SUBMITTED',
      submittedAt: new Date(),
      timeSpent,
    })

    await this.persistStudentAndResult({
      sessionId: session._id,
      examId: session.examId,
      studentInfo: (session as any).studentInfo,
      score: totalScore,
      scoreBreakdown: {
        part1Score: p1Score,
        part2Score: p2Score,
        part3Score: p3Score,
      },
      status: 'SUBMITTED',
      submittedAt: new Date(),
      timeSpentSeconds: timeSpent,
      totalQuestions,
      answeredCount,
      unansweredCount,
    })

    const result: any = { score: totalScore, timeSpent, scoreBreakdown: { part1: p1Score, part2: p2Score, part3: p3Score } }

    // Gửi đáp án nếu được phép
    if (exam?.showAnswerAfter) {
      result.answerKey = variant.answerKey
    }

    return result
  }

  // ══════════════════════════════════════════════════════
  //  ANSWER SHEETS (chấm bài giấy bằng camera)
  // ══════════════════════════════════════════════════════

  /** Tạo phiếu trả lời giấy cho học sinh khi chọn mode PAPER */
  async createAnswerSheet(
    accessCode: string,
    studentInfo: { fullName: string; className: string; school: string; academicYear?: string },
  ) {
    const exam = await this.examModel.findOne({ accessCode }).lean()
    if (!exam) throw new NotFoundException('Đề thi không tồn tại')

    const effectiveEndTime = resolveEffectiveEndTime(exam)
    if (exam.status !== 'ACTIVE') {
      if (exam.status === 'CLOSED') {
        const timeText = formatVNDateTime(effectiveEndTime)
        throw new BadRequestException(timeText ? `Đề thi đã kết thúc lúc ${timeText}` : 'Đề thi đã kết thúc')
      }
      throw new BadRequestException('Đề thi chưa được phát hành')
    }

    const now = new Date()
    if (exam.startTime && now < exam.startTime) throw new BadRequestException('Đề thi chưa bắt đầu')
    if (effectiveEndTime && now > effectiveEndTime) {
      await this.examModel.findByIdAndUpdate(exam._id, {
        status: 'CLOSED',
        ...(exam.endTime ? {} : { endTime: effectiveEndTime }),
      })
      const timeText = formatVNDateTime(effectiveEndTime)
      throw new BadRequestException(timeText ? `Đề thi đã kết thúc lúc ${timeText}` : 'Đề thi đã kết thúc')
    }

    const effectiveStudentInfo = {
      ...studentInfo,
      school: studentInfo.school || exam.defaultSchool || 'GDTX Lê Quí Đôn',
      academicYear: studentInfo.academicYear || exam.schoolYear || resolveAcademicYear(exam.startTime || new Date()),
    }

    const variantIndex = pickVariantIndex(
      effectiveStudentInfo.fullName,
      effectiveStudentInfo.className,
      effectiveStudentInfo.school,
      exam.variantCount || 4,
    )
    const variantCode = 100 + variantIndex + 1
    const variant = await this.variantModel.findOne({ examId: exam._id, variantCode }).lean()
    if (!variant) throw new NotFoundException('Không tìm thấy mã đề')

    const sheetCode = genSheetCode((exam._id as any).toString(), variantCode)

    // Tạo session PAPER_PENDING
    const session = await this.sessionModel.create({
      examId: exam._id,
      variantId: variant._id,
      variantCode,
      studentInfo: effectiveStudentInfo,
      mode: 'PAPER',
      startedAt: new Date(),
      status: 'PAPER_PENDING',
      organizationId: (exam as any).organizationId,
    })

    const sheet = await this.sheetModel.create({
      examId: exam._id,
      variantId: variant._id,
      sessionId: session._id,
      studentInfo: effectiveStudentInfo,
      sheetCode,
      gradingStatus: 'PENDING',
      organizationId: (exam as any).organizationId,
    })

    await this.sessionModel.findByIdAndUpdate(session._id, { answerSheetId: sheet._id })

    return { sessionId: session._id, sheetId: sheet._id, sheetCode, variantCode }
  }

  /** Upload ảnh scan phiếu trả lời để chấm */
  async uploadSheetScan(sheetId: string, imageUrls: string[], organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(sheetId) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const sheet = await this.sheetModel.findOneAndUpdate(
      query,
      { scannedImageUrls: imageUrls, gradingStatus: 'PROCESSING' },
      { new: true },
    )
    if (!sheet) throw new NotFoundException('Phiếu trả lời không tồn tại hoặc bạn không có quyền')
    // TODO: gọi OCR service để nhận dạng bubble
    return { sheetId, status: 'PROCESSING', message: 'Đang xử lý ảnh, vui lòng chờ...' }
  }

  async scanAndGrade(examId: string, imageUrl: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(examId) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const exam = await this.examModel.findOne(query).lean()
    if (!exam) throw new NotFoundException('Bài thi không tồn tại')

    // Tải ảnh về buffer
    let buffer: Buffer
    let mimeType = 'image/jpeg'
    try {
      const res = await fetch(imageUrl)
      if (!res.ok) throw new Error('Cannot fetch image')
      buffer = Buffer.from(await res.arrayBuffer())
      mimeType = res.headers.get('content-type') || 'image/jpeg'
    } catch (err: any) {
      throw new BadRequestException('Không thể tải ảnh từ URL: ' + err.message)
    }

    const base64Image = buffer.toString('base64')

    if (organizationId) {
      await this.licensingService.consumeAiQuota(organizationId, 1)
    }

    // Dùng OpenAI để trích xuất SBD, mã đề, đáp án
    const ocrData = await this.aiSvc.extractAnswersFromImage(base64Image, mimeType)

    const sbd = ocrData.sbd
    let variantCode = ocrData.madethi ? parseInt(ocrData.madethi) : undefined

    if (!variantCode || isNaN(variantCode)) {
      // Lấy variant đầu tiên nếu không đọc được
      const variant = await this.variantModel.findOne({ examId: exam._id }).lean()
      if (variant) variantCode = variant.variantCode
    }

    // Tính điểm
    const variant = await this.variantModel.findOne({ examId: exam._id, variantCode }).lean()
    if (!variant) {
      throw new BadRequestException(`Không tìm thấy mã đề ${variantCode}`)
    }

    const answerKey = variant.answerKey || { part1: {}, part2: {}, part3: {} }
    let p1Score = 0, p2Score = 0, p3Score = 0
    let correctP1 = 0, correctP2 = 0, correctP3 = 0

    // Part 1
    const p1Count = (exam as any).structure?.part1Count || 18
    const p1Point = (exam as any).structure?.part1ScorePerQ || 0.25
    for (let i = 1; i <= p1Count; i++) {
      const qId = variant.part1Order?.[i - 1]?.toString()
      if (qId && ocrData.part1?.[i] === answerKey.part1?.[qId]) {
        p1Score += p1Point
        correctP1++
      }
    }

    // Part 2
    const p2Count = (exam as any).structure?.part2Count || 4
    const scoring = (exam.structure as any)?.part2Scoring || { correct1: 0, correct2: 0.25, correct3: 0.5, correct4: 1.0 }
    for (let i = 1; i <= p2Count; i++) {
      const qId = variant.part2Order?.[i - 1]?.toString()
      if (qId) {
        const truth = answerKey.part2?.[qId] // array boolean
        const userAns = ocrData.part2?.[i] // array boolean
        if (truth && userAns && truth.length === 4 && userAns.length === 4) {
          const s = scoreTrueFalse(userAns, truth, scoring)
          p2Score += s
          if (s === scoring.correct4) correctP2++
        }
      }
    }

    // Part 3
    const p3Count = (exam as any).structure?.part3Count || 6
    const p3Point = (exam as any).structure?.part3ScorePerQ || 0.25
    for (let i = 1; i <= p3Count; i++) {
      const qId = variant.part3Order?.[i - 1]?.toString()
      if (qId) {
        const truthStr = String(answerKey.part3?.[qId] || '').trim().toLowerCase()
        const userStr = String(ocrData.part3?.[i] || '').trim().toLowerCase()
        if (truthStr && userStr === truthStr) {
          p3Score += p3Point
          correctP3++
        }
      }
    }

    const totalScore = Math.round((p1Score + p2Score + p3Score) * 100) / 100
    const totalQuestions = p1Count + p2Count + p3Count
    const answeredCount = Object.keys(ocrData.part1 || {}).length + Object.keys(ocrData.part2 || {}).length + Object.keys(ocrData.part3 || {}).length

    // Create session result
    const session = await this.sessionModel.create({
      examId: exam._id,
      organizationId: organizationId ? new Types.ObjectId(organizationId) : undefined,
      studentInfo: {
        fullName: sbd ? `SBD: ${sbd}` : 'Quét Camera',
        className: 'SBD ' + (sbd || '?'),
        school: exam.defaultSchool || 'GDTX',
      },
      variantCode,
      status: 'SUBMITTED',
      timeSpent: 0,
      answers: ocrData,
      score: totalScore,
      scoreBreakdown: {
        part1Score: p1Score,
        part2Score: p2Score,
        part3Score: p3Score,
      },
      gradingSource: 'CAMERA_OCR',
    })

    await this.persistStudentAndResult({
      sessionId: session._id,
      examId: session.examId,
      studentInfo: (session as any).studentInfo,
      score: totalScore,
      scoreBreakdown: {
        part1Score: p1Score,
        part2Score: p2Score,
        part3Score: p3Score,
      },
      status: 'SUBMITTED',
      submittedAt: new Date(),
      timeSpentSeconds: 0,
      totalQuestions,
      answeredCount,
      unansweredCount: Math.max(0, totalQuestions - answeredCount),
    })

    return {
      success: true,
      sessionId: session._id,
      sbd,
      variantCode,
      score: totalScore,
      scoreBreakdown: { part1Score: p1Score, part2Score: p2Score, part3Score: p3Score },
      ocrData,
    }
  }

  /** Nhập kết quả chấm tay (hoặc kết quả từ AI OCR) */
  async gradeSheet(
    sheetId: string,
    detectedAnswers: any,
    confidence = 1.0,
    gradedBy: 'AI' | string = 'AI',
    organizationId?: string,
  ) {
    const query: any = { _id: new Types.ObjectId(sheetId) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const sheet = await this.sheetModel.findOne(query).lean()
    if (!sheet) throw new NotFoundException('Phiếu trả lời không tồn tại hoặc bạn không có quyền')

    const variant = await this.variantModel.findById(sheet.variantId).lean()
    const exam = await this.examModel.findById(sheet.examId).lean()
    const scoring = (exam?.structure as any)?.part2Scoring || { correct1: 0, correct2: 0.25, correct3: 0.5, correct4: 1.0 }

    const finalAnswers = { ...detectedAnswers, ...(sheet.manualCorrections || {}) }

    // Chấm điểm
    const key = variant?.answerKey
    let p1 = 0, p2 = 0, p3 = 0
    for (const [qid, ans] of Object.entries(finalAnswers.part1 || {})) {
      if (key?.part1?.[qid] === ans) p1 += (exam?.structure as any)?.part1ScorePerQ || 0.25
    }
    for (const [qid, bools] of Object.entries(finalAnswers.part2 || {})) {
      if (key?.part2?.[qid]) p2 += scoreTrueFalse(bools as boolean[], key.part2[qid], scoring)
    }
    for (const [qid, ans] of Object.entries(finalAnswers.part3 || {})) {
      if (key?.part3?.[qid]?.trim().toLowerCase() === (ans as string).trim().toLowerCase()) {
        p3 += (exam?.structure as any)?.part3ScorePerQ || 0.25
      }
    }

    const total = Math.round((p1 + p2 + p3) * 100) / 100
    const status = confidence < 0.85 ? 'MANUAL_REVIEW' : 'GRADED'
    const totalQuestions = Object.keys(key?.part1 || {}).length + Object.keys(key?.part2 || {}).length + Object.keys(key?.part3 || {}).length
    const answeredCount = Object.keys(finalAnswers.part1 || {}).length + Object.keys(finalAnswers.part2 || {}).length + Object.keys(finalAnswers.part3 || {}).length
    const unansweredCount = Math.max(0, totalQuestions - answeredCount)

    await this.sheetModel.findByIdAndUpdate(sheetId, {
      detectedAnswers,
      finalAnswers,
      ocrConfidence: confidence,
      score: { total, part1: p1, part2: p2, part3: p3 },
      gradingStatus: status,
      gradedAt: new Date(),
      gradedBy,
    })

    // Cập nhật session
    if (sheet.sessionId) {
      const currentSession = await this.sessionModel.findByIdAndUpdate(sheet.sessionId, {
        answers: finalAnswers,
        score: total,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      }, { new: true }).lean()

      if (currentSession) {
        const timeSpentSeconds = currentSession.startedAt
          ? Math.max(0, Math.round((Date.now() - new Date(currentSession.startedAt).getTime()) / 1000))
          : 0

        await this.persistStudentAndResult({
          sessionId: currentSession._id,
          examId: currentSession.examId,
          studentInfo: currentSession.studentInfo,
          score: total,
          scoreBreakdown: { part1: p1, part2: p2, part3: p3 },
          status: 'SUBMITTED',
          submittedAt: new Date(),
          timeSpentSeconds,
          totalQuestions,
          answeredCount,
          unansweredCount,
        })
      }
    }

    return { score: total, scoreBreakdown: { part1: p1, part2: p2, part3: p3 }, status }
  }

  /** Chỉnh sửa thủ công đáp án nhận dạng sai */
  async applyManualCorrection(sheetId: string, corrections: any, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(sheetId) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const doc = await this.sheetModel.findOneAndUpdate(
      query,
      { manualCorrections: corrections, gradingStatus: 'MANUAL_REVIEW' },
      { new: true },
    )
    if (!doc) throw new NotFoundException('Phiếu trả lời không tồn tại hoặc bạn không có quyền')
    return doc
  }

  // ══════════════════════════════════════════════════════
  //  RESULTS & STATS
  // ══════════════════════════════════════════════════════

  async getExamResults(examId: string, page = 1, limit = 50, organizationId?: string) {
    const query: any = { examId: new Types.ObjectId(examId), status: { $in: ['SUBMITTED', 'TIMED_OUT'] } }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const [total, sessions] = await Promise.all([
      this.sessionModel.countDocuments(query),
      this.sessionModel.find(query).select('-answers').skip((page - 1) * limit).limit(limit).sort({ score: -1 }).lean(),
    ])
    return { total, page, limit, sessions }
  }

  async getExamStats(organizationId?: string) {
    const examQuery: any = {}
    const sessionQuery: any = { status: 'SUBMITTED' }
    const questionQuery: any = { isActive: true }

    withOrgScope(examQuery, organizationId)
    withOrgScope(sessionQuery, organizationId)
    withOrgScope(questionQuery, organizationId)

    const [totalExams, totalSessions, totalQuestions] = await Promise.all([
      this.examModel.countDocuments(examQuery),
      this.sessionModel.countDocuments(sessionQuery),
      this.questionModel.countDocuments(questionQuery),
    ])
    const activeExams = await this.examModel.countDocuments({ ...examQuery, status: 'ACTIVE' })
    return { totalExams, activeExams, totalSessions, totalQuestions }
  }

  private async upsertStudent(studentInfo: any, examId: Types.ObjectId) {
    const exam = await this.examModel.findById(examId).select('schoolYear startTime defaultSchool').lean()
    const academicYear =
      studentInfo?.academicYear
      || exam?.schoolYear
      || resolveAcademicYear(exam?.startTime ? new Date(exam.startTime) : new Date())

    const fullName = (studentInfo?.fullName || '').trim()
    const className = (studentInfo?.className || '').trim()
    const school = (studentInfo?.school || exam?.defaultSchool || 'GDTX Lê Quí Đôn').trim()

    if (!fullName || !className) {
      throw new BadRequestException('Thiếu thông tin học sinh để lưu kết quả')
    }

    return this.studentModel.findOneAndUpdate(
      { fullName, className, academicYear, school },
      { fullName, className, academicYear, school },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )
  }

  private async persistStudentAndResult(payload: {
    sessionId: Types.ObjectId
    examId: Types.ObjectId
    studentInfo: any
    score: number
    scoreBreakdown?: any
    status: 'SUBMITTED' | 'TIMED_OUT' | 'INCOMPLETE'
    submittedAt: Date
    timeSpentSeconds: number
    totalQuestions: number
    answeredCount: number
    unansweredCount: number
  }) {
    const student = await this.upsertStudent(payload.studentInfo, payload.examId)
    const academicYear = student.academicYear
    const percentage = Math.round((Math.max(0, payload.score) / 10) * 10000) / 100

    return this.examResultModel.findOneAndUpdate(
      { sessionId: payload.sessionId },
      {
        studentId: student._id,
        examId: payload.examId,
        sessionId: payload.sessionId,
        fullName: student.fullName,
        className: student.className,
        academicYear,
        school: student.school,
        score: payload.score,
        maxScore: 10,
        percentage,
        scoreBreakdown: payload.scoreBreakdown,
        status: payload.status,
        submittedAt: payload.submittedAt,
        timeSpentSeconds: payload.timeSpentSeconds,
        totalQuestions: payload.totalQuestions,
        answeredCount: payload.answeredCount,
        unansweredCount: payload.unansweredCount,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  }

  // ══════════════════════════════════════════════════════
  //  EXAM ANALYTICS & CHATBOT CONTEXT
  // ══════════════════════════════════════════════════════

  /**
   * Track exam events (START, SUBMIT, WARNING_5MIN, etc)
   */
  async trackSessionEvent(sessionId: string, eventType: string, metadata?: any) {
    const sessionLog = await this.sessionLogModel.findByIdAndUpdate(
      sessionId,
      {
        $push: {
          events: {
            type: eventType,
            timestamp: new Date(),
            metadata,
          },
        },
      },
      { new: true },
    )
    return sessionLog
  }

  /**
   * Submit exam session and store analytics
   */
  async submitExamSession(dto: SubmitExamDto) {
    const sessionLog = await this.sessionLogModel.create({
      examId: new Types.ObjectId(dto.examId),
      studentId: new Types.ObjectId(dto.studentId),
      startedAt: new Date(),
      submittedAt: new Date(),
      timeSpentSeconds: dto.timeSpentSeconds,
      timeLeftSeconds: dto.timeLeftSeconds,
      unansweredQuestionIds: dto.unansweredQuestionIds,
      unansweredCount: dto.unansweredCount,
      totalQuestions: dto.totalQuestions,
      answeredCount: dto.answeredCount,
      submissionStatus: dto.submissionStatus,
      events: [
        {
          type: 'START',
          timestamp: new Date(),
        },
        {
          type: 'SUBMIT',
          timestamp: new Date(),
          metadata: { unansweredCount: dto.unansweredCount },
        },
      ],
    })

    // Analyze session with OpenAI
    try {
      const exam = await this.examModel.findById(dto.examId).lean()
      if (exam?.organizationId) {
        await this.licensingService.consumeAiQuota(exam.organizationId.toString(), 1)
      }

      const analysis = await this.aiSvc.analyzeExamSession({
        totalQuestions: dto.totalQuestions,
        answeredCount: dto.answeredCount,
        unansweredCount: dto.unansweredCount,
        unansweredIds: dto.unansweredQuestionIds,
        timeSpentSeconds: dto.timeSpentSeconds,
        timeLeftSeconds: dto.timeLeftSeconds,
        submissionStatus: dto.submissionStatus,
        riskIndicators: [
          dto.unansweredCount > 0 ? `Còn ${dto.unansweredCount} câu chưa làm` : '',
          dto.timeLeftSeconds < 300 ? 'Sắp hết giờ' : '',
        ].filter(Boolean),
      })

      await this.sessionLogModel.findByIdAndUpdate(sessionLog._id, {
        aiAnalysis: analysis,
        analyzedAt: new Date(),
      })
    } catch (err) {
      console.error('[ExamsService] OpenAI analysis failed:', err)
    }

    return sessionLog
  }

  /**
   * Get session log by ID
   */
  async getSessionLog(sessionId: string) {
    return this.sessionLogModel.findById(sessionId).lean()
  }

  /**
   * Get session analytics with AI analysis
   */
  async getSessionAnalyticsWithAI(sessionId: string) {
    const sessionLog = await this.sessionLogModel.findById(sessionId)

    if (!sessionLog) {
      throw new NotFoundException('Phiên thi không tìm thấy')
    }

    // If not yet analyzed, analyze now
    if (!sessionLog.aiAnalysis) {
      try {
        const exam = await this.examModel.findById(sessionLog.examId).lean()
        if (exam?.organizationId) {
          await this.licensingService.consumeAiQuota(exam.organizationId.toString(), 1)
        }

        const analysis = await this.aiSvc.analyzeExamSession({
          totalQuestions: sessionLog.totalQuestions,
          answeredCount: sessionLog.answeredCount,
          unansweredCount: sessionLog.unansweredCount,
          unansweredIds: sessionLog.unansweredQuestionIds,
          timeSpentSeconds: sessionLog.timeSpentSeconds,
          timeLeftSeconds: sessionLog.timeLeftSeconds,
          submissionStatus: sessionLog.submissionStatus,
          riskIndicators: [
            sessionLog.unansweredCount > 0 ? `Còn ${sessionLog.unansweredCount} câu chưa làm` : '',
            sessionLog.timeLeftSeconds < 300 ? 'Sắp hết giờ' : '',
          ].filter(Boolean),
        })

        sessionLog.aiAnalysis = analysis
        sessionLog.analyzedAt = new Date()
        await sessionLog.save()
      } catch (err) {
        console.error('[ExamsService] OpenAI analysis failed:', err)
      }
    }

    return sessionLog
  }

  // ══════════════════════════════════════════════════════
  //  QUIZ LIVE (realtime by polling)
  // ══════════════════════════════════════════════════════

  async getQuizSets(organizationId?: string) {
    const query: any = {}
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    return this.quizSetModel.find(query).sort({ createdAt: -1 }).lean()
  }

  async createQuizSet(data: any, createdBy?: string, organizationId?: string) {
    if (!data?.title?.trim()) throw new BadRequestException('Thiếu tiêu đề bộ quiz')
    if (!Array.isArray(data?.questions) || data.questions.length === 0) {
      throw new BadRequestException('Bộ quiz phải có ít nhất 1 câu hỏi')
    }
    for (const q of data.questions) {
      if (!q?.prompt?.trim()) throw new BadRequestException('Câu hỏi không được để trống')
      if (!Array.isArray(q?.choices) || q.choices.length < 2) throw new BadRequestException('Mỗi câu cần ít nhất 2 đáp án')
      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= q.choices.length) {
        throw new BadRequestException('Đáp án đúng không hợp lệ')
      }
    }
    return this.quizSetModel.create({
      title: data.title,
      description: data.description || '',
      questions: data.questions,
      subjectId: data.subjectId ? new Types.ObjectId(data.subjectId) : undefined,
      gradeLevel: data.gradeLevel,
      createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
      organizationId: organizationId ? new Types.ObjectId(organizationId) : undefined,
    })
  }

  async updateQuizSet(id: string, data: any, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(id) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const doc = await this.quizSetModel.findOneAndUpdate(query, data, { new: true })
    if (!doc) throw new NotFoundException('Quiz set không tồn tại')
    return doc
  }

  async deleteQuizSet(id: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(id) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const deleted = await this.quizSetModel.findOneAndDelete(query)
    if (!deleted) throw new NotFoundException('Quiz set không tồn tại')
    await this.quizSessionModel.deleteMany({ setId: deleted._id })
    return { success: true }
  }

  /** Lấy bộ quiz theo ID không cần đăng nhập (dùng cho flashcard & matching mode) */
  async getPublicQuizSet(id: string) {
    let set: any = null
    try {
      set = await this.quizSetModel.findById(new Types.ObjectId(id)).lean()
    } catch {
      throw new NotFoundException('ID không hợp lệ')
    }
    if (!set) throw new NotFoundException('Bộ quiz không tồn tại')
    return set
  }

  async startQuizSession(payload: { setId: string; timePerQuestion?: number }, hostId?: string, organizationId?: string) {
    const setQuery: any = { _id: new Types.ObjectId(payload.setId) }
    if (organizationId) setQuery.organizationId = new Types.ObjectId(organizationId)
    const set = await this.quizSetModel.findOne(setQuery).lean()
    if (!set) throw new NotFoundException('Không tìm thấy bộ quiz')
    if (!set.questions?.length) throw new BadRequestException('Bộ quiz chưa có câu hỏi')

    let code = ''
    for (let i = 0; i < 5; i++) {
      const c = genQuizRoomCode()
      const exists = await this.quizSessionModel.findOne({ code: c, status: { $in: ['WAITING', 'LIVE'] } }).lean()
      if (!exists) { code = c; break }
    }
    if (!code) throw new BadRequestException('Không thể tạo mã phòng, vui lòng thử lại')

    const session = await this.quizSessionModel.create({
      setId: set._id,
      code,
      status: 'WAITING',
      timePerQuestion: payload.timePerQuestion || 20,
      currentQuestionIndex: -1,
      hostId: hostId ? new Types.ObjectId(hostId) : undefined,
      organizationId: organizationId ? new Types.ObjectId(organizationId) : undefined,
    })
    return this.getQuizSessionAdmin(String(session._id), organizationId)
  }

  /** Chuyển phiên từ WAITING → LIVE, bắt đầu câu 0 */
  async beginQuizSession(sessionId: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(sessionId) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const session = await this.quizSessionModel.findOne(query)
    if (!session) throw new NotFoundException('Phiên quiz không tồn tại')
    if (session.status !== 'WAITING') throw new BadRequestException('Phiên không ở trạng thái chờ')
    session.status = 'LIVE'
    session.currentQuestionIndex = 0
    session.startedAt = new Date()
    await session.save()
    return this.getQuizSessionAdmin(sessionId, organizationId)
  }

  async getQuizSessionAdmin(sessionId: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(sessionId) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const session = await this.quizSessionModel.findOne(query).lean()
    if (!session) throw new NotFoundException('Phiên quiz không tồn tại')

    const set = await this.quizSetModel.findById(session.setId).lean()
    if (!set) throw new NotFoundException('Bộ quiz không tồn tại')

    const [participants, answers] = await Promise.all([
      this.quizParticipantModel.find({ sessionId: session._id }).sort({ score: -1, createdAt: 1 }).lean(),
      this.quizAnswerModel.find({ sessionId: session._id, questionIndex: session.currentQuestionIndex }).lean(),
    ])

    const current = set.questions?.[session.currentQuestionIndex]
    const distribution: Record<string, number> = {}
    answers.forEach((a: any) => {
      distribution[a.selectedIndex] = (distribution[a.selectedIndex] || 0) + 1
    })

    return {
      session,
      set: {
        _id: String(set._id),
        title: set.title,
        questionCount: set.questions?.length || 0,
      },
      currentQuestion: current ? {
        index: session.currentQuestionIndex,
        prompt: current.prompt,
        choices: current.choices,
        correctIndex: current.correctIndex,
      } : null,
      participants,
      answerStats: {
        totalAnswers: answers.length,
        distribution,
      },
    }
  }

  async nextQuizQuestion(sessionId: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(sessionId) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const session = await this.quizSessionModel.findOne(query)
    if (!session) throw new NotFoundException('Phiên quiz không tồn tại')

    const set = await this.quizSetModel.findById(session.setId).lean()
    if (!set) throw new NotFoundException('Bộ quiz không tồn tại')

    const next = session.currentQuestionIndex + 1
    if (next >= (set.questions?.length || 0)) {
      session.status = 'ENDED'
      session.endedAt = new Date()
    } else {
      session.currentQuestionIndex = next
      if (session.status === 'WAITING') {
        session.status = 'LIVE'
        session.startedAt = new Date()
      }
    }
    await session.save()
    return this.getQuizSessionAdmin(String(session._id), organizationId)
  }

  async endQuizSession(sessionId: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(sessionId) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const session = await this.quizSessionModel.findOneAndUpdate(query, { status: 'ENDED', endedAt: new Date() }, { new: true }).lean()
    if (!session) throw new NotFoundException('Phiên quiz không tồn tại')
    return { success: true }
  }

  async joinQuizSessionByCode(code: string, name: string) {
    const roomCode = String(code || '').trim().toUpperCase()
    if (!roomCode) throw new BadRequestException('Thiếu mã phòng')
    if (!name?.trim()) throw new BadRequestException('Thiếu tên học sinh')

    const session = await this.quizSessionModel.findOne({ code: roomCode, status: { $in: ['WAITING', 'LIVE'] } }).lean()
    if (!session) throw new NotFoundException('Phòng quiz không tồn tại hoặc đã kết thúc')

    const participant = await this.quizParticipantModel.create({
      sessionId: session._id,
      name: name.trim().slice(0, 60),
      score: 0,
      correctCount: 0,
      lastAnsweredIndex: -1,
    })

    const state = await this.getQuizPublicState(roomCode, String(participant._id))
    return { participantId: participant._id, ...state }
  }

  async getQuizPublicState(code: string, participantId?: string) {
    const roomCode = String(code || '').trim().toUpperCase()
    const session = await this.quizSessionModel.findOne({ code: roomCode }).lean()
    if (!session) throw new NotFoundException('Không tìm thấy phòng quiz')

    const set = await this.quizSetModel.findById(session.setId).lean()
    if (!set) throw new NotFoundException('Không tìm thấy bộ quiz')

    const current = set.questions?.[session.currentQuestionIndex]
    const leaderboard = await this.quizParticipantModel
      .find({ sessionId: session._id })
      .sort({ score: -1, correctCount: -1, createdAt: 1 })
      .limit(10)
      .lean()

    let participant: any = null
    if (participantId && Types.ObjectId.isValid(participantId)) {
      participant = await this.quizParticipantModel.findOne({ _id: new Types.ObjectId(participantId), sessionId: session._id }).lean()
    }

    return {
      session: {
        _id: session._id,
        code: session.code,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        timePerQuestion: session.timePerQuestion,
      },
      set: {
        _id: set._id,
        title: set.title,
        questionCount: set.questions?.length || 0,
      },
      question: session.status === 'LIVE' && current
        ? {
          index: session.currentQuestionIndex,
          prompt: current.prompt,
          choices: current.choices,
        }
        : null,
      participant,
      leaderboard: leaderboard.map((p: any) => ({
        _id: p._id,
        name: p.name,
        score: p.score,
        correctCount: p.correctCount,
      })),
    }
  }

  async submitQuizAnswer(code: string, data: { participantId: string; selectedIndex: number; responseMs?: number }) {
    const roomCode = String(code || '').trim().toUpperCase()
    const session = await this.quizSessionModel.findOne({ code: roomCode, status: 'LIVE' })
    if (!session) throw new NotFoundException('Phòng quiz không hoạt động')

    const set = await this.quizSetModel.findById(session.setId).lean()
    if (!set) throw new NotFoundException('Bộ quiz không tồn tại')

    const question = set.questions?.[session.currentQuestionIndex]
    if (!question) throw new BadRequestException('Không có câu hỏi hiện tại')

    const participant = await this.quizParticipantModel.findOne({
      _id: new Types.ObjectId(data.participantId),
      sessionId: session._id,
    })
    if (!participant) throw new NotFoundException('Không tìm thấy người chơi')
    if (participant.lastAnsweredIndex === session.currentQuestionIndex) {
      throw new BadRequestException('Bạn đã trả lời câu này rồi')
    }

    const selected = Number(data.selectedIndex)
    if (Number.isNaN(selected) || selected < 0 || selected >= question.choices.length) {
      throw new BadRequestException('Đáp án không hợp lệ')
    }

    const isCorrect = selected === question.correctIndex
    const responseMs = Math.max(0, Number(data.responseMs || 0))
    const maxMs = Math.max(1000, session.timePerQuestion * 1000)
    const speedBonus = isCorrect ? Math.max(0, Math.floor(50 * (1 - Math.min(responseMs, maxMs) / maxMs))) : 0
    const gained = isCorrect ? 100 + speedBonus : 0

    await this.quizAnswerModel.create({
      sessionId: session._id,
      participantId: participant._id,
      questionIndex: session.currentQuestionIndex,
      selectedIndex: selected,
      isCorrect,
      responseMs,
    })

    participant.lastAnsweredIndex = session.currentQuestionIndex
    participant.score = (participant.score || 0) + gained
    participant.correctCount = (participant.correctCount || 0) + (isCorrect ? 1 : 0)
    await participant.save()

    return {
      correct: isCorrect,
      gained,
      totalScore: participant.score,
    }
  }

  // ══════════════════════════════════════════════════════
  //  POLL LIVE (realtime by polling)
  // ══════════════════════════════════════════════════════

  async getPollSets(organizationId?: string) {
    const query: any = {}
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    return this.pollSetModel.find(query).sort({ createdAt: -1 }).lean()
  }

  async createPollSet(data: any, createdBy?: string, organizationId?: string) {
    if (!data?.title?.trim()) throw new BadRequestException('Thiếu tiêu đề bộ poll')
    const questions = normalizePollQuestions(data?.questions)
    return this.pollSetModel.create({
      title: data.title.trim(),
      description: String(data?.description || '').trim(),
      questions,
      createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
      organizationId: organizationId ? new Types.ObjectId(organizationId) : undefined,
    })
  }

  async updatePollSet(id: string, data: any, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(id) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const payload = {
      ...data,
      ...(Array.isArray(data?.questions) ? { questions: normalizePollQuestions(data.questions) } : {}),
    }
    const doc = await this.pollSetModel.findOneAndUpdate(query, payload, { new: true })
    if (!doc) throw new NotFoundException('Poll set không tồn tại')
    return doc
  }

  async deletePollSet(id: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(id) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const deleted = await this.pollSetModel.findOneAndDelete(query)
    if (!deleted) throw new NotFoundException('Poll set không tồn tại')
    const sessionIds = await this.pollSessionModel.find({ setId: deleted._id }).distinct('_id')
    if (sessionIds.length) {
      await Promise.all([
        this.pollResponseModel.deleteMany({ sessionId: { $in: sessionIds } }),
        this.pollParticipantModel.deleteMany({ sessionId: { $in: sessionIds } }),
      ])
    }
    await this.pollSessionModel.deleteMany({ setId: deleted._id })
    return { success: true }
  }

  private async buildPollStats(sessionId: Types.ObjectId, questionIndex: number) {
    const [participants, responses] = await Promise.all([
      this.pollParticipantModel.find({ sessionId }).sort({ createdAt: 1 }).lean(),
      this.pollResponseModel.find({ sessionId, questionIndex }).sort({ createdAt: 1 }).lean(),
    ])

    const participantMap = new Map(participants.map((p: any) => [String(p._id), p]))
    const distribution: Record<string, number> = {}
    const textResponses: Array<{ _id: string; text: string; participantName: string }> = []

    for (const response of responses as any[]) {
      for (const idx of response.selectedIndices || []) {
        distribution[idx] = (distribution[idx] || 0) + 1
      }
      if (response.textAnswer) {
        const participant = participantMap.get(String(response.participantId))
        textResponses.push({
          _id: String(response._id),
          text: response.textAnswer,
          participantName: participant?.isAnonymous ? 'Ẩn danh' : (participant?.name || 'Khách'),
        })
      }
    }

    return {
      participants,
      responseStats: {
        totalResponses: responses.length,
        distribution,
        textResponses,
      },
    }
  }

  async startPollSession(payload: { setId: string }, hostId?: string, organizationId?: string) {
    const setQuery: any = { _id: new Types.ObjectId(payload.setId) }
    if (organizationId) setQuery.organizationId = new Types.ObjectId(organizationId)
    const set = await this.pollSetModel.findOne(setQuery).lean()
    if (!set) throw new NotFoundException('Không tìm thấy bộ poll')
    if (!set.questions?.length) throw new BadRequestException('Bộ poll chưa có câu hỏi')

    let code = ''
    for (let i = 0; i < 5; i++) {
      const c = genQuizRoomCode()
      const exists = await this.pollSessionModel.findOne({ code: c, status: { $in: ['WAITING', 'LIVE'] } }).lean()
      if (!exists) { code = c; break }
    }
    if (!code) throw new BadRequestException('Không thể tạo mã phòng poll, vui lòng thử lại')

    const session = await this.pollSessionModel.create({
      setId: set._id,
      code,
      status: 'LIVE',
      currentQuestionIndex: 0,
      startedAt: new Date(),
      questionStartedAt: new Date(),
      hostId: hostId ? new Types.ObjectId(hostId) : undefined,
      organizationId: organizationId ? new Types.ObjectId(organizationId) : undefined,
    })
    return this.getPollSessionAdmin(String(session._id), organizationId)
  }

  async getPollSessionAdmin(sessionId: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(sessionId) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const session = await this.pollSessionModel.findOne(query).lean()
    if (!session) throw new NotFoundException('Phiên poll không tồn tại')

    const set = await this.pollSetModel.findById(session.setId).lean()
    if (!set) throw new NotFoundException('Bộ poll không tồn tại')

    const currentQuestion = set.questions?.[session.currentQuestionIndex] || null
    const { participants, responseStats } = await this.buildPollStats(session._id as any, session.currentQuestionIndex)
    const timing = currentQuestion ? getPollQuestionTiming(session, currentQuestion) : null

    return {
      session,
      set: {
        _id: String(set._id),
        title: set.title,
        questionCount: set.questions?.length || 0,
      },
      currentQuestion: currentQuestion ? {
        index: session.currentQuestionIndex,
        prompt: currentQuestion.prompt,
        type: currentQuestion.type,
        options: currentQuestion.options || [],
        durationSeconds: timing?.durationSeconds || 20,
        questionStartedAt: timing?.questionStartedAt || null,
        questionEndsAt: timing?.questionEndsAt || null,
        secondsLeft: timing?.secondsLeft || 0,
        isQuestionClosed: !!timing?.isQuestionClosed,
        showResults: currentQuestion.showResults !== false,
      } : null,
      participants,
      responseStats,
    }
  }

  async nextPollQuestion(sessionId: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(sessionId) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const session = await this.pollSessionModel.findOne(query)
    if (!session) throw new NotFoundException('Phiên poll không tồn tại')

    const set = await this.pollSetModel.findById(session.setId).lean()
    if (!set) throw new NotFoundException('Bộ poll không tồn tại')

    const next = session.currentQuestionIndex + 1
    if (next >= (set.questions?.length || 0)) {
      session.status = 'ENDED'
      session.endedAt = new Date()
    } else {
      session.currentQuestionIndex = next
      session.questionStartedAt = new Date()
      if (session.status === 'WAITING') {
        session.status = 'LIVE'
        session.startedAt = new Date()
      }
    }
    await session.save()
    return this.getPollSessionAdmin(String(session._id), organizationId)
  }

  async endPollSession(sessionId: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(sessionId) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const session = await this.pollSessionModel.findOneAndUpdate(query, { status: 'ENDED', endedAt: new Date() }, { new: true }).lean()
    if (!session) throw new NotFoundException('Phiên poll không tồn tại')
    return { success: true }
  }

  async joinPollSessionByCode(code: string, name: string, isAnonymous?: boolean) {
    const roomCode = String(code || '').trim().toUpperCase()
    if (!roomCode) throw new BadRequestException('Thiếu mã phòng')
    const rawName = String(name || '').trim()
    const finalName = rawName || `Khách-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    const session = await this.pollSessionModel.findOne({ code: roomCode, status: { $in: ['WAITING', 'LIVE'] } }).lean()
    if (!session) throw new NotFoundException('Phòng poll không tồn tại hoặc đã kết thúc')

    const participant = await this.pollParticipantModel.create({
      sessionId: session._id,
      name: finalName.slice(0, 60),
      isAnonymous: !!isAnonymous,
      lastAnsweredIndex: -1,
    })

    const state = await this.getPollPublicState(roomCode, String(participant._id))
    return { participantId: participant._id, ...state }
  }

  async getPollPublicState(code: string, participantId?: string) {
    const roomCode = String(code || '').trim().toUpperCase()
    const session = await this.pollSessionModel.findOne({ code: roomCode }).lean()
    if (!session) throw new NotFoundException('Không tìm thấy phòng poll')

    const set = await this.pollSetModel.findById(session.setId).lean()
    if (!set) throw new NotFoundException('Không tìm thấy bộ poll')

    let participant: any = null
    if (participantId && Types.ObjectId.isValid(participantId)) {
      participant = await this.pollParticipantModel.findOne({ _id: new Types.ObjectId(participantId), sessionId: session._id }).lean()
    }

    const currentQuestion = set.questions?.[session.currentQuestionIndex] || null
    const { participants, responseStats } = await this.buildPollStats(session._id as any, session.currentQuestionIndex)
    const timing = currentQuestion ? getPollQuestionTiming(session, currentQuestion) : null

    return {
      session: {
        _id: session._id,
        code: session.code,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
      },
      set: {
        _id: set._id,
        title: set.title,
        questionCount: set.questions?.length || 0,
      },
      question: session.status === 'LIVE' && currentQuestion ? {
        index: session.currentQuestionIndex,
        prompt: currentQuestion.prompt,
        type: currentQuestion.type,
        options: currentQuestion.options || [],
        durationSeconds: timing?.durationSeconds || 20,
        questionStartedAt: timing?.questionStartedAt || null,
        questionEndsAt: timing?.questionEndsAt || null,
        secondsLeft: timing?.secondsLeft || 0,
        isQuestionClosed: !!timing?.isQuestionClosed,
        showResults: currentQuestion.showResults !== false,
      } : null,
      participant,
      participantCount: participants.length,
      results: currentQuestion && currentQuestion.showResults !== false && timing?.isQuestionClosed ? responseStats : null,
    }
  }

  async submitPollResponse(code: string, data: { participantId: string; selectedIndices?: number[]; textAnswer?: string }) {
    const roomCode = String(code || '').trim().toUpperCase()
    const session = await this.pollSessionModel.findOne({ code: roomCode, status: 'LIVE' })
    if (!session) throw new NotFoundException('Phòng poll không hoạt động')

    const set = await this.pollSetModel.findById(session.setId).lean()
    if (!set) throw new NotFoundException('Bộ poll không tồn tại')

    const question = set.questions?.[session.currentQuestionIndex]
    if (!question) throw new BadRequestException('Không có câu hỏi hiện tại')
    const timing = getPollQuestionTiming(session, question)
    if (timing.isQuestionClosed) {
      throw new BadRequestException('Câu hỏi bình chọn này đã hết thời gian')
    }

    const participant = await this.pollParticipantModel.findOne({
      _id: new Types.ObjectId(data.participantId),
      sessionId: session._id,
    })
    if (!participant) throw new NotFoundException('Không tìm thấy người tham gia')
    if (participant.lastAnsweredIndex === session.currentQuestionIndex) {
      throw new BadRequestException('Bạn đã gửi phản hồi cho câu này rồi')
    }

    let selectedIndices: number[] = []
    let textAnswer = ''

    if (question.type === 'TEXT') {
      textAnswer = String(data.textAnswer || '').trim()
      if (!textAnswer) throw new BadRequestException('Vui lòng nhập nội dung bình chọn')
    } else {
      selectedIndices = Array.isArray(data.selectedIndices) ? data.selectedIndices.map(v => Number(v)) : []
      if (selectedIndices.length !== 1) throw new BadRequestException('Vui lòng chọn đúng 1 phương án')
      const selected = selectedIndices[0]
      if (Number.isNaN(selected) || selected < 0 || selected >= (question.options?.length || 0)) {
        throw new BadRequestException('Lựa chọn không hợp lệ')
      }
    }

    await this.pollResponseModel.create({
      sessionId: session._id,
      participantId: participant._id,
      questionIndex: session.currentQuestionIndex,
      selectedIndices,
      textAnswer,
    })

    participant.lastAnsweredIndex = session.currentQuestionIndex
    await participant.save()

    const state = await this.getPollPublicState(roomCode, String(participant._id))
    return {
      success: true,
      results: state.results,
    }
  }

  // ══════════════════════════════════════════════════════
  //  ANALYTICS — PHÂN TÍCH CÂU HỎI
  // ══════════════════════════════════════════════════════

  /**
   * Phân tích tỷ lệ đúng/sai từng câu hỏi dựa trên các session đã nộp.
   */
  async getExamQuestionAnalytics(examId: string, organizationId?: string) {
    const exam = await this.examModel.findById(examId).lean()
    if (!exam) throw new NotFoundException('Đề thi không tồn tại')

    const sessions = await this.sessionModel
      .find({ examId: new Types.ObjectId(examId), status: 'SUBMITTED' })
      .lean()

    if (sessions.length === 0) {
      return { examId, totalSessions: 0, analytics: { part1: [], part2: [], part3: [] } }
    }

    // Lấy tất cả question IDs từ các variant
    const variants = await this.variantModel.find({ examId: new Types.ObjectId(examId) }).lean()
    if (variants.length === 0) return { examId, totalSessions: sessions.length, analytics: { part1: [], part2: [], part3: [] } }

    const firstVariant = variants[0]
    const key1 = firstVariant.answerKey?.part1 || {}
    const key2 = firstVariant.answerKey?.part2 || {}
    const key3 = firstVariant.answerKey?.part3 || {}

    // Phân tích Phần I — MULTIPLE_CHOICE
    const part1Analytics = Object.keys(key1).map(qid => {
      const correctCount = sessions.filter(s => s.answers?.part1?.[qid] === key1[qid]).length
      const totalAnswered = sessions.filter(s => s.answers?.part1?.[qid] !== undefined).length
      const optionDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
      for (const s of sessions) {
        const ans = s.answers?.part1?.[qid]
        if (ans && optionDist[ans] !== undefined) optionDist[ans]++
      }
      return {
        questionId: qid,
        correctAnswer: key1[qid],
        totalAttempts: totalAnswered,
        correctCount,
        correctRate: totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0,
        optionDistribution: optionDist,
        type: 'MULTIPLE_CHOICE',
      }
    })

    // Phân tích Phần II — TRUE_FALSE
    const part2Analytics = Object.keys(key2).map(qid => {
      const correctBools: boolean[] = key2[qid]
      let fullCorrect = 0, partial = 0, wrong = 0
      let totalAnswered = 0
      for (const s of sessions) {
        const studentBools: boolean[] | undefined = s.answers?.part2?.[qid]
        if (!studentBools) continue
        totalAnswered++
        const correctCount = studentBools.filter((a, i) => a === correctBools[i]).length
        if (correctCount === 4) fullCorrect++
        else if (correctCount >= 2) partial++
        else wrong++
      }
      return {
        questionId: qid,
        totalAttempts: totalAnswered,
        fullCorrectCount: fullCorrect,
        partialCount: partial,
        wrongCount: wrong,
        correctRate: totalAnswered > 0 ? Math.round(((fullCorrect + partial * 0.5) / totalAnswered) * 100) : 0,
        type: 'TRUE_FALSE',
      }
    })

    // Phân tích Phần III — SHORT_ANSWER
    const part3Analytics = Object.keys(key3).map(qid => {
      const expected = key3[qid]
      let correctCount = 0, totalAnswered = 0
      for (const s of sessions) {
        const ans = s.answers?.part3?.[qid]
        if (ans === undefined || ans === '') continue
        totalAnswered++
        const numAns = parseFloat(ans), numExp = parseFloat(expected)
        const match = !isNaN(numAns) && !isNaN(numExp)
          ? Math.abs(numAns - numExp) <= 0
          : ans.trim().toLowerCase() === expected.trim().toLowerCase()
        if (match) correctCount++
      }
      return {
        questionId: qid,
        correctAnswer: expected,
        totalAttempts: totalAnswered,
        correctCount,
        correctRate: totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0,
        type: 'SHORT_ANSWER',
      }
    })

    return {
      examId,
      totalSessions: sessions.length,
      analytics: {
        part1: part1Analytics.sort((a, b) => a.correctRate - b.correctRate), // xếp theo tỷ lệ đúng tăng dần
        part2: part2Analytics.sort((a, b) => a.correctRate - b.correctRate),
        part3: part3Analytics.sort((a, b) => a.correctRate - b.correctRate),
      },
    }
  }

  // ══════════════════════════════════════════════════════
  //  PDF EXPORT — BÁO CÁO KẾT QUẢ THI
  // ══════════════════════════════════════════════════════

  async generateExamPdfReport(examId: string, opts: {
    className?: string
    academicYear?: string
    organizationId?: string
  }): Promise<Buffer> {
    const exam = await this.examModel
      .findById(examId)
      .populate('subjectId', 'name code')
      .lean()
    if (!exam) throw new NotFoundException('Đề thi không tồn tại')

    const query: any = { examId: new Types.ObjectId(examId), status: 'SUBMITTED' }
    if (opts.className) query['studentInfo.className'] = opts.className

    const sessions = await this.sessionModel.find(query).lean()
    if (sessions.length === 0) {
      throw new BadRequestException('Không có học sinh nào đã nộp bài')
    }

    const scores = sessions.map(s => (s as any).score || 0)
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const maxScore = Math.max(...scores)
    const minScore = Math.min(...scores)
    const passCount = scores.filter(s => s >= 5).length

    const subject = (exam as any).subjectId

    return this.pdfReportSvc.generateClassReport({
      examTitle: exam.title,
      subjectName: typeof subject === 'object' ? subject.name : 'Chưa rõ',
      gradeLevel: exam.gradeLevel,
      academicYear: opts.academicYear,
      className: opts.className,
      school: exam.defaultSchool,
      sessions: sessions.map((s: any) => ({
        fullName: s.studentInfo?.fullName || '—',
        className: s.studentInfo?.className || '—',
        score: s.score || 0,
        scoreBreakdown: s.scoreBreakdown,
        submittedAt: s.submittedAt,
        timeSpent: s.timeSpent,
      })),
      stats: {
        totalSessions: sessions.length,
        avgScore: Math.round(avgScore * 100) / 100,
        maxScore,
        minScore,
        passRate: sessions.length > 0 ? Math.round((passCount / sessions.length) * 100 * 10) / 10 : 0,
      },
    })
  }

  // ══════════════════════════════════════════════════════
  //  AI EXPLANATION — GIẢI THÍCH ĐÁP ÁN
  // ══════════════════════════════════════════════════════

  async getSessionExplanation(sessionId: string): Promise<Record<string, { explanation: string; tip?: string }>> {
    const session = await this.sessionModel.findById(sessionId).lean() as any
    if (!session) throw new NotFoundException('Session không tồn tại')
    if (session.status !== 'SUBMITTED') throw new BadRequestException('Bài thi chưa nộp')

    // Trả về cache nếu đã có
    if (session.aiExplanation && Object.keys(session.aiExplanation).length > 0) {
      return session.aiExplanation
    }

    const variant = await this.variantModel.findById(session.variantId).lean()
    if (!variant) throw new NotFoundException('Không tìm thấy mã đề')

    // Tìm các câu làm sai để giải thích
    const wrongQuestions: any[] = []

    // Part 1
    const key1 = variant.answerKey?.part1 || {}
    const wrongP1Ids = Object.entries(session.answers?.part1 || {})
      .filter(([qid, ans]) => key1[qid] !== undefined && key1[qid] !== ans)
      .map(([qid]) => qid)
      .slice(0, 7) // max 7 câu

    if (wrongP1Ids.length > 0) {
      const p1Qs = await this.questionModel
        .find({ _id: { $in: wrongP1Ids.map(id => new Types.ObjectId(id)) } })
        .lean()
      for (const q of p1Qs) {
        wrongQuestions.push({
          questionId: String(q._id),
          content: q.content,
          type: 'MULTIPLE_CHOICE',
          options: q.options,
          studentAnswer: session.answers?.part1?.[String(q._id)],
          correctAnswer: key1[String(q._id)],
        })
      }
    }

    // Part 2
    const key2 = variant.answerKey?.part2 || {}
    const wrongP2Ids = Object.entries(session.answers?.part2 || {})
      .filter(([qid, ans]: [string, any]) => {
        const correct: boolean[] = key2[qid]
        if (!correct) return false
        return !Array.isArray(ans) || ans.some((a, i) => a !== correct[i])
      })
      .map(([qid]) => qid)
      .slice(0, 3)

    if (wrongP2Ids.length > 0) {
      const p2Qs = await this.questionModel
        .find({ _id: { $in: wrongP2Ids.map(id => new Types.ObjectId(id)) } })
        .lean()
      for (const q of p2Qs) {
        wrongQuestions.push({
          questionId: String(q._id),
          content: q.content,
          type: 'TRUE_FALSE',
          statements: q.statements,
          studentAnswer: session.answers?.part2?.[String(q._id)],
          correctAnswer: key2[String(q._id)],
        })
      }
    }

    if (wrongQuestions.length === 0) {
      return {}
    }

    const result = await this.aiSvc.explainAnswers(wrongQuestions)

    // Cache vào session document
    await this.sessionModel.findByIdAndUpdate(sessionId, { aiExplanation: result })

    return result
  }

  // ══════════════════════════════════════════════════════
  //  FLASHCARD — SRS SYSTEM
  // ══════════════════════════════════════════════════════

  /** Tạo bộ flashcard từ danh sách questionIds */
  async createFlashcardSet(data: {
    title: string
    description?: string
    subjectId?: string
    gradeLevel?: number
    questionIds?: string[]
    cards?: Array<{ front: string; back: string; hint?: string }>
    organizationId?: string
    createdBy?: string
  }) {
    const accessCode = genAccessCode()
    let cards: any[] = []

    if (data.questionIds && data.questionIds.length > 0) {
      const questions = await this.questionModel
        .find({ _id: { $in: data.questionIds.map(id => new Types.ObjectId(id)) } })
        .populate('subjectId', 'name')
        .lean()

      cards = questions.map(q => {
        let front = q.content
        let back = ''

        if (q.type === 'MULTIPLE_CHOICE' && q.options) {
          const optText = q.options.map(o => `${o.key}. ${o.content}`).join('<br>')
          front = `${q.content}<br><br>${optText}`
          back = `<strong>Đáp án: ${q.correctAnswer}</strong>`
          const correctOpt = q.options.find(o => o.key === q.correctAnswer)
          if (correctOpt) back += `<br>${correctOpt.content}`
        } else if (q.type === 'TRUE_FALSE' && q.statements) {
          front = `${q.content}<br><br>` + q.statements.map(s => `${s.key}. ${s.content}`).join('<br>')
          back = '<strong>Đáp án:</strong><br>' + q.statements.map(s => `${s.key}. ${s.answer ? '✓ Đúng' : '✗ Sai'}`).join('<br>')
        } else if (q.type === 'SHORT_ANSWER') {
          back = `<strong>Đáp án: ${q.shortAnswer}</strong>`
        }

        return { front, back, questionId: q._id }
      })
    } else if (data.cards && data.cards.length > 0) {
      cards = data.cards
    }

    if (cards.length === 0) throw new BadRequestException('Bộ flashcard phải có ít nhất 1 thẻ')

    return this.flashcardSetModel.create({
      title: data.title,
      description: data.description,
      subjectId: data.subjectId ? new Types.ObjectId(data.subjectId) : undefined,
      gradeLevel: data.gradeLevel,
      cards,
      accessCode,
      organizationId: data.organizationId ? new Types.ObjectId(data.organizationId) : undefined,
      createdBy: data.createdBy ? new Types.ObjectId(data.createdBy) : undefined,
    })
  }

  async getFlashcardSets(organizationId?: string) {
    const query: any = { isActive: true }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    return this.flashcardSetModel.find(query).sort({ createdAt: -1 }).lean()
  }

  async deleteFlashcardSet(setId: string, organizationId?: string) {
    const query: any = { _id: new Types.ObjectId(setId) }
    if (organizationId) query.organizationId = new Types.ObjectId(organizationId)
    const doc = await this.flashcardSetModel.findOneAndDelete(query)
    if (!doc) throw new NotFoundException('Bộ flashcard không tồn tại')
    return { success: true }
  }

  /** Lấy bộ flashcard qua link public (không cần auth) */
  async getPublicFlashcardSet(accessCode: string, sessionKey?: string) {
    const set = await this.flashcardSetModel
      .findOne({ accessCode, isActive: true })
      .populate('subjectId', 'name color')
      .lean()
    if (!set) throw new NotFoundException('Bộ flashcard không tồn tại hoặc đã bị xóa')

    let progress: any[] = []
    if (sessionKey) {
      progress = await this.flashcardProgressModel
        .find({ setId: set._id, sessionKey })
        .lean()
    }

    const progressMap: Record<number, any> = {}
    for (const p of progress) {
      progressMap[p.cardIndex] = p
    }

    // Tính các thẻ cần ôn hôm nay
    const now = new Date()
    const cardsWithProgress = (set as any).cards.map((card: any, idx: number) => {
      const p = progressMap[idx]
      const isDueToday = !p || !p.nextReviewAt || new Date(p.nextReviewAt) <= now
      return {
        ...card,
        index: idx,
        progress: p ? {
          easeFactor: p.easeFactor,
          interval: p.interval,
          repetitions: p.repetitions,
          nextReviewAt: p.nextReviewAt,
          lastRating: p.lastRating,
        } : null,
        isDueToday,
      }
    })

    const dueCount = cardsWithProgress.filter((c: any) => c.isDueToday).length

    return {
      setId: set._id,
      title: (set as any).title,
      description: (set as any).description,
      subject: (set as any).subjectId,
      gradeLevel: (set as any).gradeLevel,
      totalCards: (set as any).cards.length,
      dueCount,
      cards: cardsWithProgress,
    }
  }

  /** Cập nhật tiến độ SRS (SM-2 algorithm) */
  async updateFlashcardProgress(opts: {
    accessCode: string
    sessionKey: string
    cardIndex: number
    rating: 0 | 1 | 2 | 3 // 0=Không nhớ, 1=Khó, 2=Ổn, 3=Dễ
  }) {
    const set = await this.flashcardSetModel.findOne({ accessCode: opts.accessCode, isActive: true }).lean()
    if (!set) throw new NotFoundException('Bộ flashcard không tồn tại')

    const existing = await this.flashcardProgressModel.findOne({
      setId: set._id,
      sessionKey: opts.sessionKey,
      cardIndex: opts.cardIndex,
    })

    // SM-2 Algorithm
    const { rating } = opts
    let ef = existing?.easeFactor ?? 2.5
    let interval = existing?.interval ?? 1
    let repetitions = existing?.repetitions ?? 0

    if (rating >= 3) {
      // Đúng: tăng interval
      if (repetitions === 0) interval = 1
      else if (repetitions === 1) interval = 6
      else interval = Math.round(interval * ef)
      repetitions++
    } else if (rating === 2) {
      // Ổn: tăng nhẹ
      interval = Math.max(1, Math.round(interval * 1.2))
      repetitions++
    } else {
      // Sai/khó: reset
      interval = 1
      repetitions = 0
    }

    // Cập nhật ease factor
    ef = Math.max(1.3, ef + 0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02))

    const nextReviewAt = new Date()
    nextReviewAt.setDate(nextReviewAt.getDate() + interval)

    const update = { easeFactor: ef, interval, repetitions, nextReviewAt, lastRating: rating }

    if (existing) {
      await this.flashcardProgressModel.findByIdAndUpdate(existing._id, update)
    } else {
      await this.flashcardProgressModel.create({
        setId: set._id,
        sessionKey: opts.sessionKey,
        cardIndex: opts.cardIndex,
        ...update,
      })
    }

    return { success: true, nextReviewAt, interval }
  }
}
