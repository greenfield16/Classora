'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { exams, type PollPublicState } from '@/lib/api'

type Screen = 'join' | 'play' | 'ended' | 'error'

export default function PollLivePlayerPage() {
  const { code } = useParams<{ code: string }>()
  const [screen, setScreen] = useState<Screen>('join')
  const [name, setName] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [participantId, setParticipantId] = useState('')
  const [state, setState] = useState<PollPublicState | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [textAnswer, setTextAnswer] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const loadState = async (pid?: string) => {
    try {
      const next = await exams.getPollState(code, pid || participantId || undefined)
      setState(next)
      if (next.session.status === 'ENDED') setScreen('ended')
      else setScreen('play')
    } catch (e: any) {
      setErr(e.message || 'Không tải được trạng thái bình chọn')
      setScreen('error')
    }
  }

  useEffect(() => {
    if (!participantId) return
    let stop = false
    const tick = async () => {
      if (stop) return
      await loadState(participantId)
    }
    tick()
    const t = setInterval(tick, 2000)
    return () => { stop = true; clearInterval(t) }
  }, [participantId]) // eslint-disable-line

  useEffect(() => {
    setSelectedIndex(null)
    setTextAnswer('')
    setMsg('')
    setErr('')
  }, [state?.session.currentQuestionIndex])

  const join = async () => {
    if (!name.trim() && !isAnonymous) {
      setErr('Vui lòng nhập tên hoặc bật chế độ ẩn danh')
      return
    }
    try {
      const res = await exams.joinPoll(code, name.trim(), isAnonymous)
      setParticipantId(String(res.participantId))
      await loadState(String(res.participantId))
      setErr('')
    } catch (e: any) {
      setErr(e.message || 'Không thể tham gia bình chọn')
    }
  }

  const submit = async () => {
    if (!participantId || !state?.question) return
    try {
      if (state.question.type === 'TEXT') {
        if (!textAnswer.trim()) return setErr('Vui lòng nhập câu trả lời')
        await exams.submitPollResponse(code, { participantId, textAnswer: textAnswer.trim() })
      } else {
        if (selectedIndex === null) return setErr('Vui lòng chọn một phương án')
        await exams.submitPollResponse(code, { participantId, selectedIndices: [selectedIndex] })
      }
      setMsg('Đã gửi phản hồi')
      setErr('')
      await loadState(participantId)
    } catch (e: any) {
      setErr(e.message || 'Không gửi được phản hồi')
    }
  }

  const submittedCurrent = useMemo(() => {
    if (!state?.participant) return false
    return state.participant.lastAnsweredIndex === state.session.currentQuestionIndex
  }, [state])

  if (screen === 'join') {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-[560px] rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: 'rgba(148,163,184,.25)' }}>
          <h1 className="text-xl font-bold text-slate-800">Tham gia Bình chọn trực tiếp</h1>
          <p className="mt-1 text-sm text-slate-500">Mã phòng: <strong>{String(code).toUpperCase()}</strong></p>
          <input
            className="mt-4 w-full rounded-xl border px-4 py-3 text-[14px] outline-none"
            style={{ borderColor: 'rgba(148,163,184,.35)' }}
            placeholder="Nhập tên của bạn"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') join() }}
          />
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} />
            Tham gia ẩn danh
          </label>
          {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
          <button onClick={join} className="bf-btn bf-btn--primary bf-btn--large bf-btn--block mt-4">Vào phòng</button>
        </div>
      </main>
    )
  }

  if (screen === 'error') {
    return <main className="min-h-screen grid place-items-center text-slate-600">{err || 'Không thể tải phòng bình chọn'}</main>
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-[920px] space-y-4">
        <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm" style={{ borderColor: 'rgba(148,163,184,.25)' }}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <span className="font-semibold text-slate-700">{state?.set.title}</span>
              <span className="ml-2 text-slate-500">Mã phòng: {String(code).toUpperCase()}</span>
            </div>
            <div className="text-slate-600">{state?.participantCount || 0} người đang tham gia</div>
          </div>
        </div>

        {state?.session.status !== 'LIVE' || !state.question ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-slate-600" style={{ borderColor: 'rgba(148,163,184,.25)' }}>
            {state?.session.status === 'ENDED' ? 'Bình chọn đã kết thúc 🎉' : 'Người dẫn chương trình đang chuẩn bị câu hỏi...'}
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: 'rgba(148,163,184,.25)' }}>
            <div className="mb-2 text-xs text-slate-500">Câu {state.question.index + 1} / {state.set.questionCount}</div>
            <h2 className="text-lg font-bold text-slate-800">{state.question.prompt}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className={`bf-tag bf-tag--compact ${state.question.isQuestionClosed ? 'bf-tag--green' : 'bf-tag--amber'}`}>
                {state.question.isQuestionClosed ? 'Đã hết thời gian' : `Còn ${state.question.secondsLeft}s`}
              </span>
              <span className="text-slate-500">Thời gian trả lời: {state.question.durationSeconds}s</span>
            </div>

            {state.question.type === 'TEXT' ? (
              <textarea
                rows={4}
                value={textAnswer}
                onChange={e => setTextAnswer(e.target.value)}
                disabled={submittedCurrent || state.question.isQuestionClosed}
                className="mt-4 w-full rounded-xl border px-4 py-3 text-sm outline-none"
                style={{ borderColor: 'rgba(148,163,184,.35)' }}
                placeholder="Nhập ý kiến của bạn..."
              />
            ) : (
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {state.question.options.map((option, idx) => (
                  <button
                    key={`${option.text}-${idx}`}
                    onClick={() => setSelectedIndex(idx)}
                    disabled={submittedCurrent || state.question.isQuestionClosed}
                    className="rounded-xl border px-3 py-3 text-left text-sm transition"
                    style={{
                      borderColor: selectedIndex === idx ? '#2563eb' : 'rgba(148,163,184,.35)',
                      background: selectedIndex === idx ? 'rgba(37,99,235,.08)' : 'white',
                    }}
                  >
                    <strong>{idx + 1}.</strong> {option.text}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={submit}
              disabled={state.question.isQuestionClosed || submittedCurrent || (state.question.type === 'TEXT' ? !textAnswer.trim() : selectedIndex === null)}
              className="bf-btn bf-btn--primary mt-4 w-full sm:w-auto"
            >
              {state.question.isQuestionClosed ? 'Đã khóa bình chọn' : submittedCurrent ? 'Đã gửi phản hồi' : 'Gửi phản hồi'}
            </button>
            {state.question.isQuestionClosed && !submittedCurrent ? <p className="mt-3 text-sm text-amber-600">Hết thời gian trả lời. Vui lòng chờ câu tiếp theo.</p> : null}
            {msg ? <p className="mt-3 text-sm text-slate-700">{msg}</p> : null}
            {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
          </div>
        )}

        {state?.results && state.question?.showResults && state.question.isQuestionClosed ? (
          <div className="rounded-2xl border bg-white p-4" style={{ borderColor: 'rgba(148,163,184,.25)' }}>
            <div className="mb-2 text-sm font-semibold text-slate-700">Kết quả realtime</div>
            <div className="mb-3 text-xs text-slate-500">{state.results.totalResponses} phản hồi</div>

            {state.question?.type === 'TEXT' ? (
              <div className="space-y-2">
                {state.results.textResponses.length === 0 ? (
                  <div className="text-sm text-slate-500">Chưa có phản hồi văn bản.</div>
                ) : state.results.textResponses.slice(-10).map((item, idx) => (
                  <div key={`${item.text}-${idx}`} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {item.text}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {state.question.options.map((option, idx) => {
                  const count = state.results?.distribution?.[idx] || 0
                  const total = Math.max(1, state.results?.totalResponses || 0)
                  const percent = Math.round((count / total) * 100)
                  return (
                    <div key={`${option.text}-${idx}`}>
                      <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
                        <span>{option.text}</span>
                        <span>{count} · {percent}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </main>
  )
}
