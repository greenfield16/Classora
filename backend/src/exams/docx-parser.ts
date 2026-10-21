/**
 * Parse a .docx file (Word document) containing Vietnamese exam questions
 * into an array of question objects compatible with the importQuestions endpoint.
 *
 * Supported docx structure (BGD 2025 format):
 *   PHẦN I  — Trắc nghiệm nhiều lựa chọn
 *     Câu N. [question text]
 *     A. [option]  ← underlined run = correct answer
 *     B. [option]
 *     C. [option]
 *     D. [option]
 *
 *   PHẦN II — Đúng/Sai
 *     Câu N. [question context / table description]
 *     a) [statement]   ← underlined = ĐÚNG, not underlined = SAI
 *     b) [statement]
 *     c) [statement]
 *     d) [statement]
 *
 *   PHẦN III — Trả lời ngắn
 *     Câu N. [question text]
 *     Đáp án: [value]   (or "Lời giải" then "Đáp án: [value]")
 */

import AdmZip = require('adm-zip')
import { parseString } from 'xml2js'

// ── Types ────────────────────────────────────────────────────────────────────

function parseXml(xml: string): Promise<any> {
  return new Promise((resolve, reject) =>
    parseString(xml, { explicitArray: true, mergeAttrs: false }, (err, result) =>
      err ? reject(err) : resolve(result)
    )
  )
}

interface Run {
  text: string
  bold: boolean
  underline: boolean
  color?: string // hex e.g. "FF0000", "000000"
}

interface Paragraph {
  runs: Run[]
  text: string           // joined text of all runs
  hasUnderline: boolean  // at least one run has underline
  hasBold: boolean
}

export interface ParsedQuestion {
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER'
  content: string
  options?: { key: string; content: string }[]
  correctAnswer?: string
  statements?: { key: string; content: string; answer: boolean }[]
  shortAnswer?: string
  difficulty: 'NHAN_BIET'
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function parseDocxBuffer(buffer: Buffer): Promise<ParsedQuestion[]> {
  // 1. Extract word/document.xml from the ZIP
  const zip = new AdmZip(buffer)
  const entry = zip.getEntry('word/document.xml')
  if (!entry) throw new Error('Invalid docx: word/document.xml not found')

  const xmlContent = entry.getData().toString('utf-8')

  // 2. Parse XML
  const parsed: any = await parseXml(xmlContent)

  // 3. Walk paragraphs
  const body = parsed?.['w:document']?.['w:body']?.[0]
  if (!body) throw new Error('Cannot read document body')

  const rawParagraphs: any[] = body['w:p'] || []
  const paragraphs: Paragraph[] = rawParagraphs.map(extractParagraph)

  // 4. Group into sections and parse questions
  return buildQuestions(paragraphs)
}

// ── XML paragraph extraction ─────────────────────────────────────────────────

function extractParagraph(p: any): Paragraph {
  const runs: Run[] = []
  const rawRuns: any[] = p['w:r'] || []

  for (const r of rawRuns) {
    const textNodes: any[] = r['w:t'] || []
    const text = textNodes.map((t: any) => (typeof t === 'string' ? t : t?._ || t?.['#text'] || '')).join('')
    if (!text.trim() && !text) continue

    const rPr: any = (r['w:rPr'] || [])[0] || {}
    const bold = Array.isArray(rPr['w:b']) && rPr['w:b'].length > 0
    const uArr: any[] = rPr['w:u'] || []
    const underline = uArr.some((u: any) => {
      const val = u?.['$']?.['w:val']
      return val && val !== 'none' && val !== 'false'
    })
    const colorArr: any[] = rPr['w:color'] || []
    const color = colorArr[0]?.['$']?.['w:val'] || ''

    runs.push({ text, bold, underline, color })
  }

  const text = runs.map(r => r.text).join('').trim()
  const hasUnderline = runs.some(r => r.underline)
  const hasBold = runs.some(r => r.bold)

  return { runs, text, hasUnderline, hasBold }
}

// ── Question building ────────────────────────────────────────────────────────

type Section = 'NONE' | 'PART1' | 'PART2' | 'PART3'

function buildQuestions(paragraphs: Paragraph[]): ParsedQuestion[] {
  const questions: ParsedQuestion[] = []
  let section: Section = 'NONE'

  // Working state per question
  let currentType: ParsedQuestion['type'] | null = null
  let currentContent: string[] = []
  let currentOptions: { key: string; content: string }[] = []
  let currentCorrect = ''
  let currentStatements: { key: string; content: string; answer: boolean }[] = []
  let currentShortAnswer = ''
  let inAnswerBlock = false

  const flush = () => {
    if (!currentType || currentContent.length === 0) return
    const content = currentContent.join('\n').trim()
    if (!content) return

    if (currentType === 'MULTIPLE_CHOICE') {
      questions.push({
        type: 'MULTIPLE_CHOICE',
        content,
        options: currentOptions,
        correctAnswer: currentCorrect || undefined,
        difficulty: 'NHAN_BIET',
      })
    } else if (currentType === 'TRUE_FALSE') {
      if (currentStatements.length > 0) {
        questions.push({
          type: 'TRUE_FALSE',
          content,
          statements: currentStatements,
          difficulty: 'NHAN_BIET',
        })
      }
    } else if (currentType === 'SHORT_ANSWER') {
      questions.push({
        type: 'SHORT_ANSWER',
        content,
        shortAnswer: currentShortAnswer || undefined,
        difficulty: 'NHAN_BIET',
      })
    }

    // Reset
    currentType = null
    currentContent = []
    currentOptions = []
    currentCorrect = ''
    currentStatements = []
    currentShortAnswer = ''
    inAnswerBlock = false
  }

  for (const para of paragraphs) {
    const t = para.text

    // ── Detect section headers ───────────────────────────────────────────────
    if (/PHẦN\s*I\.?\s*(Câu|trắc|trắc nghiệm)/i.test(t) ||
      /^PHẦN\s+I[\.\s]/i.test(t)) {
      flush()
      section = 'PART1'
      continue
    }
    if (/PHẦN\s*II\.?\s*(Câu|trắc|đúng|sai)/i.test(t) ||
      /^PHẦN\s+II[\.\s]/i.test(t)) {
      flush()
      section = 'PART2'
      continue
    }
    if (/PHẦN\s*III\.?\s*(Câu|trắc|trả|ngắn)/i.test(t) ||
      /^PHẦN\s+III[\.\s]/i.test(t)) {
      flush()
      section = 'PART3'
      continue
    }

    // Skip empty and separator lines
    if (!t || /^[-─═\s]+$/.test(t) || /HẾT|END/i.test(t)) continue

    // ── PART I: Multiple Choice ──────────────────────────────────────────────
    if (section === 'PART1') {
      const questionMatch = t.match(/^Câu\s+(\d+)\.\s*(.*)/)
      if (questionMatch) {
        flush()
        currentType = 'MULTIPLE_CHOICE'
        const questionText = questionMatch[2].trim()
        if (questionText) currentContent = [questionText]
        else currentContent = []
        continue
      }

      // Option line: A. ... / B. ... / C. ... / D. ...
      const optionMatch = t.match(/^([A-D])\.\s*(.+)/)
      if (optionMatch && currentType === 'MULTIPLE_CHOICE') {
        const key = optionMatch[1]
        const content = optionMatch[2].trim()
        currentOptions.push({ key, content })
        // Underline on this paragraph's runs = correct answer
        if (para.hasUnderline) {
          currentCorrect = key
        }
        continue
      }

      // Continuation of question text (before options)
      if (currentType === 'MULTIPLE_CHOICE' && currentOptions.length === 0) {
        currentContent.push(t)
      }
    }

    // ── PART II: True/False ──────────────────────────────────────────────────
    else if (section === 'PART2') {
      const questionMatch = t.match(/^Câu\s+(\d+)\.\s*(.*)/)
      if (questionMatch) {
        flush()
        currentType = 'TRUE_FALSE'
        const questionText = questionMatch[2].trim()
        currentContent = questionText ? [questionText] : []
        continue
      }

      // Statement line: a) ... / b) ... / c) ... / d) ...
      const stmtMatch = t.match(/^([a-d])\)\s*(.+)/)
      if (stmtMatch && currentType === 'TRUE_FALSE') {
        const key = stmtMatch[1]
        const content = stmtMatch[2].trim()
        const answer = para.hasUnderline  // underline = ĐÚNG
        currentStatements.push({ key, content, answer })
        continue
      }

      // Context / table description continuation (before statements)
      if (currentType === 'TRUE_FALSE' && currentStatements.length === 0) {
        // Skip table data rows (pure numbers / years)
        if (!t.match(/^\d[\d\s,.]*$/)) {
          currentContent.push(t)
        }
      }
    }

    // ── PART III: Short Answer ───────────────────────────────────────────────
    else if (section === 'PART3') {
      const questionMatch = t.match(/^Câu\s+(\d+)\.\s*(.*)/)
      if (questionMatch) {
        flush()
        currentType = 'SHORT_ANSWER'
        const questionText = questionMatch[2].trim()
        currentContent = questionText ? [questionText] : []
        inAnswerBlock = false
        continue
      }

      if (/^Lời\s+giải/i.test(t)) {
        inAnswerBlock = true
        continue
      }

      const answerMatch = t.match(/^Đáp\s+án\s*:\s*(.+)/i)
      if (answerMatch && currentType === 'SHORT_ANSWER') {
        currentShortAnswer = answerMatch[1].trim()
        continue
      }

      // Continuation of question content (before answer block)
      if (currentType === 'SHORT_ANSWER' && !inAnswerBlock && !currentShortAnswer) {
        // Skip table data rows
        if (!t.match(/^\d[\d\s,.]*$/) && !t.match(/^Năm$/i) && !t.match(/^Nguồn:/i)) {
          currentContent.push(t)
        }
      }
    }
  }

  flush()
  return questions
}
