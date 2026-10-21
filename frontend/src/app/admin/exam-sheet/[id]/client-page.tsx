'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { exams, type ExamItem } from '@/lib/api'

export default function ExamSheetPage() {
  const params = useParams()
  const router = useRouter()
  const token = useAuthStore(s => s.token)
  const [exam, setExam] = useState<ExamItem | null>(null)
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

    exams.getExams(token, { page: 1, limit: 100 })
      .then(res => {
        const found = res.items.find((e: any) => e._id === id)
        if (found) {
          setExam(found)
        } else {
          throw new Error('Exam not found')
        }
      })
      .catch(err => {
        console.error(err)
        alert('Không thể tải dữ liệu bài thi')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [mounted, token, params.id, router])

  if (!mounted || loading) {
    return <div className="p-10 text-center">Đang tải phiếu làm bài...</div>
  }

  if (!exam) {
    return <div className="p-10 text-center">Không tìm thấy bài thi</div>
  }

  const p1Count = exam.structure?.part1Count || 18
  const p2Count = exam.structure?.part2Count || 4
  const p3Count = exam.structure?.part3Count || 6

  return (
    <div className="bg-white min-h-screen text-black print:p-0 p-8" style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '11pt', lineHeight: '1.5' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4; margin: 20mm; }
          body { -webkit-print-color-adjust: exact; }
        }
      `}} />
      <div className="max-w-[800px] mx-auto print:max-w-none print:w-full bg-white shadow-lg print:shadow-none p-10 print:p-0">

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="text-center font-bold">
            <div>SỞ GIÁO DỤC VÀ ĐÀO TẠO</div>
            <div>TRƯỜNG {exam.defaultSchool?.toUpperCase() || '..............................'}</div>
            <div className="mt-1 w-24 h-[1px] bg-black mx-auto"></div>
          </div>
          <div className="text-center font-bold text-xl uppercase">
            PHIẾU TRẢ LỜI TRẮC NGHIỆM
          </div>
          <div className="border border-black p-2 text-center w-32 h-32 flex items-center justify-center text-sm font-bold text-gray-400">
            QR CODE / PHÁCH
          </div>
        </div>

        {/* Student Info */}
        <div className="mb-6 grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-3">
            <div className="flex gap-2 border-b border-dotted border-black pb-1">
              <span className="shrink-0">Họ và tên thí sinh:</span>
              <span className="flex-1 font-bold text-lg"></span>
            </div>
            <div className="flex gap-8">
              <div className="flex gap-2 border-b border-dotted border-black pb-1 flex-1">
                <span className="shrink-0">Lớp:</span>
                <span className="flex-1"></span>
              </div>
              <div className="flex gap-2 border-b border-dotted border-black pb-1 flex-1">
                <span className="shrink-0">Phòng thi:</span>
                <span className="flex-1"></span>
              </div>
            </div>
            <div className="flex gap-2 border-b border-dotted border-black pb-1">
              <span className="shrink-0">Môn thi:</span>
              <span className="flex-1 font-bold">{typeof exam.subjectId === 'object' ? exam.subjectId.name : '................................................'}</span>
            </div>
            <div className="flex gap-2 border-b border-dotted border-black pb-1">
              <span className="shrink-0">Ngày thi:</span>
              <span className="flex-1">.... / .... / ........</span>
            </div>
            <div className="flex gap-2 border-b border-dotted border-black pb-1">
              <span className="shrink-0">Kỳ thi:</span>
              <span className="flex-1 font-bold">{exam.examType === 'GK' ? 'Giữa kỳ' : exam.examType === 'CK' ? 'Cuối kỳ' : 'Thử'} - NH {exam.schoolYear || '2025-2026'}</span>
            </div>
          </div>
          <div className="col-span-1 space-y-3">
            <div className="border border-black p-3 text-center">
              <div className="font-bold mb-1">Số báo danh</div>
              <div className="flex justify-center gap-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="w-6 h-8 border border-black"></div>
                ))}
              </div>
            </div>
            <div className="border border-black p-3 text-center">
              <div className="font-bold mb-1">Mã đề thi</div>
              <div className="flex justify-center gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="w-6 h-8 border border-black"></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Answers */}
        <div className="border border-black">
          {/* Part 1 */}
          <div className="border-b border-black p-4">
            <div className="font-bold mb-4">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn</div>
            <div className="grid grid-cols-4 gap-6">
              {Array.from({ length: p1Count }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 text-right font-bold">{i + 1}.</span>
                  {['A', 'B', 'C', 'D'].map(opt => (
                    <div key={opt} className="w-6 h-6 rounded-full border border-black flex items-center justify-center text-xs text-gray-500">
                      {opt}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2">
            {/* Part 2 */}
            <div className="border-r border-black p-4">
              <div className="font-bold mb-4">PHẦN II. Câu trắc nghiệm đúng sai</div>
              <div className="space-y-4">
                {Array.from({ length: p2Count }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="w-6 text-right font-bold shrink-0">Câu {i + 1}.</span>
                    <div className="grid grid-cols-1 gap-2 flex-1">
                      {['a', 'b', 'c', 'd'].map(opt => (
                        <div key={opt} className="flex items-center gap-3">
                          <span className="w-4 font-bold">{opt})</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs">Đ</span>
                            <div className="w-6 h-6 rounded-full border border-black flex items-center justify-center text-xs text-gray-500">Đ</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs">S</span>
                            <div className="w-6 h-6 rounded-full border border-black flex items-center justify-center text-xs text-gray-500">S</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Part 3 */}
            <div className="p-4">
              <div className="font-bold mb-4">PHẦN III. Câu trắc nghiệm trả lời ngắn</div>
              <div className="space-y-4">
                {Array.from({ length: p3Count }).map((_, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="w-16 font-bold shrink-0">Câu {i + 1}.</span>
                    <div className="grid grid-cols-6 gap-1 flex-1">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <div key={j} className="h-8 border border-black"></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-end print:hidden">
          <button
            onClick={() => window.print()}
            className="bf-btn bf-btn--primary bf-btn--large"
          >
            In Phiếu Làm Bài
          </button>
        </div>

      </div>
    </div>
  )
}
