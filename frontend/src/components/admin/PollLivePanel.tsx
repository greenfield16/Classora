'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { exams, examAI, type PollSet, type PollSessionAdmin, type ExamQuestion, type ExamSubject } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { ActionButton, EmptyState, FormSelect, PanelSection, Pill, StatCard } from './AdminUI'
import { ArrowsClockwise, Plus, Play, SkipForward, Stop, Trash, QrCode, BookOpen, X } from '@phosphor-icons/react'

type DraftPollQuestion = {
  prompt: string
  type: 'SINGLE_CHOICE' | 'YES_NO' | 'TEXT'
  options: string[]
  durationSeconds: number
  showResults: boolean
}

const POLL_TYPE_LABEL: Record<DraftPollQuestion['type'], string> = {
  SINGLE_CHOICE: 'Chọn 1 đáp án',
  YES_NO: 'Có / Không',
  TEXT: 'Câu trả lời ngắn',
}

const inputCls = 'w-full rounded-[8px] border px-3 py-2 text-[13px] outline-none'
const inputStyle = { borderColor: 'var(--bd)', backgroundColor: 'var(--bg1)', color: 'var(--t0)' }

const makeDraftQuestion = (): DraftPollQuestion => ({
  prompt: '',
  type: 'SINGLE_CHOICE',
  options: ['', '', '', ''],
  durationSeconds: 20,
  showResults: true,
})

function normalizeDraftType(type: DraftPollQuestion['type'], prev?: DraftPollQuestion): DraftPollQuestion {
  if (type === 'YES_NO') {
    return { ...(prev || makeDraftQuestion()), type, options: ['Có', 'Không'], durationSeconds: prev?.durationSeconds ?? 20, showResults: prev?.showResults ?? true }
  }
  if (type === 'TEXT') {
    return { ...(prev || makeDraftQuestion()), type, options: [], durationSeconds: prev?.durationSeconds ?? 20, showResults: prev?.showResults ?? true }
  }
  return { ...(prev || makeDraftQuestion()), type, options: prev?.options?.length ? [...prev.options, '', '', '', ''].slice(0, 4) : ['', '', '', ''], durationSeconds: prev?.durationSeconds ?? 20, showResults: prev?.showResults ?? true }
}

export default function PollLivePanel() {
  const token = useAuthStore(s => s.token) || ''
  const [sets, setSets] = useState<PollSet[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<DraftPollQuestion[]>([makeDraftQuestion()])

  const [session, setSession] = useState<PollSessionAdmin | null>(null)
  const [activeSessionId, setActiveSessionId] = useState('')
  const [joinUrl, setJoinUrl] = useState('')
  const [qrData, setQrData] = useState('')
  const [aiPollAnalysis, setAiPollAnalysis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // Question bank modal state
  const [showBank, setShowBank] = useState(false)
  const [bankSubjects, setBankSubjects] = useState<ExamSubject[]>([])
  const [bankQuestions, setBankQuestions] = useState<ExamQuestion[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const [bankSubjectId, setBankSubjectId] = useState('')
  const [bankSelected, setBankSelected] = useState<Set<string>>(new Set())

  const load = async () => {
    if (!token) return
    setLoading(true)
    try {
      setSets(await exams.getPollSets(token))
    } catch (e: any) {
      setError(e.message || 'Không tải được bộ bình chọn')
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
        const data = await exams.getPollSession(token, activeSessionId)
        if (!stop) {
          setSession(data)
          const url = `${window.location.origin}/poll/live/${data.session.code}`
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

  const resetDraft = () => {
    setTitle('')
    setDescription('')
    setQuestions([makeDraftQuestion()])
  }

  // ── Question bank helpers ─────────────────────────────────
  function bankQToPollDraft(q: ExamQuestion): DraftPollQuestion | null {
    if (q.type !== 'POLL' || !q.options || q.options.length < 2) return null
    return {
      prompt: q.content,
      type: 'SINGLE_CHOICE',
      options: q.options.map(o => o.content),
      durationSeconds: 20,
      showResults: true,
    }
  }

  const openBank = async () => {
    setShowBank(true)
    setBankSelected(new Set())
    setBankSubjectId('')
    if (!token) return
    setBankLoading(true)
    try {
      const [subjectsRes, qRes] = await Promise.all([
        exams.getSubjects(token),
        exams.getQuestions(token, { limit: 200, type: 'POLL' }),
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
    const filtered = bankSubjectId
      ? bankQuestions.filter(q => (typeof q.subjectId === 'string' ? q.subjectId : (q.subjectId as ExamSubject)._id) === bankSubjectId)
      : bankQuestions
    const toAdd: DraftPollQuestion[] = []
    filtered.forEach(q => {
      if (!bankSelected.has(q._id)) return
      const draft = bankQToPollDraft(q)
      if (draft) toAdd.push(draft)
    })
    if (toAdd.length === 0) return
    setQuestions(v => {
      const existing = v.filter(q => q.prompt.trim() !== '')
      return [...existing, ...toAdd]
    })
    setShowBank(false)
    setBankSelected(new Set())
    setMessage(`Đã thêm ${toAdd.length} câu từ ngân hàng vào bộ bình chọn`)
  }

  const filteredBank = bankSubjectId
    ? bankQuestions.filter(q => (typeof q.subjectId === 'string' ? q.subjectId : (q.subjectId as ExamSubject)._id) === bankSubjectId)
    : bankQuestions

  const createSet = async () => {
    if (!token) return
    const clean = questions
      .map(q => ({
        prompt: q.prompt.trim(),
        type: q.type,
        options: q.type === 'SINGLE_CHOICE' ? q.options.map(text => ({ text: text.trim() })).filter(o => o.text) : undefined,
        durationSeconds: Math.max(5, Number(q.durationSeconds || 20)),
        showResults: q.showResults,
      }))
      .filter(q => q.prompt)

    if (!title.trim()) return setError('Nhập tiêu đề bộ bình chọn')
    if (clean.length === 0) return setError('Cần ít nhất 1 câu hỏi hợp lệ')

    setSaving(true)
    setError('')
    setMessage('')
    try {
      await exams.createPollSet(token, { title: title.trim(), description: description.trim(), questions: clean })
      setMessage('Đã tạo bộ bình chọn')
      resetDraft()
      await load()
    } catch (e: any) {
      setError(e.message || 'Tạo bộ bình chọn thất bại')
    } finally {
      setSaving(false)
    }
  }

  const startSession = async (setId: string) => {
    if (!token) return
    setError('')
    try {
      const data = await exams.startPollSession(token, { setId })
      setSession(data)
      setActiveSessionId(data.session._id)
      setMessage('Đã bắt đầu phiên Bình chọn trực tiếp')
    } catch (e: any) {
      setError(e.message || 'Không thể bắt đầu phiên bình chọn')
    }
  }

  const nextQuestion = async () => {
    if (!token || !activeSessionId) return
    try {
      setSession(await exams.nextPollQuestion(token, activeSessionId))
    } catch (e: any) {
      setError(e.message || 'Không thể chuyển câu hỏi')
    }
  }

  const endSession = async () => {
    if (!token || !activeSessionId) return
    try {
      await exams.endPollSession(token, activeSessionId)
      setMessage('Đã kết thúc phiên bình chọn')
      setActiveSessionId('')
      setSession(null)
      setJoinUrl('')
      setQrData('')
    } catch (e: any) {
      setError(e.message || 'Không thể kết thúc phiên bình chọn')
    }
  }

  const analyzePollSession = async () => {
    if (!session) return
    setAiLoading(true)
    setError('')
    try {
      const q = session.currentQuestion
      const questionsPayload = q ? [{
        prompt: q.prompt,
        type: q.type,
        options: q.options || [],
        distribution: session.responseStats.distribution || {},
        totalResponses: session.responseStats.totalResponses || 0,
        textResponses: session.responseStats.textResponses || [],
      }] : []
      const res = await examAI.analyzePollSession({
        title: session.set.title,
        questions: questionsPayload,
        totalParticipants: session.participants.length,
      })
      setAiPollAnalysis(res.analysis || '')
    } catch (e: any) {
      setError(e.message || 'Không thể phân tích phiên bình chọn')
    } finally {
      setAiLoading(false)
    }
  }

  const removeSet = async (id: string) => {
    if (!token) return
    if (!confirm('Xóa bộ bình chọn này?')) return
    try {
      await exams.deletePollSet(token, id)
      await load()
    } catch (e: any) {
      setError(e.message || 'Không thể xóa bộ bình chọn')
    }
  }

  const stat = useMemo(() => ({
    sets: sets.length,
    participants: session?.participants?.length || 0,
    responsesNow: session?.responseStats?.totalResponses || 0,
    qIndex: (session?.currentQuestion?.index ?? -1) + 1,
  }), [sets.length, session])

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bộ bình chọn" value={stat.sets} accent="var(--blue)" />
        <StatCard label="Người tham gia" value={stat.participants} accent="var(--green)" />
        <StatCard label="Đã phản hồi câu hiện tại" value={stat.responsesNow} accent="var(--amber)" />
        <StatCard label="Câu đang chạy" value={stat.qIndex > 0 ? stat.qIndex : '—'} accent="var(--purple)" />
      </div>

      {error ? <div className="rounded-[10px] border px-3 py-2 text-[12px]" style={{ borderColor: 'rgba(244,63,94,.25)', color: 'var(--red)', background: 'rgba(244,63,94,.08)' }}>{error}</div> : null}
      {message ? <div className="rounded-[10px] border px-3 py-2 text-[12px]" style={{ borderColor: 'rgba(16,185,129,.28)', color: 'var(--green)', background: 'rgba(16,185,129,.08)' }}>{message}</div> : null}

      <PanelSection
        title="Tạo bộ Bình chọn trực tiếp"
        description="Khảo sát nhanh ý kiến học sinh theo thời gian thực"
        actions={(
          <ActionButton iconOnly title="Tải lại" ariaLabel="Tải lại" onClick={load} disabled={loading}>
            <ArrowsClockwise size={16} className={loading ? 'animate-spin' : ''} />
          </ActionButton>
        )}
      >
        <div className="space-y-3">
          <input className={inputCls} style={inputStyle} placeholder="Tên bộ bình chọn" value={title} onChange={e => setTitle(e.target.value)} />
          <input className={inputCls} style={inputStyle} placeholder="Mô tả ngắn (không bắt buộc)" value={description} onChange={e => setDescription(e.target.value)} />

          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={idx} className="rounded-[10px] border p-3" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[12px] font-semibold" style={{ color: 'var(--t1)' }}>Câu {idx + 1}</div>
                  {questions.length > 1 ? (
                    <ActionButton tone="danger" onClick={() => setQuestions(v => v.filter((_, i) => i !== idx))}><Trash size={14} />Xóa</ActionButton>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
                  <input
                    className={inputCls}
                    style={inputStyle}
                    placeholder="Nội dung câu hỏi"
                    value={q.prompt}
                    onChange={e => setQuestions(v => v.map((it, i) => i === idx ? { ...it, prompt: e.target.value } : it))}
                  />
                  <FormSelect
                    value={q.type}
                    onChange={value => setQuestions(v => v.map((it, i) => i === idx ? normalizeDraftType(value as DraftPollQuestion['type'], it) : it))}
                    options={Object.entries(POLL_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
                  />
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <div className="mb-1 text-[12px] font-medium" style={{ color: 'var(--t2)' }}>Thời gian bình chọn (giây)</div>
                    <input
                      type="number"
                      min={5}
                      max={300}
                      className={inputCls}
                      style={inputStyle}
                      value={q.durationSeconds}
                      onChange={e => setQuestions(v => v.map((it, i) => i === idx ? { ...it, durationSeconds: Math.max(5, Number(e.target.value || 20)) } : it))}
                    />
                  </div>
                  <div className="rounded-[8px] px-3 py-2 text-[12px]" style={{ background: 'var(--bg2)', color: 'var(--t2)' }}>
                    Khi hết thời gian, bình chọn sẽ khóa nhận phản hồi và kết quả sẽ hiện ngay trong màn hình giáo viên.
                  </div>
                </div>

                {q.type === 'SINGLE_CHOICE' ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {[0, 1, 2, 3].map(ci => (
                      <input
                        key={ci}
                        className={inputCls}
                        style={inputStyle}
                        placeholder={`Lựa chọn ${ci + 1}`}
                        value={q.options[ci] || ''}
                        onChange={e => setQuestions(v => v.map((it, i) => i === idx ? { ...it, options: it.options.map((c, j) => j === ci ? e.target.value : c) } : it))}
                      />
                    ))}
                  </div>
                ) : q.type === 'YES_NO' ? (
                  <div className="mt-3 rounded-[8px] px-3 py-2 text-[12px]" style={{ background: 'var(--bg2)', color: 'var(--t2)' }}>
                    Hệ thống dùng sẵn 2 lựa chọn: <strong>Có</strong> và <strong>Không</strong>.
                  </div>
                ) : (
                  <div className="mt-3 rounded-[8px] px-3 py-2 text-[12px]" style={{ background: 'var(--bg2)', color: 'var(--t2)' }}>
                    Người tham gia sẽ nhập câu trả lời ngắn trực tiếp từ điện thoại.
                  </div>
                )}

                <label className="mt-3 flex items-center gap-2 text-[12px]" style={{ color: 'var(--t2)' }}>
                  <input
                    type="checkbox"
                    checked={q.showResults}
                    onChange={e => setQuestions(v => v.map((it, i) => i === idx ? { ...it, showResults: e.target.checked } : it))}
                  />
                  Hiển thị kết quả realtime cho người tham gia
                </label>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => setQuestions(v => [...v, makeDraftQuestion()])}><Plus size={14} />Thêm câu hỏi</ActionButton>
            <ActionButton onClick={openBank}><BookOpen size={14} />Lấy từ ngân hàng</ActionButton>
            <ActionButton tone="primary" onClick={createSet} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu bộ bình chọn'}</ActionButton>
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Bộ bình chọn đã tạo" description="Chọn bộ bình chọn để bắt đầu phiên lấy ý kiến trực tiếp">
        {sets.length === 0 ? <EmptyState>Chưa có bộ poll nào.</EmptyState> : (
          <div className="space-y-2">
            {sets.map(s => (
              <div key={s._id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border px-3 py-2" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: 'var(--t0)' }}>{s.title}</div>
                  <div className="text-[11px]" style={{ color: 'var(--t2)' }}>{s.questions?.length || 0} câu hỏi</div>
                </div>
                <div className="flex gap-2">
                  <ActionButton tone="primary" onClick={() => startSession(s._id)}><Play size={14} />Bắt đầu live</ActionButton>
                  <ActionButton tone="danger" onClick={() => removeSet(s._id)}><Trash size={14} />Xóa</ActionButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelSection>

      {session ? (
        <PanelSection
          title={`Phiên Bình chọn trực tiếp — ${session.set.title}`}
          description={`Mã phòng: ${session.session.code}`}
          actions={<Pill tone={session.session.status === 'LIVE' ? 'green' : 'amber'}>{session.session.status}</Pill>}
        >
          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-3">
              <div className="rounded-[10px] border p-3" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
                <div className="text-[12px]" style={{ color: 'var(--t2)' }}>Câu hiện tại</div>
                <div className="mt-1 text-[14px] font-semibold" style={{ color: 'var(--t0)' }}>
                  {session.currentQuestion ? `${session.currentQuestion.index + 1}. ${session.currentQuestion.prompt}` : 'Phiên đã kết thúc'}
                </div>
                {session.currentQuestion ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
                    <span className={`bf-tag bf-tag--compact ${session.currentQuestion.isQuestionClosed ? 'bf-tag--green' : 'bf-tag--amber'}`}>
                      {session.currentQuestion.isQuestionClosed ? 'Đã hết thời gian - hiển thị kết quả' : `Còn ${session.currentQuestion.secondsLeft}s`}
                    </span>
                    <span style={{ color: 'var(--t2)' }}>Tổng thời gian: {session.currentQuestion.durationSeconds}s</span>
                  </div>
                ) : null}

                {!session.currentQuestion?.isQuestionClosed ? (
                  <div className="mt-3 rounded-[8px] px-3 py-2 text-[12px]" style={{ background: 'rgba(245,158,11,.08)', color: 'var(--amber)' }}>
                    Bình chọn đang nhận phản hồi. Kết quả chi tiết sẽ tự hiện khi hết thời gian.
                  </div>
                ) : null}

                {session.currentQuestion?.isQuestionClosed && session.currentQuestion?.type !== 'TEXT' && session.currentQuestion?.options?.length ? (
                  <div className="mt-3 space-y-2">
                    {session.currentQuestion.options.map((option, i) => {
                      const count = session.responseStats.distribution?.[i] || 0
                      const total = Math.max(1, session.responseStats.totalResponses || 0)
                      const percent = Math.round((count / total) * 100)
                      return (
                        <div key={`${option.text}-${i}`}>
                          <div className="mb-1 flex items-center justify-between text-[12px]" style={{ color: 'var(--t1)' }}>
                            <span>{option.text}</span>
                            <span>{count} phiếu · {percent}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--bg2)' }}>
                            <div className="h-full rounded-full" style={{ width: `${percent}%`, background: 'var(--blue)' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                {session.currentQuestion?.isQuestionClosed && session.currentQuestion?.type === 'TEXT' ? (
                  <div className="mt-3 space-y-2">
                    {session.responseStats.textResponses.length === 0 ? (
                      <div className="text-[12px]" style={{ color: 'var(--t2)' }}>Chưa có phản hồi văn bản.</div>
                    ) : session.responseStats.textResponses.slice(-8).map(item => (
                      <div key={item._id} className="rounded-[8px] px-3 py-2 text-[12px]" style={{ background: 'var(--bg2)', color: 'var(--t1)' }}>
                        <div className="font-semibold">{item.participantName}</div>
                        <div>{item.text}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex gap-2">
                <ActionButton tone="primary" onClick={nextQuestion}><SkipForward size={14} />Câu tiếp theo</ActionButton>
                <ActionButton tone="danger" onClick={endSession}><Stop size={14} />Kết thúc</ActionButton>
                <ActionButton onClick={analyzePollSession} disabled={aiLoading}>AI phân tích bình chọn</ActionButton>
              </div>

              {aiPollAnalysis ? (
                <div className="mt-3 rounded-[10px] border p-3 text-[13px]" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)', color: 'var(--t1)' }}>
                  <div className="mb-1 text-[12px] font-semibold" style={{ color: 'var(--t0)' }}>AI phân tích phiên bình chọn</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{aiPollAnalysis}</div>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="rounded-[10px] border p-3" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
                <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold" style={{ color: 'var(--t1)' }}><QrCode size={14} />Tham gia bình chọn</div>
                <div className="text-[11px] break-all" style={{ color: 'var(--t2)' }}>{joinUrl}</div>
                {qrData ? <img src={qrData} alt="qr" className="mt-2 rounded-[8px]" style={{ width: 180, height: 180 }} /> : null}
              </div>

              <div className="rounded-[10px] border p-3" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
                <div className="mb-2 text-[12px] font-semibold" style={{ color: 'var(--t1)' }}>Người tham gia</div>
                <div className="space-y-1">
                  {session.participants.slice(0, 12).map((p, idx) => (
                    <div key={p._id} className="flex items-center justify-between text-[12px]">
                      <span style={{ color: 'var(--t1)' }}>{idx + 1}. {p.isAnonymous ? 'Ẩn danh' : p.name}</span>
                      <span style={{ color: p.lastAnsweredIndex === session.session.currentQuestionIndex ? 'var(--green)' : 'var(--t2)', fontWeight: 700 }}>
                        {p.lastAnsweredIndex === session.session.currentQuestionIndex ? 'Đã phản hồi' : 'Đang chờ'}
                      </span>
                    </div>
                  ))}
                  {session.participants.length === 0 ? <div className="text-[12px]" style={{ color: 'var(--t2)' }}>Chưa có người tham gia</div> : null}
                </div>
              </div>
            </div>
          </div>
        </PanelSection>
      ) : null}

      {/* ── Question Bank Modal ──────────────────────── */}
      {showBank && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pb-4 pt-10">
          <div className="bf-modal flex w-full max-w-2xl flex-col" style={{ maxHeight: '82vh' }}>
            {/* header */}
            <div className="bf-modal__header flex items-center justify-between">
              <div>
                <div className="text-[14px] font-semibold" style={{ color: 'var(--t0)' }}>Ngân hàng câu hỏi Bình chọn</div>
                <div className="text-[11px]" style={{ color: 'var(--t2)' }}>Chỉ hiển thị câu hỏi loại Bình chọn (POLL)</div>
              </div>
              <button onClick={() => setShowBank(false)} className="bf-btn bf-btn--icon" title="Đóng" aria-label="Đóng">
                <X size={16} style={{ color: 'var(--t1)' }} />
              </button>
            </div>
            {/* subject filter */}
            <div className="bf-card bf-card--compact bf-card--subtle mx-4 mt-3 flex flex-wrap gap-2">
              <FormSelect
                className="min-w-[160px] flex-1"
                value={bankSubjectId}
                onChange={setBankSubjectId}
                options={[{ value: '', label: '-- Tất cả môn học --' }, ...bankSubjects.map(s => ({ value: s._id, label: s.name }))]}
              />
            </div>
            {/* question list */}
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {bankLoading ? (
                <div className="py-8 text-center text-[13px]" style={{ color: 'var(--t2)' }}>Đang tải câu hỏi...</div>
              ) : filteredBank.length === 0 ? (
                <div className="py-8 text-center text-[13px]" style={{ color: 'var(--t2)' }}>Không có câu hỏi bình chọn nào trong ngân hàng.</div>
              ) : filteredBank.map(q => (
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
                          <span key={o.key} className="text-[11px]" style={{ color: 'var(--t2)' }}>
                            {o.key}. {o.content}
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
                {filteredBank.length > 0 && <span> / {filteredBank.length} câu</span>}
              </div>
              <div className="flex gap-2">
                <ActionButton onClick={() => setShowBank(false)}>Huỷ</ActionButton>
                <ActionButton
                  tone="primary"
                  onClick={importSelected}
                  disabled={bankSelected.size === 0}
                >
                  Thêm {bankSelected.size > 0 ? bankSelected.size + ' câu' : ''} vào bộ bình chọn
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
