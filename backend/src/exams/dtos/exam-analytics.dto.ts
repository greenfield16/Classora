import { IsString, IsNumber, IsArray, IsOptional, IsEnum } from 'class-validator'

export class TrackExamEventDto {
  @IsString()
  sessionId: string

  @IsEnum(['START', 'SUBMIT', 'WARNING_5MIN', 'WARNING_1MIN', 'FOCUS_LOST', 'SCROLL', 'CLICK'])
  eventType: string

  @IsOptional()
  metadata?: Record<string, any>
}

export class SubmitExamDto {
  @IsString()
  sessionId: string

  @IsString()
  examId: string

  @IsString()
  studentId: string

  @IsArray()
  @IsString({ each: true })
  unansweredQuestionIds: string[]

  @IsNumber()
  unansweredCount: number

  @IsNumber()
  totalQuestions: number

  @IsNumber()
  answeredCount: number

  @IsNumber()
  timeSpentSeconds: number

  @IsNumber()
  timeLeftSeconds: number

  @IsEnum(['submitted', 'timeout', 'incomplete'])
  submissionStatus: 'submitted' | 'timeout' | 'incomplete'
}

export class AnalyzeExamSessionDto {
  @IsString()
  sessionId: string
}
