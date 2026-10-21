import { Injectable } from '@nestjs/common'
import { callOpenAI } from '../../common/openai'
import { buildUnifiedPrompt, resolveCompanyPromptContext } from '../../ai/prompt-builder'

@Injectable()
export class ExamAiService {
  async analyzeExamSession(sessionData: {
    studentName?: string
    examTitle?: string
    totalQuestions: number
    answeredCount: number
    unansweredCount: number
    unansweredIds: string[]
    timeSpentSeconds: number
    timeLeftSeconds: number
    submissionStatus: string
    riskIndicators: string[]
  }): Promise<{
    riskLevel: 'low' | 'medium' | 'high'
    suggestions: string[]
    strengthAreas: string[]
    improvementAreas: string[]
  }> {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[Exam AI] Missing OpenAI API key, returning default analysis')
      return this.getDefaultAnalysis(sessionData)
    }

    const analysisPack = buildUnifiedPrompt({
      audience: 'specialist',
      task: 'exam_support',
      company: resolveCompanyPromptContext(undefined),
      currentTaskLabel: 'Phân tích phiên làm bài thi và đánh giá rủi ro.',
      currentInput: [
        `Tên: ${sessionData.studentName || 'N/A'}`,
        `Bài thi: ${sessionData.examTitle || 'N/A'}`,
        `Tổng câu: ${sessionData.totalQuestions}`,
        `Câu trả lời: ${sessionData.answeredCount}`,
        `Câu chưa làm: ${sessionData.unansweredCount}`,
        `Thời gian làm: ${Math.floor(sessionData.timeSpentSeconds / 60)} phút`,
        `Thời gian còn lại: ${sessionData.timeLeftSeconds} giây`,
        `Trạng thái: ${sessionData.submissionStatus}`,
        `Các dấu hiệu: ${sessionData.riskIndicators.join(', ')}`,
      ].join('\n'),
      outputFormat: 'json',
      outputSchemaDescription: '{"riskLevel":"low|medium|high","suggestions":string[],"strengthAreas":string[],"improvementAreas":string[]}',
      extraRules: ['Chỉ trả JSON hợp lệ, không thêm text ngoài JSON.'],
    })
    const analysisPrompt = [analysisPack.system, analysisPack.prompt].filter(Boolean).join('\n\n')

    try {
      const result = await callOpenAI({
        prompt: analysisPrompt,
        maxTokens: 1024,
        temperature: 0.7,
      })

      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.warn('[Exam AI] No JSON found in response')
        return this.getDefaultAnalysis(sessionData)
      }

      return JSON.parse(jsonMatch[0])
    } catch (err: any) {
      console.error('[Exam AI] Analysis failed:', err.message)
      return this.getDefaultAnalysis(sessionData)
    }
  }

  async generateExamChatContext(sessionData: {
    studentName?: string
    examTitle?: string
    unansweredCount: number
    totalQuestions: number
    timeLeftSeconds: number
    riskLevel: 'low' | 'medium' | 'high'
  }): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      return this.getDefaultChatContext(sessionData)
    }

    const contextPack = buildUnifiedPrompt({
      audience: 'specialist',
      task: 'exam_support',
      company: resolveCompanyPromptContext(undefined),
      currentTaskLabel: 'Tạo câu cảnh báo/gợi ý cho chatbot hỗ trợ thí sinh trong lúc thi.',
      currentInput: [
        `Học sinh: ${sessionData.studentName || 'N/A'}`,
        `Bài thi: ${sessionData.examTitle || 'N/A'}`,
        `Câu chưa làm: ${sessionData.unansweredCount}/${sessionData.totalQuestions}`,
        `Thời gian còn: ${sessionData.timeLeftSeconds} giây`,
        `Mức độ nguy hiểm: ${sessionData.riskLevel}`,
      ].join('\n'),
      outputFormat: 'plain',
      extraRules: ['Trả lời 1 câu cảnh báo/gợi ý ngắn gọn, tối đa 2 dòng.'],
    })
    const contextPrompt = [contextPack.system, contextPack.prompt].filter(Boolean).join('\n\n')

    try {
      const result = await callOpenAI({
        prompt: contextPrompt,
        maxTokens: 256,
        temperature: 0.8,
      })

      return result.text.trim()
    } catch (err: any) {
      console.error('[Exam AI] Chat context failed:', err.message)
      return this.getDefaultChatContext(sessionData)
    }
  }

  /** Giải thích đáp án cho các câu học sinh làm sai. */
  async explainAnswers(questions: Array<{
    questionId: string
    content: string   // nội dung câu hỏi (có thể HTML, strip lấy text)
    type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER'
    studentAnswer: any
    correctAnswer: any
    options?: Array<{ key: string; content: string }>
    statements?: Array<{ key: string; content: string; answer: boolean }>
    subject?: string
    chapter?: string
  }>): Promise<Record<string, { explanation: string; tip?: string }>> {
    if (!process.env.OPENAI_API_KEY || questions.length === 0) {
      return this.getDefaultExplanations(questions)
    }

    // Nhóm tối đa 10 câu mỗi batch để tránh token limit
    const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)

    const questionList = questions.slice(0, 10).map((q, idx) => {
      let questionDesc = `Câu ${idx + 1}: ${stripHtml(q.content)}`
      if (q.type === 'MULTIPLE_CHOICE' && q.options) {
        const opts = q.options.map(o => `${o.key}) ${stripHtml(o.content)}`).join(' | ')
        questionDesc += `\n  Lựa chọn: ${opts}`
        questionDesc += `\n  Học sinh chọn: ${q.studentAnswer || '(không trả lời)'}`
        questionDesc += `\n  Đáp án đúng: ${q.correctAnswer}`
      } else if (q.type === 'TRUE_FALSE' && q.statements) {
        const stmts = q.statements.map(s => `${s.key}) ${stripHtml(s.content)} → ${s.answer ? 'Đúng' : 'Sai'}`).join(' | ')
        const studentArr: boolean[] = Array.isArray(q.studentAnswer) ? q.studentAnswer : []
        const studentStr = q.statements.map((s, i) => `${s.key}=${studentArr[i] ? 'Đ' : 'S'}`).join(',')
        questionDesc += `\n  Mệnh đề: ${stmts}`
        questionDesc += `\n  Học sinh trả lời: ${studentStr}`
      } else if (q.type === 'SHORT_ANSWER') {
        questionDesc += `\n  Học sinh trả lời: "${q.studentAnswer || '(trống)'}"`
        questionDesc += `\n  Đáp án đúng: "${q.correctAnswer}"`
      }
      return `[Q${q.questionId}]\n${questionDesc}`
    }).join('\n\n')

    const explainPack = buildUnifiedPrompt({
      audience: 'specialist',
      task: 'answer_explanation',
      company: resolveCompanyPromptContext(undefined),
      currentTaskLabel: 'Giải thích ngắn gọn tại sao học sinh làm sai và đáp án đúng là gì.',
      currentInput: questionList,
      outputFormat: 'json',
      outputSchemaDescription: '{"Q<id>":{"explanation":"string","tip":"string (optional)"}}',
      extraRules: [
        'Trả về JSON với key là Q<questionId> (ví dụ: Q681abc...).',
        'Mỗi câu giải thích tối đa 100 từ.',
        'tip là một câu gợi ý cách nhớ ngắn (tuỳ chọn).',
        'Chỉ trả JSON hợp lệ, không thêm text ngoài JSON.',
      ],
    })
    const prompt = [explainPack.system, explainPack.prompt].filter(Boolean).join('\n\n')

    try {
      const result = await callOpenAI({
        prompt,
        maxTokens: 3000,
        temperature: 0.4,
      })

      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return this.getDefaultExplanations(questions)

      const parsed = JSON.parse(jsonMatch[0])
      // Remap key Q<id> → questionId
      const out: Record<string, { explanation: string; tip?: string }> = {}
      for (const q of questions) {
        const key = `Q${q.questionId}`
        if (parsed[key]) {
          out[q.questionId] = {
            explanation: String(parsed[key].explanation || ''),
            tip: parsed[key].tip ? String(parsed[key].tip) : undefined,
          }
        } else {
          out[q.questionId] = { explanation: 'Hãy xem lại lý thuyết phần này.' }
        }
      }
      return out
    } catch (err: any) {
      console.error('[Exam AI] Explanation failed:', err.message)
      return this.getDefaultExplanations(questions)
    }
  }

  private getDefaultExplanations(questions: Array<{ questionId: string }>): Record<string, { explanation: string }> {
    const out: Record<string, { explanation: string }> = {}
    for (const q of questions) {
      out[q.questionId] = { explanation: 'Hãy xem lại lý thuyết liên quan đến câu hỏi này.' }
    }
    return out
  }

  private getDefaultAnalysis(sessionData: any): any {
    const riskLevel =
      sessionData.unansweredCount > sessionData.totalQuestions * 0.3
        ? 'high'
        : sessionData.unansweredCount > sessionData.totalQuestions * 0.1
          ? 'medium'
          : 'low'

    return {
      riskLevel,
      suggestions: [
        sessionData.unansweredCount > 0 ? `Còn ${sessionData.unansweredCount} câu chưa trả lời` : 'Đã trả lời hết câu hỏi',
        sessionData.timeLeftSeconds < 300 ? 'Thời gian sắp hết, hãy kiểm tra lại' : 'Còn đủ thời gian',
      ],
      strengthAreas: [`Đã trả lời ${sessionData.answeredCount}/${sessionData.totalQuestions} câu`],
      improvementAreas: sessionData.unansweredCount > 0 ? ['Hoàn thành các câu còn lại'] : [],
    }
  }

  private getDefaultChatContext(sessionData: any): string {
    if (sessionData.unansweredCount > 0) {
      return `⚠️ Bạn còn ${sessionData.unansweredCount} câu chưa trả lời. Hãy làm nốt trước khi nộp bài!`
    }
    if (sessionData.timeLeftSeconds < 300) {
      return `⏰ Chỉ còn ${Math.floor(sessionData.timeLeftSeconds / 60)} phút! Kiểm tra lại bài trước khi nộp.`
    }
    return `Bạn đang làm bài thi ${sessionData.examTitle}. Hỏi gì thì cứ hỏi nhé! 📝`
  }

  async extractAnswersFromImage(base64Image: string, mimeType: string = 'image/jpeg'): Promise<any> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    const omrPack = buildUnifiedPrompt({
      audience: 'specialist',
      task: 'exam_support',
      company: resolveCompanyPromptContext(undefined),
      currentTaskLabel: 'Nhận dạng phiếu trả lời OMR từ ảnh và trích xuất đáp án.',
      outputFormat: 'json',
      outputSchemaDescription: '{"sbd":string,"madethi":string,"part1":Record<string,string>,"part2":Record<string,(boolean|null)[]>,"part3":Record<string,string>}',
      currentInput: [
        'Trích xuất chính xác các trường: sbd, madethi, part1, part2, part3.',
        'part1: mỗi câu chọn 1 đáp án A/B/C/D.',
        'part2: mảng 4 phần tử boolean|null tương ứng a,b,c,d.',
        'part3: câu trả lời điền tay dạng string.',
      ].join('\n'),
      extraRules: [
        'SBD và mã đề có thể nằm ở ô tô tròn hoặc ghi tay.',
        'Chỉ trả JSON hợp lệ, không markdown, không text ngoài JSON.',
      ],
    })
    const prompt = [omrPack.system, omrPack.prompt].filter(Boolean).join('\n\n')
    try {
      const result = await callOpenAI({
        prompt,
        imagesBase64: [{ mimeType, data: base64Image }],
        maxTokens: 2048,
        temperature: 0.1,
      })

      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Không tìm thấy JSON trong phản hồi')
      }

      return JSON.parse(jsonMatch[0])
    } catch (err: any) {
      console.error('[Exam AI] OMR failed:', err.message)
      throw new Error('Lỗi nhận dạng ảnh: ' + err.message)
    }
  }
}
