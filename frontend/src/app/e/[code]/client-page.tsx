'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { exams } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────
type Screen = 'loading' | 'info' | 'form' | 'exam' | 'result' | 'done' | 'error'

interface PublicExam {
  id: string
  title: string
  subject: { name: string; code: string }
  gradeLevel: number
  timeLimit: number
  timeLeftSeconds: number
  structure: {
    part1Count: number; part1ScorePerQ: number
    part2Count: number; part2Scoring: { correct1: number; correct2: number; correct3: number; correct4: number }
    part3Count: number; part3ScorePerQ: number
  }
  defaultSchool: string
  startTime?: string
  endTime?: string
  activatedAt?: string
}

interface Question {
  _id: string
  content: string
  type: string
  options?: { key: string; content: string }[]
  statements?: { key: string; content: string }[]
}

interface SessionData {
  sessionId: string
  variantCode: number
  timeLeftSeconds: number
  exam: { title: string; timeLimit: number; structure: any }
  questions: { part1: Question[]; part2: Question[]; part3: Question[] }
}

interface Result {
  score: number
  timeSpent: number
  scoreBreakdown: { part1: number; part2: number; part3: number }
  answerKey?: any
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTimer(secs: number) {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function fmtSeconds(secs: number) {
  const m = Math.floor(secs / 60), s = secs % 60
  if (m === 0) return `${s} giây`
  return `${m} phút ${s > 0 ? s + ' giây' : ''}`
}

// ── Device ID ────────────────────────────────────────────────────────────────
function getDeviceId(): string {
  const KEY = 'exam_device_id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}

// ── Styles ────────────────────────────────────────────────────────────────────
const cardCls = 'rounded-2xl border border-gray-200 bg-white shadow-sm'
const inputCls = 'w-full rounded-xl border border-gray-200 px-4 py-3 text-[14px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition bg-white'
const btnPrimary = 'bf-btn bf-btn--primary bf-btn--large'
const btnOutline = 'bf-btn bf-btn--large'

// ── Main Component ────────────────────────────────────────────────────────────
export default function ExamPublicPage() {
  const { code } = useParams<{ code: string }>()
  const [screen, setScreen] = useState<Screen>('loading')
  const [examInfo, setExamInfo] = useState<PublicExam | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Form fields
  const [fullName, setFullName] = useState('')
  const [className, setClassName] = useState('')
  const [school, setSchool] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)

  // Exam state
  const [session, setSession] = useState<SessionData | null>(null)
  const [answers, setAnswers] = useState<{ part1: Record<string, string>; part2: Record<string, boolean[]>; part3: Record<string, string> }>({ part1: {}, part2: {}, part3: {} })
  const [timeLeft, setTimeLeft] = useState(0)
  const [activeTab, setActiveTab] = useState<'part1' | 'part2' | 'part3'>('part1')
  const [submitting, setSubmitting] = useState(false)

  // Fullscreen enforcement
  const [fsWarning, setFsWarning] = useState(false)   // overlay cảnh báo lần 1
  const fsViolations = useRef(0)                       // số lần thoát fullscreen
  const fsIgnore = useRef(false)                       // bỏ qua event khi submit/thoát chủ động

  // Result
  const [result, setResult] = useState<Result | null>(null)

  // LocalStorage key for this exam
  const storageKey = code ? `exam_done_${code}` : null

  // Timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load exam info — also check localStorage for prior submission
  useEffect(() => {
    if (!code) return
    const prior = storageKey ? localStorage.getItem(storageKey) : null
    if (prior) {
      try {
        const saved = JSON.parse(prior)
        setResult(saved.result)
        setExamInfo(saved.examInfo)
        setScreen('done')
        return
      } catch { localStorage.removeItem(storageKey!) }
    }
    exams.getPublicExam(code)
      .then(data => { setExamInfo(data); setSchool(data.defaultSchool); setScreen('info') })
      .catch(e => { setErrorMsg(e.message || 'Không tìm thấy đề thi'); setScreen('error') })
  }, [code]) // eslint-disable-line

  // Start exam
  const handleStart = async () => {
    if (!fullName.trim() || !className.trim()) return
    setStarting(true)
    try {
      const deviceFingerprint = getDeviceId()
      const data = await exams.startSession(code!, { fullName: fullName.trim(), className: className.trim(), school: school.trim() || examInfo?.defaultSchool, deviceFingerprint })
      setSession(data)
      setTimeLeft(data.timeLeftSeconds)
      setScreen('exam')

      // Init answers
      const p2Init: Record<string, (boolean | null)[]> = {}
      data.questions.part2.forEach(q => { p2Init[q._id] = [null, null, null, null] })
      setAnswers({ part1: {}, part2: p2Init, part3: {} })
    } catch (e: any) {
      setStartError(e.message || 'Không thể bắt đầu thi')
    } finally { setStarting(false) }
  }

  // Timer countdown
  useEffect(() => {
    if (screen !== 'exam') return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); handleSubmit(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [screen]) // eslint-disable-line

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!session || submitting) return
    setShowSubmitConfirm(false)
    if (timerRef.current) clearInterval(timerRef.current)
    setSubmitting(true)
    try {
      // Convert null (unanswered) → false before sending to backend
      const normalizedPart2: Record<string, boolean[]> = {}
      Object.entries(answers.part2).forEach(([id, bools]) => {
        normalizedPart2[id] = bools.map(b => b === true)
      })
      const res = await exams.submitSession(session.sessionId, { ...answers, part2: normalizedPart2 })
      setResult(res)
      // Persist to localStorage so revisiting the link shows "already submitted"
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify({ result: res, examInfo }))
      }
      setScreen('result')
    } catch (e: any) {
      setSubmitError(e.message || 'Lỗi khi nộp bài')
      setSubmitting(false)
    }
  }, [session, answers, submitting]) // eslint-disable-line

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  const enterFullscreen = useCallback(() => {
    const el = document.documentElement as any
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen
    req?.call(el).catch(() => { })
  }, [])

  const exitFullscreen = useCallback(() => {
    const doc = document as any
    const ex = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen
    ex?.call(doc).catch(() => { })
  }, [])

  const isFullscreen = useCallback(() => {
    const doc = document as any
    return !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement)
  }, [])

  // Vào fullscreen khi bắt đầu thi, thoát khi rời khỏi
  useEffect(() => {
    if (screen === 'exam') {
      fsViolations.current = 0
      fsIgnore.current = false
      setTimeout(enterFullscreen, 300)
    } else {
      fsIgnore.current = true
      if (isFullscreen()) exitFullscreen()
    }
  }, [screen]) // eslint-disable-line

  // Theo dõi fullscreenchange — cảnh báo lần 1, nộp bài lần 2
  useEffect(() => {
    const handleFsChange = () => {
      if (screen !== 'exam') return
      if (fsIgnore.current) return
      if (isFullscreen()) { setFsWarning(false); return }

      fsViolations.current += 1
      if (fsViolations.current === 1) {
        setFsWarning(true)
      } else {
        setFsWarning(false)
        fsIgnore.current = true
        handleSubmit()
      }
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    document.addEventListener('webkitfullscreenchange', handleFsChange)
    document.addEventListener('mozfullscreenchange', handleFsChange)
    document.addEventListener('MSFullscreenChange', handleFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange)
      document.removeEventListener('webkitfullscreenchange', handleFsChange)
      document.removeEventListener('mozfullscreenchange', handleFsChange)
      document.removeEventListener('MSFullscreenChange', handleFsChange)
    }
  }, [screen, handleSubmit, isFullscreen])

  // ── Screens ────────────────────────────────────────────────────────────────

  const endedAt = (errorMsg.match(/lúc\s+(.+)$/i)?.[1] || '').trim()
  const isEndedError = /đề thi đã kết thúc/i.test(errorMsg)

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Đang tải đề thi...</p>
        </div>
      </div>
    )
  }

  if (screen === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className={`${cardCls} max-w-md w-full p-8 text-center`}>
          <div className="text-5xl mb-4">⚠️</div>
          {isEndedError ? (
            <>
              <h1 className="text-xl font-bold text-gray-800 mb-2">
                Thời gian làm bài đã kết thúc{endedAt ? ` lúc ${endedAt}` : ''}
              </h1>
              <p className="text-gray-500 text-sm">
                Nếu gặp vấn đề về thời gian làm bài, vui lòng liên hệ với giáo viên.
              </p>
              <button
                className="bf-btn bf-btn--primary mt-4"
                onClick={() => window.dispatchEvent(new Event('gai-senior-chat:toggle'))}
              >
                Chatbot hỗ trợ Admin
              </button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-800 mb-2">Không tìm thấy đề thi</h1>
              <p className="text-gray-500 text-sm">{errorMsg}</p>
            </>
          )}
          <p className="text-gray-400 text-xs mt-4">Mã đề: <code className="bg-gray-100 px-2 py-0.5 rounded">{code}</code></p>
        </div>
      </div>
    )
  }

  // Already submitted (from localStorage)
  if (screen === 'done' && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <div className={`${cardCls} max-w-md w-full p-8 text-center`}>
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Bạn đã nộp bài rồi</h1>
          <p className="text-gray-500 text-sm mb-6">
            {examInfo?.title && <span className="font-medium">{examInfo.title} · </span>}
            Không thể thi lại đề thi này.
          </p>
          <div className="rounded-2xl bg-green-50 border border-green-200 p-5 mb-4">
            <div className="text-4xl font-bold text-green-700 mb-1">
              {typeof result.score === 'number' ? result.score.toFixed(2) : '—'}<span className="text-xl font-normal text-green-500">/10</span>
            </div>
            <div className="text-sm text-green-600">Điểm của bạn</div>
            {result.scoreBreakdown && (
              <div className="mt-3 flex justify-center gap-4 text-xs text-gray-500">
                <span>Phần I: <b className="text-gray-700">{result.scoreBreakdown.part1?.toFixed(2) ?? '—'}</b></span>
                <span>Phần II: <b className="text-gray-700">{result.scoreBreakdown.part2?.toFixed(2) ?? '—'}</b></span>
                <span>Phần III: <b className="text-gray-700">{result.scoreBreakdown.part3?.toFixed(2) ?? '—'}</b></span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400">Kết quả được lưu trên thiết bị này. Nếu bạn muốn xem lại, hãy liên hệ giáo viên.</p>
        </div>
      </div>
    )
  }

  if (screen === 'info' && examInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className={`${cardCls} max-w-lg w-full overflow-hidden`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <div className="text-sm font-medium opacity-80 mb-1">{examInfo.subject.name} · Lớp {examInfo.gradeLevel}</div>
            <h1 className="text-xl font-bold leading-snug">{examInfo.title}</h1>
          </div>

          {/* Info grid */}
          <div className="p-6 grid grid-cols-2 gap-4">
            <InfoCard icon="⏱" label="Thời gian làm bài" value={
              examInfo.timeLeftSeconds < examInfo.timeLimit * 60
                ? `Còn ${fmtSeconds(examInfo.timeLeftSeconds)} / ${examInfo.timeLimit} phút`
                : `${examInfo.timeLimit} phút`
            } />
            <InfoCard icon="📋" label="Cấu trúc đề" value={`${examInfo.structure.part1Count + examInfo.structure.part2Count + examInfo.structure.part3Count} câu`} />
            <InfoCard icon="🔢" label="Phần I (TNKQ)" value={`${examInfo.structure.part1Count} câu × ${examInfo.structure.part1ScorePerQ}đ`} />
            <InfoCard icon="✅" label="Phần II (Đúng/Sai)" value={`${examInfo.structure.part2Count} câu`} />
            <InfoCard icon="✏️" label="Phần III (Trả lời ngắn)" value={`${examInfo.structure.part3Count} câu × ${examInfo.structure.part3ScorePerQ}đ`} />
            <InfoCard icon="🏫" label="Trường" value={examInfo.defaultSchool} />
          </div>

          {/* Rules */}
          <div className="px-6 pb-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">⚠️ Lưu ý trước khi thi:</p>
              <ul className="list-disc list-inside space-y-1 text-[13px]">
                <li>Không tắt trình duyệt hoặc nạp lại trang trong khi thi</li>
                <li>Hết giờ sẽ tự động nộp bài</li>
                <li>Mỗi câu hỏi chỉ được trả lời một lần</li>
              </ul>
            </div>
          </div>

          <div className="p-6 pt-4">
            <button className={`${btnPrimary} w-full text-base py-3.5`} onClick={() => setScreen('form')}>
              Bắt đầu thi →
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'form' && examInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className={`${cardCls} max-w-md w-full overflow-hidden`}>
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">
            <h2 className="font-bold text-lg">Nhập thông tin thí sinh</h2>
            <p className="text-sm opacity-80 mt-0.5">{examInfo.title}</p>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Họ và tên <span className="text-red-500">*</span></label>
              <input className={inputCls} value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Lớp <span className="text-red-500">*</span></label>
              <input className={inputCls} value={className} onChange={e => setClassName(e.target.value)}
                placeholder="10A1" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Trường</label>
              <input className={inputCls} value={school} onChange={e => setSchool(e.target.value)}
                placeholder={examInfo.defaultSchool} />
            </div>

            <div className="pt-2">
              <div className="flex gap-3">
                <button className={btnOutline} onClick={() => setScreen('info')}>← Quay lại</button>
                <button className={`${btnPrimary} flex-1`}
                  disabled={!fullName.trim() || !className.trim() || starting}
                  onClick={() => { setStartError(''); handleStart() }}>
                  {starting ? 'Đang bắt đầu...' : 'Vào thi ngay →'}
                </button>
              </div>
              {startError && (
                <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <span className="mt-0.5 shrink-0">⚠️</span>
                  <span>{startError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'exam' && session) {
    const q = session.questions
    const totalQ = q.part1.length + q.part2.length + q.part3.length
    const answered = Object.keys(answers.part1).length
      + q.part2.filter(q2 => answers.part2[q2._id]?.some(b => b !== null)).length
      + Object.keys(answers.part3).filter(id => answers.part3[id]?.trim()).length
    const progress = Math.round((answered / totalQ) * 100)
    const isLowTime = timeLeft < 300

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Fullscreen warning overlay */}
        {fsWarning && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
              <div className="text-5xl mb-3">⚠️</div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">Thoát toàn màn hình!</h2>
              <p className="text-sm text-gray-600 mb-1">
                Bài thi yêu cầu toàn màn hình. Bạn vừa thoát khỏi chế độ này.
              </p>
              <p className="text-sm text-red-600 font-semibold mb-5">
                Nếu thoát thêm một lần nữa, bài thi sẽ được nộp tự động.
              </p>
              <button
                className="bf-btn bf-btn--primary bf-btn--large bf-btn--block"
                onClick={() => { setFsWarning(false); enterFullscreen() }}>
                Quay lại toàn màn hình
              </button>
            </div>
          </div>
        )}

        {showSubmitConfirm && (
          <div className="fixed inset-0 z-[998] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-2">Xác nhận nộp bài</h3>
              <p className="text-sm text-gray-600 mb-5">Bạn đã trả lời {answered}/{totalQ} câu. Sau khi nộp sẽ không thể sửa lại.</p>
              <div className="bf-btn-group justify-end">
                <button
                  className="bf-btn"
                  onClick={() => setShowSubmitConfirm(false)}>
                  Hủy
                </button>
                <button
                  className="bf-btn bf-btn--primary"
                  onClick={() => { setSubmitError(''); handleSubmit() }}>
                  Xác nhận nộp
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sticky header */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs text-gray-400 font-medium truncate">Mã đề {session.variantCode}</div>
              <div className="text-sm font-semibold text-gray-800 truncate">{session.exam.title}</div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-xs text-gray-500">{answered}/{totalQ} câu</div>
              <div className={`font-mono text-lg font-bold px-3 py-1.5 rounded-xl ${isLowTime ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-700'}`}>
                {fmtTimer(timeLeft)}
              </div>
              {/* Nút fullscreen */}
              <button
                title="Toàn màn hình"
                className="bf-btn bf-btn--icon"
                onClick={() => isFullscreen() ? exitFullscreen() : enterFullscreen()}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M16 4h4v4M4 16v4h4M16 20h4v-4" />
                </svg>
              </button>
              <div className="relative">
                <button className="bf-btn bf-btn--primary"
                  disabled={submitting} onClick={() => {
                    setSubmitError('')
                    setShowSubmitConfirm(true)
                  }}>
                  {submitting ? 'Đang nộp...' : 'Nộp bài'}
                </button>
                {submitError && (
                  <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-lg z-50">
                    <span className="mr-1">⚠️</span>{submitError}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-gray-100">
            <div className="h-1 bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Part tabs */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex gap-0">
              {[
                { id: 'part1', label: `Phần I (${q.part1.length})`, sub: 'Trắc nghiệm' },
                { id: 'part2', label: `Phần II (${q.part2.length})`, sub: 'Đúng/Sai' },
                { id: 'part3', label: `Phần III (${q.part3.length})`, sub: 'Trả lời ngắn' },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                  className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {t.label}
                  <span className="hidden sm:inline text-xs font-normal ml-1 opacity-70">· {t.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-5">

          {activeTab === 'part1' && q.part1.map((question, idx) => (
            <QuestionCard key={question._id} number={idx + 1} question={question}
              answered={!!answers.part1[question._id]}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                {question.options?.map(opt => {
                  const selected = answers.part1[question._id] === opt.key
                  return (
                    <button key={opt.key} onClick={() => setAnswers(a => ({ ...a, part1: { ...a.part1, [question._id]: opt.key } }))}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all text-sm ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                      <span className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {opt.key}
                      </span>
                      <span className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: opt.content }} />
                    </button>
                  )
                })}
              </div>
            </QuestionCard>
          ))}

          {activeTab === 'part2' && q.part2.map((question, idx) => {
            const userBools = answers.part2[question._id] || [null, null, null, null]
            return (
              <QuestionCard key={question._id} number={idx + 1} question={question}
                answered={userBools.some(b => b !== null)}>
                <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden">
                  {question.statements?.map((stmt, si) => (
                    <div key={stmt.key} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-gray-100">
                      <span className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-600">
                        {stmt.key}
                      </span>
                      <span className="flex-1 text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: stmt.content }} />
                      <div className="flex gap-2 flex-shrink-0">
                        {[{ v: true, l: 'Đúng' }, { v: false, l: 'Sai' }].map(({ v, l }) => {
                          const active = userBools[si] !== null && userBools[si] === v
                          return (
                            <button key={l} onClick={() => {
                              const nb = [...userBools]; nb[si] = v
                              setAnswers(a => ({ ...a, part2: { ...a.part2, [question._id]: nb } }))
                            }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${active ? (v ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700') : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                              {l}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </QuestionCard>
            )
          })}

          {activeTab === 'part3' && q.part3.map((question, idx) => (
            <QuestionCard key={question._id} number={idx + 1} question={question}
              answered={!!answers.part3[question._id]?.trim()}>
              <input className={`${inputCls} mt-3`}
                value={answers.part3[question._id] || ''}
                onChange={e => setAnswers(a => ({ ...a, part3: { ...a.part3, [question._id]: e.target.value } }))}
                placeholder="Nhập đáp án..." />
            </QuestionCard>
          ))}

          {/* Nav between parts */}
          <div className="bf-btn-group justify-between pt-2">
            <button className={btnOutline} onClick={() => setActiveTab(activeTab === 'part3' ? 'part2' : 'part1')}
              disabled={activeTab === 'part1'}>← Phần trước</button>
            {activeTab !== 'part3'
              ? <button className={btnPrimary} onClick={() => setActiveTab(activeTab === 'part1' ? 'part2' : 'part3')}>Phần tiếp →</button>
              : <button className="bf-btn bf-btn--primary bf-btn--large"
                onClick={() => { setSubmitError(''); setShowSubmitConfirm(true) }}>
                ✓ Nộp bài
              </button>
            }
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'result' && result) {
    const total = (session?.questions.part1.length || 0) * (session?.exam.structure.part1ScorePerQ || 0.25)
      + (session?.questions.part2.length || 0) * 1
      + (session?.questions.part3.length || 0) * (session?.exam.structure.part3ScorePerQ || 0.25)
    const pct = Math.round((result.score / Math.max(total, 10)) * 100)

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className={`${cardCls} max-w-lg w-full overflow-hidden`}>
          {/* Score header */}
          <div className={`p-8 text-center ${result.score >= 5 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-orange-500 to-red-500'} text-white`}>
            <div className="text-6xl font-black mb-1">{result.score.toFixed(2)}</div>
            <div className="text-lg opacity-90">/ {total.toFixed(2)} điểm</div>
            <div className="mt-3 text-sm opacity-80">{result.score >= 5 ? '🎉 Chúc mừng!' : '📚 Cố gắng hơn nhé!'}</div>
          </div>

          {/* Breakdown */}
          <div className="p-6">
            <h3 className="font-bold text-gray-800 mb-4">Chi tiết điểm số</h3>
            <div className="space-y-3">
              <ScoreRow label="Phần I — Trắc nghiệm" score={result.scoreBreakdown.part1} max={(session?.questions.part1.length || 0) * (session?.exam.structure.part1ScorePerQ || 0.25)} color="blue" />
              <ScoreRow label="Phần II — Đúng/Sai" score={result.scoreBreakdown.part2} max={session?.questions.part2.length || 0} color="purple" />
              <ScoreRow label="Phần III — Trả lời ngắn" score={result.scoreBreakdown.part3} max={(session?.questions.part3.length || 0) * (session?.exam.structure.part3ScorePerQ || 0.25)} color="green" />
            </div>

            {/* Progress bar */}
            <div className="mt-5 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className={`h-3 rounded-full transition-all ${result.score >= 5 ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="text-right text-xs text-gray-400 mt-1">{pct}% hoàn thành</div>

            <div className="mt-4 text-sm text-gray-500 text-center">
              Thời gian làm bài: {fmtSeconds(result.timeSpent)}
            </div>

            <div className="mt-6">
              <button className={`${btnOutline} w-full`} onClick={() => window.close()}>Đóng cửa sổ</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3.5">
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-[11px] text-gray-400 font-medium">{label}</div>
      <div className="text-[13px] font-semibold text-gray-800 mt-0.5">{value}</div>
    </div>
  )
}

function QuestionCard({ number, question, answered, children }: {
  number: number
  question: Question
  answered: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl border-2 p-5 bg-white transition-all ${answered ? 'border-blue-200' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <span className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${answered ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          {number}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] text-gray-800 leading-relaxed font-medium"
            dangerouslySetInnerHTML={{ __html: question.content }} />
          {children}
        </div>
      </div>
    </div>
  )
}

function ScoreRow({ label, score, max, color }: { label: string; score: number; max: number; color: 'blue' | 'purple' | 'green' }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  const barColor = { blue: 'bg-blue-500', purple: 'bg-purple-500', green: 'bg-green-500' }[color]
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-800">{score.toFixed(2)}/{max.toFixed(2)}đ</span>
      </div>
      <div className="bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
