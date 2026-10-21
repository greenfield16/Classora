import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type FlashcardSetDocument = FlashcardSet & Document

@Schema({ _id: false })
class FlashCard {
  @Prop({ required: true })
  front: string // HTML nội dung câu hỏi

  @Prop({ required: true })
  back: string // HTML đáp án + giải thích

  @Prop({ type: Types.ObjectId, ref: 'Question' })
  questionId?: Types.ObjectId // nếu tạo từ ngân hàng câu hỏi

  @Prop()
  imageUrl?: string

  @Prop()
  hint?: string // gợi ý thêm
}
const FlashCardSchema = SchemaFactory.createForClass(FlashCard)

/**
 * Bộ thẻ flashcard — giáo viên tạo từ ngân hàng câu hỏi.
 * Học sinh truy cập qua link public /quiz/flashcard/[accessCode]
 */
@Schema({ timestamps: true, collection: 'flashcard_sets' })
export class FlashcardSet {
  @Prop({ required: true, trim: true })
  title: string

  @Prop({ trim: true })
  description?: string

  @Prop({ type: Types.ObjectId, ref: 'Subject' })
  subjectId?: Types.ObjectId

  @Prop()
  gradeLevel?: number

  @Prop({ type: [FlashCardSchema], default: [] })
  cards: FlashCard[]

  @Prop({ type: [Object], default: [] })
  matchingItems: any[]

  /** Mã truy cập ngắn dùng cho link public */
  @Prop({ unique: true, sparse: true })
  accessCode?: string

  @Prop({ type: Types.ObjectId })
  createdBy?: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId

  @Prop({ default: true })
  isActive: boolean
}

export const FlashcardSetSchema = SchemaFactory.createForClass(FlashcardSet)
FlashcardSetSchema.index({ organizationId: 1 })
