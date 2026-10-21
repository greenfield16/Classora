import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type StudentDocument = Student & Document

@Schema({ timestamps: true, collection: 'students' })
export class Student {
  @Prop({ required: true, trim: true })
  fullName: string

  @Prop({ required: true, trim: true })
  className: string

  @Prop({ required: true, trim: true })
  academicYear: string // Ví dụ: 2025-2026

  @Prop({ required: true, trim: true, default: 'GDTX Lê Quí Đôn' })
  school: string

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId
}

export const StudentSchema = SchemaFactory.createForClass(Student)
StudentSchema.index({ organizationId: 1 })
StudentSchema.index({ academicYear: 1, className: 1, fullName: 1 })
StudentSchema.index({ fullName: 1, className: 1, academicYear: 1, school: 1 }, { unique: true })
