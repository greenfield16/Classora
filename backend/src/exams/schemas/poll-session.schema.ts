import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type PollSessionDocument = PollSession & Document

@Schema({ timestamps: true, collection: 'poll_sessions' })
export class PollSession {
  @Prop({ type: Types.ObjectId, ref: 'PollSet', required: true })
  setId: Types.ObjectId

  @Prop({ required: true, uppercase: true, trim: true })
  code: string

  @Prop({ enum: ['WAITING', 'LIVE', 'ENDED'], default: 'WAITING' })
  status: 'WAITING' | 'LIVE' | 'ENDED'

  @Prop({ default: 0 })
  currentQuestionIndex: number

  @Prop()
  questionStartedAt?: Date

  @Prop()
  startedAt?: Date

  @Prop()
  endedAt?: Date

  @Prop({ type: Types.ObjectId })
  hostId?: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId
}

export const PollSessionSchema = SchemaFactory.createForClass(PollSession)
PollSessionSchema.index({ code: 1 }, { unique: true })
PollSessionSchema.index({ organizationId: 1, createdAt: -1 })
