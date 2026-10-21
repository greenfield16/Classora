'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Printer } from '@phosphor-icons/react'
import { skillExams, type SkillExamTemplate } from '@/lib/skill-exams'

export default function SkillsExamPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [template, setTemplate] = useState<SkillExamTemplate | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    skillExams.getById(id).then(setTemplate).catch(err => setError(err.message || 'Không thể tải mẫu đề.'))
  }, [id])

  if (error) return <main className="p-8 text-center text-red-600">{error}</main>
  if (!template) return <main className="p-8 text-center">Đang chuẩn bị bản in...</main>

  return (
    <main className="mx-auto max-w-[800px] bg-white p-6 text-black print:max-w-none print:p-0 sm:p-10">
      <div className="mb-8 flex items-start justify-between gap-4 print:hidden">
        <div><div className="text-sm font-bold text-green-700">GREEN EXAMS</div><p className="mt-1 text-sm text-neutral-600">Bản in cho giáo viên và học sinh</p></div>
        <button className="bf-btn bf-btn--primary" onClick={() => window.print()}><Printer size={15} /> In đề</button>
      </div>
      <header className="border-b-2 border-black pb-5 text-center">
        <h1 className="text-2xl font-extrabold uppercase">{template.title}</h1>
        <p className="mt-2 text-sm">{template.subject} · Lớp {template.gradeLevel} · Thời gian: {template.durationMinutes} phút</p>
        <p className="mt-3 text-left text-sm leading-6">{template.instructions}</p>
      </header>
      <div className="mt-6 space-y-8">
        {template.sections.map((section, index) => (
          <section key={section.id}>
            <h2 className="text-lg font-bold">PHẦN {index + 1}. {section.title.toUpperCase()}</h2>
            <p className="mt-1 text-sm italic">{section.instructions}</p>
            {section.content && <div className="mt-4 whitespace-pre-wrap rounded border border-black p-4 text-sm leading-6">{section.content}</div>}
            <div className="mt-4 space-y-5">
              {section.questions.map((question, qIndex) => <div key={question.id}><div className="font-semibold">Câu {qIndex + 1}. {question.prompt}</div>{section.skill === 'QUIZ' ? <ol className="mt-2 list-[upper-alpha] space-y-1 pl-6 text-sm">{(question.options || []).map((option, optionIndex) => <li key={optionIndex}>{option}</li>)}</ol> : <div className="mt-3 min-h-20 border-b border-dashed border-neutral-400" />}</div>)}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
