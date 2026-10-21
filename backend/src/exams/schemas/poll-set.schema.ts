import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type PollSetDocument = PollSet & Document
export type PollQuestionType = 'SINGLE_CHOICE' | 'YES_NO' | 'TEXT'

@Schema({ _id: false })
class PollOption {
  @Prop({ required: true, trim: true })
  text: string
}

@Schema({ _id: false })
class PollQuestion {
  @Prop({ required: true, trim: true })
  prompt: string

  @Prop({ required: true, enum: ['SINGLE_CHOICE', 'YES_NO', 'TEXT'] })
  type: PollQuestionType

  @Prop({ type: [PollOption], default: [] })
  options: PollOption[]

  @Prop({ default: 20, min: 5 })
  durationSeconds: number

  @Prop({ default: true })
  showResults: boolean
}

@Schema({ timestamps: true, collection: 'poll_sets' })
export class PollSet {
  @Prop({ required: true, trim: true })
  title: string

  @Prop()
  description?: string

  @Prop({ type: [PollQuestion], default: [] })
  questions: PollQuestion[]

  @Prop({ type: Types.ObjectId })
  createdBy?: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId
}

export const PollSetSchema = SchemaFactory.createForClass(PollSet)
PollSetSchema.index({ organizationId: 1, createdAt: -1 })
