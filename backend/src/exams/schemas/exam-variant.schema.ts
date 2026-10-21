import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type ExamVariantDocument = ExamVariant & Document

/**
 * Mã đề trộn — được sinh tự động khi exam được publish.
 * Mỗi variant có thứ tự câu hỏi và đáp án riêng.
 *
 * Ví dụ: variantCount = 4 → sinh ra mã đề 101, 102, 103, 104
 * Học sinh được gán variant dựa trên hash(name + class + school) % variantCount
 * → cùng thông tin → cùng mã đề (idempotent, có thể reload)
 */
@Schema({ timestamps: true, collection: 'exam_variants' })
export class ExamVariant {
  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  examId: Types.ObjectId

  /** Số mã đề, ví dụ 101, 102, 103, 104 */
  @Prop({ required: true })
  variantCode: number

  // ── Thứ tự câu hỏi sau khi trộn ─────────────────────────
  /** Thứ tự câu hỏi Phần I đã trộn */
  @Prop({ type: [Types.ObjectId], ref: 'Question', default: [] })
  part1Order: Types.ObjectId[]

  /** Thứ tự câu hỏi Phần II đã trộn */
  @Prop({ type: [Types.ObjectId], ref: 'Question', default: [] })
  part2Order: Types.ObjectId[]

  /** Thứ tự câu hỏi Phần III đã trộn */
  @Prop({ type: [Types.ObjectId], ref: 'Question', default: [] })
  part3Order: Types.ObjectId[]

  /**
   * Map trộn đáp án cho Phần I.
   * key = questionId (string), value = mảng keys đã trộn ['B','A','D','C']
   * (thứ tự hiển thị trên đề, không phải đáp án đúng)
   */
  @Prop({ type: Object, default: {} })
  optionShuffleMap: Record<string, string[]>

  /**
   * Đáp án chuẩn theo variant này (đã tính lại sau khi trộn).
   * Dùng để chấm bài nhanh.
   */
  @Prop({
    type: Object,
    default: {
      part1: {}, // { questionId: 'A'|'B'|'C'|'D' }
      part2: {}, // { questionId: [true, false, true, false] }
      part3: {}, // { questionId: '3.14' }
    },
  })
  answerKey: {
    part1: Record<string, string>
    part2: Record<string, boolean[]>
    part3: Record<string, string>
  }

  /**
   * URL file PDF phiếu trả lời (OMR sheet) cho thi giấy.
   * Được tạo tự động khi variant được publish.
   */
  @Prop()
  answerSheetPdfUrl?: string

  /** URL file PDF đề thi (để in) */
  @Prop()
  examPdfUrl?: string

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId
}

export const ExamVariantSchema = SchemaFactory.createForClass(ExamVariant)
ExamVariantSchema.index({ organizationId: 1 })
ExamVariantSchema.index({ examId: 1, variantCode: 1 }, { unique: true })
ExamVariantSchema.index({ examId: 1 })
