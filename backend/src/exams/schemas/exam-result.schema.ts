import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type ExamResultDocument = ExamResult & Document

@Schema({ timestamps: true, collection: 'exam_results' })
export class ExamResult {
  @Prop({ type: Types.ObjectId, ref: 'Student', required: true })
  studentId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  examId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'ExamSession', required: true })
  sessionId: Types.ObjectId

  @Prop({ required: true, trim: true })
  fullName: string

  @Prop({ required: true, trim: true })
  className: string

  @Prop({ required: true, trim: true })
  academicYear: string

  @Prop({ required: true, trim: true, default: 'GDTX Lê Quí Đôn' })
  school: string

  @Prop({ required: true })
  score: number

  @Prop({ required: true, default: 10 })
  maxScore: number

  @Prop({ required: true, default: 0 })
  percentage: number

  @Prop({ type: Object })
  scoreBreakdown?: any

  @Prop({ required: true, default: 0 })
  unansweredCount: number

  @Prop({ required: true, default: 0 })
  answeredCount: number

  @Prop({ required: true, default: 0 })
  totalQuestions: number

  @Prop({ required: true, default: 0 })
  timeSpentSeconds: number

  @Prop({ enum: ['SUBMITTED', 'TIMED_OUT', 'INCOMPLETE'], default: 'SUBMITTED' })
  status: 'SUBMITTED' | 'TIMED_OUT' | 'INCOMPLETE'

  @Prop({ default: () => new Date() })
  submittedAt: Date

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId
}

export const ExamResultSchema = SchemaFactory.createForClass(ExamResult)
ExamResultSchema.index({ organizationId: 1 })
ExamResultSchema.index({ sessionId: 1 }, { unique: true })
ExamResultSchema.index({ studentId: 1, academicYear: 1 })
ExamResultSchema.index({ examId: 1, academicYear: 1 })
ExamResultSchema.index({ academicYear: 1, className: 1, school: 1 })
