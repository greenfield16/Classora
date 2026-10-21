import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type SubjectDocument = Subject & Document

/** Môn học — dùng cho ngân hàng câu hỏi & đề thi */
@Schema({ timestamps: true, collection: 'exam_subjects' })
export class Subject {
  @Prop({ required: true, trim: true })
  name: string // 'Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lí'…

  @Prop({ required: true, uppercase: true, trim: true })
  code: string // 'MATH', 'LIT', 'ENG', 'PHY'…

  @Prop({ type: [Number], default: [10, 11, 12] })
  gradeLevels: number[] // khối lớp áp dụng

  @Prop({ default: '#6366f1' })
  color: string // màu hiển thị trên UI

  @Prop({ default: true })
  isActive: boolean

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId
}

export const SubjectSchema = SchemaFactory.createForClass(Subject)
SubjectSchema.index({ organizationId: 1 })
SubjectSchema.index({ organizationId: 1, code: 1 }, { unique: true })
