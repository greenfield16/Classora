import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Req, HttpCode,
  UseInterceptors, UploadedFile, BadRequestException,
  Res,
} from '@nestjs/common'
import { Response } from 'express'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuth } from '../auth/guards'
import { LicenseGuard, RequireLicenseFeature } from '../licensing/license.guard'
import { ExamsService } from './exams.service'
import { ExamAiService } from './services/exam-ai.service'
import { parseDocxBuffer } from './docx-parser'
import { SubmitExamDto, TrackExamEventDto } from './dtos/exam-analytics.dto'
import { CreateStudentDto, ResultReportQueryDto, StudentQueryDto, UpdateStudentDto } from './dtos/student-management.dto'
import { LicensingService } from '../licensing/licensing.service'

// ── Admin / Teacher routes (JWT protected) ────────────────────────────────────
@Controller('exams')
@RequireLicenseFeature('exams')
export class ExamsController {
  constructor(
    private readonly svc: ExamsService,
    private readonly aiSvc: ExamAiService,
    private readonly licensingSvc: LicensingService,
  ) { }

  // ── Stats ─────────────────────────────────────────────
  @Get('stats')
  @UseGuards(JwtAuth(), LicenseGuard)
  getStats(@Req() req: any) {
    return this.svc.getExamStats(req.user?.organizationId)
  }

  // ══════════════════════════════════════════════════════
  //  SUBJECTS
  // ══════════════════════════════════════════════════════

  @Get('subjects')
  @UseGuards(JwtAuth(), LicenseGuard)
  getSubjects(@Req() req: any) {
    return this.svc.getSubjects(req.user?.organizationId)
  }

  @Post('subjects')
  @UseGuards(JwtAuth(), LicenseGuard)
  createSubject(@Body() body: any, @Req() req: any) {
    return this.svc.createSubject(body, req.user?.organizationId)
  }

  @Patch('subjects/:id')
  @UseGuards(JwtAuth(), LicenseGuard)
  updateSubject(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.svc.updateSubject(id, body, req.user?.organizationId)
  }

  // ══════════════════════════════════════════════════════
  //  QUESTION BANK
  // ══════════════════════════════════════════════════════

  @Get('questions')
  @UseGuards(JwtAuth(), LicenseGuard)
  getQuestions(@Query() q: any, @Req() req: any) {
    return this.svc.getQuestions({
      subjectId: q.subjectId,
      gradeLevel: q.gradeLevel ? Number(q.gradeLevel) : undefined,
      type: q.type,
      difficulty: q.difficulty,
      chapter: q.chapter,
      tags: q.tags ? (Array.isArray(q.tags) ? q.tags : [q.tags]) : undefined,
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 50,
    }, req.user?.organizationId)
  }

  /**
   * POST /exams/questions/parse-docx
   * Upload a .docx file and parse it into question objects (does NOT save to DB).
   * Returns { questions: ParsedQuestion[] } ready to pass to importQuestions.
   */
  @Post('questions/parse-docx')
  @UseGuards(JwtAuth(), LicenseGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async parseDocx(@UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number }) {
    if (!file) throw new BadRequestException('Vui lòng upload file .docx')
    const questions = await parseDocxBuffer(file.buffer)
    return { questions, total: questions.length }
  }

  @Post('questions')
  @UseGuards(JwtAuth(), LicenseGuard)
  createQuestion(@Body() body: any, @Req() req: any) {
    return this.svc.createQuestion(body, req.user?.userId, req.user?.organizationId)
  }

  @Post('questions/import')
  @UseGuards(JwtAuth(), LicenseGuard)
  importQuestions(
    @Body() body: { questions: any[]; defaultSubjectId: string; defaultGradeLevel: number },
    @Req() req: any,
  ) {
    return this.svc.importQuestions(body.questions, body.defaultSubjectId, body.defaultGradeLevel, req.user?.userId, req.user?.organizationId)
  }

  @Patch('questions/:id')
  @UseGuards(JwtAuth(), LicenseGuard)
  updateQuestion(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.svc.updateQuestion(id, body, req.user?.organizationId)
  }

  @Delete('questions/:id')
  @UseGuards(JwtAuth(), LicenseGuard)
  @HttpCode(204)
  deleteQuestion(@Param('id') id: string, @Req() req: any) {
    return this.svc.deleteQuestion(id, req.user?.organizationId)
  }

  // ══════════════════════════════════════════════════════
  //  STUDENTS & RESULTS (THEO NĂM HỌC)
  // ══════════════════════════════════════════════════════

  @Get('students')
  @UseGuards(JwtAuth(), LicenseGuard)
  getStudents(@Query() q: StudentQueryDto & { page?: string; limit?: string }, @Req() req: any) {
    return this.svc.getStudents({
      academicYear: q.academicYear,
      className: q.className,
      school: q.school,
      keyword: q.keyword,
      examType: q.examType,
      customExamLabel: q.customExamLabel,
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 50,
    }, req.user?.organizationId)
  }

  @Post('students')
  @UseGuards(JwtAuth(), LicenseGuard)
  createStudent(@Body() body: CreateStudentDto, @Req() req: any) {
    return this.svc.createStudent(body, req.user?.organizationId)
  }

  @Patch('students/:id')
  @UseGuards(JwtAuth(), LicenseGuard)
  updateStudent(@Param('id') id: string, @Body() body: UpdateStudentDto, @Req() req: any) {
    return this.svc.updateStudent(id, body, req.user?.organizationId)
  }

  @Get('students/:id/results')
  @UseGuards(JwtAuth(), LicenseGuard)
  getStudentResults(
    @Param('id') id: string,
    @Req() req: any,
    @Query('academicYear') academicYear?: string,
    @Query('examId') examId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getStudentResults(id, {
      academicYear,
      examId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    }, req.user?.organizationId)
  }

  @Get('results/report')
  @UseGuards(JwtAuth(), LicenseGuard)
  getResultReport(@Query() q: ResultReportQueryDto) {
    return this.svc.getResultReport({
      academicYear: q.academicYear,
      className: q.className,
      school: q.school,
      examId: q.examId,
      examType: q.examType,
      customExamLabel: q.customExamLabel,
    })
  }

  // ══════════════════════════════════════════════════════
  //  EXAMS — quản lý đề thi (admin/teacher)
  // ══════════════════════════════════════════════════════

  @Get()
  @UseGuards(JwtAuth(), LicenseGuard)
  getExams(@Query() q: any, @Req() req: any) {
    return this.svc.getExams({
      subjectId: q.subjectId,
      gradeLevel: q.gradeLevel ? Number(q.gradeLevel) : undefined,
      status: q.status,
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 20,
    }, req.user?.organizationId)
  }

  @Get(':id')
  @UseGuards(JwtAuth(), LicenseGuard)
  getExamById(@Param('id') id: string, @Req() req: any) {
    return this.svc.getExamById(id, req.user?.organizationId)
  }

  @Get(':id/questions')
  @UseGuards(JwtAuth(), LicenseGuard)
  getExamQuestions(@Param('id') id: string, @Req() req: any) {
    return this.svc.getExamQuestions(id, req.user?.organizationId)
  }

  @Post()
  @UseGuards(JwtAuth(), LicenseGuard)
  createExam(@Body() body: any, @Req() req: any) {
    return this.svc.createExam(body, req.user?.userId, req.user?.organizationId)
  }

  @Patch(':id')
  @UseGuards(JwtAuth(), LicenseGuard)
  updateExam(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.svc.updateExam(id, body, req.user?.organizationId)
  }

  @Delete(':id')
  @UseGuards(JwtAuth(), LicenseGuard)
  @HttpCode(204)
  deleteExam(@Param('id') id: string, @Req() req: any) {
    return this.svc.deleteExam(id, req.user?.organizationId)
  }

  /**
   * POST /exams/:id/publish
   * Sinh accessCode, QR code và tất cả ExamVariant.
   * Sau đó trả về link + QR để giáo viên chia sẻ.
   */
  @Post(':id/publish')
  @UseGuards(JwtAuth(), LicenseGuard)
  publishExam(@Param('id') id: string, @Req() req: any) {
    return this.svc.publishExam(id, req.user?.organizationId)
  }

  /**
   * GET /exams/:id/results
   * Danh sách kết quả thi của tất cả học sinh.
   */
  @Get(':id/results')
  @UseGuards(JwtAuth(), LicenseGuard)
  getResults(@Param('id') id: string, @Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.svc.getExamResults(id, page ? Number(page) : 1, limit ? Number(limit) : 50, req.user?.organizationId)
  }

  // ══════════════════════════════════════════════════════
  //  QUIZ LIVE (teacher/admin)
  // ══════════════════════════════════════════════════════

  @Get('quiz/sets')
  @UseGuards(JwtAuth(), LicenseGuard)
  getQuizSets(@Req() req: any) {
    return this.svc.getQuizSets(req.user?.organizationId)
  }

  @Post('quiz/sets')
  @UseGuards(JwtAuth(), LicenseGuard)
  createQuizSet(@Body() body: any, @Req() req: any) {
    return this.svc.createQuizSet(body, req.user?.userId, req.user?.organizationId)
  }

  @Patch('quiz/sets/:id')
  @UseGuards(JwtAuth(), LicenseGuard)
  updateQuizSet(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.svc.updateQuizSet(id, body, req.user?.organizationId)
  }

  @Delete('quiz/sets/:id')
  @UseGuards(JwtAuth(), LicenseGuard)
  deleteQuizSet(@Param('id') id: string, @Req() req: any) {
    return this.svc.deleteQuizSet(id, req.user?.organizationId)
  }

  @Post('quiz/sessions/start')
  @UseGuards(JwtAuth(), LicenseGuard)
  startQuizSession(@Body() body: { setId: string; timePerQuestion?: number }, @Req() req: any) {
    return this.svc.startQuizSession(body, req.user?.userId, req.user?.organizationId)
  }

  @Get('quiz/sessions/:id')
  @UseGuards(JwtAuth(), LicenseGuard)
  getQuizSession(@Param('id') id: string, @Req() req: any) {
    return this.svc.getQuizSessionAdmin(id, req.user?.organizationId)
  }

  @Post('quiz/sessions/:id/begin')
  @UseGuards(JwtAuth(), LicenseGuard)
  beginQuizSession(@Param('id') id: string, @Req() req: any) {
    return this.svc.beginQuizSession(id, req.user?.organizationId)
  }

  @Post('quiz/sessions/:id/next')
  @UseGuards(JwtAuth(), LicenseGuard)
  nextQuizQuestion(@Param('id') id: string, @Req() req: any) {
    return this.svc.nextQuizQuestion(id, req.user?.organizationId)
  }

  @Post('quiz/sessions/:id/end')
  @UseGuards(JwtAuth(), LicenseGuard)
  endQuizSession(@Param('id') id: string, @Req() req: any) {
    return this.svc.endQuizSession(id, req.user?.organizationId)
  }

  // Public quiz (học sinh)
  @Get('quiz/public/sets/:id')
  getPublicQuizSet(@Param('id') id: string) {
    return this.svc.getPublicQuizSet(id)
  }

  @Post('quiz/public/:code/join')
  joinQuiz(@Param('code') code: string, @Body() body: { name: string }) {
    return this.svc.joinQuizSessionByCode(code, body.name)
  }

  @Get('quiz/public/:code/state')
  getQuizState(@Param('code') code: string, @Query('participantId') participantId?: string) {
    return this.svc.getQuizPublicState(code, participantId)
  }

  @Post('quiz/public/:code/answer')
  submitQuizAnswer(
    @Param('code') code: string,
    @Body() body: { participantId: string; selectedIndex: number; responseMs?: number },
  ) {
    return this.svc.submitQuizAnswer(code, body)
  }

  // ══════════════════════════════════════════════════════
  //  POLL LIVE (teacher/admin)
  // ══════════════════════════════════════════════════════

  @Get('poll/sets')
  @UseGuards(JwtAuth(), LicenseGuard)
  getPollSets(@Req() req: any) {
    return this.svc.getPollSets(req.user?.organizationId)
  }

  @Post('poll/sets')
  @UseGuards(JwtAuth(), LicenseGuard)
  createPollSet(@Body() body: any, @Req() req: any) {
    return this.svc.createPollSet(body, req.user?.userId, req.user?.organizationId)
  }

  @Patch('poll/sets/:id')
  @UseGuards(JwtAuth(), LicenseGuard)
  updatePollSet(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.svc.updatePollSet(id, body, req.user?.organizationId)
  }

  @Delete('poll/sets/:id')
  @UseGuards(JwtAuth(), LicenseGuard)
  deletePollSet(@Param('id') id: string, @Req() req: any) {
    return this.svc.deletePollSet(id, req.user?.organizationId)
  }

  @Post('poll/sessions/start')
  @UseGuards(JwtAuth(), LicenseGuard)
  startPollSession(@Body() body: { setId: string }, @Req() req: any) {
    return this.svc.startPollSession(body, req.user?.userId, req.user?.organizationId)
  }

  @Get('poll/sessions/:id')
  @UseGuards(JwtAuth(), LicenseGuard)
  getPollSession(@Param('id') id: string, @Req() req: any) {
    return this.svc.getPollSessionAdmin(id, req.user?.organizationId)
  }

  @Post('poll/sessions/:id/next')
  @UseGuards(JwtAuth(), LicenseGuard)
  nextPollQuestion(@Param('id') id: string, @Req() req: any) {
    return this.svc.nextPollQuestion(id, req.user?.organizationId)
  }

  @Post('poll/sessions/:id/end')
  @UseGuards(JwtAuth(), LicenseGuard)
  endPollSession(@Param('id') id: string, @Req() req: any) {
    return this.svc.endPollSession(id, req.user?.organizationId)
  }

  @Post('poll/public/:code/join')
  joinPoll(@Param('code') code: string, @Body() body: { name: string; isAnonymous?: boolean }) {
    return this.svc.joinPollSessionByCode(code, body.name, body.isAnonymous)
  }

  @Get('poll/public/:code/state')
  getPollState(@Param('code') code: string, @Query('participantId') participantId?: string) {
    return this.svc.getPollPublicState(code, participantId)
  }

  @Post('poll/public/:code/respond')
  submitPollResponse(
    @Param('code') code: string,
    @Body() body: { participantId: string; selectedIndices?: number[]; textAnswer?: string },
  ) {
    return this.svc.submitPollResponse(code, body)
  }

  // ══════════════════════════════════════════════════════
  //  ANSWER SHEETS — chấm bài giấy (teacher)
  // ══════════════════════════════════════════════════════

  /**
   * POST /exams/sheets/:id/upload-scan
   * Upload ảnh phiếu trả lời đã điền để AI chấm.
   * Body: { imageUrls: string[] }
   */
  @Post('sheets/:id/upload-scan')
  @UseGuards(JwtAuth(), LicenseGuard)
  uploadScan(@Param('id') id: string, @Body() body: { imageUrls: string[] }, @Req() req: any) {
    return this.svc.uploadSheetScan(id, body.imageUrls, req.user?.organizationId)
  }

  /**
   * POST /exams/sheets/:id/grade
   * Nhập kết quả chấm (từ AI OCR hoặc nhập tay).
   * Body: { detectedAnswers, confidence?, gradedBy? }
   */
  @Post('sheets/:id/grade')
  @UseGuards(JwtAuth(), LicenseGuard)
  gradeSheet(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.svc.gradeSheet(id, body.detectedAnswers, body.confidence, body.gradedBy, req.user?.organizationId)
  }

  /**
   * POST /exams/:id/scan-and-grade
   * Chụp ảnh phiếu làm bài bất kỳ và chấm điểm ngay lập tức bằng AI
   */
  @Post(':id/scan-and-grade')
  @UseGuards(JwtAuth(), LicenseGuard)
  scanAndGrade(@Param('id') id: string, @Body() body: { imageUrl: string }, @Req() req: any) {
    return this.svc.scanAndGrade(id, body.imageUrl, req.user?.organizationId)
  }

  /**
   * PATCH /exams/sheets/:id/correct
   * Chỉnh sửa thủ công đáp án nhận dạng sai.
   * Body: { corrections: { part1, part2, part3 } }
   */
  @Patch('sheets/:id/correct')
  @UseGuards(JwtAuth(), LicenseGuard)
  correctSheet(@Param('id') id: string, @Body() body: { corrections: any }, @Req() req: any) {
    return this.svc.applyManualCorrection(id, body.corrections, req.user?.organizationId)
  }

  // ══════════════════════════════════════════════════════
  //  PUBLIC — học sinh (không cần đăng nhập)
  // ══════════════════════════════════════════════════════

  /**
   * GET /exams/public/:code
   * Lấy thông tin đề thi public (tiêu đề, thời gian, môn...).
   * Học sinh dùng để xem thông tin trước khi bắt đầu.
   */
  @Get('public/:code')
  getPublicExam(@Param('code') code: string) {
    return this.svc.getPublicExam(code)
  }

  /**
   * POST /exams/public/:code/start
   * Học sinh nhập thông tin và bắt đầu thi.
   * Trả về sessionId + câu hỏi đã trộn (không có đáp án).
   * Body: { fullName, className, school, deviceFingerprint? }
   */
  @Post('public/:code/start')
  startSession(
    @Param('code') code: string,
    @Body() body: { fullName: string; className: string; academicYear?: string; school?: string; deviceFingerprint?: string },
    @Req() req: any,
  ) {
    return this.svc.startSession(
      code,
      {
        fullName: body.fullName,
        className: body.className,
        academicYear: body.academicYear,
        school: body.school || 'GDTX Lê Quí Đôn',
      },
      body.deviceFingerprint,
      req.ip,
    )
  }

  /**
   * POST /exams/sessions/:id/submit
   * Học sinh nộp bài.
   * Body: { part1: { qId: 'A' }, part2: { qId: [true,false,true,false] }, part3: { qId: '3.14' } }
   */
  @Post('sessions/:id/submit')
  submitSession(@Param('id') id: string, @Body() body: any) {
    return this.svc.submitSession(id, body)
  }

  /**
   * POST /exams/public/:code/paper
   * Học sinh chọn thi giấy → sinh phiếu trả lời (OMR sheet).
   * Trả về sheetCode để giáo viên quét camera chấm.
   * Body: { fullName, className, school? }
   */
  @Post('public/:code/paper')
  createAnswerSheet(
    @Param('code') code: string,
    @Body() body: { fullName: string; className: string; academicYear?: string; school?: string },
  ) {
    return this.svc.createAnswerSheet(code, {
      fullName: body.fullName,
      className: body.className,
      academicYear: body.academicYear,
      school: body.school || 'GDTX Lê Quí Đôn',
    })
  }

  // ══════════════════════════════════════════════════════
  //  EXAM ANALYTICS & CHATBOT CONTEXT
  // ══════════════════════════════════════════════════════

  /**
   * Track exam events (WARNING_5MIN, SUBMIT, etc)
   * Used by frontend to log student behavior
   */
  @Post('session/:sessionId/track-event')
  @HttpCode(200)
  trackExamEvent(
    @Param('sessionId') sessionId: string,
    @Body() dto: TrackExamEventDto,
  ) {
    return this.svc.trackSessionEvent(sessionId, dto.eventType, dto.metadata)
  }

  /**
   * Submit exam and log session
   * Called when student submits or timeout occurs
   */
  @Post('session/submit')
  submitExamSession(@Body() dto: SubmitExamDto) {
    return this.svc.submitExamSession(dto)
  }

  /**
   * Get session analytics with GreenMind AI analysis
   * Used by chatbot to provide smart context & suggestions
   */
  @Get('session/:sessionId/analytics')
  async getSessionAnalytics(@Param('sessionId') sessionId: string) {
    return this.svc.getSessionAnalyticsWithAI(sessionId)
  }

  /**
   * Get smart context for chatbot in exam mode
   * Used to show notification bubbles or suggestions
   */
  @Get('session/:sessionId/chat-context')
  async getExamChatContext(@Param('sessionId') sessionId: string) {
    const session = await this.svc.getSessionLog(sessionId)
    if (!session) {
      return { context: '', riskLevel: 'low' }
    }

    if (session.organizationId) {
      await this.licensingSvc.consumeAiQuota(session.organizationId.toString(), 1).catch(() => { })
    }

    const context = await this.aiSvc.generateExamChatContext({
      studentName: session.studentId as any,
      unansweredCount: session.unansweredCount,
      totalQuestions: session.totalQuestions,
      timeLeftSeconds: session.timeLeftSeconds,
      riskLevel: session.aiAnalysis?.riskLevel || 'low',
    })

    return { context, riskLevel: session.aiAnalysis?.riskLevel || 'low' }
  }

  // ── Analytics — Phân tích câu hỏi ─────────────────────────────────────────

  @Get(':id/analytics/questions')
  @UseGuards(JwtAuth(), LicenseGuard)
  async getQuestionAnalytics(@Param('id') id: string, @Req() req: any) {
    return this.svc.getExamQuestionAnalytics(id, req.user?.organizationId)
  }

  // ── PDF Report ────────────────────────────────────────────────────────────

  @Get(':id/report/pdf')
  @UseGuards(JwtAuth(), LicenseGuard)
  async downloadPdfReport(
    @Param('id') id: string,
    @Query('className') className: string,
    @Query('academicYear') academicYear: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.svc.generateExamPdfReport(id, {
      className: className || undefined,
      academicYear: academicYear || undefined,
      organizationId: req.user?.organizationId,
    })
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bao-cao-ket-qua-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    })
    res.end(pdfBuffer)
  }

  // ── AI Explanation — Giải thích đáp án ───────────────────────────────────

  @Get('sessions/:id/explanation')
  async getAnswerExplanation(@Param('id') id: string) {
    return this.svc.getSessionExplanation(id)
  }

  // ── Flashcard Sets (Admin) ─────────────────────────────────────────────────

  @Get('flashcards/sets')
  @UseGuards(JwtAuth(), LicenseGuard)
  async getFlashcardSets(@Req() req: any) {
    return this.svc.getFlashcardSets(req.user?.organizationId)
  }

  @Post('flashcards/sets')
  @UseGuards(JwtAuth(), LicenseGuard)
  async createFlashcardSet(@Body() body: any, @Req() req: any) {
    return this.svc.createFlashcardSet({
      ...body,
      organizationId: req.user?.organizationId,
      createdBy: req.user?.sub || req.user?.id,
    })
  }

  @Delete('flashcards/sets/:setId')
  @UseGuards(JwtAuth(), LicenseGuard)
  async deleteFlashcardSet(@Param('setId') setId: string, @Req() req: any) {
    return this.svc.deleteFlashcardSet(setId, req.user?.organizationId)
  }

  // ── Flashcard Public (Học sinh — không cần auth) ──────────────────────────

  @Get('flashcards/public/:code')
  async getPublicFlashcardSet(
    @Param('code') code: string,
    @Query('sessionKey') sessionKey: string,
  ) {
    return this.svc.getPublicFlashcardSet(code, sessionKey || undefined)
  }

  @Post('flashcards/public/:code/progress')
  @HttpCode(200)
  async updateFlashcardProgress(
    @Param('code') code: string,
    @Body() body: { sessionKey: string; cardIndex: number; rating: 0 | 1 | 2 | 3 },
  ) {
    return this.svc.updateFlashcardProgress({
      accessCode: code,
      sessionKey: body.sessionKey,
      cardIndex: body.cardIndex,
      rating: body.rating,
    })
  }
}
