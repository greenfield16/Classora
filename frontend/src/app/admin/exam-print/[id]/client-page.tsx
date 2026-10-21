'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { exams, type ExamItem, type ExamQuestion } from '@/lib/api'

export default function ExamPrintPage() {
  const params = useParams()
  const router = useRouter()
  const token = useAuthStore(s => s.token)
  const [exam, setExam] = useState<ExamItem | null>(null)
  const [questions, setQuestions] = useState<{ part1: ExamQuestion[], part2: ExamQuestion[], part3: ExamQuestion[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (!token) {
      router.replace('/admin/login')
      return
    }

    const id = params.id as string
    if (!id) return

    Promise.all([
      exams.getExams(token, { page: 1, limit: 100 }),
    ]).then(([examListRes]) => {
      const found = examListRes.items.find((e: any) => e._id === id)
      if (found) {
        setExam(found)
        return exams.getExamQuestions(token, id)
      }
      throw new Error('Exam not found')
    }).then(qs => {
      setQuestions(qs)
    }).catch(err => {
      console.error(err)
      alert('Không thể tải dữ liệu đề thi')
    }).finally(() => {
      setLoading(false)
    })
  }, [mounted, token, params.id, router])

  if (!mounted || loading) {
    return <div className="p-10 text-center">Đang tải dữ liệu in...</div>
  }

  if (!exam || !questions) {
    return <div className="p-10 text-center">Không tìm thấy bài thi</div>
  }

  const subjectName = typeof exam.subjectId === 'object' ? exam.subjectId.name : 'Môn học'

  return (
    <div className="bg-white min-h-screen text-black print:p-0 p-8" style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '13pt', lineHeight: '1.5' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4; margin: 20mm; }
          body { -webkit-print-color-adjust: exact; }
        }
      `}} />
      <div className="max-w-[800px] mx-auto print:max-w-none print:w-full bg-white shadow-lg print:shadow-none p-10 print:p-0">

        {/* Header */}
        <div className="flex justify-between items-start mb-6 border-b pb-4 border-black">
          <div className="text-center font-bold">
            <div>SỞ GIÁO DỤC VÀ ĐÀO TẠO</div>
            <div>TRƯỜNG {exam.defaultSchool?.toUpperCase() || '..............................'}</div>
            <div className="mt-1 w-24 h-[1px] bg-black mx-auto"></div>
          </div>
          <div className="text-center font-bold">
            <div>KỲ THI {exam.examType === 'GK' ? 'GIỮA KỲ' : exam.examType === 'CK' ? 'CUỐI KỲ' : 'THỬ'} NĂM HỌC {exam.schoolYear || '2025-2026'}</div>
            <div>Môn: {subjectName} - Lớp: {exam.gradeLevel}</div>
            <div>Thời gian làm bài: {exam.timeLimit} phút</div>
            <div className="mt-1 w-24 h-[1px] bg-black mx-auto"></div>
          </div>
        </div>

        {/* Info */}
        <div className="mb-6 space-y-2 italic">
          <div>Họ và tên thí sinh: ............................................................................</div>
          <div>Lớp: ................................. Số báo danh: ............................................</div>
        </div>

        <div className="text-center font-bold text-xl mb-6">MÃ ĐỀ CHUNG</div>

        {/* Content */}
        <div className="space-y-6">
          {/* Part 1 */}
          {questions.part1.length > 0 && (
            <div>
              <div className="font-bold mb-3">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. (Mỗi câu hỏi thí sinh chỉ chọn một phương án)</div>
              <div className="space-y-4">
                {questions.part1.map((q, idx) => (
                  <div key={q._id} className="break-inside-avoid">
                    <div className="flex gap-1 mb-2">
                      <span className="font-bold shrink-0">Câu {idx + 1}:</span>
                      <span dangerouslySetInnerHTML={{ __html: q.content }} />
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 pl-8">
                      {q.options?.map((opt) => (
                        <div key={opt.key} className="flex gap-2">
                          <span className="font-bold">{opt.key}.</span>
                          <span>{opt.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Part 2 */}
          {questions.part2.length > 0 && (
            <div>
              <div className="font-bold mb-3 mt-6">PHẦN II. Câu trắc nghiệm đúng sai. (Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai)</div>
              <div className="space-y-4">
                {questions.part2.map((q, idx) => (
                  <div key={q._id} className="break-inside-avoid">
                    <div className="flex gap-1 mb-2">
                      <span className="font-bold shrink-0">Câu {idx + 1}:</span>
                      <span dangerouslySetInnerHTML={{ __html: q.content }} />
                    </div>
                    <div className="pl-8 space-y-2">
                      {q.statements?.map((stmt) => (
                        <div key={stmt.key} className="flex gap-2">
                          <span className="font-bold">{stmt.key})</span>
                          <span>{stmt.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Part 3 */}
          {questions.part3.length > 0 && (
            <div>
              <div className="font-bold mb-3 mt-6">PHẦN III. Câu trắc nghiệm trả lời ngắn. (Thí sinh điền đáp án vào ô tương ứng)</div>
              <div className="space-y-4">
                {questions.part3.map((q, idx) => (
                  <div key={q._id} className="break-inside-avoid flex gap-1">
                    <span className="font-bold shrink-0">Câu {idx + 1}:</span>
                    <span dangerouslySetInnerHTML={{ __html: q.content }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 text-center font-bold italic">
          --- HẾT ---
        </div>

        <div className="mt-10 flex justify-end print:hidden">
          <button
            onClick={() => window.print()}
            className="bf-btn bf-btn--primary bf-btn--large"
          >
            In Đề Thi
          </button>
        </div>
      </div>
    </div>
  )
}
