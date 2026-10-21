'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Check, Headphones, Microphone, Pause, Play, Stop, Timer } from '@phosphor-icons/react'
import { skillExams, type SkillExamTemplate, type SkillQuestion, type SkillSection } from '@/lib/skill-exams'

type Screen = 'loading' | 'start' | 'exam' | 'submitting' | 'done' | 'error'
type LocalRecording = { blob: Blob; url: string; durationSeconds: number }

function formatTime(total: number) {
  const minutes = Math.max(0, Math.floor(total / 60))
  const seconds = Math.max(0, total % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function tts(text: string, action: 'play' | 'stop') {
  if (!('speechSynthesis' in window)) return false
  if (action === 'stop') {
    window.speechSynthesis.cancel()
    return true
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.86
  window.speechSynthesis.speak(utterance)
  return true
}

function RecordingControl({ value, onChange }: {
  questionId: string
  value?: LocalRecording
  onChange: (value?: LocalRecording) => void
}) {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')

  const stop = useCallback(() => {
    recorderRef.current?.stop()
  }, [])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    if (value?.url) URL.revokeObjectURL(value.url)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Trình duyệt chưa hỗ trợ thu âm. Hãy dùng Chrome, Edge hoặc Safari mới.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      recorder.ondataavailable = event => { if (event.data.size > 0) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        if (value?.url) URL.revokeObjectURL(value.url)
        onChange({ blob, durationSeconds, url: URL.createObjectURL(blob) })
        stream.getTracks().forEach(track => track.stop())
        setRecording(false)
      }
      recorder.start()
      setRecording(true)
    } catch {
      setError('Không thể dùng micro. Hãy cho phép quyền Microphone trong trình duyệt rồi thử lại.')
    }
  }

  return (
    <div className="mt-3 rounded-[6px] border p-3" style={{ background: '#effcf5', borderColor: 'var(--bd)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><div className="text-[12px] font-bold">Trả lời bằng giọng nói</div><div className="mt-0.5 text-[11px]" style={{ color: 'var(--t2)' }}>Bấm thu âm, nói câu trả lời, rồi dừng để nghe lại.</div></div>
        {!recording ? <button className="bf-btn bf-btn--primary" onClick={start}><Microphone size={15} /> Thu âm</button> : <button className="bf-btn bf-btn--danger" onClick={stop}><Stop size={15} /> Dừng</button>}
      </div>
      {value && <div className="mt-3 flex items-center gap-2"><audio controls src={value.url} className="h-8 max-w-full" /><button className="text-[12px] font-bold" style={{ color: 'var(--red)' }} onClick={() => onChange(undefined)}>Bỏ bản ghi</button></div>}
      {error && <p className="mt-2 text-[11px] font-medium" style={{ color: 'var(--red)' }}>{error}</p>}
    </div>
  )
}

function QuestionAnswer({ section, question, answer, onChange, recording, onRecordingChange }: {
  section: SkillSection
  question: SkillQuestion
  answer: string | number | undefined
  onChange: (value: string | number) => void
  recording?: LocalRecording
  onRecordingChange: (value?: LocalRecording) => void
}) {
  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--bds)' }}>
      <div className="text-[14px] font-bold">{question.prompt}</div>
      {section.skill === 'QUIZ' ? <div className="mt-3 grid gap-2">{(question.options || []).map((option, index) => <label key={index} className="flex cursor-pointer items-center gap-3 rounded-[6px] border px-3 py-2 text-[13px]" style={{ borderColor: answer === index ? 'var(--bd)' : 'var(--bds)', background: answer === index ? 'var(--color-card-lavender)' : 'var(--bg1)' }}><input type="radio" name={question.id} checked={answer === index} onChange={() => onChange(index)} /><span>{option}</span></label>)}</div> : <textarea rows={section.skill === 'WRITING' ? 7 : 3} className="mt-3 w-full rounded-[6px] border px-3 py-2 text-[14px] outline-none" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }} value={typeof answer === 'string' ? answer : ''} onChange={event => onChange(event.target.value)} placeholder={section.skill === 'WRITING' ? 'Viết bài làm của bạn tại đây...' : 'Nhập câu trả lời...'} />}
      {question.requiresRecording && <RecordingControl questionId={question.id} value={recording} onChange={onRecordingChange} />}
    </div>
  )
}

export default function PublicSkillsExamPage() {
  const { code } = useParams<{ code: string }>()
  const [screen, setScreen] = useState<Screen>('loading')
  const [template, setTemplate] = useState<SkillExamTemplate | null>(null)
  const [error, setError] = useState('')
  const [student, setStudent] = useState({ fullName: '', className: '', email: '' })
  const [answers, setAnswers] = useState<Record<string, string | number>>({})
  const [recordings, setRecordings] = useState<Record<string, LocalRecording>>({})
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (!code) return
    skillExams.getPublic(code).then(item => {
      setTemplate(item)
      setTimeLeft(item.durationMinutes * 60)
      setScreen('start')
    }).catch(err => { setError(err.message || 'Không thể mở đề thi.'); setScreen('error') })
  }, [code])

  useEffect(() => {
    if (screen !== 'exam') return
    const timer = window.setInterval(() => setTimeLeft(value => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [screen])

  const submit = async () => {
    if (!template || screen === 'submitting') return
    setScreen('submitting')
    try {
      const uploads = await Promise.all(Object.entries(recordings).map(async ([questionId, recording]) => {
        const url = await skillExams.uploadRecording(template.ownerId, template.id, questionId, recording.blob)
        return [questionId, { url, durationSeconds: recording.durationSeconds }] as const
      }))
      await skillExams.submit({
        templateId: template.id,
        accessCode: template.accessCode,
        ownerId: template.ownerId,
        student,
        answers,
        recordings: Object.fromEntries(uploads),
      })
      setScreen('done')
    } catch (err: any) {
      setError(err.message || 'Không thể nộp bài. Vui lòng kiểm tra kết nối và thử lại.')
      setScreen('exam')
    }
  }

  if (screen === 'loading') return <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5]"><p className="text-[14px]">Đang mở đề thi...</p></main>
  if (screen === 'error' && !template) return <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5] p-4"><div className="bf-card max-w-md text-center"><h1 className="text-[18px] font-bold" style={{ color: 'var(--red)' }}>Không thể mở đề thi</h1><p className="mt-2 text-[13px]" style={{ color: 'var(--t2)' }}>{error}</p></div></main>
  if (!template) return null

  if (screen === 'start') return <main className="min-h-screen bg-[#f5f5f5] p-4 sm:p-8"><div className="mx-auto max-w-xl"><div className="bf-card" style={{ background: 'var(--color-card-mint)' }}><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-[4px] border bg-white" style={{ borderColor: 'var(--bd)' }}><Headphones size={23} /></span><div><div className="text-[12px] font-bold" style={{ color: 'var(--t2)' }}>{template.subject} · Lớp {template.gradeLevel}</div><h1 className="text-[21px] font-extrabold">{template.title}</h1></div></div><div className="mt-4 flex items-center gap-2 text-[13px] font-bold"><Timer size={17} /> {template.durationMinutes} phút · {template.sections.length} kỹ năng</div><p className="mt-4 text-[13px] leading-relaxed" style={{ color: 'var(--t2)' }}>{template.instructions}</p></div><div className="bf-card mt-4"><h2 className="text-[15px] font-bold">Thông tin học sinh</h2><div className="mt-4 grid gap-3"><input className="w-full rounded-[6px] border px-3 py-2 text-[14px]" style={{ borderColor: 'var(--bd)' }} value={student.fullName} onChange={event => setStudent(current => ({ ...current, fullName: event.target.value }))} placeholder="Họ và tên *" /><input className="w-full rounded-[6px] border px-3 py-2 text-[14px]" style={{ borderColor: 'var(--bd)' }} value={student.className} onChange={event => setStudent(current => ({ ...current, className: event.target.value }))} placeholder="Lớp *" /><input type="email" className="w-full rounded-[6px] border px-3 py-2 text-[14px]" style={{ borderColor: 'var(--bd)' }} value={student.email} onChange={event => setStudent(current => ({ ...current, email: event.target.value }))} placeholder="Email (không bắt buộc)" /></div><button className="bf-btn bf-btn--primary mt-4 w-full" disabled={!student.fullName.trim() || !student.className.trim()} onClick={() => setScreen('exam')}><Play size={16} weight="fill" /> Bắt đầu làm bài</button></div></div></main>

  if (screen === 'done') return <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5] p-4"><div className="bf-card max-w-md text-center" style={{ background: 'var(--color-card-mint)' }}><Check size={42} weight="bold" className="mx-auto" style={{ color: 'var(--green)' }} /><h1 className="mt-3 text-[20px] font-extrabold">Đã nộp bài</h1><p className="mt-2 text-[13px]" style={{ color: 'var(--t2)' }}>Bài làm và bản ghi âm của bạn đã được gửi cho giáo viên.</p></div></main>

  return <main className="min-h-screen bg-[#f5f5f5] pb-28"><header className="sticky top-0 z-10 border-b bg-white px-4 py-3" style={{ borderColor: 'var(--bd)' }}><div className="mx-auto flex max-w-3xl items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-[14px] font-extrabold">{template.title}</div><div className="text-[11px]" style={{ color: 'var(--t2)' }}>{student.fullName} · {student.className}</div></div><div className="flex items-center gap-2 rounded-[4px] border px-2 py-1 font-mono text-[14px] font-bold" style={{ borderColor: 'var(--bd)', background: timeLeft < 300 ? '#fff0f0' : 'var(--color-card-saffron)' }}><Timer size={15} />{formatTime(timeLeft)}</div></div></header><div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">{template.sections.map((section, sectionIndex) => <section key={section.id} className="bf-card"><div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-bold uppercase" style={{ color: 'var(--t2)' }}>Phần {sectionIndex + 1} · {section.skill}</div><h2 className="mt-1 text-[18px] font-extrabold">{section.title}</h2><p className="mt-1 text-[13px]" style={{ color: 'var(--t2)' }}>{section.instructions}</p></div>{section.skill === 'LISTENING' && <div className="flex gap-1"><button className="bf-btn bf-btn--icon" title="Nghe bài" onClick={() => tts(section.content || '', 'play')}><Headphones size={18} /></button><button className="bf-btn bf-btn--icon" title="Dừng" onClick={() => tts('', 'stop')}><Pause size={18} /></button></div>}</div>{section.content && <div className="mt-4 whitespace-pre-wrap rounded-[6px] border p-4 text-[14px] leading-7" style={{ borderColor: 'var(--bds)', background: section.skill === 'LISTENING' ? 'var(--color-card-mint)' : 'var(--bg0)' }}>{section.skill === 'LISTENING' ? 'Bài nghe sẽ được đọc bằng giọng nói. Bấm biểu tượng tai nghe để nghe.' : section.content}</div>}{section.questions.map(question => <QuestionAnswer key={question.id} section={section} question={question} answer={answers[question.id]} onChange={value => setAnswers(current => ({ ...current, [question.id]: value }))} recording={recordings[question.id]} onRecordingChange={value => setRecordings(current => { const next = { ...current }; if (value) next[question.id] = value; else delete next[question.id]; return next })} />)}</section>)}{error && <p className="text-[13px] font-medium" style={{ color: 'var(--red)' }}>{error}</p>}<button className="bf-btn bf-btn--primary w-full" onClick={submit}><Check size={16} /> Nộp bài</button></div></main>
}
