import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type QuizParticipantDocument = QuizParticipant & Document

@Schema({ timestamps: true, collection: 'quiz_participants' })
export class QuizParticipant {
  @Prop({ type: Types.ObjectId, ref: 'QuizSession', required: true })
  sessionId: Types.ObjectId

  @Prop({ required: true, trim: true })
  name: string

  @Prop({ default: 0 })
  score: number

  @Prop({ default: 0 })
  correctCount: number

  @Prop({ default: -1 })
  lastAnsweredIndex: number
}

export const QuizParticipantSchema = SchemaFactory.createForClass(QuizParticipant)
QuizParticipantSchema.index({ sessionId: 1, createdAt: -1 })
