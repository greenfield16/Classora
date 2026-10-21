import { IsOptional, IsString } from 'class-validator'

export class CreateStudentDto {
  @IsString()
  fullName: string

  @IsString()
  className: string

  @IsString()
  academicYear: string

  @IsOptional()
  @IsString()
  school?: string
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  fullName?: string

  @IsOptional()
  @IsString()
  className?: string

  @IsOptional()
  @IsString()
  academicYear?: string

  @IsOptional()
  @IsString()
  school?: string
}

export class StudentQueryDto {
  @IsOptional()
  @IsString()
  academicYear?: string

  @IsOptional()
  @IsString()
  className?: string

  @IsOptional()
  @IsString()
  school?: string

  @IsOptional()
  @IsString()
  keyword?: string

  @IsOptional()
  @IsString()
  examType?: string

  @IsOptional()
  @IsString()
  customExamLabel?: string
}

export class ResultReportQueryDto {
  @IsOptional()
  @IsString()
  academicYear?: string

  @IsOptional()
  @IsString()
  className?: string

  @IsOptional()
  @IsString()
  school?: string

  @IsOptional()
  @IsString()
  examId?: string

  @IsOptional()
  @IsString()
  examType?: string

  @IsOptional()
  @IsString()
  customExamLabel?: string
}
