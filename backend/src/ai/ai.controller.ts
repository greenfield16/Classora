import { Body, Controller, Post, UseGuards, BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import { IsIn, IsObject } from 'class-validator'
import { JwtAuth } from '../auth/guards'
import { callOpenAI } from '../common/openai'
import { buildAiPrompt, ExamAiTask } from './exam-prompts'

class AiDto {
  @IsIn(['generateQuestions','parseQuestions','explainAnswer','analyzeQuizSession','analyzePollSession','detectCheating'])
  task: ExamAiTask
  @IsObject() payload: Record<string, any>
}
@Controller('ai')
@UseGuards(JwtAuth())
export class AiController {
  @Post()
  async run(@Body() body: AiDto) {
    if (JSON.stringify(body.payload).length > 64000) throw new BadRequestException('AI input is too large')
    if (body.task === 'generateQuestions') {
      const count = Number(body.payload.count)
      if (!Number.isInteger(count) || count < 1 || count > 50) throw new BadRequestException('Choose 1–50 questions')
    }
    const pack = buildAiPrompt(body.task, body.payload)
    try {
      const result = await callOpenAI(pack)
      if (body.task === 'generateQuestions' || body.task === 'parseQuestions') {
        const parsed = JSON.parse(result.text)
        const questions = Array.isArray(parsed) ? parsed : parsed.questions
        if (!Array.isArray(questions)) throw new Error('Invalid question output')
        return { ok: true, questions, count: questions.length, model: result.model }
      }
      if (body.task === 'explainAnswer') {
        const parsed = JSON.parse(result.text)
        return { ok: true, explanation: String(parsed.explanation || ''), model: result.model }
      }
      return { ok: true, analysis: result.text, model: result.model }
    } catch {
      throw new ServiceUnavailableException('Không thể xử lý AI. Kiểm tra cấu hình OpenAI hoặc thử lại.')
    }
  }
}
