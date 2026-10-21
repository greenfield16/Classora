import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type QuestionDocument = Question & Document

/** Loại câu hỏi theo cấu trúc đề thi mới nhất BGD 2025 */
export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'QUIZ' | 'POLL'

/**
 * Mức độ nhận thức (Bloom / BGD):
 * NHAN_BIET → THONG_HIEU → VAN_DUNG → VAN_DUNG_CAO
 */
export type DifficultyLevel = 'NHAN_BIET' | 'THONG_HIEU' | 'VAN_DUNG' | 'VAN_DUNG_CAO'

// ── Sub-schemas ──────────────────────────────────────────────────────────────

@Schema({ _id: false })
class QuestionOption {
  /** A | B | C | D */
  @Prop({ required: true, enum: ['A', 'B', 'C', 'D'] })
  key: string

  /** Nội dung đáp án (HTML — hỗ trợ LaTeX qua KaTeX) */
  @Prop({ required: true })
  content: string
}
const QuestionOptionSchema = SchemaFactory.createForClass(QuestionOption)

@Schema({ _id: false })
class TrueFalseStatement {
  /** a | b | c | d */
  @Prop({ required: true, enum: ['a', 'b', 'c', 'd'] })
  key: string

  /** Nội dung mệnh đề */
  @Prop({ required: true })
  content: string

  /** Đáp án đúng của mệnh đề này */
  @Prop({ required: true })
  answer: boolean
}
const TrueFalseStatementSchema = SchemaFactory.createForClass(TrueFalseStatement)

// ── Main schema ──────────────────────────────────────────────────────────────

/**
 * Ngân hàng câu hỏi.
 * Phân loại theo môn, khối lớp, loại câu, mức độ.
 * Hỗ trợ 3 loại câu hỏi theo cấu trúc BGD 2025:
 *   Phần I  — MULTIPLE_CHOICE  (trắc nghiệm nhiều lựa chọn, chọn 1/4)
 *   Phần II — TRUE_FALSE        (đúng/sai, 4 mệnh đề mỗi câu)
 *   Phần III— SHORT_ANSWER      (trả lời ngắn / điền số)
 */
@Schema({ timestamps: true, collection: 'exam_questions' })
export class Question {
  @Prop({ type: Types.ObjectId, ref: 'Subject', required: true })
  subjectId: Types.ObjectId

  @Prop({ required: true })
  gradeLevel: number // 10 | 11 | 12 | ...

  @Prop({ required: true, enum: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'QUIZ', 'POLL'] })
  type: QuestionType

  /** Đề câu hỏi — HTML (hỗ trợ ảnh, LaTeX qua KaTeX) */
  @Prop({ required: true })
  content: string

  // ── Phần I: MULTIPLE_CHOICE ──────────────────────────────
  /** Các lựa chọn A/B/C/D */
  @Prop({ type: [QuestionOptionSchema] })
  options?: QuestionOption[]

  /** Đáp án đúng: 'A' | 'B' | 'C' | 'D' */
  @Prop({ enum: ['A', 'B', 'C', 'D'] })
  correctAnswer?: string

  // ── Phần II: TRUE_FALSE ──────────────────────────────────
  /** 4 mệnh đề a/b/c/d kèm đáp án đúng/sai */
  @Prop({ type: [TrueFalseStatementSchema] })
  statements?: TrueFalseStatement[]

  // ── Phần III: SHORT_ANSWER ───────────────────────────────
  /** Đáp án ngắn (chuỗi hoặc số) */
  @Prop()
  shortAnswer?: string

  /**
   * Sai số chấp nhận được cho đáp số số (±tolerance).
   * Ví dụ: đáp án 3.14, tolerance = 0.01 → chấp nhận 3.13 → 3.15
   */
  @Prop({ default: 0 })
  shortAnswerTolerance?: number

  // ── Metadata ─────────────────────────────────────────────
  @Prop({ required: true, enum: ['NHAN_BIET', 'THONG_HIEU', 'VAN_DUNG', 'VAN_DUNG_CAO'] })
  difficulty: DifficultyLevel

  @Prop({ trim: true })
  chapter?: string // Chương/Unit

  @Prop({ trim: true })
  topic?: string // Bài/Chủ đề

  @Prop({ type: [String], default: [] })
  tags: string[]

  @Prop({ enum: ['MANUAL', 'UPLOAD'], default: 'MANUAL' })
  source: 'MANUAL' | 'UPLOAD'

  /** URL file Word/PDF nguồn nếu upload */
  @Prop()
  uploadFileUrl?: string

  /** Số lần câu hỏi xuất hiện trong đề thi */
  @Prop({ default: 0 })
  usageCount: number

  @Prop({ type: Types.ObjectId })
  createdBy?: Types.ObjectId

  @Prop({ default: true })
  isActive: boolean

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId
}

export const QuestionSchema = SchemaFactory.createForClass(Question)
QuestionSchema.index({ organizationId: 1 })
QuestionSchema.index({ subjectId: 1, gradeLevel: 1, type: 1 })
QuestionSchema.index({ subjectId: 1, gradeLevel: 1, difficulty: 1 })
QuestionSchema.index({ tags: 1 })
QuestionSchema.index({ isActive: 1 })
