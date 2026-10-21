import { request, jsonBody, API_BASE } from './http'
export type SkillType = 'READING' | 'LISTENING' | 'WRITING' | 'QUIZ'

export type SkillQuestion = {
  id: string
  prompt: string
  points: number
  options?: string[]
  correctOption?: number
  requiresRecording?: boolean
}

export type SkillSection = {
  id: string
  skill: SkillType
  title: string
  instructions: string
  content?: string
  questions: SkillQuestion[]
}

export type SkillExamTemplate = {
  id: string
  ownerId: string
  title: string
  subject: string
  gradeLevel: number
  durationMinutes: number
  instructions: string
  inviteEmails: string[]
  sections: SkillSection[]
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
  accessCode: string
  createdAt?: any
  updatedAt?: any
}

export type SkillExamSubmission = {
  id?: string
  templateId: string
  accessCode: string
  ownerId: string
  student: { fullName: string; className: string; email: string }
  answers: Record<string, string | number>
  recordings: Record<string, { url: string; durationSeconds: number }>
  submittedAt?: any
}

export const skillExams = {
  listMine: () => request<SkillExamTemplate[]>('/skill-exams'),
  create: async (input: Omit<SkillExamTemplate, 'id' | 'ownerId' | 'accessCode' | 'status' | 'createdAt' | 'updatedAt'>) => (await request<SkillExamTemplate>('/skill-exams', jsonBody('POST', input))).id,
  update: (id: string, input: Partial<SkillExamTemplate>) => request(`/skill-exams/${id}`, jsonBody('PATCH', input)),
  remove: (id: string) => request(`/skill-exams/${id}`, jsonBody('DELETE')),
  getById: (id: string) => request<SkillExamTemplate>(`/skill-exams/${id}`),
  getPublic: (code: string) => request<SkillExamTemplate>(`/skill-exams/public/${encodeURIComponent(code)}`),
  submit: async (input: Omit<SkillExamSubmission, 'id' | 'submittedAt'>) => (await request(`/skill-exams/public/${encodeURIComponent(input.accessCode)}/submit`, jsonBody('POST', input))).id,
  uploadRecording: async (_ownerId: string, templateId: string, questionId: string, blob: Blob) => {
    const data = new FormData(); data.append('file', blob, 'recording.webm'); data.append('questionId', questionId)
    const result = await request(`/skill-exams/public/templates/${templateId}/recordings`, {method:'POST',body:data})
    return `${API_BASE}${result.url}`
  },
}
