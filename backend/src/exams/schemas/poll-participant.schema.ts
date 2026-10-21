import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type PollParticipantDocument = PollParticipant & Document

@Schema({ timestamps: true, collection: 'poll_participants' })
export class PollParticipant {
  @Prop({ type: Types.ObjectId, ref: 'PollSession', required: true })
  sessionId: Types.ObjectId

  @Prop({ required: true, trim: true })
  name: string

  @Prop({ default: false })
  isAnonymous: boolean

  @Prop({ default: -1 })
  lastAnsweredIndex: number
}

export const PollParticipantSchema = SchemaFactory.createForClass(PollParticipant)
PollParticipantSchema.index({ sessionId: 1, createdAt: -1 })
