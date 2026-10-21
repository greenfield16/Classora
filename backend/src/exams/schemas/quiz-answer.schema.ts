import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type QuizAnswerDocument = QuizAnswer & Document

@Schema({ timestamps: true, collection: 'quiz_answers' })
export class QuizAnswer {
  @Prop({ type: Types.ObjectId, ref: 'QuizSession', required: true })
  sessionId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'QuizParticipant', required: true })
  participantId: Types.ObjectId

  @Prop({ required: true, min: 0 })
  questionIndex: number

  @Prop({ required: true, min: 0 })
  selectedIndex: number

  @Prop({ required: true })
  isCorrect: boolean

  @Prop({ default: 0 })
  responseMs: number
}

export const QuizAnswerSchema = SchemaFactory.createForClass(QuizAnswer)
QuizAnswerSchema.index({ sessionId: 1, participantId: 1, questionIndex: 1 }, { unique: true })
QuizAnswerSchema.index({ sessionId: 1, questionIndex: 1 })
