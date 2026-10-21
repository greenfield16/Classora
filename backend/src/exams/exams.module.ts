import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Subject, SubjectSchema } from './schemas/subject.schema'
import { Question, QuestionSchema } from './schemas/question.schema'
import { Exam, ExamSchema } from './schemas/exam.schema'
import { ExamVariant, ExamVariantSchema } from './schemas/exam-variant.schema'
import { ExamSession, ExamSessionSchema } from './schemas/exam-session.schema'
import { AnswerSheet, AnswerSheetSchema } from './schemas/answer-sheet.schema'
import { ExamSessionLog, ExamSessionLogSchema } from './schemas/exam-session-log.schema'
import { Student, StudentSchema } from './schemas/student.schema'
import { ExamResult, ExamResultSchema } from './schemas/exam-result.schema'
import { QuizSet, QuizSetSchema } from './schemas/quiz-set.schema'
import { QuizSession, QuizSessionSchema } from './schemas/quiz-session.schema'
import { QuizParticipant, QuizParticipantSchema } from './schemas/quiz-participant.schema'
import { QuizAnswer, QuizAnswerSchema } from './schemas/quiz-answer.schema'
import { PollSet, PollSetSchema } from './schemas/poll-set.schema'
import { PollSession, PollSessionSchema } from './schemas/poll-session.schema'
import { PollParticipant, PollParticipantSchema } from './schemas/poll-participant.schema'
import { PollResponse, PollResponseSchema } from './schemas/poll-response.schema'
import { FlashcardSet, FlashcardSetSchema } from './schemas/flashcard-set.schema'
import { FlashcardProgress, FlashcardProgressSchema } from './schemas/flashcard-progress.schema'
import { ExamsService } from './exams.service'
import { ExamAiService } from './services/exam-ai.service'
import { PdfReportService } from './services/pdf-report.service'
import { ExamsController } from './exams.controller'
import { LicensingModule } from '../licensing/licensing.module'

@Module({
  imports: [
    LicensingModule,
    MongooseModule.forFeature(
      [
        { name: Subject.name, schema: SubjectSchema },
        { name: Question.name, schema: QuestionSchema },
        { name: Exam.name, schema: ExamSchema },
        { name: ExamVariant.name, schema: ExamVariantSchema },
        { name: ExamSession.name, schema: ExamSessionSchema },
        { name: AnswerSheet.name, schema: AnswerSheetSchema },
        { name: ExamSessionLog.name, schema: ExamSessionLogSchema },
        { name: Student.name, schema: StudentSchema },
        { name: ExamResult.name, schema: ExamResultSchema },
        { name: QuizSet.name, schema: QuizSetSchema },
        { name: QuizSession.name, schema: QuizSessionSchema },
        { name: QuizParticipant.name, schema: QuizParticipantSchema },
        { name: QuizAnswer.name, schema: QuizAnswerSchema },
        { name: PollSet.name, schema: PollSetSchema },
        { name: PollSession.name, schema: PollSessionSchema },
        { name: PollParticipant.name, schema: PollParticipantSchema },
        { name: PollResponse.name, schema: PollResponseSchema },
        { name: FlashcardSet.name, schema: FlashcardSetSchema },
        { name: FlashcardProgress.name, schema: FlashcardProgressSchema },
      ],
      'mgmt',
    ),
  ],
  providers: [ExamsService, ExamAiService, PdfReportService],
  controllers: [ExamsController],
  exports: [ExamsService, ExamAiService, PdfReportService],
})
export class ExamsModule { }
