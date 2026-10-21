import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type FlashcardProgressDocument = FlashcardProgress & Document

/**
 * Tiến độ học SRS (SM-2 algorithm) của một học sinh ẩn danh trên một thẻ.
 * Dùng sessionKey (từ localStorage) để nhận diện, không cần đăng nhập.
 */
@Schema({ timestamps: true, collection: 'flashcard_progress' })
export class FlashcardProgress {
  @Prop({ type: Types.ObjectId, ref: 'FlashcardSet', required: true })
  setId: Types.ObjectId

  /** Key từ localStorage của học sinh — không cần đăng nhập */
  @Prop({ required: true })
  sessionKey: string

  /** Index của thẻ trong set (dùng index thay ObjectId để đơn giản) */
  @Prop({ required: true })
  cardIndex: number

  // ── SM-2 parameters ─────────────────────────────────────
  /** Ease factor (SM-2) — bắt đầu 2.5 */
  @Prop({ default: 2.5 })
  easeFactor: number

  /** Khoảng cách lần ôn tiếp theo (ngày) */
  @Prop({ default: 1 })
  interval: number

  /** Số lần đã lặp thành công */
  @Prop({ default: 0 })
  repetitions: number

  /** Lần ôn tiếp theo */
  @Prop()
  nextReviewAt: Date

  /** Rating lần cuối: 0=Không nhớ, 1=Khó, 2=Ổn, 3=Dễ */
  @Prop({ min: 0, max: 3 })
  lastRating?: number
}

export const FlashcardProgressSchema = SchemaFactory.createForClass(FlashcardProgress)
FlashcardProgressSchema.index({ setId: 1, sessionKey: 1, cardIndex: 1 }, { unique: true })
FlashcardProgressSchema.index({ sessionKey: 1, nextReviewAt: 1 })
