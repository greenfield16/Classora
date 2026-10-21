'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check, ClipboardText, Copy, FileText, Headphones, Link,
  PaperPlaneTilt, PencilSimple, Plus, Printer, Trash,
} from '@phosphor-icons/react'
import { ActionButton, EmptyState, FormSelect, PanelSection, Pill } from './AdminUI'
import { skillExams, type SkillExamTemplate, type SkillQuestion, type SkillSection, type SkillType } from '@/lib/skill-exams'

const inputCls = 'w-full rounded-[8px] border px-3 py-2 text-[13px] outline-none'
const inputStyle = { borderColor: 'var(--bd)', backgroundColor: 'var(--bg1)', color: 'var(--t0)' }
const labelCls = 'mb-1 block text-[12px] font-medium'

const SKILLS: Array<{ type: SkillType; label: string; description: string; tone: string; icon: any }> = [
  { type: 'READING', label: 'Reading', description: 'Văn bản và câu hỏi đọc hiểu', tone: 'var(--color-card-lavender)', icon: FileText },
  { type: 'LISTENING', label: 'Listening', description: 'TTS và trả lời sau khi nghe', tone: 'var(--color-card-mint)', icon: Headphones },
  { type: 'WRITING', label: 'Writing', description: 'Đề bài viết và phần thu âm', tone: 'var(--color-card-saffron)', icon: PencilSimple },
  { type: 'QUIZ', label: 'Quiz', description: 'Câu hỏi trắc nghiệm nhanh', tone: 'var(--color-card-pink)', icon: ClipboardText },
]

function uid() {
  return crypto.randomUUID()
}

function makeQuestion(skill: SkillType): SkillQuestion {
  return {
    id: uid(),
    prompt: skill === 'WRITING' ? 'Hãy viết một đoạn văn theo yêu cầu.' : 'Nhập câu hỏi cho học sinh.',
    points: 1,
    ...(skill === 'QUIZ' ? { options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'], correctOption: 0 } : {}),
    ...(skill === 'LISTENING' || skill === 'WRITING' ? { requiresRecording: false } : {}),
  }
}

function makeSection(skill: SkillType): SkillSection {
  const detail = SKILLS.find(item => item.type === skill)!
  return {
    id: uid(),
    skill,
    title: detail.label,
    instructions: skill === 'LISTENING'
      ? 'Nghe bài đọc. Bạn có thể nghe lại theo hướng dẫn của giáo viên.'
      : skill === 'READING'
        ? 'Đọc văn bản và trả lời câu hỏi.'
        : skill === 'WRITING'
          ? 'Viết câu trả lời rõ ràng, đúng yêu cầu.'
          : 'Chọn đáp án phù hợp nhất.',
    content: skill === 'LISTENING'
      ? 'Nhập kịch bản để hệ thống đọc bằng giọng nói cho học sinh.'
      : skill === 'READING'
        ? 'Nhập văn bản đọc hiểu tại đây.'
        : '',
    questions: [makeQuestion(skill)],
  }
}

function emptyDraft() {
  return {
    title: '', subject: 'Tiếng Anh', gradeLevel: 10, durationMinutes: 45,
    instructions: 'Đọc kỹ hướng dẫn trước khi làm bài.', inviteEmails: '', sections: [] as SkillSection[],
  }
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) {
    alert('Thiết bị này chưa hỗ trợ đọc văn bản. Hãy dùng Chrome, Edge hoặc Safari mới.')
    return
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.86
  window.speechSynthesis.speak(utterance)
}

function SectionEditor({ section, onChange, onRemove }: {
  section: SkillSection
  onChange: (next: SkillSection) => void
  onRemove: () => void
}) {
  const definition = SKILLS.find(item => item.type === section.skill)!
  const Icon = definition.icon
  const updateQuestion = (id: string, patch: Partial<SkillQuestion>) => {
    onChange({ ...section, questions: section.questions.map(item => item.id === id ? { ...item, ...patch } : item) })
  }

  return (
    <section className="bf-card space-y-4" style={{ background: definition.tone }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-[4px] border" style={{ background: 'var(--bg1)', borderColor: 'var(--bd)' }}><Icon size={20} weight="duotone" /></span>
          <div className="min-w-0">
            <div className="text-[12px] font-bold" style={{ color: 'var(--t2)' }}>{definition.label}</div>
            <input aria-label={`Tên phần ${definition.label}`} className="w-full bg-transparent text-[15px] font-bold outline-none" value={section.title} onChange={event => onChange({ ...section, title: event.target.value })} />
          </div>
        </div>
        <ActionButton tone="danger" iconOnly title="Xóa phần" ariaLabel="Xóa phần" onClick={onRemove}><Trash size={15} /></ActionButton>
      </div>

      <div>
        <label className={labelCls}>Hướng dẫn cho học sinh</label>
        <textarea rows={2} className={inputCls} style={inputStyle} value={section.instructions} onChange={event => onChange({ ...section, instructions: event.target.value })} />
      </div>

      {(section.skill === 'READING' || section.skill === 'LISTENING') && (
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className={labelCls + ' !mb-0'}>{section.skill === 'READING' ? 'Văn bản đọc hiểu' : 'Kịch bản TTS'}</label>
            {section.skill === 'LISTENING' && <ActionButton onClick={() => speak(section.content || '')}><Headphones size={14} /> Nghe thử</ActionButton>}
          </div>
          <textarea rows={5} className={inputCls} style={inputStyle} value={section.content || ''} onChange={event => onChange({ ...section, content: event.target.value })} placeholder={section.skill === 'LISTENING' ? 'Nhập tiếng Anh hoặc ngôn ngữ cần đọc...' : 'Nhập bài đọc...'} />
        </div>
      )}

      {section.questions.map((question, index) => (
        <div key={question.id} className="rounded-[6px] border p-3" style={{ background: 'var(--bg1)', borderColor: 'var(--bd)' }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold">Câu {index + 1}</span>
            <button className="text-[12px] font-bold" style={{ color: 'var(--red)' }} onClick={() => onChange({ ...section, questions: section.questions.filter(item => item.id !== question.id) })}>Xóa</button>
          </div>
          <textarea rows={2} className={inputCls} style={inputStyle} value={question.prompt} onChange={event => updateQuestion(question.id, { prompt: event.target.value })} />

          {section.skill === 'QUIZ' && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(question.options || []).map((option, optionIndex) => (
                <label key={optionIndex} className="flex items-center gap-2 text-[12px] font-medium">
                  <input type="radio" name={`correct-${question.id}`} checked={question.correctOption === optionIndex} onChange={() => updateQuestion(question.id, { correctOption: optionIndex })} />
                  <input className={inputCls} style={inputStyle} value={option} onChange={event => updateQuestion(question.id, { options: (question.options || []).map((item, idx) => idx === optionIndex ? event.target.value : item) })} />
                </label>
              ))}
            </div>
          )}

          {(section.skill === 'LISTENING' || section.skill === 'WRITING') && (
            <label className="mt-3 flex items-center gap-2 text-[12px] font-medium">
              <input type="checkbox" checked={Boolean(question.requiresRecording)} onChange={event => updateQuestion(question.id, { requiresRecording: event.target.checked })} />
              Yêu cầu học sinh thu âm câu trả lời
            </label>
          )}
        </div>
      ))}
      <ActionButton onClick={() => onChange({ ...section, questions: [...section.questions, makeQuestion(section.skill)] })}><Plus size={14} /> Thêm câu hỏi</ActionButton>
    </section>
  )
}

export default function SkillsExamPanel() {
  const [items, setItems] = useState<SkillExamTemplate[]>([])
  const [draft, setDraft] = useState(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await skillExams.listMine()) }
    catch (error: any) { setNotice(error.message || 'Không thể tải danh sách đề.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const emailList = useMemo(() => draft.inviteEmails.split(/[\n,;]+/).map(item => item.trim()).filter(Boolean), [draft.inviteEmails])
  const updateSection = (id: string, next: SkillSection) => setDraft(current => ({ ...current, sections: current.sections.map(section => section.id === id ? next : section) }))

  const save = async () => {
    if (!draft.title.trim()) return setNotice('Nhập tên mẫu đề trước khi lưu.')
    if (draft.sections.length === 0) return setNotice('Thêm ít nhất một kỹ năng cho đề thi.')
    setSaving(true)
    setNotice('')
    const payload = {
      title: draft.title.trim(), subject: draft.subject.trim() || 'Ngoại ngữ', gradeLevel: draft.gradeLevel,
      durationMinutes: Math.max(5, Number(draft.durationMinutes) || 45), instructions: draft.instructions.trim(),
      inviteEmails: emailList, sections: draft.sections,
    }
    try {
      if (editingId) await skillExams.update(editingId, payload)
      else await skillExams.create(payload)
      setNotice(editingId ? 'Đã cập nhật mẫu đề.' : 'Đã tạo mẫu đề. Bạn có thể publish để chia sẻ cho học sinh.')
      setDraft(emptyDraft())
      setEditingId(null)
      await load()
    } catch (error: any) { setNotice(error.message || 'Không thể lưu mẫu đề.') }
    finally { setSaving(false) }
  }

  const edit = (item: SkillExamTemplate) => {
    setEditingId(item.id)
    setDraft({
      title: item.title, subject: item.subject, gradeLevel: item.gradeLevel, durationMinutes: item.durationMinutes,
      instructions: item.instructions, inviteEmails: (item.inviteEmails || []).join('\n'), sections: item.sections || [],
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const publish = async (item: SkillExamTemplate) => {
    await skillExams.update(item.id, { status: item.status === 'PUBLISHED' ? 'CLOSED' : 'PUBLISHED' })
    await load()
  }

  const share = async (item: SkillExamTemplate) => {
    const url = `${window.location.origin}/skills/${item.accessCode}`
    await navigator.clipboard.writeText(url)
    setNotice('Đã copy link làm bài.')
  }

  const invite = (item: SkillExamTemplate) => {
    const url = `${window.location.origin}/skills/${item.accessCode}`
    const recipient = (item.inviteEmails || []).join(',')
    const subject = encodeURIComponent(`Mời làm bài: ${item.title}`)
    const body = encodeURIComponent(`Em hãy làm bài theo link sau:\n${url}\n\nThời gian: ${item.durationMinutes} phút.`)
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        {SKILLS.map(item => {
          const Icon = item.icon
          return <div key={item.type} className="bf-card bf-card--compact" style={{ background: item.tone }}><Icon size={24} weight="duotone" /><div className="mt-2 text-[13px] font-bold">{item.label}</div><div className="mt-1 text-[11px]" style={{ color: 'var(--t2)' }}>{item.description}</div></div>
        })}
      </div>

      <PanelSection title={editingId ? 'Chỉnh sửa mẫu đề kỹ năng' : 'Tạo mẫu đề kỹ năng'} description="Tạo một bài Reading, Listening, Writing và Quiz; học sinh làm bài qua link riêng.">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><label className={labelCls}>Tên mẫu đề *</label><input className={inputCls} style={inputStyle} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="VD: English Skills Check — Unit 4" /></div>
          <div><label className={labelCls}>Môn học</label><input className={inputCls} style={inputStyle} value={draft.subject} onChange={event => setDraft(current => ({ ...current, subject: event.target.value }))} placeholder="Tiếng Anh" /></div>
          <div className="grid grid-cols-2 gap-3"><FormSelect label="Khối lớp" value={String(draft.gradeLevel)} options={[10, 11, 12].map(value => ({ value: String(value), label: `Lớp ${value}` }))} onChange={value => setDraft(current => ({ ...current, gradeLevel: Number(value) }))} /><div><label className={labelCls}>Thời gian (phút)</label><input type="number" min={5} className={inputCls} style={inputStyle} value={draft.durationMinutes} onChange={event => setDraft(current => ({ ...current, durationMinutes: Number(event.target.value) }))} /></div></div>
          <div className="md:col-span-2"><label className={labelCls}>Hướng dẫn chung</label><textarea rows={2} className={inputCls} style={inputStyle} value={draft.instructions} onChange={event => setDraft(current => ({ ...current, instructions: event.target.value }))} /></div>
          <div className="md:col-span-2"><label className={labelCls}>Email học sinh</label><textarea rows={2} className={inputCls} style={inputStyle} value={draft.inviteEmails} onChange={event => setDraft(current => ({ ...current, inviteEmails: event.target.value }))} placeholder="Mỗi email một dòng hoặc phân cách bằng dấu phẩy" /><p className="mt-1 text-[11px]" style={{ color: 'var(--t3)' }}>Khi publish, nút “Soạn email mời” mở ứng dụng email với link làm bài đã điền sẵn.</p></div>
        </div>

        <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--bds)' }}>
          <div className="mb-3 text-[13px] font-bold">Thêm kỹ năng</div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {SKILLS.map(item => { const Icon = item.icon; return <button key={item.type} className="flex min-h-[76px] items-center gap-3 rounded-[6px] border p-3 text-left" style={{ background: item.tone, borderColor: 'var(--bd)' }} onClick={() => setDraft(current => ({ ...current, sections: [...current.sections, makeSection(item.type)] }))}><span className="flex h-8 w-8 items-center justify-center rounded-[4px] border bg-white" style={{ borderColor: 'var(--bd)' }}><Icon size={17} /></span><span><span className="block text-[12px] font-bold">{item.label}</span><span className="block text-[10px]" style={{ color: 'var(--t2)' }}>{item.description}</span></span></button> })}
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {draft.sections.map(section => <SectionEditor key={section.id} section={section} onChange={next => updateSection(section.id, next)} onRemove={() => setDraft(current => ({ ...current, sections: current.sections.filter(item => item.id !== section.id) }))} />)}
          {draft.sections.length === 0 && <EmptyState>Chọn một kỹ năng ở trên để bắt đầu tạo mẫu đề.</EmptyState>}
        </div>

        {notice && <p className="mt-4 text-[12px] font-medium" style={{ color: notice.includes('Không') || notice.includes('Nhập') || notice.includes('Thêm') ? 'var(--red)' : 'var(--green)' }}>{notice}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2"><ActionButton onClick={() => { setDraft(emptyDraft()); setEditingId(null) }}>Làm mới</ActionButton><ActionButton tone="primary" onClick={save} disabled={saving}><Check size={14} /> {saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Tạo mẫu đề'}</ActionButton></div>
      </PanelSection>

      <PanelSection title="Mẫu đề đã tạo" description="Publish để tạo link cho học sinh. In đề hoặc mở email mời trực tiếp từ mỗi mẫu.">
        {loading ? <EmptyState>Đang tải mẫu đề...</EmptyState> : items.length === 0 ? <EmptyState>Chưa có mẫu đề kỹ năng nào.</EmptyState> : <div className="grid gap-3 lg:grid-cols-2">{items.map(item => {
          const url = `${typeof window === 'undefined' ? '' : window.location.origin}/skills/${item.accessCode}`
          return <article key={item.id} className="bf-card bf-card--compact space-y-3">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-[14px] font-bold">{item.title}</h3><p className="mt-1 text-[11px]" style={{ color: 'var(--t2)' }}>{item.subject} · Lớp {item.gradeLevel} · {item.durationMinutes} phút</p></div><Pill tone={item.status === 'PUBLISHED' ? 'green' : item.status === 'CLOSED' ? 'default' : 'amber'}>{item.status === 'PUBLISHED' ? 'Đang mở' : item.status === 'CLOSED' ? 'Đã đóng' : 'Nháp'}</Pill></div>
            <div className="flex flex-wrap gap-1">{(item.sections || []).map(section => <Pill key={section.id}>{SKILLS.find(skill => skill.type === section.skill)?.label}</Pill>)}</div>
            {item.status === 'PUBLISHED' && <div className="truncate rounded-[4px] border px-2 py-2 font-mono text-[11px]" style={{ borderColor: 'var(--bds)', background: 'var(--bg0)', color: 'var(--blue)' }}>{url}</div>}
            <div className="flex flex-wrap gap-2"><ActionButton onClick={() => edit(item)}><PencilSimple size={14} /> Sửa</ActionButton><ActionButton onClick={() => window.open(`/admin/skills-exam-print/${item.id}`, '_blank', 'noopener,noreferrer')}><Printer size={14} /> In</ActionButton>{item.status === 'PUBLISHED' && <><ActionButton onClick={() => share(item)}><Copy size={14} /> Copy link</ActionButton><ActionButton onClick={() => invite(item)}><PaperPlaneTilt size={14} /> Soạn email mời</ActionButton></>}<ActionButton tone={item.status === 'PUBLISHED' ? 'danger' : 'primary'} onClick={() => publish(item)}><Link size={14} /> {item.status === 'PUBLISHED' ? 'Đóng đề' : item.status === 'CLOSED' ? 'Mở lại' : 'Publish'}</ActionButton><ActionButton tone="danger" iconOnly title="Xóa" ariaLabel="Xóa" onClick={async () => { if (confirm(`Xóa mẫu đề “${item.title}”?`)) { await skillExams.remove(item.id); load() } }}><Trash size={14} /></ActionButton></div>
          </article>
        })}</div>}
      </PanelSection>
    </div>
  )
}
