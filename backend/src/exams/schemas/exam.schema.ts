import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type ExamDocument = Exam & Document

export type ExamType = 'GK' | 'CK' | 'PRACTICE' | 'TN_THPT' | 'CUSTOM'
// GK = Giữa kỳ, CK = Cuối kỳ, PRACTICE = Luyện tập, TN_THPT = Tốt nghiệp THPT

export type ExamStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED'

// ── Sub-schemas ──────────────────────────────────────────────────────────────

/**
 * Cấu hình chấm điểm cho Phần II (Đúng/Sai).
 * BGD 2025 mặc định: 1đúng=0đ, 2đúng=0.25đ, 3đúng=0.5đ, 4đúng=1đ
 */
@Schema({ _id: false })
class TrueFalseScoring {
  @Prop({ default: 0 })
  correct1: number // điểm khi đúng 1/4 mệnh đề

  @Prop({ default: 0.25 })
  correct2: number // điểm khi đúng 2/4

  @Prop({ default: 0.5 })
  correct3: number // điểm khi đúng 3/4

  @Prop({ default: 1.0 })
  correct4: number // điểm khi đúng 4/4 (full score)
}

/** Cấu hình phân bổ câu hỏi theo từng phần */
@Schema({ _id: false })
class ExamStructure {
  // ── Phần I: Trắc nghiệm nhiều lựa chọn ──────────────────
  @Prop({ default: 18 })
  part1Count: number // số câu (BGD 2025 default = 18)

  @Prop({ default: 0.25 })
  part1ScorePerQ: number // điểm/câu (18 × 0.25 = 4.5đ)

  /** Phân bổ mức độ (tổng = part1Count) */
  @Prop({ type: Object, default: { NHAN_BIET: 6, THONG_HIEU: 6, VAN_DUNG: 4, VAN_DUNG_CAO: 2 } })
  part1Difficulty: Record<string, number>

  // ── Phần II: Đúng/Sai ────────────────────────────────────
  @Prop({ default: 4 })
  part2Count: number // số câu (mỗi câu 4 mệnh đề a/b/c/d)

  @Prop({ type: Object, default: {} })
  part2Scoring: TrueFalseScoring // thang điểm đúng/sai

  // ── Phần III: Trả lời ngắn ───────────────────────────────
  @Prop({ default: 6 })
  part3Count: number // số câu (BGD 2025 default = 6)

  @Prop({ default: 0.25 })
  part3ScorePerQ: number // điểm/câu (6 × 0.25 = 1.5đ)
}

// ── Main Exam schema ─────────────────────────────────────────────────────────

/**
 * Bài thi — được tạo từ ngân hàng câu hỏi hoặc upload file.
 * Hỗ trợ trộn đề (nhiều mã đề) và cả thi online lẫn thi giấy.
 *
 * Điểm tổng mặc định BGD 2025: 4.5 + 4.0 + 1.5 = 10đ
 */
@Schema({ timestamps: true, collection: 'exams' })
export class Exam {
  @Prop({ required: true, trim: true })
  title: string // 'Đề kiểm tra Giữa kỳ 1 — Toán 12'

  @Prop()
  description?: string

  @Prop({ type: Types.ObjectId, ref: 'Subject', required: true })
  subjectId: Types.ObjectId

  @Prop({ required: true })
  gradeLevel: number // 10 | 11 | 12 | ...

  @Prop({ trim: true })
  schoolYear?: string // '2025-2026'

  @Prop({ enum: [1, 2] })
  semester?: number

  @Prop({ enum: ['GK', 'CK', 'PRACTICE', 'TN_THPT', 'CUSTOM'], default: 'PRACTICE' })
  examType: ExamType

  // ── Câu hỏi (ObjectId ref đến Question) ─────────────────
  @Prop({ type: [Types.ObjectId], ref: 'Question', default: [] })
  part1Questions: Types.ObjectId[] // Trắc nghiệm nhiều lựa chọn

  @Prop({ type: [Types.ObjectId], ref: 'Question', default: [] })
  part2Questions: Types.ObjectId[] // Đúng/Sai

  @Prop({ type: [Types.ObjectId], ref: 'Question', default: [] })
  part3Questions: Types.ObjectId[] // Trả lời ngắn

  // ── Cấu hình đề ─────────────────────────────────────────
  @Prop({ type: Object })
  structure: ExamStructure

  @Prop({ required: true, default: 90 })
  timeLimit: number // phút

  @Prop()
  startTime?: Date // null = mở bất kỳ lúc nào

  @Prop()
  endTime?: Date

  /** Thời điểm publish (bấm Kích hoạt). endTime tính từ đây nếu không set thủ công. */
  @Prop()
  activatedAt?: Date

  // ── Truy cập ─────────────────────────────────────────────
  /**
   * Mã ngắn duy nhất — dùng cho link và QR code.
   * URL: /e/{accessCode}
   * Được tạo tự động khi publish.
   */
  @Prop({ unique: true, sparse: true })
  accessCode?: string

  /** Base64 data URL của QR code (tự động tạo khi accessCode được set) */
  @Prop()
  qrCodeDataUrl?: string

  /** Tên trường mặc định hiển thị trong form học sinh */
  @Prop({ default: 'GDTX Lê Quí Đôn' })
  defaultSchool: string

  // ── Trộn đề ──────────────────────────────────────────────
  @Prop({ default: true })
  shuffleQuestions: boolean // trộn thứ tự câu hỏi

  @Prop({ default: true })
  shuffleOptions: boolean // trộn thứ tự đáp án A/B/C/D (phần I)

  /**
   * Số mã đề thi khác nhau sẽ được sinh ra (101, 102, 103...).
   * Học sinh khác nhau → mã đề khác nhau (trộn khác nhau).
   */
  @Prop({ default: 4 })
  variantCount: number

  // ── Kết quả ──────────────────────────────────────────────
  /** Thi online → hiện điểm ngay sau khi nộp */
  @Prop({ default: true })
  showResultImmediately: boolean

  /** Hiện đáp án sau khi nộp */
  @Prop({ default: false })
  showAnswerAfter: boolean

  // ── Trạng thái ───────────────────────────────────────────
  @Prop({ enum: ['DRAFT', 'ACTIVE', 'CLOSED'], default: 'DRAFT' })
  status: ExamStatus

  /** Số phiên thi đã diễn ra */
  @Prop({ default: 0 })
  sessionCount: number

  @Prop({ enum: ['MANUAL', 'UPLOAD'], default: 'MANUAL' })
  source: 'MANUAL' | 'UPLOAD'

  /** URL file Word/PDF gốc nếu tạo bằng upload */
  @Prop()
  uploadFileUrl?: string

  @Prop({ type: Types.ObjectId })
  createdBy?: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId
}

export const ExamSchema = SchemaFactory.createForClass(Exam)
ExamSchema.index({ organizationId: 1 })
ExamSchema.index({ subjectId: 1, gradeLevel: 1 })
ExamSchema.index({ status: 1 })
