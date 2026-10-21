'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { exams, type QuizSet } from '@/lib/api'
import {
  ArrowLeft, ArrowRight, ArrowCounterClockwise, Cards, CheckCircle, SmileyXEyes
} from '@phosphor-icons/react'

// ── SM-2 session key (stored in localStorage) ──────────────────────────────────
const SESSION_KEY_LS = 'gf-flashcard-session-key'

function getOrCreateSessionKey(): string {
  try {
    let key = localStorage.getItem(SESSION_KEY_LS)
    if (!key) {
      key = `fk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      localStorage.setItem(SESSION_KEY_LS, key)
    }
    return key
  } catch {
    return `fk_${Date.now()}`
  }
}

type Card = {
  front: string
  back: string
  hint?: string
  imageUrl?: string
  index: number
  progress: any
  isDueToday: boolean
}

type SetData = {
  setId: string
  title: string
  description?: string
  subject?: { name: string; color?: string }
  gradeLevel?: number
  totalCards: number
  dueCount: number
  cards: Card[]
  matchingItems?: MatchingItem[]
}

type MatchingItem = {
  prompt: string
  correct: string[]
  distractors?: string[]
  imageUrl?: string
}

const RATING_LABELS = [
  { value: 0, label: 'Chưa nhớ', color: '#EF4444', emoji: '✗' },
  { value: 1, label: 'Hơi khó', color: '#D97706', emoji: '!' },
  { value: 2, label: 'Nhớ ổn', color: '#2563EB', emoji: '✓' },
  { value: 3, label: 'Rất chắc', color: '#16A34A', emoji: '★' },
]

function getFlashcardCode(paramCode?: string): string {
  if (typeof window === 'undefined') return paramCode || ''
  const parts = window.location.pathname.split('/').filter(Boolean)
  const index = parts.findIndex(part => part === 'flashcard')
  return parts[index + 1] || paramCode || ''
}

function getFlashcardMode(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('mode') || ''
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export default function CombinedFlashcardPage() {
  const { code: paramCode } = useParams<{ code: string }>()
  const code = getFlashcardCode(paramCode)
  const router = useRouter()
  const isMongoId = code?.length === 24 && /^[0-9a-fA-F]{24}$/.test(code)

  if (isMongoId) {
    return <QuizLiveFlashcardView code={code} router={router} />
  }

  return <SrsFlashcardView code={code} />
}

// ═══════════════════════════════════════════════════════════════════════════════
//  VIEW 1: QUIZ LIVE FLASHCARDS (KNOWN/UNKNOWN SYSTEM)
// ═══════════════════════════════════════════════════════════════════════════════

type QuizLiveCard = {
  prompt: string
  choices: Array<{ text: string }>
  correctIndex: number
  explanation?: string
}

function QuizLiveFlashcardView({ code, router }: { code: string; router: any }) {
  const [set, setSet] = useState<QuizSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<number>>(new Set())
  const [unknown, setUnknown] = useState<Set<number>>(new Set())
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (!code) return
    setLoading(true)
    exams.getPublicQuizSet(code)
      .then(data => setSet(data))
      .catch(e => setError(e.message || 'Không tải được bộ flashcard'))
      .finally(() => setLoading(false))
  }, [code])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg0)' }}>
        <div className="text-[14px]" style={{ color: 'var(--t2)' }}>Đang tải flashcard...</div>
      </main>
    )
  }

  if (error || !set) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg0)' }}>
        <div className="text-center space-y-3">
          <SmileyXEyes size={48} style={{ color: 'var(--t2)', margin: '0 auto' }} />
          <div className="text-[14px]" style={{ color: 'var(--red)' }}>{error || 'Bộ flashcard không tồn tại'}</div>
          <button onClick={() => router.back()} className="bf-btn bf-btn--text">← Quay lại</button>
        </div>
      </main>
    )
  }

  const cards = (set.questions || []) as QuizLiveCard[]
  const total = cards.length
  const card = cards[index]
  const correctAnswer = card?.choices?.[card.correctIndex]?.text || ''
  const progress = Math.round(((known.size + unknown.size) / total) * 100)
  const remaining = total - known.size - unknown.size

  const goNext = () => {
    setFlipped(false)
    setTimeout(() => {
      if (index < total - 1) setIndex(i => i + 1)
      else setFinished(true)
    }, 120)
  }

  const goPrev = () => {
    setFlipped(false)
    setTimeout(() => setIndex(i => Math.max(0, i - 1)), 120)
  }

  const markKnown = () => {
    setKnown(prev => new Set([...prev, index]))
    setUnknown(prev => { const s = new Set(prev); s.delete(index); return s })
    goNext()
  }

  const markUnknown = () => {
    setUnknown(prev => new Set([...prev, index]))
    setKnown(prev => { const s = new Set(prev); s.delete(index); return s })
    goNext()
  }

  const restart = () => {
    setIndex(0)
    setFlipped(false)
    setKnown(new Set())
    setUnknown(new Set())
    setFinished(false)
  }

  if (finished || (known.size + unknown.size >= total && total > 0)) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: 'var(--bg0)' }}>
        <div className="w-full max-w-[480px] rounded-2xl border p-8 text-center space-y-4" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
          <CheckCircle size={56} weight="fill" style={{ color: 'var(--green)', margin: '0 auto' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--t0)' }}>Xong rồi! 🎉</h2>
          <p className="text-[13px]" style={{ color: 'var(--t2)' }}>{set.title}</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl py-4" style={{ background: 'rgba(16,185,129,.1)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--green)' }}>{known.size}</div>
              <div className="text-[12px]" style={{ color: 'var(--t2)' }}>Đã nhớ ✓</div>
            </div>
            <div className="rounded-xl py-4" style={{ background: 'rgba(244,63,94,.1)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--red)' }}>{unknown.size}</div>
              <div className="text-[12px]" style={{ color: 'var(--t2)' }}>Cần ôn lại ✗</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            {unknown.size > 0 && (
              <button
                onClick={() => {
                  const unknownCards = [...unknown]
                  setIndex(unknownCards[0])
                  setKnown(new Set())
                  setUnknown(new Set())
                  setFinished(false)
                  setFlipped(false)
                }}
                className="bf-btn bf-btn--primary bf-btn--large bf-btn--block"
              >
                Ôn lại {unknown.size} thẻ chưa nhớ
              </button>
            )}
            <button
              onClick={restart}
              className="bf-btn bf-btn--large bf-btn--block"
            >
              <ArrowCounterClockwise size={16} />Học lại từ đầu
            </button>
            <button onClick={() => router.back()} className="bf-btn bf-btn--text mt-1">← Quay lại</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col px-4 py-6" style={{ background: 'var(--bg0)' }}>
      <div className="mx-auto w-full max-w-[620px] flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="bf-btn bf-btn--text">
            <ArrowLeft size={16} /> Quay lại
          </button>
          <div className="flex items-center gap-2">
            <Cards size={18} style={{ color: 'var(--blue)' }} />
            <span className="text-[13px] font-semibold" style={{ color: 'var(--t0)' }}>{set.title}</span>
          </div>
          <div className="text-[13px]" style={{ color: 'var(--t2)' }}>
            {index + 1} / {total}
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--bd)' }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: 'var(--blue)' }}
          />
        </div>
        <div className="flex justify-between text-[11px]" style={{ color: 'var(--t2)', marginTop: '-8px' }}>
          <span style={{ color: 'var(--green)' }}>✓ {known.size} nhớ</span>
          <span>{remaining} còn lại</span>
          <span style={{ color: 'var(--red)' }}>✗ {unknown.size} chưa nhớ</span>
        </div>

        {/* Flip card */}
        <div
          className="relative cursor-pointer select-none"
          style={{ perspective: '1200px', minHeight: '280px' }}
          onClick={() => setFlipped(f => !f)}
        >
          <div
            className="relative w-full"
            style={{
              minHeight: '280px',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.45s cubic-bezier(.4,0,.2,1)',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front - Question */}
            <div
              className="absolute inset-0 rounded-2xl border flex flex-col items-center justify-center p-6 text-center"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                borderColor: 'var(--bd)',
                background: 'var(--bg1)',
              }}
            >
              <div className="text-[11px] uppercase tracking-wider mb-4 font-semibold" style={{ color: 'var(--t2)' }}>
                Câu hỏi · Click để lật
              </div>
              <div className="text-[18px] font-semibold leading-relaxed" style={{ color: 'var(--t0)' }}>
                {card?.prompt}
              </div>
              <div className="mt-6 text-[12px]" style={{ color: 'var(--t2)' }}>
                {card?.choices?.length} lựa chọn
              </div>
            </div>

            {/* Back - Answer */}
            <div
              className="absolute inset-0 rounded-2xl border flex flex-col items-center justify-center p-6 text-center"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                borderColor: 'rgba(16,185,129,.4)',
                background: 'rgba(16,185,129,.06)',
              }}
            >
              <div className="text-[11px] uppercase tracking-wider mb-4 font-semibold" style={{ color: 'var(--green)' }}>
                Đáp án đúng
              </div>
              <div className="text-[20px] font-bold leading-relaxed" style={{ color: 'var(--green)' }}>
                {correctAnswer}
              </div>
              {card?.explanation && (
                <div className="mt-4 text-[13px] leading-relaxed max-w-[400px]" style={{ color: 'var(--t2)' }}>
                  {card.explanation}
                </div>
              )}
              {/* All choices */}
              <div className="mt-5 w-full max-w-[400px] grid grid-cols-2 gap-2">
                {card?.choices?.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-[10px] px-3 py-2 text-[12px] text-left"
                    style={{
                      background: i === card.correctIndex ? 'rgba(16,185,129,.15)' : 'var(--bg2)',
                      color: i === card.correctIndex ? 'var(--green)' : 'var(--t2)',
                      fontWeight: i === card.correctIndex ? 700 : 400,
                    }}
                  >
                    {i === card.correctIndex ? '✓ ' : ''}{c.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bf-btn-group justify-between gap-3">
          <button
            onClick={goPrev}
            disabled={index === 0}
            className="bf-btn"
          >
            <ArrowLeft size={16} /> Trước
          </button>

          <div className="bf-btn-group">
            <button
              onClick={markUnknown}
              className="bf-btn bf-btn--danger"
              title="Chưa nhớ"
            >
              ✗ Chưa nhớ
            </button>
            <button
              onClick={markKnown}
              className="bf-btn bf-btn--primary"
              title="Đã nhớ"
            >
              ✓ Đã nhớ
            </button>
          </div>

          <button
            onClick={goNext}
            disabled={index >= total - 1 && known.size + unknown.size < total}
            className="bf-btn"
          >
            Tiếp <ArrowRight size={16} />
          </button>
        </div>

        <p className="text-center text-[11px]" style={{ color: 'var(--t2)' }}>
          Click vào thẻ để xem đáp án · Đánh dấu ✓ hoặc ✗ để theo dõi tiến độ
        </p>
      </div>
    </main>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  VIEW 2: SRS FLASHCARDS (SM-2 ALGORITHM FOR STUDENTS)
// ═══════════════════════════════════════════════════════════════════════════════

function SrsFlashcardView({ code }: { code: string }) {
  const [setData, setSetData] = useState<SetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sessionKey, setSessionKey] = useState('')
  const [flipped, setFlipped] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [studyCards, setStudyCards] = useState<Card[]>([])
  const [done, setDone] = useState(false)
  const [statsToday, setStatsToday] = useState({ reviewed: 0, correct: 0 })
  const [showHint, setShowHint] = useState(false)
  const [ratingLoading, setRatingLoading] = useState(false)
  const mode = getFlashcardMode()

  useEffect(() => {
    const key = getOrCreateSessionKey()
    setSessionKey(key)
    loadSet(key)
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSet = async (key: string) => {
    setLoading(true)
    setError('')
    try {
      const data = await exams.getPublicFlashcardSet(code, key)
      setSetData(data as SetData)
      // Chỉ lấy thẻ cần ôn hôm nay, nếu không có thì lấy tất cả
      const due = data.cards.filter(c => c.isDueToday)
      setStudyCards(due.length > 0 ? due : data.cards)
      setCurrentIndex(0)
      setFlipped(false)
      setDone(false)
    } catch (err: any) {
      setError(err.message || 'Không thể tải bộ flashcard')
    } finally {
      setLoading(false)
    }
  }

  const currentCard = studyCards[currentIndex]

  const handleRate = async (rating: 0 | 1 | 2 | 3) => {
    if (!currentCard || ratingLoading) return
    setRatingLoading(true)
    try {
      await exams.updateFlashcardProgress(code, {
        sessionKey,
        cardIndex: currentCard.index,
        rating,
      })
      setStatsToday(prev => ({
        reviewed: prev.reviewed + 1,
        correct: prev.correct + (rating >= 2 ? 1 : 0),
      }))
      const next = currentIndex + 1
      if (next >= studyCards.length) {
        setDone(true)
      } else {
        setCurrentIndex(next)
        setFlipped(false)
        setShowHint(false)
      }
    } catch (err: any) {
      console.error('Rate error:', err.message)
    } finally {
      setRatingLoading(false)
    }
  }

  const restart = () => {
    setCurrentIndex(0)
    setFlipped(false)
    setDone(false)
    setStatsToday({ reviewed: 0, correct: 0 })
    setShowHint(false)
    // Shuffle lại
    setStudyCards(prev => [...prev].sort(() => Math.random() - 0.5))
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #F7F7F2 0%, #D1FAE5 48%, #FEF3C7 100%)' }}>
        <div style={{ textAlign: 'center', color: '#171717' }}>
          <div style={{ width: 54, height: 54, border: '2px solid #171717', borderRadius: 8, display: 'grid', placeItems: 'center', margin: '0 auto 12px', background: '#fff' }}>
            <Cards size={28} weight="duotone" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Đang tải flashcard...</div>
        </div>
      </div>
    )
  }

  if (error || !setData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #F7F7F2 0%, #FCE7F3 100%)' }}>
        <div style={{ textAlign: 'center', color: '#EF4444', padding: 32, background: '#fff', border: '2px solid #171717', borderRadius: 8 }}>
          <SmileyXEyes size={44} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 16, marginBottom: 8 }}>Không tìm thấy bộ flashcard</div>
          <div style={{ fontSize: 13, color: '#525252' }}>{error}</div>
        </div>
      </div>
    )
  }

  if (mode === 'match') {
    return <MatchingFlashcardView setData={setData} />
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F7F7F2 0%, #D1FAE5 42%, #FDE68A 100%)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '2px solid rgba(23,23,23,0.12)',
        background: 'rgba(255,255,255,0.76)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#525252', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2, fontWeight: 800 }}>
            Classora Flashcard
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: '#000', margin: 0 }}>
            {setData.title}
          </h1>
          {setData.subject && (
            <div style={{ fontSize: 12, color: '#404040', marginTop: 4, fontWeight: 600 }}>
              {setData.subject.name}{setData.gradeLevel ? ` · Lớp ${setData.gradeLevel}` : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#171717', flexWrap: 'wrap' }}>
          <div style={{ border: '1.5px solid #171717', borderRadius: 4, padding: '7px 9px', background: '#fff', fontWeight: 800 }}>{setData.totalCards} thẻ</div>
          <div style={{ border: '1.5px solid #171717', borderRadius: 4, padding: '7px 9px', background: '#FEF3C7', fontWeight: 800 }}>{setData.dueCount} cần ôn</div>
          {statsToday.reviewed > 0 && (
            <div style={{ border: '1.5px solid #171717', borderRadius: 4, padding: '7px 9px', background: '#D1FAE5', fontWeight: 800 }}>{statsToday.reviewed} đã xem</div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!done && studyCards.length > 0 && (
        <div style={{ height: 5, background: 'rgba(23,23,23,0.12)' }}>
          <div style={{
            height: '100%',
            background: '#9AEF2B',
            width: `${((currentIndex) / studyCards.length) * 100}%`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>
        {done ? (
          // Done screen
          <div style={{ textAlign: 'center', maxWidth: 430, width: '100%', background: '#fff', border: '2px solid #171717', borderRadius: 8, padding: 28, boxShadow: '6px 6px 0 #171717' }}>
            <CheckCircle size={58} weight="fill" style={{ color: '#16A34A', margin: '0 auto 16px' }} />
            <h2 style={{ color: '#000', fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Hoàn thành phiên ôn!</h2>
            <p style={{ color: '#404040', fontSize: 14, marginBottom: 24 }}>
              Bạn đã ôn {statsToday.reviewed} thẻ — {statsToday.correct} trả lời tốt
              ({statsToday.reviewed > 0 ? Math.round((statsToday.correct / statsToday.reviewed) * 100) : 0}%)
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={restart}
                style={{
                  padding: '12px 24px', borderRadius: 4, border: '2px solid #171717', cursor: 'pointer',
                  background: '#9AEF2B',
                  color: '#000', fontSize: 14, fontWeight: 900,
                }}>
                Ôn lại
              </button>
            </div>
          </div>
        ) : currentCard ? (
          // Card display
          <div style={{ width: '100%', maxWidth: 560 }}>
            {/* Counter */}
            <div style={{ textAlign: 'center', fontSize: 12, color: '#171717', marginBottom: 12, fontWeight: 800 }}>
              Thẻ {currentIndex + 1} / {studyCards.length}
            </div>

            {/* Card with flip animation */}
            <div
              style={{
                perspective: '1000px',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => { if (!flipped) setFlipped(true) }}
            >
              <div style={{
                position: 'relative',
                transformStyle: 'preserve-3d',
                transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                borderRadius: 16,
                minHeight: 260,
              }}>
                {/* Front */}
                <div style={{
                  position: flipped ? 'absolute' : 'relative',
                  top: 0, left: 0, right: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  border: '2px solid #171717',
                  borderRadius: 8,
                  padding: '28px 24px',
                  minHeight: 260,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '6px 6px 0 #171717',
                  background: '#fff',
                }}>
                  <div style={{ fontSize: 11, color: '#2563EB', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, fontWeight: 900 }}>
                    Câu hỏi
                  </div>
                  {currentCard.imageUrl && (
                    <img
                      src={currentCard.imageUrl}
                      alt=""
                      style={{
                        maxWidth: '100%',
                        maxHeight: 190,
                        objectFit: 'contain',
                        border: '2px solid #171717',
                        borderRadius: 6,
                        marginBottom: 16,
                        background: '#F7F7F2',
                      }}
                    />
                  )}
                  <div
                    style={{ fontSize: 17, color: '#000', lineHeight: 1.7, textAlign: 'center', maxWidth: '100%', fontWeight: 700 }}
                    dangerouslySetInnerHTML={{ __html: currentCard.front }}
                  />
                  {currentCard.hint && showHint && (
                    <div style={{
                      marginTop: 16, padding: '8px 14px',
                      background: '#FEF3C7', borderRadius: 4, border: '1px solid #171717',
                      fontSize: 13, color: '#171717', fontWeight: 700,
                    }}>
                      {currentCard.hint}
                    </div>
                  )}
                  {!flipped && (
                    <div style={{ marginTop: 20, fontSize: 12, color: '#525252', fontWeight: 700 }}>
                      Bấm để xem đáp án
                    </div>
                  )}
                </div>

                {/* Back */}
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: '#D1FAE5',
                  border: '2px solid #171717',
                  borderRadius: 8,
                  padding: '28px 24px',
                  minHeight: 260,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '6px 6px 0 #171717',
                }}>
                  <div style={{ fontSize: 11, color: '#15803D', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, fontWeight: 900 }}>
                    Đáp án
                  </div>
                  <div
                    style={{ fontSize: 17, color: '#000', lineHeight: 1.7, textAlign: 'center', fontWeight: 700 }}
                    dangerouslySetInnerHTML={{ __html: currentCard.back }}
                  />
                </div>
              </div>
            </div>

            {/* Hint button (before flip) */}
            {!flipped && currentCard.hint && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowHint(s => !s) }}
                  style={{ background: '#FEF3C7', border: '2px solid #171717', color: '#171717', padding: '7px 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 800 }}>
                  {showHint ? 'Ẩn gợi ý' : 'Gợi ý'}
                </button>
              </div>
            )}

            {/* Rating buttons (after flip) */}
            {flipped && (
              <div style={{ marginTop: 20 }}>
                <div style={{ textAlign: 'center', fontSize: 13, color: '#171717', marginBottom: 12, fontWeight: 800 }}>
                  Bạn nhớ bài này như thế nào?
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                  {RATING_LABELS.map(r => (
                    <button
                      key={r.value}
                      disabled={ratingLoading}
                      onClick={() => handleRate(r.value as 0 | 1 | 2 | 3)}
                      style={{
                        padding: '10px 4px',
                        borderRadius: 4,
                        border: '2px solid #171717',
                        background: `${r.color}1A`,
                        color: r.color,
                        cursor: ratingLoading ? 'not-allowed' : 'pointer',
                        fontSize: 12,
                        fontWeight: 900,
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                      <span style={{ fontSize: 18, color: '#171717' }}>{r.emoji}</span>
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ maxWidth: 420, background: '#fff', border: '2px solid #171717', borderRadius: 8, padding: 24, textAlign: 'center', boxShadow: '6px 6px 0 #171717' }}>
            <Cards size={42} weight="duotone" style={{ margin: '0 auto 12px', color: '#171717' }} />
            <div style={{ color: '#000', fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
              Bộ flashcard chưa có thẻ
            </div>
            <div style={{ color: '#525252', fontSize: 13, lineHeight: 1.5 }}>
              Giáo viên cần vào tab Flashcard SRS, bấm Quản lý thẻ và thêm nội dung trước khi chia sẻ link này.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MatchingFlashcardView({ setData }: { setData: SetData }) {
  const items = setData.matchingItems || []
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [checked, setChecked] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const current = items[index]
  const options = useMemo(() => current ? shuffle([...(current.correct || []), ...(current.distractors || [])]) : [], [current])
  const correctSet = new Set(current?.correct || [])

  const toggle = (option: string) => {
    if (checked) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(option)) next.delete(option)
      else next.add(option)
      return next
    })
  }

  const isCorrectSelection = () => {
    if (!current) return false
    if (selected.size !== correctSet.size) return false
    return Array.from(selected).every(item => correctSet.has(item))
  }

  const check = () => {
    if (!current) return
    const ok = isCorrectSelection()
    if (ok) setCorrectCount(v => v + 1)
    setChecked(true)
  }

  const next = () => {
    const nextIndex = index + 1
    if (nextIndex >= items.length) {
      setFinished(true)
      return
    }
    setIndex(nextIndex)
    setSelected(new Set())
    setChecked(false)
  }

  const restart = () => {
    setIndex(0)
    setSelected(new Set())
    setChecked(false)
    setCorrectCount(0)
    setFinished(false)
  }

  if (items.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #F7F7F2 0%, #D1FAE5 42%, #FDE68A 100%)', padding: 20 }}>
        <div style={{ maxWidth: 440, background: '#fff', border: '2px solid #171717', borderRadius: 8, padding: 24, textAlign: 'center', boxShadow: '6px 6px 0 #171717' }}>
          <Cards size={42} weight="duotone" style={{ margin: '0 auto 12px', color: '#171717' }} />
          <div style={{ color: '#000', fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Chưa có trò chơi ghép thẻ</div>
          <div style={{ color: '#525252', fontSize: 13, lineHeight: 1.5 }}>Giáo viên cần vào Quản lý thẻ và thêm mục Ghép thẻ trước khi chia sẻ chế độ này.</div>
        </div>
      </div>
    )
  }

  if (finished) {
    const percent = Math.round((correctCount / items.length) * 100)
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #F7F7F2 0%, #D1FAE5 42%, #FDE68A 100%)', padding: 20 }}>
        <div style={{ maxWidth: 460, width: '100%', background: '#fff', border: '2px solid #171717', borderRadius: 8, padding: 28, textAlign: 'center', boxShadow: '6px 6px 0 #171717' }}>
          <CheckCircle size={58} weight="fill" style={{ color: '#16A34A', margin: '0 auto 16px' }} />
          <h2 style={{ color: '#000', fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Hoàn thành ghép thẻ</h2>
          <p style={{ color: '#404040', fontSize: 14, marginBottom: 20 }}>{correctCount}/{items.length} lượt đúng · {percent}%</p>
          <button onClick={restart} style={{ padding: '12px 24px', borderRadius: 4, border: '2px solid #171717', cursor: 'pointer', background: '#9AEF2B', color: '#000', fontSize: 14, fontWeight: 900 }}>
            Chơi lại
          </button>
        </div>
      </div>
    )
  }

  const ok = checked && isCorrectSelection()

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #F7F7F2 0%, #D1FAE5 42%, #FDE68A 100%)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', borderBottom: '2px solid rgba(23,23,23,0.12)', background: 'rgba(255,255,255,0.76)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: '#525252', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2, fontWeight: 800 }}>Classora Matching Flashcard</div>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: '#000', margin: 0 }}>{setData.title}</h1>
        </div>
        <div style={{ border: '1.5px solid #171717', borderRadius: 4, padding: '7px 9px', background: '#fff', fontWeight: 800, fontSize: 12 }}>
          {index + 1}/{items.length}
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '20px 16px' }}>
        <div style={{ width: '100%', maxWidth: 780, display: 'grid', gap: 16 }}>
          <div style={{ background: '#fff', border: '2px solid #171717', borderRadius: 8, padding: 22, boxShadow: '6px 6px 0 #171717' }}>
            <div style={{ fontSize: 12, color: '#2563EB', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, fontWeight: 900 }}>Chọn tất cả cụm đúng liên quan tới</div>
            {current.imageUrl && (
              <img src={current.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 190, objectFit: 'contain', border: '2px solid #171717', borderRadius: 6, marginBottom: 14, background: '#F7F7F2' }} />
            )}
            <div style={{ fontSize: 22, color: '#000', fontWeight: 900, lineHeight: 1.35 }}>{current.prompt}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {options.map(option => {
              const picked = selected.has(option)
              const shouldBePicked = correctSet.has(option)
              const bg = checked
                ? shouldBePicked ? '#D1FAE5' : picked ? '#FCE7F3' : '#fff'
                : picked ? '#FEF3C7' : '#fff'
              return (
                <button
                  key={option}
                  onClick={() => toggle(option)}
                  style={{
                    minHeight: 58,
                    border: '2px solid #171717',
                    borderRadius: 6,
                    background: bg,
                    color: '#000',
                    fontWeight: 850,
                    padding: '12px 14px',
                    textAlign: 'left',
                    cursor: checked ? 'default' : 'pointer',
                    boxShadow: picked ? '3px 3px 0 #171717' : 'none',
                  }}
                >
                  {checked && shouldBePicked ? '✓ ' : checked && picked && !shouldBePicked ? '✗ ' : picked ? '• ' : ''}
                  {option}
                </button>
              )
            })}
          </div>

          {checked && (
            <div style={{ background: ok ? '#D1FAE5' : '#FCE7F3', border: '2px solid #171717', borderRadius: 6, padding: 12, color: '#000', fontWeight: 800 }}>
              {ok ? 'Đúng rồi. Các cụm đã chọn đều liên quan.' : 'Chưa đúng. Các cụm đúng đã được tô xanh, cụm chọn sai được tô hồng.'}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: '#171717', fontWeight: 800 }}>Đã chọn: {selected.size}</div>
            {!checked ? (
              <button onClick={check} disabled={selected.size === 0} style={{ padding: '12px 22px', borderRadius: 4, border: '2px solid #171717', background: selected.size === 0 ? '#E5E7EB' : '#9AEF2B', color: '#000', fontWeight: 900, cursor: selected.size === 0 ? 'not-allowed' : 'pointer' }}>
                Kiểm tra
              </button>
            ) : (
              <button onClick={next} style={{ padding: '12px 22px', borderRadius: 4, border: '2px solid #171717', background: '#9AEF2B', color: '#000', fontWeight: 900, cursor: 'pointer' }}>
                {index + 1 >= items.length ? 'Hoàn thành' : 'Câu tiếp'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
