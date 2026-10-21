'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { exams, examAI, type QuizSet, type QuizSessionAdmin, type ExamQuestion, type ExamSubject } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { ActionButton, EmptyState, FormSelect, PanelSection, Pill, StatCard } from './AdminUI'
import { Play, Plus, Trash, ArrowsClockwise, QrCode, SkipForward, Stop, BookOpen, X, Cards, Lightning, Monitor } from '@phosphor-icons/react'
import Link from 'next/link'

type DraftQuestion = {
  prompt: string
  choices: string[]
  correctIndex: number
}

const inputCls = 'w-full rounded-[8px] border px-3 py-2 text-[13px] outline-none'
const inputStyle = { borderColor: 'var(--bd)', backgroundColor: 'var(--bg1)', color: 'var(--t0)' }

export default function QuizLivePanel() {
  const token = useAuthStore(s => s.token) || ''
  const [sets, setSets] = useState<QuizSet[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    { prompt: '', choices: ['', '', '', ''], correctIndex: 0 },
  ])

  const [session, setSession] = useState<QuizSessionAdmin | null>(null)
  const [activeSessionId, setActiveSessionId] = useState('')
  const [joinUrl, setJoinUrl] = useState('')
  const [qrData, setQrData] = useState('')
  const [aiExplanation, setAiExplanation] = useState('')
  const [aiSessionAnalysis, setAiSessionAnalysis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // Host live modal
  const [showWaitingRoom, setShowWaitingRoom] = useState(false)
  const [showHostModal, setShowHostModal] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const qIndexRef = useRef<number>(-1)

  // Question bank modal state
  const [showBank, setShowBank] = useState(false)
  const [bankSubjects, setBankSubjects] = useState<ExamSubject[]>([])
  const [bankQuestions, setBankQuestions] = useState<ExamQuestion[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const [bankSubjectId, setBankSubjectId] = useState('')
  const [bankSelected, setBankSelected] = useState<Set<string>>(new Set())
  const [bankType, setBankType] = useState('')

  const load = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await exams.getQuizSets(token)
      setSets(res)
    } catch (e: any) {
      setError(e.message || 'Không tải được Quiz sets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token]) // eslint-disable-line

  useEffect(() => {
    if (!activeSessionId || !token) return
    let stop = false
    const tick = async () => {
      try {
        const data = await exams.getQuizSession(token, activeSessionId)
        if (!stop) {
          setSession(data)
          const url = `${window.location.origin}/quiz/live/${data.session.code}`
          setJoinUrl(url)
          setQrData(await QRCode.toDataURL(url, { width: 220, margin: 1 }))
        }
      } catch {
        // ignore transient polling errors
      }
    }
    tick()
    const t = setInterval(tick, 2000)
    return () => { stop = true; clearInterval(t) }
  }, [activeSessionId, token])

  // ── Per-question countdown timer ──────────────────────────────────────────
  const _currentQIndex = session?.currentQuestion?.index ?? -1
  useEffect(() => {
    if (_currentQIndex !== qIndexRef.current) {
      qIndexRef.current = _currentQIndex
      setTimeLeft(session?.session.timePerQuestion ?? 20)
    }
  }, [_currentQIndex]) // eslint-disable-line

  useEffect(() => {
    if (timeLeft <= 0) return
    const t = setTimeout(() => setTimeLeft(v => Math.max(0, v - 1)), 1000)
    return () => clearTimeout(t)
  }, [timeLeft])

  const resetDraft = () => {
    setTitle('')
    setDescription('')
    setQuestions([{ prompt: '', choices: ['', '', '', ''], correctIndex: 0 }])
  }

  // ── Question bank helpers ─────────────────────────────────
  function bankQToQuizDraft(q: ExamQuestion): DraftQuestion | null {
    if ((q.type !== 'MULTIPLE_CHOICE' && q.type !== 'QUIZ') || !q.options || q.options.length < 2) return null
    const choices = q.options.map(o => o.content)
    const keyToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 }
    const correctIndex = q.correctAnswer ? (keyToIndex[q.correctAnswer.toUpperCase()] ?? 0) : 0
    if (correctIndex >= choices.length) return null
    return { prompt: q.content, choices, correctIndex }
  }

  const openBank = async () => {
    setShowBank(true)
    setBankSelected(new Set())
    setBankType('')
    if (!token) return
    setBankLoading(true)
    try {
      const [subjectsRes, qRes] = await Promise.all([
        exams.getSubjects(token),
        exams.getQuestions(token, { limit: 200 }),
      ])
      setBankSubjects(subjectsRes)
      setBankQuestions(qRes.items)
    } catch (e: any) {
      setError(e.message || 'Không tải được ngân hàng câu hỏi')
    } finally {
      setBankLoading(false)
    }
  }

  const importSelected = () => {
    const toAdd: DraftQuestion[] = []
    filterBankQuestions.forEach(q => {
      if (!bankSelected.has(q._id)) return
      const draft = bankQToQuizDraft(q)
      if (draft) toAdd.push(draft)
    })
    if (toAdd.length === 0) return
    setQuestions(v => {
      // Remove blank placeholder questions when importing
      const existing = v.filter(q => q.prompt.trim() !== '')
      return [...existing, ...toAdd]
    })
    setShowBank(false)
    setBankSelected(new Set())
    setMessage(`Đã thêm ${toAdd.length} câu từ ngân hàng vào bộ quiz`)
  }

  const createSet = async () => {
    if (!token) return
    const clean = questions
      .map(q => ({
        prompt: q.prompt.trim(),
        choices: q.choices.map(c => c.trim()).filter(Boolean).map(text => ({ text })),
        correctIndex: q.correctIndex,
      }))
      .filter(q => q.prompt && q.choices.length >= 2)

    if (!title.trim()) return setError('Nhập tiêu đề bộ quiz')
    if (clean.length === 0) return setError('Cần ít nhất 1 câu hỏi hợp lệ')

    setSaving(true)
    setError('')
    setMessage('')
    try {
      await exams.createQuizSet(token, { title: title.trim(), description, questions: clean })
      setMessage('Đã tạo bộ quiz')
      resetDraft()
      await load()
    } catch (e: any) {
      setError(e.message || 'Tạo bộ quiz thất bại')
    } finally {
      setSaving(false)
    }
  }

  const startSession = async (setId: string) => {
    if (!token) return
    setError('')
    try {
      const data = await exams.startQuizSession(token, { setId, timePerQuestion: 20 })
      setSession(data)
      setActiveSessionId(data.session._id)
      setShowWaitingRoom(true)
      setMessage('Đã tạo phòng — đang chờ học sinh tham gia')
    } catch (e: any) {
      setError(e.message || 'Không thể bắt đầu phiên')
    }
  }

  const beginSession = async () => {
    if (!token || !activeSessionId) return
    setError('')
    try {
      const data = await exams.beginQuizSession(token, activeSessionId)
      setSession(data)
      setShowWaitingRoom(false)
      setShowHostModal(true)
      setMessage('Quiz đã bắt đầu!')
    } catch (e: any) {
      setError(e.message || 'Không thể bắt đầu quiz')
    }
  }

  const nextQuestion = async () => {
    if (!token || !activeSessionId) return
    try {
      const data = await exams.nextQuizQuestion(token, activeSessionId)
      setSession(data)
    } catch (e: any) {
      setError(e.message || 'Không thể chuyển câu')
    }
  }

  const endSession = async () => {
    if (!token || !activeSessionId) return
    try {
      await exams.endQuizSession(token, activeSessionId)
      setMessage('Đã kết thúc phiên quiz')
      setActiveSessionId('')
      setSession(null)
      setJoinUrl('')
      setQrData('')
      setShowHostModal(false)
      setShowWaitingRoom(false)
    } catch (e: any) {
      setError(e.message || 'Không thể kết thúc phiên')
    }
  }

  const explainCurrentQuestion = async () => {
    if (!session?.currentQuestion) return
    setAiLoading(true)
    setError('')
    try {
      const q = session.currentQuestion
      const res = await examAI.explainAnswer({
        question: q.prompt,
        choices: q.choices.map(c => c.text),
        correctIndex: q.correctIndex,
        gradeLevel: 10,
        subjectName: 'Môn học',
      })
      setAiExplanation(res.explanation || '')
    } catch (e: any) {
      setError(e.message || 'Không thể tạo giải thích AI')
    } finally {
      setAiLoading(false)
    }
  }

  const analyzeSession = async () => {
    if (!session) return
    setAiLoading(true)
    setError('')
    try {
      const q = session.currentQuestion
      const payloadQuestions = q ? [{
        prompt: q.prompt,
        correctIndex: q.correctIndex,
        distribution: session.answerStats.distribution || {},
      }] : []
      const res = await examAI.analyzeQuizSession({
        title: session.set.title,
        questions: payloadQuestions,
        leaderboard: session.participants.map(p => ({ name: p.name, score: p.score })),
        totalParticipants: session.participants.length,
      })
      setAiSessionAnalysis(res.analysis || '')
    } catch (e: any) {
      setError(e.message || 'Không thể phân tích phiên Quiz Live')
    } finally {
      setAiLoading(false)
    }
  }

  const removeSet = async (id: string) => {
    if (!token) return
    if (!confirm('Xóa bộ quiz này?')) return
    try {
      await exams.deleteQuizSet(token, id)
      await load()
    } catch (e: any) {
      setError(e.message || 'Không thể xóa bộ quiz')
    }
  }

  const filterBankQuestions = (() => {
    let list = bankQuestions.filter(q => q.type === 'MULTIPLE_CHOICE' || q.type === 'QUIZ')
    if (bankType) list = list.filter(q => q.type === bankType)
    if (!bankSubjectId) return list
    return list.filter(q => {
      const sid = typeof q.subjectId === 'string' ? q.subjectId : (q.subjectId as ExamSubject)?._id
      return sid === bankSubjectId
    })
  })()

  const stat = useMemo(() => ({
    sets: sets.length,
    livePlayers: session?.participants?.length || 0,
    answersNow: session?.answerStats?.totalAnswers || 0,
    qIndex: (session?.currentQuestion?.index ?? -1) + 1,
  }), [sets.length, session])

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bộ quiz" value={stat.sets} accent="var(--blue)" />
        <StatCard label="Người chơi online" value={stat.livePlayers} accent="var(--green)" />
        <StatCard label="Trả lời câu hiện tại" value={stat.answersNow} accent="var(--amber)" />
        <StatCard label="Câu đang chạy" value={stat.qIndex > 0 ? stat.qIndex : '—'} accent="var(--purple)" />
      </div>

      {error ? <div className="rounded-[10px] border px-3 py-2 text-[12px]" style={{ borderColor: 'rgba(244,63,94,.25)', color: 'var(--red)', background: 'rgba(244,63,94,.08)' }}>{error}</div> : null}
      {message ? <div className="rounded-[10px] border px-3 py-2 text-[12px]" style={{ borderColor: 'rgba(16,185,129,.28)', color: 'var(--green)', background: 'rgba(16,185,129,.08)' }}>{message}</div> : null}

      <PanelSection
        title="Tạo bộ Quiz Live"
        description="Soạn câu hỏi và đáp án để chạy lớp học realtime"
        actions={(
          <ActionButton iconOnly title="Tải lại" ariaLabel="Tải lại" onClick={load} disabled={loading}>
            <ArrowsClockwise size={16} className={loading ? 'animate-spin' : ''} />
          </ActionButton>
        )}
      >
        <div className="space-y-3">
          <input className={inputCls} style={inputStyle} placeholder="Tên bộ quiz" value={title} onChange={e => setTitle(e.target.value)} />
          <input className={inputCls} style={inputStyle} placeholder="Mô tả ngắn (không bắt buộc)" value={description} onChange={e => setDescription(e.target.value)} />

          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={idx} className="rounded-[10px] border p-3" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
                <div className="mb-2 text-[12px] font-semibold" style={{ color: 'var(--t1)' }}>Câu {idx + 1}</div>
                <input className={inputCls} style={inputStyle} placeholder="Nội dung câu hỏi" value={q.prompt}
                  onChange={e => setQuestions(v => v.map((it, i) => i === idx ? { ...it, prompt: e.target.value } : it))} />
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {[0, 1, 2, 3].map(ci => (
                    <label key={ci} className="flex items-center gap-2 rounded-[8px] border px-2 py-1.5" style={{ borderColor: q.correctIndex === ci ? 'var(--blue)' : 'var(--bd)' }}>
                      <input type="radio" checked={q.correctIndex === ci} onChange={() => setQuestions(v => v.map((it, i) => i === idx ? { ...it, correctIndex: ci } : it))} />
                      <input className="w-full bg-transparent text-[13px] outline-none" placeholder={`Đáp án ${ci + 1}`} value={q.choices[ci] || ''}
                        onChange={e => setQuestions(v => v.map((it, i) => i === idx ? { ...it, choices: it.choices.map((c, j) => j === ci ? e.target.value : c) } : it))} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => setQuestions(v => [...v, { prompt: '', choices: ['', '', '', ''], correctIndex: 0 }])}><Plus size={14} />Thêm câu</ActionButton>
            <ActionButton onClick={openBank}><BookOpen size={14} />Lấy từ ngân hàng</ActionButton>
            <ActionButton tone="primary" onClick={createSet} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu bộ quiz'}</ActionButton>
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Bộ quiz đã tạo" description="Chọn bộ quiz để bắt đầu phiên live">
        {sets.length === 0 ? <EmptyState>Chưa có bộ quiz nào.</EmptyState> : (
          <div className="space-y-2">
            {sets.map(s => (
              <div key={s._id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border px-3 py-2" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: 'var(--t0)' }}>{s.title}</div>
                  <div className="text-[11px]" style={{ color: 'var(--t2)' }}>{s.questions?.length || 0} câu hỏi</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton tone="primary" onClick={() => startSession(s._id)}><Play size={14} />Live</ActionButton>
                  <Link href={`/quiz/flashcard/${s._id}`} target="_blank">
                    <ActionButton><Cards size={14} />Flashcard</ActionButton>
                  </Link>
                  <Link href={`/quiz/matching/${s._id}`} target="_blank">
                    <ActionButton><Lightning size={14} />Ghép đôi</ActionButton>
                  </Link>
                  <ActionButton tone="danger" onClick={() => removeSet(s._id)}><Trash size={14} />Xóa</ActionButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelSection>

      {session ? (
        <PanelSection
          title={`Phiên Quiz Live — ${session.set.title}`}
          description={`Mã phòng: ${session.session.code}`}
          actions={<Pill tone={session.session.status === 'LIVE' ? 'green' : 'amber'}>{session.session.status}</Pill>}
        >
          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <div className="mb-3 rounded-[10px] border p-3" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
                <div className="text-[12px]" style={{ color: 'var(--t2)' }}>Câu hiện tại</div>
                <div className="mt-1 text-[14px] font-semibold" style={{ color: 'var(--t0)' }}>
                  {session.currentQuestion ? `${session.currentQuestion.index + 1}. ${session.currentQuestion.prompt}` : 'Phiên đã kết thúc'}
                </div>
                {session.currentQuestion ? (
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {session.currentQuestion.choices.map((c, i) => (
                      <div key={i} className="rounded-[8px] px-2 py-1 text-[12px]" style={{
                        background: String(i) === String(session.answerStats.distribution ? Object.entries(session.answerStats.distribution).sort((a, b) => b[1] - a[1])[0]?.[0] : '') ? 'rgba(59,130,246,.12)' : 'var(--bg2)',
                        color: 'var(--t1)',
                      }}>
                        {i + 1}. {c.text} · {session.answerStats.distribution?.[i] || 0}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex gap-2">
                <ActionButton tone="primary" onClick={nextQuestion}><SkipForward size={14} />Câu tiếp theo</ActionButton>
                <ActionButton tone="danger" onClick={endSession}><Stop size={14} />Kết thúc</ActionButton>
                <ActionButton onClick={explainCurrentQuestion} disabled={!session.currentQuestion || aiLoading}>AI giải thích đáp án</ActionButton>
                <ActionButton onClick={analyzeSession} disabled={aiLoading}>AI phân tích phiên</ActionButton>
              </div>

              {aiExplanation ? (
                <div className="mt-3 rounded-[10px] border p-3 text-[13px]" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)', color: 'var(--t1)' }}>
                  <div className="mb-1 text-[12px] font-semibold" style={{ color: 'var(--t0)' }}>AI giải thích đáp án</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{aiExplanation}</div>
                </div>
              ) : null}

              {aiSessionAnalysis ? (
                <div className="mt-3 rounded-[10px] border p-3 text-[13px]" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)', color: 'var(--t1)' }}>
                  <div className="mb-1 text-[12px] font-semibold" style={{ color: 'var(--t0)' }}>AI phân tích phiên Quiz Live</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{aiSessionAnalysis}</div>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="rounded-[10px] border p-3" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
                <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold" style={{ color: 'var(--t1)' }}><QrCode size={14} />Tham gia lớp</div>
                <div className="text-[11px] break-all" style={{ color: 'var(--t2)' }}>{joinUrl}</div>
                {qrData ? <img src={qrData} alt="qr" className="mt-2 rounded-[8px]" style={{ width: 180, height: 180 }} /> : null}
              </div>

              <div className="rounded-[10px] border p-3" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
                <div className="mb-2 text-[12px] font-semibold" style={{ color: 'var(--t1)' }}>Leaderboard</div>
                <div className="space-y-1">
                  {session.participants.slice(0, 10).map((p, idx) => (
                    <div key={p._id} className="flex items-center justify-between text-[12px]">
                      <span style={{ color: 'var(--t1)' }}>{idx + 1}. {p.name}</span>
                      <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{p.score}</span>
                    </div>
                  ))}
                  {session.participants.length === 0 ? <div className="text-[12px]" style={{ color: 'var(--t2)' }}>Chưa có học sinh tham gia</div> : null}
                </div>
              </div>
            </div>
          </div>
        </PanelSection>
      ) : null}
      {/* ── Session active banner (khi modal đã thu nhỏ) ────────────────── */}
      {session && !showHostModal && !showWaitingRoom ? (
        <div className="flex items-center justify-between rounded-[12px] border px-4 py-3" style={{ borderColor: 'rgba(59,130,246,.4)', background: 'rgba(59,130,246,.06)' }}>
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ background: '#22c55e' }} />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--t0)' }}>Phiên đang chạy: {session.set.title}</div>
              <div className="text-[11px]" style={{ color: 'var(--t2)' }}>
                Mã phòng <strong>{session.session.code}</strong> · {session.participants.length} người chơi
                {session.currentQuestion ? ` · Câu ${session.currentQuestion.index + 1}/${session.set.questionCount}` : ''}
              </div>
            </div>
          </div>
          <button
            onClick={() => session.session.status === 'WAITING' ? setShowWaitingRoom(true) : setShowHostModal(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
            style={{ background: '#2563eb' }}
          >
            <Monitor size={16} /> {session.session.status === 'WAITING' ? 'Mở phòng chờ' : 'Mở màn hình Host'}
          </button>
        </div>
      ) : null}

      {/* ── Waiting Room (chờ học sinh vào trước khi bắt đầu) ──────────── */}
      {showWaitingRoom && session ? (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center" style={{ background: '#0d0d0d' }}>
          {/* Top bar */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b px-6 py-3" style={{ borderColor: 'rgba(255,255,255,.1)' }}>
            <div className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,.45)' }}>
              Phòng chờ · {session.set.title}
            </div>
            <button
              onClick={() => setShowWaitingRoom(false)}
              className="rounded-full p-2 transition hover:bg-white/10"
              title="Thu nhỏ (phòng vẫn mở)"
            >
              <X size={18} style={{ color: 'rgba(255,255,255,.45)' }} />
            </button>
          </div>

          {/* Center content */}
          <div className="flex w-full max-w-[900px] flex-col items-center gap-10 px-6 pt-8 md:flex-row md:items-start md:justify-center">
            {/* Left: code + join info */}
            <div className="flex flex-col items-center gap-5">
              <div className="text-center">
                <div className="text-[12px] uppercase tracking-[.2em] mb-2" style={{ color: 'rgba(255,255,255,.35)' }}>Mã tham gia</div>
                <div className="font-mono text-[64px] font-black leading-none tracking-[.18em]" style={{ color: '#60a5fa' }}>
                  {session.session.code}
                </div>
              </div>
              {qrData ? (
                <div className="rounded-[16px] bg-white p-3">
                  <img src={qrData} alt="qr" style={{ width: 180, height: 180, display: 'block' }} />
                </div>
              ) : null}
              {joinUrl ? (
                <div className="max-w-[260px] text-center text-[11px] break-all" style={{ color: '#60a5fa' }}>
                  {joinUrl}
                </div>
              ) : null}
            </div>

            {/* Right: participant list */}
            <div className="flex flex-col gap-4" style={{ minWidth: '280px', maxWidth: '440px', flex: 1 }}>
              {/* Live count */}
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 animate-pulse rounded-full" style={{ background: '#22c55e' }} />
                <div className="text-[32px] font-black text-white">{session.participants.length}</div>
                <div className="text-[15px]" style={{ color: 'rgba(255,255,255,.45)' }}>học sinh đã vào</div>
              </div>

              {/* Name list */}
              <div className="flex flex-wrap gap-2" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                {session.participants.length === 0 ? (
                  <div className="text-[13px]" style={{ color: 'rgba(255,255,255,.3)' }}>
                    Đang chờ học sinh tham gia...
                  </div>
                ) : (
                  [...session.participants].map(p => (
                    <div key={p._id} className="bf-tag bf-tag--compact" style={{ background: 'rgba(255,255,255,.12)', color: '#fff', borderColor: 'rgba(255,255,255,.22)' }}>
                      {p.name}
                    </div>
                  ))
                )}
              </div>

              {/* Start button */}
              <button
                onClick={beginSession}
                disabled={session.participants.length === 0}
                className="mt-4 w-full rounded-2xl py-5 text-[18px] font-black text-white transition hover:opacity-90 disabled:opacity-40"
                style={{ background: session.participants.length > 0 ? '#2563eb' : '#374151' }}
              >
                {session.participants.length === 0 ? 'Đợi học sinh tham gia...' : `▶ Bắt đầu với ${session.participants.length} học sinh`}
              </button>
              <div className="text-center text-[11px]" style={{ color: 'rgba(255,255,255,.25)' }}>
                Học sinh truy cập link hoặc quét QR để vào phòng
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Host Live Modal ───────────────────────────────────────────────── */}
      {showHostModal && session ? (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#0d0d0d' }}>

          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-3" style={{ borderColor: 'rgba(255,255,255,.1)' }}>
            <div className="flex items-center gap-5">
              <div>
                <div className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.35)' }}>Mã phòng</div>
                <div className="font-mono text-[28px] font-black tracking-[.15em]" style={{ color: '#60a5fa' }}>{session.session.code}</div>
              </div>
              <div className="h-10 w-px" style={{ background: 'rgba(255,255,255,.1)' }} />
              <div className="text-[15px] font-semibold" style={{ color: 'rgba(255,255,255,.65)' }}>{session.set.title}</div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{session.participants.length}</div>
                <div className="text-[10px]" style={{ color: 'rgba(255,255,255,.35)' }}>Người chơi</div>
              </div>
              {session.currentQuestion && (
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{session.currentQuestion.index + 1}/{session.set.questionCount}</div>
                  <div className="text-[10px]" style={{ color: 'rgba(255,255,255,.35)' }}>Câu hỏi</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-xl font-bold" style={{ color: timeLeft <= 5 ? '#f87171' : timeLeft <= 10 ? '#fbbf24' : '#4ade80' }}>{timeLeft}s</div>
                <div className="text-[10px]" style={{ color: 'rgba(255,255,255,.35)' }}>Còn lại</div>
              </div>
              <button onClick={() => setShowHostModal(false)} className="rounded-full p-2 transition hover:bg-white/10" title="Thu nhỏ (phiên vẫn chạy)">
                <X size={20} style={{ color: 'rgba(255,255,255,.5)' }} />
              </button>
            </div>
          </div>

          {/* Timer bar */}
          <div className="h-1" style={{ background: 'rgba(255,255,255,.06)' }}>
            <div
              className="h-1 transition-all duration-1000"
              style={{
                width: `${(timeLeft / (session.session.timePerQuestion || 20)) * 100}%`,
                background: timeLeft <= 5 ? '#f87171' : timeLeft <= 10 ? '#fbbf24' : '#3b82f6',
              }}
            />
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">

            {/* Main area */}
            <div className="flex flex-1 flex-col overflow-y-auto px-8 py-6">
              {session.session.status !== 'LIVE' || !session.currentQuestion ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="space-y-3 text-center">
                    <div className="text-5xl">🎉</div>
                    <div className="text-2xl font-bold text-white">Quiz đã kết thúc!</div>
                    <div className="text-[14px]" style={{ color: 'rgba(255,255,255,.45)' }}>Xem kết quả bên phải</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-5">
                    <div className="mb-2 text-[11px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.35)' }}>
                      Câu {session.currentQuestion.index + 1} / {session.set.questionCount}
                    </div>
                    <h2 className="text-[26px] font-bold leading-snug text-white">{session.currentQuestion.prompt}</h2>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {(() => {
                      const COLORS = [
                        { bg: '#dc2626', bar: '#f87171', label: 'A' },
                        { bg: '#2563eb', bar: '#60a5fa', label: 'B' },
                        { bg: '#d97706', bar: '#fbbf24', label: 'C' },
                        { bg: '#16a34a', bar: '#4ade80', label: 'D' },
                      ]
                      const revealCorrect = timeLeft <= 0
                      const total = session.answerStats.totalAnswers || 0
                      const dist = session.answerStats.distribution || {}
                      return session.currentQuestion!.choices.map((c, i) => {
                        const cnt = (dist as any)[i] || 0
                        const pct = total > 0 ? Math.round((cnt / total) * 100) : 0
                        const isCorrect = revealCorrect && i === session.currentQuestion!.correctIndex
                        const col = COLORS[i] || COLORS[0]
                        return (
                          <div key={i} className="relative overflow-hidden rounded-[14px]" style={{ background: 'rgba(255,255,255,.06)', border: isCorrect ? `2px solid ${col.bar}` : '2px solid rgba(255,255,255,.08)' }}>
                            <div className="absolute inset-y-0 left-0 rounded-l-[13px] transition-all duration-700" style={{ width: `${pct}%`, background: `${col.bar}22` }} />
                            <div className="relative flex items-center gap-3 px-4 py-4">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-black text-white" style={{ background: col.bg }}>{col.label}</div>
                              <div className="flex-1 text-[15px] font-medium leading-snug text-white">{c.text}</div>
                              <div className="shrink-0 text-right">
                                <div className="text-[22px] font-black" style={{ color: col.bar }}>{pct}%</div>
                                <div className="text-[11px]" style={{ color: 'rgba(255,255,255,.35)' }}>{cnt} trả lời</div>
                              </div>
                              {isCorrect && (
                                <div className="bf-tag bf-tag--compact absolute right-2 top-2" style={{ background: col.bar, color: '#000' }}>✓ ĐÚNG</div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>

                  <div className="mt-3 text-[12px]" style={{ color: 'rgba(255,255,255,.3)' }}>
                    {session.answerStats.totalAnswers} / {session.participants.length} người đã trả lời
                  </div>
                  {timeLeft > 0 ? (
                    <div className="mt-2 text-[12px]" style={{ color: '#fbbf24' }}>
                      Đang thu đáp án... Đáp án đúng sẽ hiện khi hết giờ.
                    </div>
                  ) : null}

                  {aiExplanation ? (
                    <div className="mt-5 rounded-[12px] border p-4 text-[13px]" style={{ borderColor: 'rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.75)' }}>
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#60a5fa' }}>✨ AI Giải thích đáp án</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{aiExplanation}</div>
                    </div>
                  ) : null}
                  {aiSessionAnalysis ? (
                    <div className="mt-5 rounded-[12px] border p-4 text-[13px]" style={{ borderColor: 'rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.75)' }}>
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#a78bfa' }}>📊 AI Phân tích phiên</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{aiSessionAnalysis}</div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {/* Sidebar */}
            <div className="flex w-[280px] shrink-0 flex-col border-l" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
              {/* QR */}
              <div className="border-b px-4 py-4" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.35)' }}>Tham gia tại</div>
                <div className="mb-2 break-all text-[11px]" style={{ color: '#60a5fa' }}>{joinUrl}</div>
                {qrData ? <img src={qrData} alt="qr" className="rounded-[10px]" style={{ width: 200, height: 200 }} /> : null}
              </div>
              {/* Leaderboard */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.35)' }}>🏆 Leaderboard</div>
                <div className="space-y-1.5">
                  {session.participants.length === 0 ? (
                    <div className="text-[12px]" style={{ color: 'rgba(255,255,255,.3)' }}>Chưa có người chơi</div>
                  ) : (
                    [...session.participants]
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 15)
                      .map((p, idx) => {
                        const medals = ['🥇', '🥈', '🥉']
                        return (
                          <div key={p._id} className="flex items-center gap-2 rounded-[8px] px-3 py-2" style={{ background: idx < 3 ? 'rgba(255,255,255,.08)' : 'transparent' }}>
                            <span className="w-5 text-center text-[13px]">{medals[idx] ?? idx + 1}</span>
                            <span className="flex-1 truncate text-[13px]" style={{ color: 'rgba(255,255,255,.75)' }}>{p.name}</span>
                            <span className="text-[13px] font-bold" style={{ color: '#60a5fa' }}>{p.score}</span>
                          </div>
                        )
                      })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer controls */}
          <div className="flex items-center justify-between border-t px-6 py-3" style={{ borderColor: 'rgba(255,255,255,.1)' }}>
            <div className="flex gap-2">
              <button
                onClick={explainCurrentQuestion}
                disabled={!session.currentQuestion || aiLoading || timeLeft > 0}
                className="rounded-xl px-4 py-2.5 text-[12px] font-semibold transition hover:opacity-80 disabled:opacity-40"
                style={{ background: 'rgba(96,165,250,.18)', color: '#60a5fa' }}
              >
                {aiLoading ? '...' : timeLeft > 0 ? '⏱ Đợi hết giờ' : '✨ AI Giải thích'}
              </button>
              <button
                onClick={analyzeSession}
                disabled={aiLoading}
                className="rounded-xl px-4 py-2.5 text-[12px] font-semibold transition hover:opacity-80 disabled:opacity-40"
                style={{ background: 'rgba(167,139,250,.18)', color: '#a78bfa' }}
              >
                {aiLoading ? '...' : '📊 AI Phân tích'}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={nextQuestion}
                className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-bold text-white transition hover:opacity-90"
                style={{ background: '#2563eb' }}
              >
                <SkipForward size={16} /> Câu tiếp theo
              </button>
              <button
                onClick={endSession}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white transition hover:opacity-90"
                style={{ background: '#dc2626' }}
              >
                <Stop size={16} /> Kết thúc
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Question Bank Modal ─────────────────────────────── */}
      {showBank && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pb-4 pt-10">
          <div className="bf-modal flex w-full max-w-2xl flex-col" style={{ maxHeight: '82vh' }}>
            {/* header */}
            <div className="bf-modal__header flex items-center justify-between">
              <div>
                <div className="text-[14px] font-semibold" style={{ color: 'var(--t0)' }}>Ngân hàng câu hỏi</div>
                <div className="text-[11px]" style={{ color: 'var(--t2)' }}>Chỉ hiển thị câu trắc nghiệm nhiều lựa chọn và Quiz Live</div>
              </div>
              <button onClick={() => setShowBank(false)} className="bf-btn bf-btn--icon" title="Đóng" aria-label="Đóng">
                <X size={16} style={{ color: 'var(--t1)' }} />
              </button>
            </div>
            {/* subject + type filter */}
            <div className="bf-card bf-card--compact bf-card--subtle mx-4 mt-3 flex flex-wrap gap-2">
              <FormSelect
                className="min-w-[160px] flex-1"
                value={bankSubjectId}
                onChange={setBankSubjectId}
                options={[{ value: '', label: '-- Tất cả môn học --' }, ...bankSubjects.map(s => ({ value: s._id, label: s.name }))]}
              />
              <FormSelect
                className="min-w-[140px] flex-1"
                value={bankType}
                onChange={setBankType}
                options={[
                  { value: '', label: '-- Tất cả loại --' },
                  { value: 'MULTIPLE_CHOICE', label: 'Trắc nghiệm' },
                  { value: 'QUIZ', label: 'Quiz Live' },
                ]}
              />
            </div>
            {/* question list */}
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {bankLoading ? (
                <div className="py-8 text-center text-[13px]" style={{ color: 'var(--t2)' }}>Đang tải câu hỏi...</div>
              ) : filterBankQuestions.length === 0 ? (
                <div className="py-8 text-center text-[13px]" style={{ color: 'var(--t2)' }}>Không có câu hỏi phù hợp.</div>
              ) : filterBankQuestions.map(q => (
                <label
                  key={q._id}
                  className="bf-list-card flex cursor-pointer items-start gap-3 px-3 py-2"
                  style={{
                    borderColor: bankSelected.has(q._id) ? 'var(--blue)' : 'var(--bd)',
                    background: bankSelected.has(q._id) ? 'rgba(59,130,246,.07)' : 'var(--bg1)',
                  }}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={bankSelected.has(q._id)}
                    onChange={e => {
                      setBankSelected(prev => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(q._id); else next.delete(q._id)
                        return next
                      })
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium" style={{ color: 'var(--t0)' }}>{q.content}</div>
                    {q.options && (
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                        {q.options.map(o => (
                          <span
                            key={o.key}
                            className="text-[11px]"
                            style={{ color: o.key === q.correctAnswer ? 'var(--green)' : 'var(--t2)', fontWeight: o.key === q.correctAnswer ? 600 : 400 }}
                          >
                            {o.key}. {o.content}{o.key === q.correctAnswer ? ' ✓' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
            {/* footer */}
            <div className="bf-modal__footer flex items-center justify-between">
              <div className="text-[12px]" style={{ color: 'var(--t2)' }}>
                Đã chọn: <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{bankSelected.size}</span> câu
                {filterBankQuestions.length > 0 && <span> / {filterBankQuestions.length} câu</span>}
              </div>
              <div className="flex gap-2">
                <ActionButton onClick={() => setShowBank(false)}>Huỷ</ActionButton>
                <ActionButton
                  tone="primary"
                  onClick={importSelected}
                  disabled={bankSelected.size === 0}
                >
                  Thêm {bankSelected.size > 0 ? bankSelected.size + ' câu' : ''} vào bộ quiz
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
