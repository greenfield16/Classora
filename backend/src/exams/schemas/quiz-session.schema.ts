import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type QuizSessionDocument = QuizSession & Document

@Schema({ timestamps: true, collection: 'quiz_sessions' })
export class QuizSession {
  @Prop({ type: Types.ObjectId, ref: 'QuizSet', required: true })
  setId: Types.ObjectId

  @Prop({ required: true, uppercase: true, trim: true })
  code: string

  @Prop({ enum: ['WAITING', 'LIVE', 'ENDED'], default: 'WAITING' })
  status: 'WAITING' | 'LIVE' | 'ENDED'

  @Prop({ default: 20 })
  timePerQuestion: number

  @Prop({ default: -1 })
  currentQuestionIndex: number

  @Prop()
  startedAt?: Date

  @Prop()
  endedAt?: Date

  @Prop({ type: Types.ObjectId })
  hostId?: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId
}

export const QuizSessionSchema = SchemaFactory.createForClass(QuizSession)
QuizSessionSchema.index({ code: 1 }, { unique: true })
QuizSessionSchema.index({ organizationId: 1, createdAt: -1 })
