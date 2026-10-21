import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type QuizSetDocument = QuizSet & Document

@Schema({ _id: false })
class QuizChoice {
  @Prop({ required: true, trim: true })
  text: string
}

@Schema({ _id: false })
class QuizQuestion {
  @Prop({ required: true, trim: true })
  prompt: string

  @Prop({ type: [QuizChoice], default: [] })
  choices: QuizChoice[]

  @Prop({ required: true, min: 0 })
  correctIndex: number

  @Prop()
  explanation?: string
}

@Schema({ timestamps: true, collection: 'quiz_sets' })
export class QuizSet {
  @Prop({ required: true, trim: true })
  title: string

  @Prop()
  description?: string

  @Prop({ type: [QuizQuestion], default: [] })
  questions: QuizQuestion[]

  @Prop({ type: Types.ObjectId, ref: 'Subject' })
  subjectId?: Types.ObjectId

  @Prop()
  gradeLevel?: number

  @Prop({ type: Types.ObjectId })
  createdBy?: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId
}

export const QuizSetSchema = SchemaFactory.createForClass(QuizSet)
QuizSetSchema.index({ organizationId: 1, createdAt: -1 })
