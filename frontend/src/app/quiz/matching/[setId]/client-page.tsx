'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { exams, type QuizSet } from '@/lib/api'
import { ArrowLeft, ArrowCounterClockwise, Lightning, CheckCircle, SmileyXEyes } from '@phosphor-icons/react'

type Card = { id: string; text: string; type: 'question' | 'answer'; pairIndex: number }

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function MatchingPage() {
  const { setId } = useParams<{ setId: string }>()
  const router = useRouter()

  const [set, setSet] = useState<QuizSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Game state
  const [leftCards, setLeftCards] = useState<Card[]>([])
  const [rightCards, setRightCards] = useState<Card[]>([])
  const [selected, setSelected] = useState<{ side: 'left' | 'right'; id: string } | null>(null)
  const [matchedPairs, setMatchedPairs] = useState<Set<number>>(new Set())
  const [wrongPair, setWrongPair] = useState<{ l: string; r: string } | null>(null)
  const [score, setScore] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [finished, setFinished] = useState(false)
  const [startTime, setStartTime] = useState<number>(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!setId) return
    setLoading(true)
    exams.getPublicQuizSet(setId)
      .then(data => setSet(data))
      .catch(e => setError(e.message || 'Không tải được bộ ghép đôi'))
      .finally(() => setLoading(false))
  }, [setId])

  const initGame = useCallback((data: QuizSet) => {
    // Take max 8 pairs to keep manageable on screen
    const src = data.questions.slice(0, 8)
    const lc: Card[] = src.map((q, i) => ({
      id: `q-${i}`,
      text: q.prompt,
      type: 'question',
      pairIndex: i,
    }))
    const rc: Card[] = src.map((q, i) => ({
      id: `a-${i}`,
      text: (q.choices as Array<{ text: string }>)[q.correctIndex]?.text || '',
      type: 'answer',
      pairIndex: i,
    }))
    setLeftCards(shuffle(lc))
    setRightCards(shuffle(rc))
    setMatchedPairs(new Set())
    setSelected(null)
    setWrongPair(null)
    setScore(0)
    setAttempts(0)
    setFinished(false)
    setStartTime(Date.now())
    setElapsed(0)
  }, [])

  useEffect(() => {
    if (set) initGame(set)
  }, [set, initGame])

  // Timer
  useEffect(() => {
    if (finished || !startTime) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 500)
    return () => clearInterval(t)
  }, [finished, startTime])

  const total = set ? Math.min(set.questions.length, 8) : 0

  const handleClick = (side: 'left' | 'right', card: Card) => {
    if (matchedPairs.has(card.pairIndex)) return
    if (wrongPair) return // wait for wrong animation to clear

    if (!selected) {
      setSelected({ side, id: card.id })
      return
    }

    // Clicked same card → deselect
    if (selected.side === side && selected.id === card.id) {
      setSelected(null)
      return
    }

    // Clicked same side → switch selection
    if (selected.side === side) {
      setSelected({ side, id: card.id })
      return
    }

    // Got a pair (one from each side)
    const leftId = side === 'right' ? selected.id : card.id
    const rightId = side === 'right' ? card.id : selected.id
    const leftCard = leftCards.find(c => c.id === leftId)!
    const rightCard = rightCards.find(c => c.id === rightId)!

    setAttempts(a => a + 1)
    setSelected(null)

    if (leftCard.pairIndex === rightCard.pairIndex) {
      // Correct match
      const newMatched = new Set([...matchedPairs, leftCard.pairIndex])
      setMatchedPairs(newMatched)
      setScore(s => s + 1)
      if (newMatched.size >= total) {
        setFinished(true)
        setElapsed(Math.floor((Date.now() - startTime) / 1000))
      }
    } else {
      // Wrong match
      setWrongPair({ l: leftId, r: rightId })
      setTimeout(() => setWrongPair(null), 700)
    }
  }

  const accuracy = attempts > 0 ? Math.round((score / attempts) * 100) : 100

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg0)' }}>
        <div className="text-[14px]" style={{ color: 'var(--t2)' }}>Đang tải trò chơi ghép đôi...</div>
      </main>
    )
  }

  if (error || !set) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg0)' }}>
        <div className="text-center space-y-3">
          <SmileyXEyes size={48} style={{ color: 'var(--t2)', margin: '0 auto' }} />
          <div className="text-[14px]" style={{ color: 'var(--red)' }}>{error || 'Bộ quiz không tồn tại'}</div>
          <button onClick={() => router.back()} className="bf-btn bf-btn--text">← Quay lại</button>
        </div>
      </main>
    )
  }

  // ── Finished screen ───────────────────────────────────────────────────────
  if (finished) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: 'var(--bg0)' }}>
        <div className="w-full max-w-[440px] rounded-2xl border p-8 text-center space-y-4" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
          <CheckCircle size={56} weight="fill" style={{ color: 'var(--green)', margin: '0 auto' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--t0)' }}>Hoàn thành! 🎉</h2>
          <p className="text-[13px]" style={{ color: 'var(--t2)' }}>{set.title}</p>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="rounded-xl py-4" style={{ background: 'rgba(16,185,129,.1)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--green)' }}>{total}/{total}</div>
              <div className="text-[11px]" style={{ color: 'var(--t2)' }}>Cặp khớp</div>
            </div>
            <div className="rounded-xl py-4" style={{ background: 'rgba(59,130,246,.1)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--blue)' }}>{accuracy}%</div>
              <div className="text-[11px]" style={{ color: 'var(--t2)' }}>Độ chính xác</div>
            </div>
            <div className="rounded-xl py-4" style={{ background: 'rgba(168,85,247,.1)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--purple)' }}>{fmtTime(elapsed)}</div>
              <div className="text-[11px]" style={{ color: 'var(--t2)' }}>Thời gian</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <button
              onClick={() => initGame(set)}
              className="bf-btn bf-btn--primary bf-btn--large bf-btn--block"
            >
              <ArrowCounterClockwise size={16} /> Chơi lại
            </button>
            <button onClick={() => router.back()} className="bf-btn bf-btn--text">← Quay lại</button>
          </div>
        </div>
      </main>
    )
  }

  // ── Game board ────────────────────────────────────────────────────────────
  const getCardStyle = (side: 'left' | 'right', card: Card) => {
    const isMatched = matchedPairs.has(card.pairIndex)
    const isSelected = selected?.side === side && selected.id === card.id
    const isWrong = wrongPair && (
      (side === 'left' && wrongPair.l === card.id) ||
      (side === 'right' && wrongPair.r === card.id)
    )

    if (isMatched) return {
      borderColor: 'var(--green)',
      background: 'rgba(16,185,129,.1)',
      color: 'var(--green)',
      opacity: 0.55,
      cursor: 'default',
    }
    if (isWrong) return {
      borderColor: 'var(--red)',
      background: 'rgba(244,63,94,.12)',
      color: 'var(--red)',
      cursor: 'pointer',
      animation: 'shake 0.4s ease',
    }
    if (isSelected) return {
      borderColor: 'var(--blue)',
      background: 'rgba(59,130,246,.12)',
      color: 'var(--blue)',
      cursor: 'pointer',
      boxShadow: '0 0 0 2px rgba(59,130,246,.25)',
    }
    return {
      borderColor: 'var(--bd)',
      background: 'var(--bg1)',
      color: 'var(--t0)',
      cursor: 'pointer',
    }
  }

  return (
    <main className="min-h-screen flex flex-col px-4 py-6" style={{ background: 'var(--bg0)' }}>
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-6px)}
          60%{transform:translateX(6px)}
        }
      `}</style>
      <div className="mx-auto w-full max-w-[900px] flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="bf-btn bf-btn--text">
            <ArrowLeft size={16} /> Quay lại
          </button>
          <div className="flex items-center gap-2">
            <Lightning size={18} weight="fill" style={{ color: 'var(--amber)' }} />
            <span className="text-[13px] font-semibold" style={{ color: 'var(--t0)' }}>Ghép đôi — {set.title}</span>
          </div>
          <div className="flex items-center gap-4 text-[13px]" style={{ color: 'var(--t2)' }}>
            <span>⏱ {fmtTime(elapsed)}</span>
            <span style={{ color: 'var(--blue)' }}>{matchedPairs.size}/{total}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--bd)' }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{ width: `${(matchedPairs.size / total) * 100}%`, background: 'var(--green)' }}
          />
        </div>

        <p className="text-center text-[12px]" style={{ color: 'var(--t2)' }}>
          Click vào một câu hỏi rồi click vào đáp án tương ứng để ghép cặp
        </p>

        {/* Game grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left: Questions */}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--t2)' }}>Câu hỏi</div>
            {leftCards.map(card => (
              <button
                key={card.id}
                onClick={() => handleClick('left', card)}
                disabled={matchedPairs.has(card.pairIndex)}
                className="rounded-[12px] border px-4 py-3 text-[13px] text-left font-medium leading-snug transition-all duration-150"
                style={getCardStyle('left', card)}
              >
                {matchedPairs.has(card.pairIndex) ? <span>✓ </span> : null}
                {card.text}
              </button>
            ))}
          </div>

          {/* Right: Answers */}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--t2)' }}>Đáp án</div>
            {rightCards.map(card => (
              <button
                key={card.id}
                onClick={() => handleClick('right', card)}
                disabled={matchedPairs.has(card.pairIndex)}
                className="rounded-[12px] border px-4 py-3 text-[13px] text-left font-medium leading-snug transition-all duration-150"
                style={getCardStyle('right', card)}
              >
                {matchedPairs.has(card.pairIndex) ? <span>✓ </span> : null}
                {card.text}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom controls */}
        <div className="flex items-center justify-between text-[12px]" style={{ color: 'var(--t2)' }}>
          <span>Lần thử: {attempts} · Độ chính xác: {accuracy}%</span>
          <button
            onClick={() => initGame(set)}
            className="bf-btn bf-btn--text"
          >
            <ArrowCounterClockwise size={14} /> Làm mới
          </button>
        </div>
      </div>
    </main>
  )
}
