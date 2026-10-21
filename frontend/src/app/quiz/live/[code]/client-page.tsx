'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { exams, type QuizPublicState } from '@/lib/api'

type Screen = 'join' | 'play' | 'ended' | 'error'

export default function QuizLivePlayerPage() {
  const { code } = useParams<{ code: string }>()
  const [screen, setScreen] = useState<Screen>('join')
  const [name, setName] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [state, setState] = useState<QuizPublicState | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [answeredIndex, setAnsweredIndex] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const startedAtRef = useRef<number>(Date.now())

  const loadState = async (pid?: string) => {
    try {
      const s = await exams.getQuizState(code, pid || participantId || undefined)
      setState(s)
      if (s.session.status === 'ENDED') setScreen('ended')
      else setScreen('play')
      if (answeredIndex !== s.session.currentQuestionIndex) {
        setSelectedIndex(null)
      }
    } catch (e: any) {
      setErr(e.message || 'Không tải được trạng thái phòng')
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
    if (!state) return
    startedAtRef.current = Date.now()
    setSelectedIndex(null)
    setAnsweredIndex(null)
    setMsg('')
  }, [state?.session.currentQuestionIndex]) // eslint-disable-line

  const join = async () => {
    if (!name.trim()) return
    try {
      const res = await exams.joinQuiz(code, name.trim())
      setParticipantId(String(res.participantId))
      setErr('')
      await loadState(String(res.participantId))
    } catch (e: any) {
      setErr(e.message || 'Không thể tham gia phòng')
    }
  }

  const submit = async () => {
    if (!participantId || selectedIndex === null || !state?.question) return
    try {
      const responseMs = Date.now() - startedAtRef.current
      const res = await exams.submitQuizAnswer(code, { participantId, selectedIndex, responseMs })
      setAnsweredIndex(state.question.index)
      setMsg(res.correct ? `✅ Chính xác! +${res.gained} điểm` : '❌ Sai rồi, đợi câu tiếp theo nhé')
      await loadState(participantId)
    } catch (e: any) {
      setErr(e.message || 'Không gửi được đáp án')
    }
  }

  const rank = useMemo(() => {
    if (!state || !participantId) return null
    const idx = state.leaderboard.findIndex(r => String(r._id) === String(participantId))
    return idx >= 0 ? idx + 1 : null
  }, [state, participantId])

  if (screen === 'join') {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-[560px] rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: 'rgba(148,163,184,.25)' }}>
          <h1 className="text-xl font-bold text-slate-800">Tham gia Quiz Live</h1>
          <p className="mt-1 text-sm text-slate-500">Mã phòng: <strong>{String(code).toUpperCase()}</strong></p>
          <input
            className="mt-4 w-full rounded-xl border px-4 py-3 text-[14px] outline-none"
            style={{ borderColor: 'rgba(148,163,184,.35)' }}
            placeholder="Nhập tên của bạn"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') join() }}
          />
          {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
          <button onClick={join} className="bf-btn bf-btn--primary bf-btn--large bf-btn--block mt-4">Vào phòng</button>
        </div>
      </main>
    )
  }

  if (screen === 'error') {
    return <main className="min-h-screen grid place-items-center text-slate-600">{err || 'Không thể tải phòng quiz'}</main>
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-[880px] space-y-4">
        <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm" style={{ borderColor: 'rgba(148,163,184,.25)' }}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <span className="font-semibold text-slate-700">{state?.set.title}</span>
              <span className="ml-2 text-slate-500">Mã phòng: {String(code).toUpperCase()}</span>
            </div>
            <div className="text-slate-600">{rank ? `Hạng #${rank}` : 'Đang chờ xếp hạng'}</div>
          </div>
        </div>

        {state?.session.status === 'WAITING' ? (
          <div className="rounded-2xl border bg-white p-10 text-center shadow-sm" style={{ borderColor: 'rgba(148,163,184,.25)' }}>
            <div className="mb-3 text-4xl">⏳</div>
            <h2 className="text-lg font-bold text-slate-800">Đang chờ giáo viên bắt đầu</h2>
            <p className="mt-2 text-sm text-slate-500">Bạn đã vào phòng thành công. Vui lòng ngồi đợi...</p>
            <div className="mt-4 flex justify-center gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        ) : state?.session.status !== 'LIVE' || !state.question ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-slate-600" style={{ borderColor: 'rgba(148,163,184,.25)' }}>
            {state?.session.status === 'ENDED' ? 'Quiz đã kết thúc 🎉' : 'Giáo viên đang chuẩn bị câu hỏi...'}
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: 'rgba(148,163,184,.25)' }}>
            <div className="mb-2 text-xs text-slate-500">Câu {state.question.index + 1} / {state.set.questionCount}</div>
            <h2 className="text-lg font-bold text-slate-800">{state.question.prompt}</h2>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {state.question.choices.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedIndex(i)}
                  disabled={answeredIndex === state.question?.index}
                  className="rounded-xl border px-3 py-3 text-left text-sm transition"
                  style={{
                    borderColor: selectedIndex === i ? '#2563eb' : 'rgba(148,163,184,.35)',
                    background: selectedIndex === i ? 'rgba(37,99,235,.08)' : 'white',
                  }}
                >
                  <strong>{i + 1}.</strong> {c.text}
                </button>
              ))}
            </div>
            <button
              onClick={submit}
              disabled={selectedIndex === null || answeredIndex === state.question.index}
              className="bf-btn bf-btn--primary mt-4 w-full sm:w-auto"
            >
              {answeredIndex === state.question.index ? 'Đã trả lời' : 'Gửi đáp án'}
            </button>
            {msg ? <p className="mt-3 text-sm text-slate-700">{msg}</p> : null}
            {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
          </div>
        )}

        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: 'rgba(148,163,184,.25)' }}>
          <div className="mb-2 text-sm font-semibold text-slate-700">Top 10</div>
          <div className="space-y-1 text-sm">
            {state?.leaderboard?.map((p, i) => (
              <div key={p._id} className="flex items-center justify-between">
                <span className="text-slate-700">{i + 1}. {p.name}</span>
                <span className="font-semibold text-blue-600">{p.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
