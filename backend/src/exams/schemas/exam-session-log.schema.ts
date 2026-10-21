import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

@Schema({ timestamps: true })
export class ExamSessionLog extends Document {
  @Prop({ type: Types.ObjectId, required: true })
  examId: string

  @Prop({ type: Types.ObjectId, required: true })
  studentId: string

  @Prop({ type: Date, default: Date.now })
  startedAt: Date

  @Prop()
  submittedAt?: Date

  @Prop({ type: Number, default: 0 })
  timeSpentSeconds: number

  @Prop({ type: Number, default: 0 })
  timeLeftSeconds: number

  // ⭐ Unanswered questions tracking
  @Prop({ type: [String], default: [] })
  unansweredQuestionIds: string[]

  @Prop({ type: Number, default: 0 })
  unansweredCount: number

  @Prop({ type: Number, default: 0 })
  totalQuestions: number

  @Prop({ type: Number, default: 0 })
  answeredCount: number

  // ⭐ Event logs for analytics
  @Prop({
    type: [
      {
        type: { type: String, enum: ['START', 'SUBMIT', 'WARNING_5MIN', 'WARNING_1MIN', 'FOCUS_LOST', 'SCROLL', 'CLICK'] },
        timestamp: Date,
        metadata: Object,
      },
    ],
    default: [],
  })
  events: Array<{
    type: string
    timestamp: Date
    metadata?: any
  }>

  @Prop({ type: String, enum: ['submitted', 'timeout', 'incomplete'], default: 'incomplete' })
  submissionStatus: string

  @Prop()
  analyzedAt?: Date

  @Prop({ type: Object })
  aiAnalysis?: {
    riskLevel: 'low' | 'medium' | 'high'
    suggestions: string[]
    strengthAreas: string[]
    improvementAreas: string[]
  }

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId
}

export const ExamSessionLogSchema = SchemaFactory.createForClass(ExamSessionLog)
ExamSessionLogSchema.index({ organizationId: 1 })
ExamSessionLogSchema.index({ examId: 1, studentId: 1 })
ExamSessionLogSchema.index({ createdAt: 1 })
