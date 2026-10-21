import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type UserDocument = User & Document

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string

  @Prop({ required: true })
  password: string

  @Prop({ required: true, trim: true })
  name: string

  @Prop({ enum: ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT'], default: 'TEACHER' })
  role: string

  @Prop({ type: Types.ObjectId })
  organizationId?: Types.ObjectId

  @Prop({ default: true })
  isActive: boolean

}

export const UserSchema = SchemaFactory.createForClass(User)
