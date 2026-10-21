import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type PollResponseDocument = PollResponse & Document

@Schema({ timestamps: true, collection: 'poll_responses' })
export class PollResponse {
  @Prop({ type: Types.ObjectId, ref: 'PollSession', required: true })
  sessionId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'PollParticipant', required: true })
  participantId: Types.ObjectId

  @Prop({ required: true, min: 0 })
  questionIndex: number

  @Prop({ type: [Number], default: [] })
  selectedIndices: number[]

  @Prop({ trim: true })
  textAnswer?: string
}

export const PollResponseSchema = SchemaFactory.createForClass(PollResponse)
PollResponseSchema.index({ sessionId: 1, participantId: 1, questionIndex: 1 }, { unique: true })
PollResponseSchema.index({ sessionId: 1, questionIndex: 1 })
