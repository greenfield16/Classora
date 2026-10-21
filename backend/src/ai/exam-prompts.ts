export type ExamAiTask =
  | 'generateQuestions'
  | 'parseQuestions'
  | 'explainAnswer'
  | 'analyzeQuizSession'
  | 'analyzePollSession'
  | 'detectCheating'

export function buildAiPrompt(task: ExamAiTask, payload: any): { prompt: string; responseJson: boolean; maxTokens: number } {
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
