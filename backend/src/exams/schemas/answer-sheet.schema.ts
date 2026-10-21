import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type AnswerSheetDocument = AnswerSheet & Document

export type GradingStatus = 'PENDING' | 'PROCESSING' | 'GRADED' | 'ERROR' | 'MANUAL_REVIEW'

@Schema({ _id: false })
class SheetStudentInfo {
  @Prop({ required: true })
  fullName: string

  @Prop({ required: true })
  className: string

  @Prop()
  academicYear?: string

  @Prop({ required: true, default: 'GDTX Lê Quí Đôn' })
  school: string
}

/**
 * Đáp án ghi nhận từ OMR scan hoặc nhập tay.
 * Cấu trúc giống ExamSession.answers.
 */
@Schema({ _id: false })
class DetectedAnswers {
  @Prop({ type: Object, default: {} })
  part1: Record<string, string> // { questionId: 'A'|'B'|'C'|'D' }

  @Prop({ type: Object, default: {} })
  part2: Record<string, boolean[]> // { questionId: [true,false,true,false] }

  @Prop({ type: Object, default: {} })
  part3: Record<string, string> // { questionId: '3.14' }
}

@Schema({ _id: false })
class ScoreSummary {
  @Prop({ default: 0 })
  total: number

  @Prop({ default: 0 })
  part1: number

  @Prop({ default: 0 })
  part2: number

  @Prop({ default: 0 })
  part3: number
}

/**
 * Phiếu trả lời giấy (OMR Answer Sheet).
 *
 * Luồng xử lý:
 *   1. Khi học sinh chọn mode PAPER → sinh ra AnswerSheet
 *   2. Hệ thống tạo file PDF (phiếu trả lời có mã QR + bubble grid)
 *   3. Học sinh in, làm bài tay → tô bubble
 *   4. Giáo viên chụp/scan → upload ảnh qua API /exams/sheets/:id/grade
 *   5. AI (OpenCV) nhận dạng bubble đã tô → detectedAnswers
 *   6. Hệ thống chấm tự động, giáo viên review nếu confidence thấp
 *
 * Cấu trúc phiếu (PDF):
 *   ┌─────────────────────────────────────┐
 *   │  [Logo]  Trường: ______  Mã đề: 101 │
 *   │  Họ tên: ___________  Lớp: ______   │
 *   │  [QR Code]                           │
 *   ├─────────────────────────────────────┤
 *   │  PHẦN I — Trắc nghiệm (18 câu)      │
 *   │  1 ○A ○B ○C ○D   10 ○A ○B ○C ○D    │
 *   │  ...                                 │
 *   ├─────────────────────────────────────┤
 *   │  PHẦN II — Đúng/Sai (4 câu)         │
 *   │  1 a:○Đ○S  b:○Đ○S  c:○Đ○S  d:○Đ○S │
 *   │  ...                                 │
 *   ├─────────────────────────────────────┤
 *   │  PHẦN III — Trả lời ngắn (6 câu)    │
 *   │  1: [______]  2: [______]  ...       │
 *   └─────────────────────────────────────┘
 */
@Schema({ timestamps: true, collection: 'answer_sheets' })
export class AnswerSheet {
  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  examId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'ExamVariant', required: true })
  variantId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'ExamSession' })
  sessionId?: Types.ObjectId

  @Prop({ type: Object, required: true })
  studentInfo: SheetStudentInfo

  /**
   * Mã phiếu duy nhất — được nhúng vào QR code trên phiếu.
   * Format: {examId_short}-{variantCode}-{random6}
   * Ví dụ: "abc123-101-k9xm4p"
   */
  @Prop({ required: true, unique: true })
  sheetCode: string

  /** URL file PDF phiếu trả lời (để in) */
  @Prop()
  pdfUrl?: string

  // ── Camera grading ───────────────────────────────────────
  /** URLs ảnh chụp phiếu thi đã điền */
  @Prop({ type: [String], default: [] })
  scannedImageUrls: string[]

  @Prop({
    enum: ['PENDING', 'PROCESSING', 'GRADED', 'ERROR', 'MANUAL_REVIEW'],
    default: 'PENDING',
  })
  gradingStatus: GradingStatus

  /**
   * Đáp án nhận dạng từ AI/OpenCV.
   * Có thể thiếu hoặc sai nếu ảnh chụp xấu → cần manual review.
   */
  @Prop({ type: Object })
  detectedAnswers?: DetectedAnswers

  /**
   * Độ tin cậy nhận dạng (0.0 → 1.0).
   * < 0.85 → tự động chuyển sang MANUAL_REVIEW.
   */
  @Prop()
  ocrConfidence?: number

  /**
   * Chỉnh sửa thủ công của giáo viên.
   * Merge lên detectedAnswers để ra finalAnswers.
   */
  @Prop({ type: Object })
  manualCorrections?: DetectedAnswers

  /**
   * Đáp án cuối cùng = detectedAnswers + manualCorrections.
   * Dùng để chấm điểm.
   */
  @Prop({ type: Object })
  finalAnswers?: DetectedAnswers

  @Prop({ type: Object })
  score?: ScoreSummary

  @Prop()
  gradedAt?: Date

  /** 'AI' hoặc ObjectId của giáo viên đã review */
  @Prop()
  gradedBy?: string

  @Prop()
  gradingNotes?: string

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId
}

export const AnswerSheetSchema = SchemaFactory.createForClass(AnswerSheet)
AnswerSheetSchema.index({ organizationId: 1 })
AnswerSheetSchema.index({ examId: 1, variantId: 1 })
AnswerSheetSchema.index({ sessionId: 1 })
AnswerSheetSchema.index({ gradingStatus: 1 })
