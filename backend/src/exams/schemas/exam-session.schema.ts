import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type ExamSessionDocument = ExamSession & Document

export type SessionStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'TIMED_OUT' | 'PAPER_PENDING'
export type SessionMode = 'ONLINE' | 'PAPER'

@Schema({ _id: false })
class StudentInfo {
  @Prop({ required: true, trim: true })
  fullName: string

  @Prop({ required: true, trim: true })
  className: string // 'Lớp 12A1'

  @Prop({ trim: true })
  academicYear?: string // '2025-2026'

  @Prop({ required: true, trim: true, default: 'GDTX Lê Quí Đôn' })
  school: string
}

@Schema({ _id: false })
class ScoreBreakdown {
  // Phần I — Trắc nghiệm nhiều lựa chọn
  @Prop({ default: 0 })
  part1Score: number

  @Prop({ default: 0 })
  part1Correct: number

  @Prop({ default: 0 })
  part1Total: number

  // Phần II — Đúng/Sai
  @Prop({ default: 0 })
  part2Score: number

  @Prop({ default: 0 })
  part2FullCorrect: number // số câu đúng 4/4

  @Prop({ default: 0 })
  part2Partial: number // số câu đúng 2-3/4

  @Prop({ default: 0 })
  part2Total: number

  // Phần III — Trả lời ngắn
  @Prop({ default: 0 })
  part3Score: number

  @Prop({ default: 0 })
  part3Correct: number

  @Prop({ default: 0 })
  part3Total: number
}

/**
 * Phiên thi của một học sinh.
 * Học sinh không cần đăng nhập — chỉ cần nhập họ tên / lớp / trường.
 * Mỗi phiên được gán một ExamVariant (mã đề) tự động.
 */
@Schema({ timestamps: true, collection: 'exam_sessions' })
export class ExamSession {
  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  examId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'ExamVariant', required: true })
  variantId: Types.ObjectId

  /** Số mã đề (để hiển thị trên màn hình) */
  @Prop({ required: true })
  variantCode: number // 101 | 102 | 103 | 104

  @Prop({ type: Object, required: true })
  studentInfo: StudentInfo

  /** Browser fingerprint — ngăn thi nhiều lần từ cùng thiết bị */
  @Prop()
  deviceFingerprint?: string

  @Prop()
  ipAddress?: string

  @Prop({ enum: ['ONLINE', 'PAPER'], default: 'ONLINE' })
  mode: SessionMode

  @Prop({ default: () => new Date() })
  startedAt: Date

  @Prop()
  submittedAt?: Date

  /** Thời gian làm bài (giây) */
  @Prop()
  timeSpent?: number

  /**
   * Câu trả lời của học sinh.
   * Lưu theo questionId để có thể chấm dù có shuffle.
   */
  @Prop({
    type: Object,
    default: {
      part1: {}, // { questionId: 'A'|'B'|'C'|'D' }
      part2: {}, // { questionId: [true, false, true, false] } — 4 mệnh đề
      part3: {}, // { questionId: '3.14' }
    },
  })
  answers: {
    part1: Record<string, string>
    part2: Record<string, boolean[]>
    part3: Record<string, string>
  }

  /** Điểm tổng (thang 10) */
  @Prop()
  score?: number

  @Prop({ type: Object })
  scoreBreakdown?: ScoreBreakdown

  @Prop({ enum: ['IN_PROGRESS', 'SUBMITTED', 'TIMED_OUT', 'PAPER_PENDING'], default: 'IN_PROGRESS' })
  status: SessionStatus

  /** Ref đến phiếu trả lời giấy (nếu mode = PAPER) */
  @Prop({ type: Types.ObjectId, ref: 'AnswerSheet' })
  answerSheetId?: Types.ObjectId

  @Prop({ type: Object })
  organizationId?: Types.ObjectId

  @Prop({ select: false })
  sessionTokenHash?: string

  /** Cache giải thích đáp án từ AI — tránh gọi lại nhiều lần */
  @Prop({ type: Object })
  aiExplanation?: Record<string, { explanation: string; tip?: string }>
}

export const ExamSessionSchema = SchemaFactory.createForClass(ExamSession)
ExamSessionSchema.index({ organizationId: 1 })
ExamSessionSchema.index({ examId: 1 })
ExamSessionSchema.index({ examId: 1, variantId: 1 })
ExamSessionSchema.index({ deviceFingerprint: 1, examId: 1 })
ExamSessionSchema.index({ 'studentInfo.fullName': 1, examId: 1 })
ExamSessionSchema.index({ status: 1 })
