import { callOpenAI } from './openai'
// functions/src/index.ts
import * as functions from 'firebase-functions/v1'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

initializeApp()
const db = getFirestore()

type ExamAiTask =
  | 'generateQuestions'
  | 'parseQuestions'
  | 'explainAnswer'
  | 'analyzeQuizSession'
  | 'analyzePollSession'
  | 'detectCheating'

function jsonFromText(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (!match) throw new Error('AI response did not contain JSON.')
    return JSON.parse(match[0])
  }
}

function buildAiPrompt(task: ExamAiTask, payload: any): { prompt: string; responseJson: boolean; maxTokens: number } {
  if (task === 'generateQuestions') {
    return {
      responseJson: true,
      maxTokens: 4096,
      prompt: [
        'Bạn là giáo viên Việt Nam. Tạo câu hỏi thi theo đúng JSON, không markdown.',
        `Môn: ${payload.subjectName || 'Môn học'}`,
        `Lớp: ${payload.gradeLevel || 12}`,
        `Chủ đề: ${payload.topic || ''}`,
        `Dạng câu hỏi: ${payload.questionType || 'MULTIPLE_CHOICE'}`,
        `Số lượng: ${payload.count || 5}`,
        `Độ khó: ${payload.difficulty || 'NHAN_BIET'}`,
        `Chương: ${payload.chapter || ''}`,
        'Schema: {"questions":[{"type":"MULTIPLE_CHOICE|TRUE_FALSE|SHORT_ANSWER","content":"string","gradeLevel":number,"difficulty":"NHAN_BIET|THONG_HIEU|VAN_DUNG|VAN_DUNG_CAO","chapter":"string|null","topic":"string|null","tags":[],"options":[{"key":"A","content":"string"}],"correctAnswer":"A","statements":[{"key":"a","content":"string","answer":true}],"shortAnswer":"string"}]}',
      ].join('\n'),
    }
  }

  if (task === 'parseQuestions') {
    return {
      responseJson: true,
      maxTokens: 4096,
      prompt: [
        'Chuyển văn bản câu hỏi sau thành JSON, không markdown.',
        `Dạng ưu tiên: ${payload.questionType || 'tự nhận diện'}`,
        `Lớp mặc định: ${payload.gradeLevel || 12}`,
        `Độ khó mặc định: ${payload.difficulty || 'NHAN_BIET'}`,
        'Schema giống: {"questions":[{"type":"MULTIPLE_CHOICE|TRUE_FALSE|SHORT_ANSWER","content":"string","gradeLevel":number,"difficulty":"NHAN_BIET|THONG_HIEU|VAN_DUNG|VAN_DUNG_CAO","chapter":null,"topic":null,"tags":[],"options":[{"key":"A","content":"string"}],"correctAnswer":"A","statements":[{"key":"a","content":"string","answer":true}],"shortAnswer":"string"}]}',
        `Văn bản:\n${payload.text || ''}`,
      ].join('\n'),
    }
  }

  if (task === 'explainAnswer') {
    return {
      responseJson: true,
      maxTokens: 1024,
      prompt: [
        'Giải thích đáp án ngắn gọn bằng tiếng Việt. Trả JSON không markdown.',
        `Môn: ${payload.subjectName || ''}`,
        `Lớp: ${payload.gradeLevel || ''}`,
        `Câu hỏi: ${payload.question || ''}`,
        `Các lựa chọn: ${(payload.choices || []).map((c: string, i: number) => `${i}: ${c}`).join(' | ')}`,
        `Index đáp án đúng: ${payload.correctIndex}`,
        'Schema: {"explanation":"string"}',
      ].join('\n'),
    }
  }

  if (task === 'detectCheating') {
    return {
      responseJson: false,
      maxTokens: 2048,
      prompt: [
        'Phân tích rủi ro bất thường/gian lận trong kết quả thi. Trả lời tiếng Việt, có gạch đầu dòng ngắn.',
        `Đề thi: ${payload.examTitle || ''}`,
        `Dữ liệu học sinh JSON: ${JSON.stringify(payload.students || []).slice(0, 12000)}`,
      ].join('\n'),
    }
  }

  return {
    responseJson: false,
    maxTokens: 2048,
    prompt: [
      task === 'analyzeQuizSession' ? 'Phân tích phiên Quiz Live bằng tiếng Việt.' : 'Phân tích phiên bình chọn bằng tiếng Việt.',
      `Tiêu đề: ${payload.title || ''}`,
      `Số người tham gia: ${payload.totalParticipants || 0}`,
      `Câu hỏi JSON: ${JSON.stringify(payload.questions || []).slice(0, 10000)}`,
      `Bảng điểm JSON: ${JSON.stringify(payload.leaderboard || []).slice(0, 6000)}`,
    ].join('\n'),
  }
}

function scoreTrueFalse(
  studentAnswers: boolean[],
  correctAnswers: boolean[],
  scoring: { correct1: number; correct2: number; correct3: number; correct4: number }
): number {
  const correct = studentAnswers.filter((a, i) => a === correctAnswers[i]).length
  if (correct === 4) return scoring.correct4
  if (correct === 3) return scoring.correct3
  if (correct === 2) return scoring.correct2
  if (correct === 1) return scoring.correct1
  return 0
}

export const gradeExam = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  // Check auth
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.')
  }

  const { examId, studentInfo, answers } = data
  if (!examId || !studentInfo || !answers) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.')
  }

  // Fetch the master exam configuration and secure answer key from Firestore
  const examRef = db.collection('exams').doc(examId)
  const examDoc = await examRef.get()
  if (!examDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Exam not found.')
  }

  const examData = examDoc.data()!
  const structure = examData.structure || {}
  const part1ScorePerQ = structure.part1ScorePerQ || 0.25
  const part2Scoring = structure.part2Scoring || { correct1: 0, correct2: 0.25, correct3: 0.5, correct4: 1.0 }
  const part3ScorePerQ = structure.part3ScorePerQ || 0.25

  // Secure Answer Keys are stored inside the 'exams/{examId}/answerKeys/master' subcollection/document
  const answerKeyDoc = await examRef.collection('answerKeys').doc('master').get()
  if (!answerKeyDoc.exists) {
    throw new functions.https.HttpsError('internal', 'Exam answer key is missing.')
  }
  const answerKey = answerKeyDoc.data()!

  // ── Grade Part I ──────────────────────────────────────
  const key1 = answerKey.part1 || {}
  let p1Score = 0, p1Correct = 0
  for (const [qid, ans] of Object.entries(answers.part1 || {})) {
    if (key1[qid] === ans) {
      p1Score += part1ScorePerQ
      p1Correct++
    }
  }

  // ── Grade Part II ─────────────────────────────────────
  const key2 = answerKey.part2 || {}
  let p2Score = 0, p2Full = 0, p2Partial = 0
  for (const [qid, studentBools] of Object.entries(answers.part2 || {})) {
    const correctBools = key2[qid] as boolean[]
    const sBools = studentBools as boolean[]
    if (!correctBools || !sBools) continue
    const score = scoreTrueFalse(sBools, correctBools, part2Scoring)
    p2Score += score
    const correctCount = sBools.filter((a, i) => a === correctBools[i]).length
    if (correctCount === 4) p2Full++
    else if (correctCount >= 2) p2Partial++
  }

  // ── Grade Part III ────────────────────────────────────
  const key3 = answerKey.part3 || {}
  let p3Score = 0, p3Correct = 0
  for (const [qid, ans] of Object.entries(answers.part3 || {})) {
    const expected = String(key3[qid] || '')
    const studentAns = String(ans || '')
    const numAns = parseFloat(studentAns), numExp = parseFloat(expected)
    const match = !isNaN(numAns) && !isNaN(numExp)
      ? Math.abs(numAns - numExp) <= 0.001
      : studentAns.trim().toLowerCase() === expected.trim().toLowerCase()

    if (match) {
      p3Score += part3ScorePerQ
      p3Correct++
    }
  }

  const totalScore = Math.round((p1Score + p2Score + p3Score) * 100) / 100
  const totalQuestions = Object.keys(key1).length + Object.keys(key2).length + Object.keys(key3).length
  const answeredCount = Object.keys(answers.part1 || {}).length + Object.keys(answers.part2 || {}).length + Object.keys(answers.part3 || {}).length

  // Write Attempt document
  const attemptPayload = {
    user_id: context.auth.uid,
    exam_id: examId,
    studentInfo: {
      fullName: studentInfo.fullName || '',
      className: studentInfo.className || '',
      school: studentInfo.school || examData.defaultSchool || 'GDTX Lê Quí Đôn',
      academicYear: studentInfo.academicYear || examData.schoolYear || '2026-2027',
    },
    answers,
    score: totalScore,
    scoreBreakdown: {
      part1Score: p1Score,
      part1Correct: p1Correct,
      part1Total: Object.keys(key1).length,
      part2Score: p2Score,
      part2FullCorrect: p2Full,
      part2Partial: p2Partial,
      part2Total: Object.keys(key2).length,
      part3Score: p3Score,
      part3Correct: p3Correct,
      part3Total: Object.keys(key3).length,
    },
    submittedAt: FieldValue.serverTimestamp(),
    totalQuestions,
    answeredCount,
    unansweredCount: Math.max(0, totalQuestions - answeredCount),
  }

  const attemptRef = db.collection('attempts').doc()
  await attemptRef.set(attemptPayload)

  return {
    attemptId: attemptRef.id,
    score: totalScore,
    scoreBreakdown: {
      part1Score: p1Score,
      part2Score: p2Score,
      part3Score: p3Score,
    }
  }
})

export const examAi = functions
  .runWith({ secrets: ['OPENAI_API_KEY'] })
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.')
  }

  const task = data?.task as ExamAiTask
  const payload = data?.payload || {}
  const allowedTasks: ExamAiTask[] = [
    'generateQuestions',
    'parseQuestions',
    'explainAnswer',
    'analyzeQuizSession',
    'analyzePollSession',
    'detectCheating',
  ]

  if (!allowedTasks.includes(task)) {
    throw new functions.https.HttpsError('invalid-argument', 'Unsupported AI task.')
  }

  try {
    const request = buildAiPrompt(task, payload)
    const result = await callOpenAI({ prompt: request.prompt, responseJson: request.responseJson, maxTokens: request.maxTokens })

    if (task === 'generateQuestions' || task === 'parseQuestions') {
      const parsed = jsonFromText(result.text)
      const questions = Array.isArray(parsed) ? parsed : parsed.questions || []
      return { ok: true, questions, count: questions.length, model: result.model }
    }
    if (task === 'explainAnswer') {
      const parsed = jsonFromText(result.text)
      return { ok: true, explanation: String(parsed.explanation || result.text), model: result.model }
    }
    return { ok: true, analysis: result.text, model: result.model }
  } catch (err: any) {
    console.error('[examAi] OpenAI failed:', err.message)
    throw new functions.https.HttpsError('internal', err.message || 'OpenAI failed.')
  }
  })
