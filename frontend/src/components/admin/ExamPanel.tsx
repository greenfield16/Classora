'use client'

import { useEffect, useState, useCallback } from 'react'
import QRCode from 'qrcode'
import { useAuthStore } from '@/lib/store'
import {
  exams, examAI, storage, profiles, auth, feedback,
  type ExamSubject,
  type ExamQuestion,
  type ExamItem,
  type ExamSessionResult,
  type ExamStudent,
  type ExamStudentResultItem,
  type ExamResultReport,
  type TeacherProfile,
} from '@/lib/api'
import {
  ActionButton, DataTable, EmptyState, FormSelect, PanelSection, Pill, StatCard,
} from './AdminUI'
import {
  BookOpen, Check, ClipboardText, Copy, GraduationCap, Link,
  Plus, QrCode, Trash, X, ArrowLeft, PencilSimple, Eye, BookBookmark,
  CloudArrowUp, FileArrowDown, FilePdf, ListBullets, UsersThree, Camera, GameController,
  ChartBar, Cards,
  UserCircle, Buildings, Key, ChatCircleText, PaperPlaneTilt, Lightbulb, Sparkle, Headphones,
  ArrowsClockwise,
} from '@phosphor-icons/react'
import QuizLivePanel from './QuizLivePanel'
import PollLivePanel from './PollLivePanel'
import SkillsExamPanel from './SkillsExamPanel'

// ── helpers ───────────────────────────────────────────────────────────────────
const DIFFICULTY_LABEL: Record<string, string> = {
  NHAN_BIET: 'Nhận biết', THONG_HIEU: 'Thông hiểu', VAN_DUNG: 'Vận dụng', VAN_DUNG_CAO: 'Vận dụng cao',
}
const DIFFICULTY_TONE: Record<string, 'default' | 'blue' | 'green' | 'amber' | 'red'> = {
  NHAN_BIET: 'green', THONG_HIEU: 'blue', VAN_DUNG: 'amber', VAN_DUNG_CAO: 'red',
}
const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: 'Trắc nghiệm', TRUE_FALSE: 'Đúng/Sai', SHORT_ANSWER: 'Trả lời ngắn', QUIZ: 'Quiz Live', POLL: 'Bình chọn',
}
const STATUS_TONE: Record<string, 'default' | 'blue' | 'green' | 'amber' | 'red'> = {
  DRAFT: 'amber', ACTIVE: 'green', CLOSED: 'default',
}
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Nháp', ACTIVE: 'Đang mở', CLOSED: 'Đã đóng' }

function fmtTime(secs?: number) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const STUDENT_EXAM_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả loại kỳ thi' },
  { value: 'MIDTERM_1', label: 'Giữa HK1' },
  { value: 'FINAL_1', label: 'HK1' },
  { value: 'MIDTERM_2', label: 'Giữa HK2' },
  { value: 'FINAL_2', label: 'HK2' },
  { value: 'TN_THPT', label: 'TN THPT' },
  { value: 'PRACTICE', label: 'Luyện tập' },
  { value: 'CUSTOM', label: 'Custom' },
]

function getStudentExamTypeLabel(exam: { title?: string; examType?: string; semester?: number } | string | undefined) {
  if (!exam || typeof exam === 'string') return typeof exam === 'string' ? exam : '—'
  if (exam.examType === 'GK') return exam.semester === 2 ? 'Giữa HK2' : 'Giữa HK1'
  if (exam.examType === 'CK') return exam.semester === 2 ? 'HK2' : 'HK1'
  if (exam.examType === 'TN_THPT') return 'TN THPT'
  if (exam.examType === 'PRACTICE') return 'Luyện tập'
  if (exam.examType === 'CUSTOM') return exam.title || 'Custom'
  return exam.title || exam.examType || '—'
}

// ── Input styles ─────────────────────────────────────────────────────────────
const inputCls = 'w-full rounded-[8px] border px-3 py-2 text-[13px] outline-none'
const inputStyle = { borderColor: 'var(--bd)', backgroundColor: 'var(--bg1)', color: 'var(--t0)' }
const labelCls = 'text-[12px] font-medium mb-1 block'

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function crc32(bytes: Uint8Array) {
  let crc = -1
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function makeZip(files: { name: string; content: string }[]) {
  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  const writeHeader = (size: number) => {
    const bytes = new Uint8Array(size)
    return { bytes, view: new DataView(bytes.buffer) }
  }

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const contentBytes = encoder.encode(file.content)
    const crc = crc32(contentBytes)

    const local = writeHeader(30 + nameBytes.length)
    local.view.setUint32(0, 0x04034b50, true)
    local.view.setUint16(4, 20, true)
    local.view.setUint16(8, 0, true)
    local.view.setUint32(14, crc, true)
    local.view.setUint32(18, contentBytes.length, true)
    local.view.setUint32(22, contentBytes.length, true)
    local.view.setUint16(26, nameBytes.length, true)
    local.bytes.set(nameBytes, 30)
    localParts.push(local.bytes, contentBytes)

    const central = writeHeader(46 + nameBytes.length)
    central.view.setUint32(0, 0x02014b50, true)
    central.view.setUint16(4, 20, true)
    central.view.setUint16(6, 20, true)
    central.view.setUint16(10, 0, true)
    central.view.setUint32(16, crc, true)
    central.view.setUint32(20, contentBytes.length, true)
    central.view.setUint32(24, contentBytes.length, true)
    central.view.setUint16(28, nameBytes.length, true)
    central.view.setUint32(42, offset, true)
    central.bytes.set(nameBytes, 46)
    centralParts.push(central.bytes)

    offset += local.bytes.length + contentBytes.length
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = writeHeader(22)
  end.view.setUint32(0, 0x06054b50, true)
  end.view.setUint16(8, files.length, true)
  end.view.setUint16(10, files.length, true)
  end.view.setUint32(12, centralSize, true)
  end.view.setUint32(16, offset, true)

  const blobParts = [...localParts, ...centralParts, end.bytes].map(part =>
    part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer
  )

  return new Blob(blobParts, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

const WORD_TEMPLATE_TEXT = `PHẦN I. Trắc nghiệm nhiều lựa chọn
Câu 1. Ngày Môi trường Thế giới được kỷ niệm hằng năm vào ngày nào?
A. 5/6
B. 22/4
C. 1/5
D. 20/11

PHẦN II. Câu hỏi đúng/sai
Câu 2. Đọc thông tin sau về bảo vệ môi trường biển.
a) Rác thải nhựa có thể gây hại cho sinh vật biển. (Đúng)
b) Có thể xả pin cũ xuống biển vì pin sẽ tự phân hủy nhanh. (Sai)
c) Trồng rừng ngập mặn giúp bảo vệ bờ biển. (Đúng)
d) Dầu loang không ảnh hưởng đến hệ sinh thái biển. (Sai)

PHẦN III. Trả lời ngắn
Câu 3. Nếu một lớp có 40 học sinh, 25% học sinh tham gia câu lạc bộ xanh thì có bao nhiêu học sinh tham gia?
Đáp án: 10`

function docxParagraph(text: string, underline = false, bold = false) {
  const runProps = underline || bold
    ? `<w:rPr>${bold ? '<w:b/>' : ''}${underline ? '<w:u w:val="single"/>' : ''}</w:rPr>`
    : ''
  return `<w:p><w:r>${runProps}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`
}

function makeQuestionTemplateDocx() {
  const lines = [
    docxParagraph('MẪU IMPORT CÂU HỎI GREEN EXAMS', false, true),
    docxParagraph('Hướng dẫn: giữ đúng cấu trúc PHẦN I/II/III. Gạch chân đáp án đúng ở trắc nghiệm; với đúng/sai, gạch chân mệnh đề đúng. Google Docs: soạn xong chọn File > Download > Microsoft Word (.docx).'),
    docxParagraph(''),
    docxParagraph('PHẦN I. Trắc nghiệm nhiều lựa chọn', false, true),
    docxParagraph('Câu 1. Ngày Môi trường Thế giới được kỷ niệm hằng năm vào ngày nào?'),
    docxParagraph('A. 5/6', true),
    docxParagraph('B. 22/4'),
    docxParagraph('C. 1/5'),
    docxParagraph('D. 20/11'),
    docxParagraph(''),
    docxParagraph('PHẦN II. Câu hỏi đúng/sai', false, true),
    docxParagraph('Câu 2. Đọc thông tin sau về bảo vệ môi trường biển.'),
    docxParagraph('a) Rác thải nhựa có thể gây hại cho sinh vật biển.', true),
    docxParagraph('b) Có thể xả pin cũ xuống biển vì pin sẽ tự phân hủy nhanh.'),
    docxParagraph('c) Trồng rừng ngập mặn giúp bảo vệ bờ biển.', true),
    docxParagraph('d) Dầu loang không ảnh hưởng đến hệ sinh thái biển.'),
    docxParagraph(''),
    docxParagraph('PHẦN III. Trả lời ngắn', false, true),
    docxParagraph('Câu 3. Nếu một lớp có 40 học sinh, 25% học sinh tham gia câu lạc bộ xanh thì có bao nhiêu học sinh tham gia?'),
    docxParagraph('Đáp án: 10'),
  ].join('')

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`

  return makeZip([
    {
      name: '[Content_Types].xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    { name: 'word/document.xml', content: documentXml },
  ])
}

// ── Admin navigation ─────────────────────────────────────────────────────────
function AdminNavigation({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; description: string; icon: any }[]
  active: string
  onChange: (id: string) => void
}) {
  const groups = [
    { label: 'Chính', ids: ['overview'] },
    { label: 'Soạn đề', ids: ['questions', 'exams', 'skills'] },
    { label: 'Theo dõi', ids: ['results', 'analytics', 'students'] },
    { label: 'Hoạt động lớp', ids: ['quizlive', 'polllive', 'flashcards'] },
    { label: 'Hỗ trợ', ids: ['guide', 'feedback', 'profile'] },
  ]

  const navContent = (
    <div className="flex flex-col gap-2.5">
      {groups.map(group => {
        const groupTabs = group.ids.map(id => tabs.find(tab => tab.id === id)).filter(Boolean) as typeof tabs
        return (
          <div key={group.label}>
            <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--t3)' }}>
              {group.label}
            </div>
            <div className="grid gap-1">
              {groupTabs.map(t => {
                const isActive = active === t.id
                return (
                  <div key={t.id}>
                    <button
                      onClick={() => onChange(t.id)}
                      className="flex min-h-[38px] w-full items-center gap-2 rounded-[4px] border px-2.5 py-1.5 text-left transition-transform active:scale-[0.99]"
                      style={{
                        borderColor: isActive ? 'var(--bd)' : 'transparent',
                        background: isActive ? 'var(--color-accent-green)' : 'transparent',
                        color: 'var(--t0)',
                        boxShadow: isActive ? 'var(--shadow-subtle-3)' : 'none',
                      }}
                    >
                      <t.icon className="flex-shrink-0" size={16} weight={isActive ? 'fill' : 'regular'} />
                      <span className="min-w-0 truncate text-[12px] font-bold">{t.label}</span>
                    </button>
                    {isActive && (
                      <div className="px-2.5 pb-1 pt-1 text-[11px] font-medium leading-snug" style={{ color: 'var(--t2)' }}>
                        {t.description}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <aside className="sticky top-[104px] hidden self-start overflow-y-auto rounded-[8px] border p-2.5 lg:block" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)', maxHeight: 'calc(100vh - 128px)' }}>
      {navContent}
    </aside>
  )
}

function MobileBottomNav({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; description: string; icon: any }[]
  active: string
  onChange: (id: string) => void
}) {
  const go = (id: string) => {
    onChange(id)
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[84] border-t px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 lg:hidden" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)', boxShadow: '0 -8px 18px rgba(0,0,0,0.08)' }}>
      <div className="bf-scrollbar-none mx-auto flex max-w-[520px] snap-x gap-1 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        {tabs.map(tab => {
            const isActive = active === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => go(tab.id)}
                className="relative flex min-h-[54px] w-[72px] flex-shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-[8px] px-1 text-[10px] font-bold"
                style={{
                  background: 'transparent',
                  color: 'var(--t0)',
                }}
              >
                <tab.icon size={18} weight={isActive ? 'fill' : 'regular'} />
                <span className="relative max-w-full truncate whitespace-nowrap leading-tight">
                  {tab.label}
                  {isActive && (
                    <span
                      className="absolute -bottom-1 left-0 right-0 -z-0 h-[6px] rounded-full opacity-90"
                      style={{ background: 'var(--color-accent-green)', transform: 'rotate(-1deg)' }}
                    />
                  )}
                </span>
              </button>
            )
        })}
      </div>
    </nav>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  IMPORT MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function ImportQuestionsModal({
  token, subjects, onClose, onDone,
}: { token: string; subjects: ExamSubject[]; onClose: () => void; onDone: () => void }) {
  const [parsed, setParsed] = useState<any[]>([])
  const [defaultSubjectId, setDefaultSubjectId] = useState('')
  const [defaultGradeLevel, setDefaultGradeLevel] = useState(12)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [parseError, setParseError] = useState('')

  const downloadWordTemplate = () => {
    const url = URL.createObjectURL(makeQuestionTemplateDocx())
    const a = document.createElement('a')
    a.href = url; a.download = 'mau-import-cau-hoi-green-exams.docx'; a.click()
    URL.revokeObjectURL(url)
  }

  const openGoogleDocsTemplate = async () => {
    try {
      await navigator.clipboard.writeText(WORD_TEMPLATE_TEXT)
    } catch { }
    window.open('https://docs.new', '_blank', 'noopener,noreferrer')
  }

  const downloadJsonTemplate = () => {
    const tpl = [
      {
        type: 'MULTIPLE_CHOICE', content: 'Câu hỏi trắc nghiệm ví dụ?',
        difficulty: 'NHAN_BIET', chapter: 'Chương 1', topic: 'Bài 1',
        options: [
          { key: 'A', content: 'Đáp án A' }, { key: 'B', content: 'Đáp án B' },
          { key: 'C', content: 'Đáp án C' }, { key: 'D', content: 'Đáp án D' },
        ],
        correctAnswer: 'A',
      },
      {
        type: 'TRUE_FALSE', content: 'Câu hỏi Đúng/Sai ví dụ?', difficulty: 'THONG_HIEU',
        statements: [
          { key: 'a', content: 'Mệnh đề a', answer: true },
          { key: 'b', content: 'Mệnh đề b', answer: false },
          { key: 'c', content: 'Mệnh đề c', answer: true },
          { key: 'd', content: 'Mệnh đề d', answer: false },
        ],
      },
      { type: 'SHORT_ANSWER', content: 'Câu hỏi trả lời ngắn ví dụ?', difficulty: 'VAN_DUNG', shortAnswer: '3.14' },
    ]
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'mau-cau-hoi.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(''); setParsed([])
    const isDocx = file.name.toLowerCase().endsWith('.docx')
    const isJson = file.name.toLowerCase().endsWith('.json')

    if (isDocx) {
      setParsing(true)
      try {
        const res = await exams.parseDocx(token, file)
        if (!res.questions?.length) {
          setParseError('Không tìm thấy câu hỏi trong file Word. Hãy dùng file mẫu và giữ cấu trúc PHẦN I/II/III.')
          return
        }
        setParsed(res.questions)
      } catch (err: any) {
        setParseError(err.message || 'Không đọc được file Word.')
      } finally {
        setParsing(false)
      }
      return
    }

    if (isJson) {
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target?.result as string)
          if (!Array.isArray(data)) throw new Error('File phải là mảng JSON ([...])')
          setParsed(data)
        } catch (err: any) { setParseError(err.message) }
      }
      reader.readAsText(file)
      return
    }

    setParseError('Chỉ hỗ trợ file .docx hoặc .json.')
  }

  const handleImport = async () => {
    if (!defaultSubjectId || parsed.length === 0) return
    setImporting(true)
    try {
      const res = await exams.importQuestions(token, { questions: parsed, defaultSubjectId, defaultGradeLevel })
      setImportedCount(res.imported)
      setDone(true)
      onDone()
    } catch (err: any) { setParseError(err.message) }
    finally { setImporting(false) }
  }

  const cnt = (t: string) => parsed.filter(q => q.type === t).length

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto p-4 sm:items-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bf-modal flex max-h-[calc(100dvh-32px)] w-full max-w-xl flex-col">
        <div className="bf-modal__header flex flex-shrink-0 items-center justify-between">
          <h3 className="font-bold text-[15px]" style={{ color: 'var(--t0)' }}>Import câu hỏi từ Word / Google Docs</h3>
          <ActionButton iconOnly title="Đóng" ariaLabel="Đóng" onClick={onClose}><X size={16} /></ActionButton>
        </div>
        <div className="bf-modal__body flex-1 space-y-4 overflow-y-auto">
          <div className="bf-card bf-card--compact" style={{ background: 'var(--color-card-mint)' }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <FileArrowDown size={28} weight="duotone" style={{ color: 'var(--green)', flexShrink: 0 }} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold" style={{ color: 'var(--t0)' }}>File mẫu Word cho giáo viên</div>
                <div className="text-[11px] leading-relaxed" style={{ color: 'var(--t2)' }}>
                  Tải mẫu .docx, sửa câu hỏi trong Word hoặc Google Docs, rồi upload lại file .docx.
                </div>
              </div>
              <ActionButton tone="primary" onClick={downloadWordTemplate}><FileArrowDown size={13} /> Tải mẫu .docx</ActionButton>
            </div>
          </div>

          <div className="bf-card bf-card--compact bf-card--subtle">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Copy size={24} weight="duotone" style={{ color: 'var(--blue)', flexShrink: 0 }} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold" style={{ color: 'var(--t0)' }}>Dùng Google Docs</div>
                <div className="text-[11px] leading-relaxed" style={{ color: 'var(--t2)' }}>
                  Mở Google Docs, dán nội dung mẫu đã copy, soạn xong tải về Microsoft Word (.docx) để import.
                </div>
              </div>
              <ActionButton onClick={openGoogleDocsTemplate}><Copy size={13} /> Copy mẫu & mở Docs</ActionButton>
            </div>
          </div>

          <details className="bf-card bf-card--compact bf-card--subtle">
            <summary className="cursor-pointer text-[12px] font-bold" style={{ color: 'var(--t1)' }}>Tùy chọn kỹ thuật: tải mẫu JSON</summary>
            <div className="mt-3 flex items-center gap-3">
            <FileArrowDown size={28} weight="duotone" style={{ color: 'var(--blue)', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold" style={{ color: 'var(--t0)' }}>File mẫu JSON</div>
              <div className="text-[11px]" style={{ color: 'var(--t2)' }}>Dành cho người quen cấu trúc dữ liệu.</div>
            </div>
            <ActionButton onClick={downloadJsonTemplate}><FileArrowDown size={13} /> Tải JSON</ActionButton>
            </div>
          </details>

          {/* File picker */}
          <div>
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Chọn file .docx hoặc .json *</label>
            <input type="file" accept=".docx,.json" onChange={handleFile}
              className="w-full rounded-[8px] border px-3 py-1.5 text-[13px] file:mr-3 file:rounded-[6px] file:border-0 file:bg-transparent file:text-[12px] file:font-semibold file:cursor-pointer"
              style={{ borderColor: 'var(--bd)', color: 'var(--t1)', background: 'var(--bg1)' }} />
            <p className="mt-1 text-[11px]" style={{ color: 'var(--t3)' }}>
              Đáp án đúng trong Word: gạch chân lựa chọn đúng; câu đúng/sai gạch chân mệnh đề đúng; câu trả lời ngắn dùng dòng "Đáp án: ...".
            </p>
          </div>

          {parsing && <p className="text-[13px] font-medium" style={{ color: 'var(--blue)' }}>Đang đọc file Word...</p>}

          {parseError && <p className="text-[13px] font-medium" style={{ color: 'var(--red)' }}>⚠️ {parseError}</p>}

          {parsed.length > 0 && !done && (
            <>
              <div className="bf-card bf-card--compact bf-card--subtle">
                <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--t0)' }}>
                  Tìm thấy <span style={{ color: 'var(--blue)' }}>{parsed.length}</span> câu hỏi:
                </div>
                <div className="flex gap-4 text-[12px]" style={{ color: 'var(--t2)' }}>
                  {cnt('MULTIPLE_CHOICE') > 0 && <span>📝 {cnt('MULTIPLE_CHOICE')} trắc nghiệm</span>}
                  {cnt('TRUE_FALSE') > 0 && <span>☑️ {cnt('TRUE_FALSE')} đúng/sai</span>}
                  {cnt('SHORT_ANSWER') > 0 && <span>✏️ {cnt('SHORT_ANSWER')} trả lời ngắn</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormSelect
                    label="Môn học mặc định *"
                    value={defaultSubjectId}
                    placeholder="Chọn môn..."
                    options={subjects.map(s => ({ value: s._id, label: s.name }))}
                    onChange={setDefaultSubjectId}
                  />
                  <p className="text-[11px] mt-1" style={{ color: 'var(--t3)' }}>Dùng cho câu chưa có trường subjectId</p>
                </div>
                <div>
                  <FormSelect
                    label="Khối lớp mặc định"
                    value={String(defaultGradeLevel)}
                    options={[10, 11, 12].map(g => ({ value: String(g), label: `Lớp ${g}` }))}
                    onChange={value => setDefaultGradeLevel(Number(value))}
                  />
                </div>
              </div>
            </>
          )}

          {done && (
            <div className="bf-card p-4 text-center" style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'var(--green)' }}>
              <div className="font-bold text-[15px]" style={{ color: 'var(--green)' }}>✅ Import thành công {importedCount} câu hỏi!</div>
            </div>
          )}
        </div>
        <div className="bf-modal__footer flex flex-shrink-0 flex-wrap justify-end gap-2">
          <ActionButton onClick={onClose}>{done ? 'Đóng' : 'Hủy'}</ActionButton>
          {!done && (
            <ActionButton tone="primary" onClick={handleImport}
              disabled={importing || parsed.length === 0 || !defaultSubjectId}>
              <CloudArrowUp size={14} />
              {importing ? 'Đang import...' : `Import ${parsed.length} câu hỏi`}
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  QUESTION BANK
// ═══════════════════════════════════════════════════════════════════════════════

type QFilter = { subjectId: string; gradeLevel: string; type: string; difficulty: string }

function AIQuestionTools({ token, subjects, onImported }: { token: string; subjects: ExamSubject[]; onImported: () => void }) {
  const [mode, setMode] = useState<'generate' | 'parse'>('generate')
  const [subjectId, setSubjectId] = useState('')
  const [gradeLevel, setGradeLevel] = useState(10)
  const [questionType, setQuestionType] = useState('MULTIPLE_CHOICE')
  const [difficulty, setDifficulty] = useState('NHAN_BIET')
  const [topic, setTopic] = useState('')
  const [chapter, setChapter] = useState('')
  const [count, setCount] = useState(5)
  const [rawText, setRawText] = useState('')
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const selectedSubject = subjects.find(s => s._id === subjectId)

  function normalizeAiQuestion(q: any) {
    const type = String(q?.type || questionType)
    const base: any = {
      content: String(q?.content || '').trim(),
      type,
      difficulty,
      chapter: chapter || undefined,
      topic: topic || undefined,
    }
    if (type === 'MULTIPLE_CHOICE' || type === 'QUIZ' || type === 'POLL') {
      const keys = ['A', 'B', 'C', 'D']
      const opts = Array.isArray(q?.options) ? q.options : []
      base.options = keys.map((k, i) => ({ key: k, content: String(opts[i]?.content || opts[i] || '').trim() }))
      if (type !== 'POLL') {
        const ca = String(q?.correctAnswer || 'A').toUpperCase()
        base.correctAnswer = ['A', 'B', 'C', 'D'].includes(ca) ? ca : 'A'
      }
    } else if (type === 'TRUE_FALSE') {
      const keys = ['a', 'b', 'c', 'd']
      const st = Array.isArray(q?.statements) ? q.statements : []
      base.statements = keys.map((k, i) => ({
        key: k,
        content: String(st[i]?.content || '').trim(),
        answer: Boolean(st[i]?.answer),
      }))
    } else if (type === 'SHORT_ANSWER') {
      base.shortAnswer = String(q?.shortAnswer || '').trim()
      base.shortAnswerTolerance = Number(q?.shortAnswerTolerance || 0)
    }
    return base
  }

  const doGenerate = async () => {
    if (!subjectId) return setErr('Chọn môn học trước khi sinh câu hỏi')
    if (!topic.trim()) return setErr('Nhập chủ đề cần sinh câu hỏi')
    setLoading(true)
    setErr('')
    setMsg('')
    try {
      const res = await examAI.generateQuestions({
        subjectName: selectedSubject?.name || 'Môn học',
        gradeLevel,
        topic: topic.trim(),
        questionType,
        count: Math.max(1, Math.min(20, count)),
        difficulty,
        chapter: chapter.trim(),
      })
      setQuestions(Array.isArray(res.questions) ? res.questions : [])
      setMsg(`AI đã sinh ${res.count || 0} câu (${res.model})`)
    } catch (e: any) {
      setErr(e.message || 'Không thể sinh câu hỏi bằng AI')
    } finally {
      setLoading(false)
    }
  }

  const doParse = async () => {
    if (!subjectId) return setErr('Chọn môn học trước khi parse câu hỏi')
    if (!rawText.trim()) return setErr('Dán nội dung đề vào ô văn bản')
    setLoading(true)
    setErr('')
    setMsg('')
    try {
      const res = await examAI.parseQuestions({
        text: rawText,
        questionType,
        gradeLevel,
        difficulty,
      })
      setQuestions(Array.isArray(res.questions) ? res.questions : [])
      setMsg(`AI đã parse ${res.count || 0} câu (${res.model})`)
    } catch (e: any) {
      setErr(e.message || 'Không thể parse câu hỏi bằng AI')
    } finally {
      setLoading(false)
    }
  }

  const doImport = async () => {
    if (!subjectId) return setErr('Chọn môn học trước khi import')
    const clean = questions.map(normalizeAiQuestion).filter((q: any) => q.content)
    if (clean.length === 0) return setErr('Không có câu hợp lệ để import')
    setImporting(true)
    setErr('')
    setMsg('')
    try {
      const res = await exams.importQuestions(token, {
        questions: clean,
        defaultSubjectId: subjectId,
        defaultGradeLevel: gradeLevel,
      })
      setMsg(`Đã import ${res.imported} câu (bỏ qua ${res.skipped})`)
      setQuestions([])
      onImported()
    } catch (e: any) {
      setErr(e.message || 'Import câu hỏi AI thất bại')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="bf-card bf-card--compact">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-semibold" style={{ color: 'var(--t0)' }}>AI hỗ trợ ngân hàng câu hỏi</div>
        <div className="flex gap-2">
          <ActionButton onClick={() => setMode('generate')} tone={mode === 'generate' ? 'primary' : 'default'}>Sinh câu hỏi</ActionButton>
          <ActionButton onClick={() => setMode('parse')} tone={mode === 'parse' ? 'primary' : 'default'}>Parse văn bản</ActionButton>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <FormSelect
          label="Môn học"
          value={subjectId}
          placeholder="Chọn môn học"
          options={subjects.map(s => ({ value: s._id, label: s.name }))}
          onChange={setSubjectId}
        />
        <FormSelect
          label="Khối lớp"
          value={String(gradeLevel)}
          options={[10, 11, 12].map(g => ({ value: String(g), label: `Lớp ${g}` }))}
          onChange={value => setGradeLevel(Number(value))}
        />
        <FormSelect
          label="Loại câu"
          value={questionType}
          options={[
            { value: 'MULTIPLE_CHOICE', label: 'Trắc nghiệm' },
            { value: 'TRUE_FALSE', label: 'Đúng/Sai' },
            { value: 'SHORT_ANSWER', label: 'Trả lời ngắn' },
            { value: 'QUIZ', label: 'Quiz Live' },
            { value: 'POLL', label: 'Bình chọn' },
          ]}
          onChange={setQuestionType}
        />
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-3">
        <FormSelect
          label="Mức độ"
          value={difficulty}
          options={[
            { value: 'NHAN_BIET', label: 'Nhận biết' },
            { value: 'THONG_HIEU', label: 'Thông hiểu' },
            { value: 'VAN_DUNG', label: 'Vận dụng' },
            { value: 'VAN_DUNG_CAO', label: 'Vận dụng cao' },
          ]}
          onChange={setDifficulty}
        />
        <div>
          <label className={labelCls} style={{ color: 'var(--t2)' }}>Chương</label>
          <input className={inputCls} style={inputStyle} placeholder="Tuỳ chọn" value={chapter} onChange={e => setChapter(e.target.value)} />
        </div>
        {mode === 'generate' ? (
          <div>
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Số câu</label>
            <input type="number" min={1} max={20} className={inputCls} style={inputStyle} value={count} onChange={e => setCount(Number(e.target.value || 5))} />
          </div>
        ) : <div />}
      </div>

      {mode === 'generate' ? (
        <div className="mt-2">
          <label className={labelCls} style={{ color: 'var(--t2)' }}>Chủ đề</label>
          <input className={inputCls} style={inputStyle} placeholder="Nhập chủ đề cần sinh câu hỏi..." value={topic} onChange={e => setTopic(e.target.value)} />
        </div>
      ) : (
        <div className="mt-2">
          <label className={labelCls} style={{ color: 'var(--t2)' }}>Văn bản đề</label>
          <textarea
            rows={5}
            className={inputCls}
            style={inputStyle}
            placeholder="Dán văn bản đề vào đây để AI tách câu hỏi..."
            value={rawText}
            onChange={e => setRawText(e.target.value)}
          />
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {mode === 'generate' ? (
          <ActionButton tone="primary" onClick={doGenerate} disabled={loading}>{loading ? 'Đang sinh...' : 'AI sinh câu hỏi'}</ActionButton>
        ) : (
          <ActionButton tone="primary" onClick={doParse} disabled={loading}>{loading ? 'Đang parse...' : 'AI parse câu hỏi'}</ActionButton>
        )}
        <ActionButton onClick={doImport} disabled={importing || questions.length === 0}>{importing ? 'Đang import...' : `Import ${questions.length} câu AI`}</ActionButton>
      </div>

      {err ? <div className="mt-2 text-[12px]" style={{ color: 'var(--red)' }}>{err}</div> : null}
      {msg ? <div className="mt-2 text-[12px]" style={{ color: 'var(--green)' }}>{msg}</div> : null}

      {questions.length > 0 ? (
        <div className="bf-card bf-card--compact mt-2 text-[12px]" style={{ color: 'var(--t2)' }}>
          Preview: {questions.length} câu. Bấm Import để đưa vào ngân hàng câu hỏi.
        </div>
      ) : null}
    </div>
  )
}

function QuestionBank({ token, subjects }: { token: string; subjects: ExamSubject[] }) {
  const [items, setItems] = useState<ExamQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<QFilter>({ subjectId: '', gradeLevel: '', type: '', difficulty: '' })
  const [editing, setEditing] = useState<Partial<ExamQuestion> | null>(null) // null = closed, {} = new
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async (f: QFilter = filter, p = page) => {
    setLoading(true)
    try {
      const res = await exams.getQuestions(token, {
        subjectId: f.subjectId || undefined,
        gradeLevel: f.gradeLevel ? Number(f.gradeLevel) : undefined,
        type: f.type || undefined,
        difficulty: f.difficulty || undefined,
        page: p, limit: 30,
      })
      setItems(res.items)
      setTotal(res.total)
    } finally { setLoading(false) }
  }, [token, filter, page])

  useEffect(() => { load() }, [load])

  const handleFilter = (key: keyof QFilter, val: string) => {
    const nf = { ...filter, [key]: val }
    setFilter(nf)
    setPage(1)
    load(nf, 1)
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      if (editing._id) {
        await exams.updateQuestion(token, editing._id, editing)
      } else {
        await exams.createQuestion(token, editing)
      }
      setEditing(null)
      load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa câu hỏi này?')) return
    setDeleting(id)
    try { await exams.deleteQuestion(token, id); load() }
    finally { setDeleting(null) }
  }

  return (
    <div className="space-y-4">
      <AIQuestionTools token={token} subjects={subjects} onImported={() => load()} />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <FormSelect className="w-[150px]" value={filter.subjectId} placeholder="Tất cả môn" options={[{ value: '', label: 'Tất cả môn' }, ...subjects.map(s => ({ value: s._id, label: s.name }))]} onChange={value => handleFilter('subjectId', value)} />
        <FormSelect className="w-[140px]" value={filter.gradeLevel} placeholder="Tất cả khối" options={[{ value: '', label: 'Tất cả khối' }, ...[10, 11, 12].map(g => ({ value: String(g), label: `Lớp ${g}` }))]} onChange={value => handleFilter('gradeLevel', value)} />
        <FormSelect className="w-[150px]" value={filter.type} placeholder="Tất cả loại" options={[{ value: '', label: 'Tất cả loại' }, ...Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))]} onChange={value => handleFilter('type', value)} />
        <FormSelect className="w-[150px]" value={filter.difficulty} placeholder="Tất cả mức" options={[{ value: '', label: 'Tất cả mức' }, ...Object.entries(DIFFICULTY_LABEL).map(([value, label]) => ({ value, label }))]} onChange={value => handleFilter('difficulty', value)} />
        <ActionButton iconOnly title="Tải lại" ariaLabel="Tải lại" onClick={() => load()} disabled={loading}>
          <ArrowsClockwise size={16} className={loading ? 'animate-spin' : ''} />
        </ActionButton>
        <div className="flex-1" />
        <ActionButton onClick={() => setShowImport(true)}>
          <CloudArrowUp size={14} /> Import từ file
        </ActionButton>
        <ActionButton tone="primary" onClick={() => setEditing({ type: 'MULTIPLE_CHOICE', gradeLevel: 10, difficulty: 'NHAN_BIET', options: [{ key: 'A', content: '' }, { key: 'B', content: '' }, { key: 'C', content: '' }, { key: 'D', content: '' }], isActive: true })}>
          <Plus size={14} weight="bold" /> Thêm câu hỏi
        </ActionButton>
      </div>

      <div className="text-[12px]" style={{ color: 'var(--t2)' }}>Tổng: {total} câu hỏi</div>

      {loading ? <EmptyState>Đang tải...</EmptyState> : items.length === 0 ? <EmptyState>Chưa có câu hỏi nào. Hãy thêm câu hỏi hoặc bớt bộ lọc.</EmptyState> : (
        <DataTable>
          <table className="min-w-full text-left text-[13px]">
            <thead style={{ background: 'var(--bg1)', color: 'var(--t2)' }}>
              <tr>
                <th className="px-4 py-3 font-semibold w-[40%]">Câu hỏi</th>
                <th className="px-4 py-3 font-semibold">Môn / Khối</th>
                <th className="px-4 py-3 font-semibold">Loại</th>
                <th className="px-4 py-3 font-semibold">Mức độ</th>
                <th className="px-4 py-3 font-semibold">Dùng</th>
                <th className="px-4 py-3 font-semibold w-20"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(q => {
                const subj = typeof q.subjectId === 'object' ? q.subjectId : subjects.find(s => s._id === q.subjectId)
                return (
                  <tr key={q._id} className="border-t" style={{ borderColor: 'var(--bds)' }}>
                    <td className="px-4 py-3">
                      <div style={{ color: 'var(--t0)' }} className="line-clamp-2 text-[13px]"
                        dangerouslySetInnerHTML={{ __html: q.content.replace(/<[^>]+>/g, ' ').slice(0, 120) }} />
                      {q.chapter && <div className="text-[11px] mt-0.5" style={{ color: 'var(--t3)' }}>{q.chapter}</div>}
                    </td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--t1)' }}>
                      {subj?.name || '—'}<br /><span style={{ color: 'var(--t3)' }}>Lớp {q.gradeLevel}</span>
                    </td>
                    <td className="px-4 py-3"><Pill tone="blue">{TYPE_LABEL[q.type]}</Pill></td>
                    <td className="px-4 py-3"><Pill tone={DIFFICULTY_TONE[q.difficulty]}>{DIFFICULTY_LABEL[q.difficulty]}</Pill></td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--t2)' }}>{q.usageCount || 0}x</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <ActionButton iconOnly title="Sửa" ariaLabel="Sửa" onClick={() => setEditing({ ...q })}>
                          <PencilSimple size={14} />
                        </ActionButton>
                        <ActionButton iconOnly tone="danger" title="Xóa" ariaLabel="Xóa"
                          disabled={deleting === q._id} onClick={() => handleDelete(q._id)}>
                          <Trash size={14} />
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </DataTable>
      )}

      {/* Pagination */}
      {total > 30 && (
        <div className="flex gap-2 justify-center">
          <ActionButton disabled={page <= 1} onClick={() => { setPage(page - 1); load(filter, page - 1) }}>‹ Trước</ActionButton>
          <span className="px-3 py-2 text-[12px]" style={{ color: 'var(--t2)' }}>Trang {page} / {Math.ceil(total / 30)}</span>
          <ActionButton disabled={page >= Math.ceil(total / 30)} onClick={() => { setPage(page + 1); load(filter, page + 1) }}>Tiếp ›</ActionButton>
        </div>
      )}

      {showImport && (
        <ImportQuestionsModal
          token={token}
          subjects={subjects}
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false)
            load()
          }}
        />
      )}

      {/* Question Editor Modal */}
      {editing && <QuestionEditor subjects={subjects} initial={editing} onClose={() => setEditing(null)} onSave={handleSave} saving={saving} onChange={setEditing as any} />}
    </div>
  )
}

// ── Question Editor ────────────────────────────────────────────────────────────
function QuestionEditor({
  subjects, initial, onClose, onSave, saving, onChange,
}: {
  subjects: ExamSubject[]
  initial: Partial<ExamQuestion>
  onClose: () => void
  onSave: () => void
  saving: boolean
  onChange: (q: Partial<ExamQuestion>) => void
}) {
  const q = initial

  const updateOption = (idx: number, val: string) => {
    const opts = [...(q.options || [])]
    opts[idx] = { ...opts[idx], content: val }
    onChange({ ...q, options: opts })
  }

  const updateStatement = (idx: number, field: 'content' | 'answer', val: string | boolean) => {
    const stmts = [...(q.statements || [])]
    stmts[idx] = { ...stmts[idx], [field]: val }
    onChange({ ...q, statements: stmts })
  }

  const handleTypeChange = (type: ExamQuestion['type']) => {
    const base: Partial<ExamQuestion> = { ...q, type }
    if (type === 'MULTIPLE_CHOICE' || type === 'QUIZ' || type === 'POLL') {
      base.options = q.options?.length === 4 ? q.options : [{ key: 'A', content: '' }, { key: 'B', content: '' }, { key: 'C', content: '' }, { key: 'D', content: '' }]
      if (type !== 'POLL') { base.correctAnswer = q.correctAnswer || 'A' } else { delete base.correctAnswer }
      delete base.statements; delete base.shortAnswer
    } else if (type === 'TRUE_FALSE') {
      base.statements = q.statements?.length === 4 ? q.statements : ['a', 'b', 'c', 'd'].map(k => ({ key: k, content: '', answer: false }))
      delete base.options; delete base.correctAnswer; delete base.shortAnswer
    } else {
      base.shortAnswer = q.shortAnswer || ''
      delete base.options; delete base.correctAnswer; delete base.statements
    }
    onChange(base)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bf-modal w-full max-w-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--bd)' }}>
          <h3 className="font-bold text-[15px]" style={{ color: 'var(--t0)' }}>{q._id ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}</h3>
          <ActionButton iconOnly title="Đóng" ariaLabel="Đóng" onClick={onClose}><X size={16} /></ActionButton>
        </div>
        <div className="p-5 space-y-4">
          {/* Row 1: subject, grade, type */}
          <div className="grid grid-cols-3 gap-3">
            <FormSelect label="Môn học *" value={q.subjectId as string || ''} placeholder="Chọn môn" options={[{ value: '', label: 'Chọn môn' }, ...subjects.map(s => ({ value: s._id, label: s.name }))]} onChange={value => onChange({ ...q, subjectId: value })} />
            <FormSelect label="Khối lớp *" value={String(q.gradeLevel || 10)} options={[10, 11, 12].map(g => ({ value: String(g), label: `Lớp ${g}` }))} onChange={value => onChange({ ...q, gradeLevel: Number(value) })} />
            <FormSelect label="Loại câu *" value={q.type || 'MULTIPLE_CHOICE'} options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} onChange={value => handleTypeChange(value as any)} />
          </div>

          {/* Row 2: difficulty, chapter, topic */}
          <div className="grid grid-cols-3 gap-3">
            <FormSelect label="Mức độ *" value={q.difficulty || 'NHAN_BIET'} options={Object.entries(DIFFICULTY_LABEL).map(([value, label]) => ({ value, label }))} onChange={value => onChange({ ...q, difficulty: value as any })} />
            <div>
              <label className={labelCls} style={{ color: 'var(--t2)' }}>Chương</label>
              <input className={inputCls} style={inputStyle} value={q.chapter || ''} onChange={e => onChange({ ...q, chapter: e.target.value })} placeholder="Chương 1..." />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--t2)' }}>Bài / Chủ đề</label>
              <input className={inputCls} style={inputStyle} value={q.topic || ''} onChange={e => onChange({ ...q, topic: e.target.value })} placeholder="Bài 2..." />
            </div>
          </div>

          {/* Content */}
          <div>
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Nội dung câu hỏi *</label>
            <textarea rows={3} className={inputCls} style={inputStyle} value={q.content || ''}
              onChange={e => onChange({ ...q, content: e.target.value })} placeholder="Nhập nội dung câu hỏi... (hỗ trợ HTML/LaTeX)" />
          </div>

          {/* Type-specific */}
          {q.type === 'POLL' && (
            <div className="space-y-2">
              <label className={labelCls} style={{ color: 'var(--t2)' }}>Các lựa chọn A/B/C/D <span className="font-normal text-[11px]" style={{ color: 'var(--t3)' }}>(không cần đáp án đúng)</span></label>
              {(q.options || []).map((opt, idx) => (
                <div key={opt.key} className="flex gap-2 items-center">
                  <span className="w-6 h-6 flex items-center justify-center rounded font-bold text-[12px] flex-shrink-0"
                    style={{ background: 'var(--bg1)', color: 'var(--t1)', border: '1px solid var(--bd)' }}>
                    {opt.key}
                  </span>
                  <input className={inputCls} style={inputStyle} value={opt.content}
                    onChange={e => updateOption(idx, e.target.value)} placeholder={`Lựa chọn ${opt.key}...`} />
                </div>
              ))}
              <p className="text-[11px]" style={{ color: 'var(--t3)' }}>Câu hỏi bình chọn — học sinh vote vào một trong các lựa chọn</p>
            </div>
          )}

          {(q.type === 'MULTIPLE_CHOICE' || q.type === 'QUIZ') && (
            <div className="space-y-2">
              <label className={labelCls} style={{ color: 'var(--t2)' }}>Các lựa chọn A/B/C/D</label>
              {(q.options || []).map((opt, idx) => (
                <div key={opt.key} className="flex gap-2 items-center">
                  <span className="w-6 h-6 flex items-center justify-center rounded font-bold text-[12px] flex-shrink-0"
                    style={{ background: q.correctAnswer === opt.key ? 'var(--green)' : 'var(--bg1)', color: q.correctAnswer === opt.key ? '#fff' : 'var(--t1)', border: '1px solid var(--bd)' }}>
                    {opt.key}
                  </span>
                  <input className={inputCls} style={inputStyle} value={opt.content}
                    onChange={e => updateOption(idx, e.target.value)} placeholder={`Đáp án ${opt.key}...`} />
                  <button type="button" onClick={() => onChange({ ...q, correctAnswer: opt.key })}
                    className="flex-shrink-0 px-2 py-1 rounded text-[11px] font-semibold border transition-colors"
                    style={{ borderColor: q.correctAnswer === opt.key ? 'var(--green)' : 'var(--bd)', color: q.correctAnswer === opt.key ? 'var(--green)' : 'var(--t2)', background: 'transparent' }}>
                    {q.correctAnswer === opt.key ? <Check size={14} weight="bold" /> : '○'}
                  </button>
                </div>
              ))}
              <p className="text-[11px]" style={{ color: 'var(--t3)' }}>Click ○ hoặc chữ cái để chọn đáp án đúng</p>
            </div>
          )}

          {q.type === 'TRUE_FALSE' && (
            <div className="space-y-2">
              <label className={labelCls} style={{ color: 'var(--t2)' }}>4 mệnh đề (a/b/c/d)</label>
              {(q.statements || []).map((stmt, idx) => (
                <div key={stmt.key} className="flex gap-2 items-center">
                  <span className="w-6 h-6 flex items-center justify-center rounded font-bold text-[12px] flex-shrink-0"
                    style={{ background: 'var(--bg1)', color: 'var(--t1)', border: '1px solid var(--bd)' }}>{stmt.key}</span>
                  <input className={inputCls} style={inputStyle} value={stmt.content}
                    onChange={e => updateStatement(idx, 'content', e.target.value)} placeholder={`Mệnh đề ${stmt.key}...`} />
                  <FormSelect
                    className="w-[96px] flex-shrink-0"
                    value={stmt.answer ? 'true' : 'false'}
                    options={[{ value: 'true', label: '✓ Đúng' }, { value: 'false', label: '✗ Sai' }]}
                    onChange={value => updateStatement(idx, 'answer', value === 'true')}
                  />
                </div>
              ))}
            </div>
          )}

          {q.type === 'SHORT_ANSWER' && (
            <div>
              <label className={labelCls} style={{ color: 'var(--t2)' }}>Đáp án (chuỗi hoặc số)</label>
              <input className={inputCls} style={inputStyle} value={q.shortAnswer || ''}
                onChange={e => onChange({ ...q, shortAnswer: e.target.value })} placeholder="Ví dụ: 3.14 hoặc Hà Nội" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t" style={{ borderColor: 'var(--bd)' }}>
          <ActionButton onClick={onClose}>Hủy</ActionButton>
          <ActionButton tone="primary" onClick={onSave} disabled={saving || !q.subjectId || !q.content?.trim()}>
            {saving ? 'Đang lưu...' : (q._id ? 'Cập nhật' : 'Thêm câu hỏi')}
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXAM QUESTIONS MODAL — preview câu hỏi đã gán cho đề thi
// ═══════════════════════════════════════════════════════════════════════════════

function ExamQuestionsModal({ token, examId, examTitle, onClose }: {
  token: string
  examId: string
  examTitle: string
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ total: number; part1: ExamQuestion[]; part2: ExamQuestion[]; part3: ExamQuestion[] } | null>(null)

  useEffect(() => {
    exams.getExamQuestions(token, examId)
      .then(setData)
      .catch(() => setData({ total: 0, part1: [], part2: [], part3: [] }))
      .finally(() => setLoading(false))
  }, [token, examId])

  const renderQuestion = (q: ExamQuestion, idx: number) => (
    <div key={q._id} className="bf-list-card p-2.5 text-[12px]">
      <div className="flex items-start gap-2">
        <span className="font-bold flex-shrink-0" style={{ color: 'var(--t2)' }}>#{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'var(--blue)', color: '#fff' }}>
              {TYPE_LABEL[q.type] || q.type}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--bg0)', color: 'var(--t2)', border: '1px solid var(--bds)' }}>
              {DIFFICULTY_LABEL[q.difficulty] || q.difficulty}
            </span>
          </div>
          <p className="line-clamp-2 leading-relaxed" style={{ color: 'var(--t1)' }}
            dangerouslySetInnerHTML={{ __html: q.content || '' }} />
          {q.type === 'MULTIPLE_CHOICE' && q.correctAnswer && (
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--green)' }}>✓ Đáp án: {q.correctAnswer}</p>
          )}
          {q.type === 'SHORT_ANSWER' && q.shortAnswer != null && (
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--green)' }}>✓ Đáp số: {q.shortAnswer}</p>
          )}
          {q.type === 'TRUE_FALSE' && q.statements && (
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--t3)' }}>
              {q.statements.map(s => `${s.key}: ${s.answer ? 'Đúng' : 'Sai'}`).join(' · ')}
            </p>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="bf-modal w-full max-w-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--bd)' }}>
          <div>
            <h3 className="font-bold text-[15px]" style={{ color: 'var(--t0)' }}>Câu hỏi của đề thi</h3>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--t2)' }}>{examTitle}</p>
          </div>
          <button onClick={onClose} className="bf-btn bf-btn--icon" title="Đóng" aria-label="Đóng"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="text-center py-10 text-[13px]" style={{ color: 'var(--t3)' }}>Đang tải...</div>
          ) : data?.total === 0 ? (
            <div className="bf-card bf-card--subtle p-5 text-center">
              <ListBullets size={32} className="mx-auto mb-2" style={{ color: 'var(--t3)' }} />
              <p className="font-semibold text-[13px] mb-1" style={{ color: 'var(--t1)' }}>Chưa có câu hỏi được gán thủ công</p>
              <p className="text-[12px]" style={{ color: 'var(--t3)' }}>
                Đề này dùng chế độ <b>Tự động</b> — câu hỏi sẽ được lấy ngẫu nhiên từ ngân hàng khi publish.
                Nếu ngân hàng chưa có câu nào cho môn/khối này, hãy import câu hỏi từ file JSON trước.
              </p>
            </div>
          ) : (
            <>
              {/* Part I */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-[13px]" style={{ color: 'var(--t1)' }}>Phần I — Trắc nghiệm</span>
                  <span className="bf-tag bf-tag--compact bf-tag--blue">{data!.part1.length} câu</span>
                </div>
                {data!.part1.length === 0
                  ? <p className="text-[12px]" style={{ color: 'var(--t3)' }}>Sẽ lấy tự động từ ngân hàng khi publish</p>
                  : <div className="space-y-2">{data!.part1.map((q, i) => renderQuestion(q, i))}</div>}
              </div>

              {/* Part II */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-[13px]" style={{ color: 'var(--t1)' }}>Phần II — Đúng/Sai</span>
                  <span className="bf-tag bf-tag--compact bf-tag--green">{data!.part2.length} câu</span>
                </div>
                {data!.part2.length === 0
                  ? <p className="text-[12px]" style={{ color: 'var(--t3)' }}>Sẽ lấy tự động từ ngân hàng khi publish</p>
                  : <div className="space-y-2">{data!.part2.map((q, i) => renderQuestion(q, i))}</div>}
              </div>

              {/* Part III */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-[13px]" style={{ color: 'var(--t1)' }}>Phần III — Trả lời ngắn</span>
                  <span className="bf-tag bf-tag--compact bf-tag--amber">{data!.part3.length} câu</span>
                </div>
                {data!.part3.length === 0
                  ? <p className="text-[12px]" style={{ color: 'var(--t3)' }}>Sẽ lấy tự động từ ngân hàng khi publish</p>
                  : <div className="space-y-2">{data!.part3.map((q, i) => renderQuestion(q, i))}</div>}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && data && data.total > 0 && (
          <div className="px-5 py-3 border-t text-[12px] flex items-center gap-3 flex-shrink-0" style={{ borderColor: 'var(--bd)', color: 'var(--t2)' }}>
            <span>Tổng: <b style={{ color: 'var(--t0)' }}>{data.total} câu hỏi</b></span>
            <span>🔵 {data.part1.length} TN · 🟢 {data.part2.length} Đ/S · 🟡 {data.part3.length} Ngắn</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  QUESTION PICKER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function QuestionPickerModal({ token, subjectId, gradeLevel, structure, initialSelected, onConfirm, onClose }: {
  token: string
  subjectId: string
  gradeLevel: number
  structure: { part1Count: number; part2Count: number; part3Count: number }
  initialSelected: { part1: string[]; part2: string[]; part3: string[] }
  onConfirm: (s: { part1: string[]; part2: string[]; part3: string[] }) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'part1' | 'part2' | 'part3'>('part1')
  const [bankQs, setBankQs] = useState<{ part1: ExamQuestion[]; part2: ExamQuestion[]; part3: ExamQuestion[] }>({ part1: [], part2: [], part3: [] })
  const [selected, setSelected] = useState(initialSelected)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ keyword: '', difficulty: '', chapter: '', topic: '' })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      exams.getQuestions(token, { subjectId: subjectId || undefined, gradeLevel: gradeLevel || undefined, type: 'MULTIPLE_CHOICE', limit: 500 }),
      exams.getQuestions(token, { subjectId: subjectId || undefined, gradeLevel: gradeLevel || undefined, type: 'TRUE_FALSE', limit: 500 }),
      exams.getQuestions(token, { subjectId: subjectId || undefined, gradeLevel: gradeLevel || undefined, type: 'SHORT_ANSWER', limit: 500 }),
    ]).then(([p1, p2, p3]) => setBankQs({ part1: p1.items, part2: p2.items, part3: p3.items }))
      .finally(() => setLoading(false))
  }, [token, subjectId, gradeLevel])

  const toggle = (part: 'part1' | 'part2' | 'part3', id: string) => {
    const max = { part1: structure.part1Count, part2: structure.part2Count, part3: structure.part3Count }[part]
    setSelected(s => {
      const curr = s[part]
      if (curr.includes(id)) return { ...s, [part]: curr.filter(x => x !== id) }
      if (curr.length >= max) return s
      return { ...s, [part]: [...curr, id] }
    })
  }

  const PARTS = [
    { key: 'part1' as const, label: 'Phần I — Trắc nghiệm', max: structure.part1Count },
    { key: 'part2' as const, label: 'Phần II — Đúng/Sai', max: structure.part2Count },
    { key: 'part3' as const, label: 'Phần III — Trả lời ngắn', max: structure.part3Count },
  ]
  const totalSel = selected.part1.length + selected.part2.length + selected.part3.length
  const visibleQuestions = bankQs[tab].filter(q => {
    const keyword = filters.keyword.trim().toLowerCase()
    const content = `${q.content || ''} ${q.chapter || ''} ${q.topic || ''}`.replace(/<[^>]+>/g, ' ').toLowerCase()
    return (!keyword || content.includes(keyword))
      && (!filters.difficulty || q.difficulty === filters.difficulty)
      && (!filters.chapter.trim() || String(q.chapter || '').toLowerCase().includes(filters.chapter.trim().toLowerCase()))
      && (!filters.topic.trim() || String(q.topic || '').toLowerCase().includes(filters.topic.trim().toLowerCase()))
  })
  const resetFilters = () => setFilters({ keyword: '', difficulty: '', chapter: '', topic: '' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bf-modal flex w-full max-w-4xl flex-col" style={{ maxHeight: '85vh' }}>
        <div className="bf-modal__header flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-bold text-[15px]" style={{ color: 'var(--t0)' }}>Chọn câu hỏi từ ngân hàng</h3>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--t2)' }}>
              Đã chọn: {selected.part1.length}/{structure.part1Count} TN · {selected.part2.length}/{structure.part2Count} Đ/S · {selected.part3.length}/{structure.part3Count} Ngắn
            </p>
          </div>
          <ActionButton iconOnly title="Đóng" ariaLabel="Đóng" onClick={onClose}><X size={16} /></ActionButton>
        </div>

        <div className="mx-5 mt-4 grid gap-2 rounded-[8px] p-2 md:grid-cols-3" style={{ background: 'var(--bg0)', border: '1px solid var(--bds)' }}>
          {PARTS.map(p => (
            <button key={p.key} onClick={() => setTab(p.key)}
              className="flex min-h-[44px] items-center justify-between gap-2 rounded-[6px] border px-3 py-2 text-left text-[12px] font-bold transition-transform active:scale-[0.99]"
              style={{
                borderColor: tab === p.key ? 'var(--bd)' : 'transparent',
                background: tab === p.key ? 'var(--color-accent-green)' : 'transparent',
                color: 'var(--t0)',
                boxShadow: tab === p.key ? 'var(--shadow-subtle-3)' : 'none',
              }}>
              <span className="truncate">{p.label}</span>
              <span className={`bf-tag bf-tag--compact ${selected[p.key].length >= p.max ? 'bf-tag--green' : ''}`}>{selected[p.key].length}/{p.max}</span>
            </button>
          ))}
        </div>

        <div className="bf-card bf-card--compact bf-card--subtle mx-5 mt-3">
          <div className="grid gap-2 md:grid-cols-[minmax(180px,1fr)_160px_140px_140px_auto]">
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="Tìm nội dung câu hỏi..."
              value={filters.keyword}
              onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))}
            />
            <FormSelect
              value={filters.difficulty}
              onChange={value => setFilters(f => ({ ...f, difficulty: value }))}
              options={[{ value: '', label: 'Tất cả mức' }, ...Object.entries(DIFFICULTY_LABEL).map(([value, label]) => ({ value, label }))]}
            />
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="Chương"
              value={filters.chapter}
              onChange={e => setFilters(f => ({ ...f, chapter: e.target.value }))}
            />
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="Chủ đề"
              value={filters.topic}
              onChange={e => setFilters(f => ({ ...f, topic: e.target.value }))}
            />
            <ActionButton onClick={resetFilters}>Xóa lọc</ActionButton>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? <EmptyState>Đang tải câu hỏi...</EmptyState>
            : bankQs[tab].length === 0 ? <EmptyState>Không có câu hỏi nào trong ngân hàng cho môn/khối đã chọn.</EmptyState>
              : visibleQuestions.length === 0 ? <EmptyState>Không có câu hỏi phù hợp với bộ lọc.</EmptyState>
              : (
                <div className="space-y-2">
                  {visibleQuestions.map((q, idx) => {
                    const isSel = selected[tab].includes(q._id)
                    return (
                      <div key={q._id} onClick={() => toggle(tab, q._id)}
                        className="bf-list-card flex items-start gap-3 p-3 cursor-pointer transition-all"
                        style={{ borderColor: isSel ? 'var(--bd)' : 'var(--bds)', background: isSel ? 'var(--color-card-mint)' : 'var(--bg1)', boxShadow: isSel ? 'var(--shadow-subtle-3)' : 'none' }}>
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="flex h-5 w-5 items-center justify-center rounded-[4px] border" style={{ borderColor: isSel ? 'var(--bd)' : 'var(--bds)', background: isSel ? 'var(--color-accent-green)' : 'var(--bg1)' }}>
                            {isSel && <Check size={11} weight="bold" />}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px]" style={{ color: 'var(--t0)' }}>
                            <span className="font-semibold">{idx + 1}.</span>{' '}
                            <span dangerouslySetInnerHTML={{ __html: q.content.replace(/<[^>]+>/g, ' ').slice(0, 160) }} />
                          </div>
                          <div className="flex gap-1.5 mt-1">
                            <Pill tone={DIFFICULTY_TONE[q.difficulty]}>{DIFFICULTY_LABEL[q.difficulty]}</Pill>
                            {q.chapter && <Pill>{q.chapter}</Pill>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
        </div>

        <div className="bf-modal__footer flex justify-between items-center gap-3 flex-shrink-0">
          <span className="text-[12px]" style={{ color: 'var(--t2)' }}>{visibleQuestions.length}/{bankQs[tab].length} câu đang hiển thị</span>
          <div className="flex gap-2">
            <ActionButton onClick={onClose}>Hủy</ActionButton>
            <ActionButton tone="primary" onClick={() => onConfirm(selected)}>
              <Check size={14} weight="bold" /> Xác nhận ({totalSel} câu)
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXAM SCANNER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function ExamScannerModal({ token, exam, onClose, onSuccess }: {
  token: string
  exam: ExamItem
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      // 1. Upload to R2
      const key = `scans/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { uploadUrl, publicUrl } = await storage.getPresignedUrl(token, key, file.type)
      await storage.uploadFile(uploadUrl, file)

      // 2. Call scan-and-grade
      const res = await exams.scanAndGrade(token, exam._id, publicUrl)
      setResult(res)
    } catch (err: any) {
      alert('Lỗi chấm bài: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="bf-modal w-full max-w-md flex flex-col" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--bd)' }}>
          <div>
            <h3 className="font-bold text-[15px] text-black">Chấm bài bằng Camera</h3>
            <p className="text-[12px] mt-0.5 text-gray-500">{exam.title}</p>
          </div>
          <button onClick={onClose} className="bf-btn bf-btn--icon" title="Đóng" aria-label="Đóng"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!result ? (
            <div className="text-center">
              <label className="bf-btn bf-btn--primary bf-btn--large bf-btn--block cursor-pointer">
                <Camera size={20} />
                {loading ? 'Đang chấm điểm...' : 'Chụp ảnh phiếu TL'}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} disabled={loading} />
              </label>
              <p className="text-[12px] text-gray-500 mt-3">Hãy đặt phiếu làm bài phẳng, đủ sáng và rõ nét SBD/Mã đề để AI nhận diện chính xác nhất.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <div className="text-[24px] font-bold text-green-600">{result.score?.toFixed(2)} điểm</div>
                <div className="text-[13px] text-green-800 mt-1">SBD: {result.sbd || 'Không nhận diện được'} - Mã đề: {result.variantCode}</div>
              </div>
              <div className="text-[12px] text-gray-600 space-y-1">
                <div>P1: {result.scoreBreakdown?.part1Score?.toFixed(2)}đ</div>
                <div>P2: {result.scoreBreakdown?.part2Score?.toFixed(2)}đ</div>
                <div>P3: {result.scoreBreakdown?.part3Score?.toFixed(2)}đ</div>
              </div>
              <button onClick={onSuccess} className="bf-btn bf-btn--primary bf-btn--block">
                Xong
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXAM LIST & CREATE
// ═══════════════════════════════════════════════════════════════════════════════

function ExamList({
  token, subjects, profile,
  onViewResults,
}: {
  token: string
  subjects: ExamSubject[]
  profile: TeacherProfile | null
  onViewResults: (exam: ExamItem) => void
}) {
  const [items, setItems] = useState<ExamItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [publishResult, setPublishResult] = useState<{ accessCode: string; qrUrl: string; qrDataUrl: string; autoSampled?: boolean; counts?: any } | null>(null)
  const [copied, setCopied] = useState(false)
  const [questionSource, setQuestionSource] = useState<'auto' | 'json' | 'bank'>('auto')
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([])
  const [parsingDocx, setParsingDocx] = useState(false)
  const [selectedQs, setSelectedQs] = useState<{ part1: string[]; part2: string[]; part3: string[] }>({ part1: [], part2: [], part3: [] })
  const [showPicker, setShowPicker] = useState(false)
  const [viewingQuestionsExam, setViewingQuestionsExam] = useState<{ id: string; title: string } | null>(null)
  const [scanningExam, setScanningExam] = useState<ExamItem | null>(null)
  const [customTypeLabel, setCustomTypeLabel] = useState('')
  const [form, setForm] = useState({
    title: '', subjectId: '', gradeLevel: 10, examType: 'GK' as string,
    schoolYear: '2025-2026', semester: 1, timeLimit: 90,
    variantCount: 4, defaultSchool: '',
    shuffleQuestions: true, shuffleOptions: false,
    structure: {
      part1Count: 18, part1ScorePerQ: 0.25,
      part1Difficulty: { NHAN_BIET: 6, THONG_HIEU: 6, VAN_DUNG: 4, VAN_DUNG_CAO: 2 },
      part2Count: 4,
      part2Scoring: { correct1: 0, correct2: 0.25, correct3: 0.5, correct4: 1.0 },
      part3Count: 6, part3ScorePerQ: 0.25,
    },
  })

  const load = async () => {
    setLoading(true)
    try {
      const res = await exams.getExams(token, { page: 1, limit: 50 })
      setItems(res.items)
      setTotal(res.total)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  useEffect(() => {
    if (!profile) return
    setForm(f => ({
      ...f,
      defaultSchool: f.defaultSchool || profile.defaultWorkplace || profile.workplaces[0] || '',
      gradeLevel: profile.gradeLevels.includes(f.gradeLevel) ? f.gradeLevel : profile.gradeLevels[0] || 10,
    }))
  }, [profile])

  const handleQuestionFile = async (file: File) => {
    setParsedQuestions([])
    const applyParsedQuestions = (questions: any[]) => {
      setParsedQuestions(questions)
      const part1Count = questions.filter(q => q.type === 'MULTIPLE_CHOICE').length
      const part2Count = questions.filter(q => q.type === 'TRUE_FALSE').length
      const part3Count = questions.filter(q => q.type === 'SHORT_ANSWER').length
      setForm(f => ({
        ...f,
        title: f.title.trim() ? f.title : file.name.replace(/\.(docx|json)$/i, ''),
        structure: {
          ...f.structure,
          part1Count: part1Count || f.structure.part1Count,
          part2Count: part2Count || f.structure.part2Count,
          part3Count: part3Count || f.structure.part3Count,
        },
      }))
    }
    const isDocx = file.name.toLowerCase().endsWith('.docx')
    const isJson = file.name.toLowerCase().endsWith('.json')

    if (isDocx) {
      setParsingDocx(true)
      try {
        const res = await exams.parseDocx(token, file)
        if (!res.questions || res.questions.length === 0) {
          alert('Không tìm thấy câu hỏi nào trong file. Hãy kiểm tra cấu trúc file theo hướng dẫn.')
          return
        }
        applyParsedQuestions(res.questions)
      } catch (err: any) {
        alert('Lỗi đọc file .docx: ' + err.message)
      } finally {
        setParsingDocx(false)
      }
    } else if (isJson) {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const arr = JSON.parse(e.target?.result as string)
          if (!Array.isArray(arr)) throw new Error()
          applyParsedQuestions(arr)
        } catch { alert('File JSON không hợp lệ. Vui lòng dùng file JSON dạng mảng.') }
      }
      reader.readAsText(file)
    } else {
      alert('Chỉ hỗ trợ file .docx hoặc .json')
    }
  }

  const downloadQuestionTemplate = () => {
    const url = URL.createObjectURL(makeQuestionTemplateDocx())
    const a = document.createElement('a')
    a.href = url
    a.download = 'mau-import-cau-hoi-green-exams.docx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const openQuestionTemplateInDocs = async () => {
    try {
      await navigator.clipboard.writeText(WORD_TEMPLATE_TEXT)
    } catch { }
    window.open('https://docs.new', '_blank', 'noopener,noreferrer')
  }

  const handleCreate = async () => {
    if (!form.title.trim() || !form.subjectId) return alert('Nhập tên đề thi và chọn môn học')
    if (questionSource === 'json' && parsedQuestions.length === 0) return alert('Vui lòng upload file Word/JSON trước khi tạo đề.')
    setCreating(true)
    try {
      let qIds = { part1: [] as string[], part2: [] as string[], part3: [] as string[] }

      if (questionSource === 'json' && parsedQuestions.length > 0) {
        const res = await exams.importQuestions(token, {
          questions: parsedQuestions,
          defaultSubjectId: form.subjectId,
          defaultGradeLevel: form.gradeLevel,
        })
        qIds = res.ids || qIds
      } else if (questionSource === 'bank') {
        qIds = selectedQs
      }

      await exams.createExam(token, {
        ...form,
        title: (form.examType === 'CUSTOM' && customTypeLabel.trim()) ? customTypeLabel.trim() : form.title,
        teacherName: profile?.fullName || '',
        teacherProfile: profile ? {
          uid: profile.uid,
          fullName: profile.fullName,
          phone: profile.phone || '',
          position: profile.position || '',
          subjectSpecialization: profile.subjectSpecialization || '',
          workplace: form.defaultSchool,
        } : undefined,
        part1Questions: qIds.part1,
        part2Questions: qIds.part2,
        part3Questions: qIds.part3,
        source: questionSource === 'json' ? 'UPLOAD' : 'MANUAL',
      })
      setForm(f => ({ ...f, title: '' }))
      setCustomTypeLabel('')
      setParsedQuestions([])
      setSelectedQs({ part1: [], part2: [], part3: [] })
      setQuestionSource('auto')
      load()
    } finally { setCreating(false) }
  }

  const handlePublish = async (id: string) => {
    setPublishing(id)
    try {
      const res = await exams.publishExam(token, id)
      const appUrl = window.location.origin
      const fullUrl = `${appUrl}/e/${res.accessCode}`
      const qrDataUrl = await QRCode.toDataURL(fullUrl, { width: 256, margin: 2 })
      setPublishResult({
        accessCode: res.accessCode,
        qrUrl: fullUrl,
        qrDataUrl,
        autoSampled: (res as any).autoSampled,
        counts: (res as any).counts,
      })
      load()
    } catch (err: any) {
      alert('Lỗi publish: ' + err.message)
    } finally { setPublishing(null) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa bài thi này? Tất cả kết quả sẽ bị mất.')) return
    await exams.deleteExam(token, id)
    load()
  }

  const handleClose = async (id: string) => {
    await exams.updateExam(token, id, { status: 'CLOSED' })
    load()
  }

  const copyLink = () => {
    if (!publishResult) return
    navigator.clipboard.writeText(publishResult.qrUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const examTypeLabel: Record<string, string> = { GK: 'Giữa kỳ', CK: 'Cuối kỳ', PRACTICE: 'Luyện tập', TN_THPT: 'TN THPT', CUSTOM: 'Tùy chọn' }

  return (
    <div className="space-y-5">
      {/* Create form */}
      <PanelSection title="Tạo bài thi mới" description="Tạo đề bằng Word, chọn từ ngân hàng hoặc để hệ thống tự lấy câu hỏi">
        <div className="grid grid-cols-1 gap-3 mb-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Tên bài thi *</label>
            <input className={inputCls} style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Đề kiểm tra Giữa kỳ 1 — Toán 12" />
          </div>
          <FormSelect label="Môn học *" value={form.subjectId} placeholder="Chọn môn..." options={[{ value: '', label: 'Chọn môn...' }, ...subjects.map(s => ({ value: s._id, label: s.name }))]} onChange={value => setForm(f => ({ ...f, subjectId: value }))} />
          <FormSelect label="Khối lớp" value={String(form.gradeLevel)} options={(profile?.gradeLevels?.length ? profile.gradeLevels : [10, 11, 12]).map(g => ({ value: String(g), label: `Lớp ${g}` }))} onChange={value => setForm(f => ({ ...f, gradeLevel: Number(value) }))} />
          <div>
            <FormSelect label="Loại kỳ thi" value={form.examType} options={Object.entries(examTypeLabel).map(([value, label]) => ({ value, label }))} onChange={value => { setForm(f => ({ ...f, examType: value })); if (value !== 'CUSTOM') setCustomTypeLabel('') }} />
            {form.examType === 'CUSTOM' && (
              <input className={inputCls} style={{ ...inputStyle, marginTop: '6px' }} placeholder="Nhãn kỳ thi (VD: Kiểm tra 15 phút, Thi thử...)" value={customTypeLabel} onChange={e => setCustomTypeLabel(e.target.value)} />
            )}
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Thời gian làm bài (phút)</label>
            <input type="number" className={inputCls} style={inputStyle} value={form.timeLimit} onChange={e => setForm(f => ({ ...f, timeLimit: Number(e.target.value) }))} />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Số mã đề (101/102/103...)</label>
            <input type="number" min={1} max={10} className={inputCls} style={inputStyle} value={form.variantCount} onChange={e => setForm(f => ({ ...f, variantCount: Number(e.target.value) }))} />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Tên trường mặc định</label>
            {profile?.workplaces?.length ? (
              <FormSelect value={form.defaultSchool} options={profile.workplaces.map(workplace => ({ value: workplace, label: workplace }))} onChange={value => setForm(f => ({ ...f, defaultSchool: value }))} />
            ) : (
              <input className={inputCls} style={inputStyle} value={form.defaultSchool} onChange={e => setForm(f => ({ ...f, defaultSchool: e.target.value }))} placeholder="Cập nhật tại tab Hồ sơ" />
            )}
          </div>
        </div>

        {/* Structure quick-config */}
        <div className="bf-card bf-card--compact bf-card--subtle mb-3">
          <div className="text-[12px] font-semibold mb-2" style={{ color: 'var(--t1)' }}>Cấu trúc đề (BGD 2025)</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className={labelCls} style={{ color: 'var(--t2)' }}>Phần I — Trắc nghiệm</label>
              <input type="number" className={inputCls} style={inputStyle} value={form.structure.part1Count}
                onChange={e => setForm(f => ({ ...f, structure: { ...f.structure, part1Count: Number(e.target.value) } }))} />
              <div className="text-[11px] mt-1" style={{ color: 'var(--t3)' }}>× {form.structure.part1ScorePerQ}đ = {(form.structure.part1Count * form.structure.part1ScorePerQ).toFixed(2)}đ</div>
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--t2)' }}>Phần II — Đúng/Sai</label>
              <input type="number" className={inputCls} style={inputStyle} value={form.structure.part2Count}
                onChange={e => setForm(f => ({ ...f, structure: { ...f.structure, part2Count: Number(e.target.value) } }))} />
              <div className="text-[11px] mt-1" style={{ color: 'var(--t3)' }}>× 1.0đ (4 đúng) = {form.structure.part2Count}.0đ</div>
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--t2)' }}>Phần III — Trả lời ngắn</label>
              <input type="number" className={inputCls} style={inputStyle} value={form.structure.part3Count}
                onChange={e => setForm(f => ({ ...f, structure: { ...f.structure, part3Count: Number(e.target.value) } }))} />
              <div className="text-[11px] mt-1" style={{ color: 'var(--t3)' }}>× {form.structure.part3ScorePerQ}đ = {(form.structure.part3Count * form.structure.part3ScorePerQ).toFixed(2)}đ</div>
            </div>
          </div>
          <div className="mt-2 text-[12px] font-semibold" style={{ color: 'var(--blue)' }}>
            Tổng điểm: {(form.structure.part1Count * form.structure.part1ScorePerQ + form.structure.part2Count + form.structure.part3Count * form.structure.part3ScorePerQ).toFixed(2)} / 10
          </div>
        </div>

        {/* Nguồn câu hỏi */}
        <div className="bf-card bf-card--raised mb-3">
          <div className="mb-3 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <BookBookmark size={16} weight="duotone" style={{ color: 'var(--blue)' }} />
              <span className="text-[13px] font-bold" style={{ color: 'var(--t0)' }}>Câu hỏi cho đề thi</span>
            </div>
            <p className="text-[12px]" style={{ color: 'var(--t2)' }}>
              Chọn cách lấy câu hỏi trước khi tạo đề. Upload Word sẽ tự lưu câu hỏi vào ngân hàng và gắn vào đề.
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            {([
              { id: 'auto' as const, label: 'Tự động', desc: 'Lấy ngẫu nhiên khi publish', icon: Sparkle },
              { id: 'json' as const, label: 'Import đề Word', desc: 'Parse file, lưu NH và tạo đề', icon: FileArrowDown },
              { id: 'bank' as const, label: 'Chọn từ ngân hàng', desc: 'Chọn thủ công từng câu', icon: BookOpen },
            ]).map(option => {
              const isActive = questionSource === option.id
              return (
                <button
                  key={option.id}
                  onClick={() => setQuestionSource(option.id)}
                  className="flex min-h-[64px] items-start gap-3 rounded-[8px] border p-3 text-left transition-transform active:scale-[0.99]"
                  style={{
                    borderColor: isActive ? 'var(--bd)' : 'var(--bds)',
                    background: isActive ? 'var(--color-accent-green)' : 'var(--bg1)',
                    boxShadow: isActive ? 'var(--shadow-subtle-3)' : 'none',
                    color: 'var(--t0)',
                  }}
                >
                  <option.icon className="mt-0.5 flex-shrink-0" size={18} weight={isActive ? 'fill' : 'duotone'} />
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold">{option.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: 'var(--t2)' }}>{option.desc}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-3">
            {questionSource === 'auto' && (
              <div className="rounded-[8px] p-3 text-[12px] leading-relaxed" style={{ background: 'var(--color-card-mint)', border: '1px solid var(--bds)', color: 'var(--t2)' }}>
                Khi publish, hệ thống tự chọn ngẫu nhiên từ ngân hàng câu hỏi theo môn, khối và cấu trúc đề đã cấu hình.
              </div>
            )}

            {questionSource === 'json' && (
              <div className="space-y-3">
                <div className="bf-card bf-card--compact" style={{ background: 'var(--color-card-mint)' }}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <FileArrowDown size={28} weight="duotone" style={{ color: 'var(--green)', flexShrink: 0 }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold" style={{ color: 'var(--t0)' }}>Import đề thi từ Word</div>
                      <div className="text-[11px] leading-relaxed" style={{ color: 'var(--t2)' }}>
                        Hệ thống parse .docx, lưu câu hỏi vào ngân hàng, rồi tạo đề thi từ đúng các câu vừa import.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton onClick={downloadQuestionTemplate}><FileArrowDown size={12} /> Mẫu .docx</ActionButton>
                      <ActionButton onClick={openQuestionTemplateInDocs}><Copy size={12} /> Google Docs</ActionButton>
                    </div>
                  </div>
                </div>

                <div className="rounded-[8px] p-3" style={{ background: 'var(--bg1)', border: '1px solid var(--bds)' }}>
                  <label className={labelCls} style={{ color: 'var(--t2)' }}>Chọn file .docx hoặc .json</label>
                  <input type="file" accept=".json,.docx"
                    className="w-full rounded-[8px] border px-3 py-1.5 text-[13px] file:mr-3 file:rounded-[6px] file:border-0 file:bg-transparent file:text-[12px] file:font-semibold file:cursor-pointer"
                    style={{ borderColor: 'var(--bd)', color: 'var(--t1)', background: 'var(--bg1)' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleQuestionFile(f) }} />
                </div>

                {parsingDocx && (
                  <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--blue)' }}>
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                    Đang phân tích file Word...
                  </div>
                )}
                {parsedQuestions.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-[8px] p-3 text-[12px]" style={{ background: 'rgba(22, 163, 74, 0.08)', border: '1px solid var(--green)', color: 'var(--green)' }}>
                    <Check size={13} weight="bold" />
                    <span>Đã đọc <b>{parsedQuestions.length}</b> câu:</span>
                    <span><b>{parsedQuestions.filter(q => q.type === 'MULTIPLE_CHOICE').length}</b> TN</span>
                    <span><b>{parsedQuestions.filter(q => q.type === 'TRUE_FALSE').length}</b> Đ/S</span>
                    <span><b>{parsedQuestions.filter(q => q.type === 'SHORT_ANSWER').length}</b> Ngắn</span>
                  </div>
                ) : (
                  <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
                    Sau khi upload file, số câu ở cấu trúc đề sẽ tự cập nhật theo nội dung parse được.
                  </p>
                )}
              </div>
            )}

            {questionSource === 'bank' && (
              <div className="bf-card bf-card--compact" style={{ background: 'var(--color-card-lavender)' }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[13px] font-bold" style={{ color: 'var(--t0)' }}>Chọn câu hỏi từ ngân hàng</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--t2)' }}>
                      Chọn đúng số lượng theo cấu trúc đề đã thiết lập ở trên.
                    </div>
                  </div>
                  <ActionButton onClick={() => setShowPicker(true)}>
                    <BookBookmark size={13} /> Mở bộ chọn câu hỏi
                  </ActionButton>
                </div>
                {(selectedQs.part1.length + selectedQs.part2.length + selectedQs.part3.length) > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-[12px]" style={{ color: 'var(--blue)' }}>
                    <Check size={13} weight="bold" />
                    <span>Đã chọn: <b>{selectedQs.part1.length}</b>/{form.structure.part1Count} TN · <b>{selectedQs.part2.length}</b>/{form.structure.part2Count} Đ/S · <b>{selectedQs.part3.length}</b>/{form.structure.part3Count} Ngắn</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <ActionButton tone="primary" onClick={handleCreate} disabled={creating}>
          <Plus size={14} weight="bold" />
          {creating ? 'Đang tạo...' : 'Tạo bài thi'}
        </ActionButton>
      </PanelSection>

      {/* List */}
      <PanelSection
        title={`Danh sách bài thi (${total})`}
        actions={(
          <ActionButton iconOnly title="Tải lại" ariaLabel="Tải lại" onClick={load} disabled={loading}>
            <ArrowsClockwise size={16} className={loading ? 'animate-spin' : ''} />
          </ActionButton>
        )}
      >
        {loading ? <EmptyState>Đang tải...</EmptyState> : items.length === 0 ? <EmptyState>Chưa có bài thi nào</EmptyState> : (
          <div className="space-y-3">
            {items.map(exam => {
              const subj = typeof exam.subjectId === 'object' ? exam.subjectId : subjects.find(s => s._id === exam.subjectId)
              const totalScore = exam.structure
                ? (exam.structure.part1Count * exam.structure.part1ScorePerQ + exam.structure.part2Count + exam.structure.part3Count * exam.structure.part3ScorePerQ).toFixed(1)
                : '10.0'
              return (
                <div key={exam._id} className="bf-card flex flex-col gap-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[14px]" style={{ color: 'var(--t0)' }}>{exam.title}</span>
                        <Pill tone={STATUS_TONE[exam.status]}>{STATUS_LABEL[exam.status]}</Pill>
                        {exam.examType && <Pill>{examTypeLabel[exam.examType] || exam.examType}</Pill>}
                      </div>
                      <div className="flex gap-3 mt-1 text-[12px] flex-wrap" style={{ color: 'var(--t2)' }}>
                        <span>📚 {subj?.name || '—'} · Lớp {exam.gradeLevel}</span>
                        <span>⏱ {exam.timeLimit} phút</span>
                        <span>📄 {exam.structure?.part1Count || 0}+{exam.structure?.part2Count || 0}+{exam.structure?.part3Count || 0} câu</span>
                        <span>🎯 {totalScore}đ</span>
                        <span>🔀 {exam.variantCount} mã đề</span>
                        <span>👥 {exam.sessionCount || 0} lượt thi</span>
                        {(() => {
                          const assigned = (exam.part1Questions?.length || 0) + (exam.part2Questions?.length || 0) + (exam.part3Questions?.length || 0)
                          return assigned > 0
                            ? <span style={{ color: 'var(--green)' }}>✅ {assigned} câu gán sẵn</span>
                            : <span style={{ color: 'var(--t3)' }}>⚡ Câu hỏi tự động</span>
                        })()}
                      </div>
                      {exam.accessCode && (
                        <div className="mt-1 text-[12px] flex items-center gap-1" style={{ color: 'var(--blue)' }}>
                          <Link size={12} />
                          <span className="font-mono">{window.location.origin}/e/{exam.accessCode}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                      <ActionButton onClick={() => window.open(`/admin/exam-print/${exam._id}`, '_blank')}>
                        <ClipboardText size={14} /> In đề
                      </ActionButton>
                      <ActionButton onClick={() => window.open(`/admin/exam-sheet/${exam._id}`, '_blank')}>
                        <ClipboardText size={14} /> In phiếu TL
                      </ActionButton>
                      {exam.status === 'DRAFT' && (
                        <>
                          <ActionButton onClick={() => setViewingQuestionsExam({ id: exam._id, title: exam.title })}>
                            <ListBullets size={14} /> Xem câu hỏi
                          </ActionButton>
                          <ActionButton tone="primary" onClick={() => handlePublish(exam._id)} disabled={publishing === exam._id}>
                            <QrCode size={14} /> {publishing === exam._id ? 'Đang publish...' : 'Publish'}
                          </ActionButton>
                        </>
                      )}
                      {exam.status === 'ACTIVE' && <>
                        <ActionButton onClick={() => handlePublish(exam._id)} disabled={publishing === exam._id}>
                          <QrCode size={14} /> QR
                        </ActionButton>
                        {exam.accessCode && (
                          <ActionButton onClick={() => window.open(`/e/${exam.accessCode}`, '_blank')}>
                            <Eye size={14} /> Xem đề online
                          </ActionButton>
                        )}
                        <ActionButton onClick={() => setScanningExam(exam)}>
                          <Camera size={14} /> Chấm bài
                        </ActionButton>
                        <ActionButton onClick={() => onViewResults(exam)}>
                          <Eye size={14} /> Kết quả
                        </ActionButton>
                        <ActionButton tone="danger" onClick={() => handleClose(exam._id)}>Đóng</ActionButton>
                      </>}
                      {exam.status === 'CLOSED' && (
                        <>
                          <ActionButton onClick={() => setScanningExam(exam)}>
                            <Camera size={14} /> Chấm bài
                          </ActionButton>
                          <ActionButton onClick={() => onViewResults(exam)}>
                            <Eye size={14} /> Kết quả
                          </ActionButton>
                        </>
                      )}
                      <ActionButton tone="danger" iconOnly title="Xóa" ariaLabel="Xóa" onClick={() => handleDelete(exam._id)}><Trash size={14} /></ActionButton>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </PanelSection>

      {viewingQuestionsExam && (
        <ExamQuestionsModal
          token={token}
          examId={viewingQuestionsExam.id}
          examTitle={viewingQuestionsExam.title}
          onClose={() => setViewingQuestionsExam(null)}
        />
      )}

      {scanningExam && (
        <ExamScannerModal
          token={token}
          exam={scanningExam}
          onClose={() => setScanningExam(null)}
          onSuccess={() => { load(); setScanningExam(null) }}
        />
      )}

      {showPicker && (
        <QuestionPickerModal
          token={token}
          subjectId={form.subjectId} gradeLevel={form.gradeLevel}
          structure={form.structure}
          initialSelected={selectedQs}
          onConfirm={s => { setSelectedQs(s); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Publish result modal */}
      {publishResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="bf-modal w-full max-w-md p-6 text-center">
            <h3 className="font-bold text-[16px] mb-1" style={{ color: 'var(--t0)' }}>🎉 Bài thi đã được publish!</h3>
            <p className="text-[13px] mb-4" style={{ color: 'var(--t2)' }}>Chia sẻ link hoặc QR code cho học sinh</p>
            {publishResult?.autoSampled && (
              <div className="bf-card bf-card--compact mb-4 text-left text-[12px]" style={{ background: 'var(--amber-bg,#fffbeb)', borderColor: '#f59e0b', color: '#92400e' }}>
                <span className="font-bold">⚠️ Câu hỏi được lấy tự động từ ngân hàng.</span>
                <span className="ml-1">Hãy kiểm tra ngân hàng câu hỏi để đảm bảo đủ số lượng và đúng môn/khối.</span>
              </div>
            )}
            {publishResult.qrDataUrl && (
              <img src={publishResult.qrDataUrl} alt="QR Code" className="mx-auto mb-4 rounded-[8px]" style={{ width: 200, height: 200 }} />
            )}
            <div className="rounded-[8px] border px-3 py-2 text-[13px] font-mono mb-3 text-left break-all" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)', color: 'var(--blue)' }}>
              {publishResult.qrUrl}
            </div>
            <div className="flex gap-2 justify-center">
              <ActionButton tone="primary" onClick={copyLink}>
                <Copy size={14} /> {copied ? 'Đã copy!' : 'Copy link'}
              </ActionButton>
              <ActionButton onClick={() => setPublishResult(null)}>Đóng</ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RESULTS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function ResultsPanel({ token, examId, examTitle, onBack }: { token: string; examId: string; examTitle: string; onBack: () => void }) {
  const [sessions, setSessions] = useState<ExamSessionResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [aiFraudReport, setAiFraudReport] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    exams.getResults(token, examId).then(res => {
      setSessions(res.sessions)
      setTotal(res.total)
    }).finally(() => setLoading(false))
  }, [token, examId])

  const avg = sessions.length > 0 ? (sessions.reduce((a, s) => a + (s.score || 0), 0) / sessions.length).toFixed(2) : '—'
  const pass = sessions.filter(s => (s.score || 0) >= 5).length

  const analyzeCheating = async () => {
    if (sessions.length === 0) return
    setAiLoading(true)
    try {
      const res = await examAI.detectCheating({
        examTitle,
        students: sessions.map(s => ({
          name: s.studentInfo?.fullName,
          score: s.score || 0,
          timeSpent: s.timeSpent || 0,
          answeredCount: (s as any).answeredCount || 0,
          totalQuestions: (s as any).totalQuestions || 0,
        })),
      })
      setAiFraudReport(res.analysis || '')
    } catch (e: any) {
      setAiFraudReport(`Không thể phân tích gian lận: ${e.message || 'Lỗi hệ thống'}`)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ActionButton onClick={onBack}><ArrowLeft size={14} /> Quay lại</ActionButton>
        <h3 className="font-bold text-[15px]" style={{ color: 'var(--t0)' }}>{examTitle}</h3>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Tổng lượt thi" value={total} accent="var(--blue)" />
        <StatCard label="Điểm TB" value={avg} accent="var(--green)" />
        <StatCard label="Đạt ≥5đ" value={pass} accent="var(--amber)" />
        <StatCard label="Tỉ lệ đạt" value={total > 0 ? `${Math.round(pass / total * 100)}%` : '—'} accent="var(--purple)" />
      </div>

      <div className="flex items-center gap-2">
        <ActionButton onClick={analyzeCheating} disabled={aiLoading || sessions.length === 0}>
          {aiLoading ? 'AI đang phân tích...' : 'AI phát hiện bất thường / gian lận'}
        </ActionButton>
      </div>

      {aiFraudReport ? (
        <div className="bf-card bf-card--compact text-[13px]" style={{ color: 'var(--t1)' }}>
          <div className="mb-1 text-[12px] font-semibold" style={{ color: 'var(--t0)' }}>Báo cáo AI</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{aiFraudReport}</div>
        </div>
      ) : null}

      {loading ? <EmptyState>Đang tải...</EmptyState> : sessions.length === 0 ? <EmptyState>Chưa có học sinh nào thi</EmptyState> : (
        <DataTable>
          <table className="min-w-full text-left text-[13px]">
            <thead style={{ background: 'var(--bg1)', color: 'var(--t2)' }}>
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Họ và tên</th>
                <th className="px-4 py-3 font-semibold">Lớp</th>
                <th className="px-4 py-3 font-semibold">Trường</th>
                <th className="px-4 py-3 font-semibold">Mã đề</th>
                <th className="px-4 py-3 font-semibold">Điểm</th>
                <th className="px-4 py-3 font-semibold">P1 / P2 / P3</th>
                <th className="px-4 py-3 font-semibold">Tg làm bài</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={s._id} className="border-t" style={{ borderColor: 'var(--bds)' }}>
                  <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--t3)' }}>{i + 1}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--t0)' }}>{s.studentInfo.fullName}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--t1)' }}>{s.studentInfo.className}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--t2)' }}>{s.studentInfo.school}</td>
                  <td className="px-4 py-3"><Pill>{s.variantCode}</Pill></td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-[15px]" style={{ color: (s.score || 0) >= 5 ? 'var(--green)' : 'var(--red)' }}>
                      {s.score?.toFixed(2) ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--t2)' }}>
                    {s.scoreBreakdown ? `${s.scoreBreakdown.part1Score.toFixed(2)} / ${s.scoreBreakdown.part2Score.toFixed(2)} / ${s.scoreBreakdown.part3Score.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--t2)' }}>{fmtTime(s.timeSpent)}</td>
                  <td className="px-4 py-3">
                    <Pill tone={s.status === 'SUBMITTED' ? 'green' : 'amber'}>{s.status === 'SUBMITTED' ? 'Đã nộp' : s.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STUDENT DASHBOARD (THEO NĂM HỌC)
// ═══════════════════════════════════════════════════════════════════════════════

function StudentDashboard({ token }: { token: string }) {
  const [students, setStudents] = useState<ExamStudent[]>([])
  const [report, setReport] = useState<ExamResultReport | null>(null)
  const [scoreColumns, setScoreColumns] = useState<string[]>([])
  const [filterOptions, setFilterOptions] = useState({ academicYears: [] as string[], classNames: [] as string[], schools: [] as string[] })
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<ExamStudent | null>(null)
  const [studentResults, setStudentResults] = useState<ExamStudentResultItem[]>([])
  const [loadingResults, setLoadingResults] = useState(false)

  const [filters, setFilters] = useState({
    academicYear: '',
    className: '',
    school: '',
    examType: '',
    customExamLabel: '',
    keyword: '',
  })

  const [newStudent, setNewStudent] = useState({
    fullName: '',
    className: '',
    academicYear: '',
    school: '',
  })
  const [savingStudent, setSavingStudent] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setErrorMsg('')
    try {
      const [st, rp] = await Promise.all([
        exams.getStudents(token, { ...filters, page: 1, limit: 200 }),
        exams.getResultReport(token, {
          academicYear: filters.academicYear || undefined,
          className: filters.className || undefined,
          school: filters.school || undefined,
          examType: filters.examType || undefined,
          customExamLabel: filters.examType === 'CUSTOM' ? (filters.customExamLabel || undefined) : undefined,
        }),
      ])
      setStudents(st.items)
      setScoreColumns(st.scoreColumns)
      setFilterOptions(st.filterOptions)
      setReport(rp)
    } catch (err: any) {
      setStudents([])
      setScoreColumns([])
      setReport({ totalResults: 0, avgScore: 0, maxScore: 0, minScore: 0, passRate: 0, topResults: [] })
      setErrorMsg(err?.message || 'Không tải được dashboard học sinh')
    } finally {
      setLoading(false)
    }
  }, [token, filters])

  const loadStudentResults = useCallback(async (student: ExamStudent) => {
    setSelectedStudent(student)
    setLoadingResults(true)
    setErrorMsg('')
    try {
      const res = await exams.getStudentResults(token, student._id, {
        academicYear: filters.academicYear || undefined,
        page: 1,
        limit: 100,
      })
      setStudentResults(res.items)
    } catch (err: any) {
      setStudentResults([])
      setErrorMsg(err?.message || 'Không tải được kết quả học sinh')
    } finally {
      setLoadingResults(false)
    }
  }, [token, filters.academicYear])

  useEffect(() => { load() }, [load])

  const addStudent = async () => {
    if (!newStudent.fullName || !newStudent.className || !newStudent.academicYear) return
    setSavingStudent(true)
    setErrorMsg('')
    try {
      await exams.createStudent(token, {
        fullName: newStudent.fullName.trim(),
        className: newStudent.className.trim(),
        academicYear: newStudent.academicYear.trim(),
        school: newStudent.school.trim() || 'GDTX Lê Quí Đôn',
      })
      setNewStudent({ fullName: '', className: '', academicYear: '', school: '' })
      await load()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thêm được học sinh')
    } finally {
      setSavingStudent(false)
    }
  }

  return (
    <div className="space-y-5">
      <PanelSection title="Dashboard học sinh" description="Quản lý học sinh theo năm học và theo dõi kết quả thi đã lưu">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          <FormSelect
            value={filters.academicYear}
            onChange={value => setFilters(f => ({ ...f, academicYear: value }))}
            options={[{ value: '', label: 'Tất cả năm học' }, ...filterOptions.academicYears.map(year => ({ value: year, label: year }))]}
          />
          <FormSelect
            value={filters.className}
            onChange={value => setFilters(f => ({ ...f, className: value }))}
            options={[{ value: '', label: 'Tất cả lớp' }, ...filterOptions.classNames.map(className => ({ value: className, label: className }))]}
          />
          <FormSelect
            value={filters.school}
            onChange={value => setFilters(f => ({ ...f, school: value }))}
            options={[{ value: '', label: 'Tất cả trường' }, ...filterOptions.schools.map(school => ({ value: school, label: school }))]}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          <FormSelect
            value={filters.examType}
            onChange={value => setFilters(f => ({ ...f, examType: value, customExamLabel: value === 'CUSTOM' ? f.customExamLabel : '' }))}
            options={STUDENT_EXAM_TYPE_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
          />
          {filters.examType === 'CUSTOM' && (
            <input className={inputCls} style={inputStyle} placeholder="Nhập tên kỳ thi custom" value={filters.customExamLabel} onChange={e => setFilters(f => ({ ...f, customExamLabel: e.target.value }))} />
          )}
          <input className={inputCls} style={inputStyle} placeholder="Tìm theo tên" value={filters.keyword} onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))} />
        </div>
        <div className="flex gap-2 mb-4">
          <ActionButton tone="primary" onClick={load}>Lọc dữ liệu</ActionButton>
          <ActionButton onClick={() => {
            setFilters({ academicYear: '', className: '', school: '', examType: '', customExamLabel: '', keyword: '' })
          }}>Xóa lọc</ActionButton>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="Số học sinh" value={students.length} accent="var(--blue)" />
          <StatCard label="Tổng kết quả" value={report?.totalResults ?? 0} accent="var(--green)" />
          <StatCard label="Điểm trung bình" value={report?.avgScore ?? 0} accent="var(--amber)" />
          <StatCard label="Tỉ lệ đạt" value={`${report?.passRate ?? 0}%`} accent="var(--purple)" />
        </div>

        {errorMsg && (
          <div className="bf-card bf-card--compact mb-4 text-[12px]" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'var(--red)', color: 'var(--red)' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {loading ? <EmptyState>Đang tải danh sách học sinh...</EmptyState> : (
          <DataTable>
            <table className="min-w-full text-left text-[13px]">
              <thead style={{ background: 'var(--bg1)', color: 'var(--t2)' }}>
                <tr>
                  <th className="px-4 py-3 font-semibold">Họ và tên học sinh</th>
                  {scoreColumns.map(column => (
                    <th key={column} className="px-4 py-3 font-semibold whitespace-nowrap">{column}</th>
                  ))}
                  <th className="px-4 py-3 font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s._id} className="border-t" style={{ borderColor: 'var(--bds)' }}>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: 'var(--t0)' }}>{s.fullName}</div>
                      <div className="text-[11px]" style={{ color: 'var(--t3)' }}>{s.className} • {s.academicYear} • {s.school}</div>
                    </td>
                    {scoreColumns.map(column => {
                      const cell = s.scoresByExamType?.[column]
                      return (
                        <td key={`${s._id}-${column}`} className="px-4 py-3">
                          {cell ? (
                            <div>
                              <div className="font-bold text-[14px]" style={{ color: cell.score >= 5 ? 'var(--green)' : 'var(--red)' }}>{cell.score.toFixed(2)}</div>
                              <div className="text-[11px]" style={{ color: 'var(--t3)' }}>{cell.examTitle}</div>
                            </div>
                          ) : <span style={{ color: 'var(--t3)' }}>—</span>}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3">
                      <ActionButton onClick={() => loadStudentResults(s)}>
                        <Eye size={14} /> Xem điểm
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        )}
      </PanelSection>

      <PanelSection title="Thêm học sinh" description="Tạo nhanh học sinh thủ công nếu chưa có dữ liệu thi">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className={inputCls} style={inputStyle} placeholder="Họ và tên học sinh" value={newStudent.fullName} onChange={e => setNewStudent(v => ({ ...v, fullName: e.target.value }))} />
          <input className={inputCls} style={inputStyle} placeholder="Lớp" value={newStudent.className} onChange={e => setNewStudent(v => ({ ...v, className: e.target.value }))} />
          <input className={inputCls} style={inputStyle} placeholder="Năm học" value={newStudent.academicYear} onChange={e => setNewStudent(v => ({ ...v, academicYear: e.target.value }))} />
          <input className={inputCls} style={inputStyle} placeholder="Trường" value={newStudent.school} onChange={e => setNewStudent(v => ({ ...v, school: e.target.value }))} />
        </div>
        <div className="mt-3">
          <ActionButton tone="primary" onClick={addStudent} disabled={savingStudent || !newStudent.fullName || !newStudent.className || !newStudent.academicYear}>
            <Plus size={14} /> {savingStudent ? 'Đang lưu...' : 'Thêm học sinh'}
          </ActionButton>
        </div>
      </PanelSection>

      {selectedStudent && (
        <PanelSection title={`Kết quả thi: ${selectedStudent.fullName}`} description={`${selectedStudent.className} • ${selectedStudent.academicYear} • ${selectedStudent.school}`}>
          {loadingResults ? <EmptyState>Đang tải kết quả...</EmptyState> : studentResults.length === 0 ? <EmptyState>Chưa có kết quả thi</EmptyState> : (
            <DataTable>
              <table className="min-w-full text-left text-[13px]">
                <thead style={{ background: 'var(--bg1)', color: 'var(--t2)' }}>
                  <tr>
                    <th className="px-4 py-3 font-semibold">Bài thi</th>
                    <th className="px-4 py-3 font-semibold">Loại kỳ thi</th>
                    <th className="px-4 py-3 font-semibold">Điểm</th>
                    <th className="px-4 py-3 font-semibold">%</th>
                    <th className="px-4 py-3 font-semibold">Đã làm</th>
                    <th className="px-4 py-3 font-semibold">Chưa làm</th>
                    <th className="px-4 py-3 font-semibold">Thời gian</th>
                    <th className="px-4 py-3 font-semibold">Nộp lúc</th>
                  </tr>
                </thead>
                <tbody>
                  {studentResults.map(r => (
                    <tr key={r._id} className="border-t" style={{ borderColor: 'var(--bds)' }}>
                      <td className="px-4 py-3" style={{ color: 'var(--t1)' }}>{typeof r.examId === 'string' ? r.examId : (r.examId?.title || '—')}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--t1)' }}>{getStudentExamTypeLabel(typeof r.examId === 'string' ? undefined : r.examId)}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: r.score >= 5 ? 'var(--green)' : 'var(--red)' }}>{r.score.toFixed(2)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--t1)' }}>{r.percentage.toFixed(2)}%</td>
                      <td className="px-4 py-3" style={{ color: 'var(--t1)' }}>{r.answeredCount}/{r.totalQuestions}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--t2)' }}>{r.unansweredCount}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--t2)' }}>{fmtTime(r.timeSpentSeconds)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--t2)' }}>{new Date(r.submittedAt).toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )}
        </PanelSection>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EDUCATION VISUALS, GUIDE & FEEDBACK
// ═══════════════════════════════════════════════════════════════════════════════

function BrainfishVisualCard({
  icon: Icon,
  title,
  desc,
  tone = 'mint',
}: {
  icon: any
  title: string
  desc: string
  tone?: 'mint' | 'lavender' | 'saffron' | 'pink'
}) {
  const bg = {
    mint: 'var(--color-card-mint)',
    lavender: 'var(--color-card-lavender)',
    saffron: 'var(--color-card-saffron)',
    pink: 'var(--color-card-pink)',
  }[tone]
  return (
    <div className="bf-card bf-card--raised" style={{ background: bg }}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[4px] border" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
        <Icon size={24} weight="duotone" />
      </div>
      <div className="text-[14px] font-bold" style={{ color: 'var(--t0)' }}>{title}</div>
      <div className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--t2)' }}>{desc}</div>
    </div>
  )
}

function GuidePanel() {
  const guideSections = [
    {
      title: 'Thiết lập ban đầu',
      icon: UserCircle,
      tone: 'mint' as const,
      items: [
        'Vào tab Hồ sơ để nhập họ tên, trường công tác và khối lớp giảng dạy.',
        'Vào Tổng quan để thêm môn học trước khi tạo câu hỏi hoặc đề thi.',
        'Mỗi tài khoản admin có dữ liệu riêng theo tài khoản đăng nhập.',
      ],
    },
    {
      title: 'Ngân hàng câu hỏi',
      icon: BookOpen,
      tone: 'lavender' as const,
      items: [
        'Tạo câu hỏi thủ công hoặc dùng AI để sinh/parse câu hỏi.',
        'Gắn môn, khối lớp, loại câu và mức độ để hệ thống lọc chính xác.',
        'Khi xóa câu hỏi, hệ thống ẩn câu hỏi khỏi danh sách thay vì làm mất dữ liệu liên quan.',
      ],
    },
    {
      title: 'Tạo và phát đề thi',
      icon: ClipboardText,
      tone: 'saffron' as const,
      items: [
        'Vào Đề thi, chọn môn, khối, trường mặc định và cấu trúc điểm.',
        'Chọn nguồn câu hỏi: tự động từ ngân hàng, upload JSON/Word hoặc chọn thủ công.',
        'Bấm Publish để tạo mã truy cập và QR cho học sinh làm bài.',
      ],
    },
    {
      title: 'Chấm bài và kết quả',
      icon: ChartBar,
      tone: 'pink' as const,
      items: [
        'Theo dõi điểm và lượt thi trong tab Kết quả.',
        'Dùng AI phân tích lớp để phát hiện điểm bất thường hoặc nhóm cần hỗ trợ.',
        'Xuất báo cáo PDF ở tab Phân tích khi cần tổng hợp cho lớp/trường.',
      ],
    },
    {
      title: 'Quiz, Poll và Flashcard',
      icon: GameController,
      tone: 'mint' as const,
      items: [
        'Quiz Live dùng cho kiểm tra nhanh theo thời gian thực.',
        'Poll Live dùng để khảo sát ý kiến hoặc kiểm tra hiểu bài.',
        'Flashcard SRS giúp học sinh ôn tập lặp lại theo mức độ nhớ.',
      ],
    },
    {
      title: 'Thực hành an toàn',
      icon: Key,
      tone: 'lavender' as const,
      items: [
        'Đổi mật khẩu định kỳ trong tab Hồ sơ.',
        'Không chia sẻ tài khoản admin cho học sinh.',
        'Kiểm tra kỹ đề và đáp án trước khi publish cho lớp làm bài.',
      ],
    },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BrainfishVisualCard icon={ClipboardText} title="Soạn đề nhanh" desc="Chuẩn hóa câu hỏi, tự động lấy từ ngân hàng và xuất mã thi cho lớp." tone="mint" />
        <BrainfishVisualCard icon={QrCode} title="Lớp học realtime" desc="Chia sẻ QR, tổ chức quiz/poll và theo dõi học sinh tham gia ngay trên màn hình." tone="lavender" />
        <BrainfishVisualCard icon={Sparkle} title="AI hỗ trợ giáo viên" desc="Sinh câu hỏi, parse đề, giải thích đáp án và phân tích kết quả lớp học." tone="saffron" />
      </div>

      <PanelSection title="Hướng dẫn sử dụng theo chức năng" description="Các bước thực tế để giáo viên vận hành toàn bộ app">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {guideSections.map(section => (
            <div key={section.title} className="bf-card">
              <div className="mb-3 flex items-center gap-2">
                <span className={`bf-tag bf-tag--${section.tone === 'mint' ? 'green' : section.tone === 'lavender' ? 'blue' : section.tone === 'saffron' ? 'amber' : 'red'}`}>
                  <section.icon size={15} /> {section.title}
                </span>
              </div>
              <ol className="space-y-2 text-[13px]" style={{ color: 'var(--t1)' }}>
                {section.items.map((item, idx) => (
                  <li key={item} className="flex gap-2">
                    <span className="font-bold" style={{ color: 'var(--t0)' }}>{idx + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </PanelSection>
    </div>
  )
}

function FeedbackPanel() {
  const [form, setForm] = useState({
    type: 'FEATURE' as 'BUG' | 'FEATURE' | 'CONTENT' | 'UX' | 'OTHER',
    priority: 'NORMAL' as 'LOW' | 'NORMAL' | 'HIGH',
    title: '',
    message: '',
    contactBack: true,
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.title.trim() || !form.message.trim()) return setError('Vui lòng nhập tiêu đề và nội dung góp ý.')
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await feedback.create({ ...form, page: typeof window !== 'undefined' ? window.location.pathname : '/admin' })
      setForm(f => ({ ...f, title: '', message: '' }))
      setMessage('Cảm ơn thầy/cô. Góp ý đã được ghi nhận.')
    } catch (err: any) {
      setError(err.message || 'Không thể gửi góp ý.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BrainfishVisualCard icon={ChatCircleText} title="Góp ý nhanh" desc="Gửi lỗi, đề xuất tính năng hoặc phản hồi trải nghiệm trong lúc sử dụng." tone="mint" />
        <BrainfishVisualCard icon={Lightbulb} title="Ưu tiên giáo viên" desc="Các góp ý thực tế từ lớp học sẽ giúp ưu tiên cải tiến đúng nhu cầu." tone="saffron" />
        <BrainfishVisualCard icon={PaperPlaneTilt} title="Theo dõi phản hồi" desc="Nếu chọn liên hệ lại, đội ngũ có thể trao đổi thêm qua email tài khoản." tone="lavender" />
      </div>

      {(message || error) && (
        <div className="rounded-[8px] border px-4 py-3 text-[13px] font-semibold"
          style={{ borderColor: 'var(--bd)', background: error ? 'var(--color-card-pink)' : 'var(--color-card-mint)', color: 'var(--t0)' }}>
          {error || message}
        </div>
      )}

      <PanelSection title="Gửi góp ý" description="Thu thập phản hồi của giáo viên để cải thiện hệ thống">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <FormSelect
              label="Loại góp ý"
              value={form.type}
              onChange={value => setForm(f => ({ ...f, type: value as any }))}
              options={[
                { value: 'FEATURE', label: 'Đề xuất tính năng' },
                { value: 'BUG', label: 'Báo lỗi' },
                { value: 'CONTENT', label: 'Câu hỏi/nội dung học tập' },
                { value: 'UX', label: 'Trải nghiệm sử dụng' },
                { value: 'OTHER', label: 'Khác' },
              ]}
            />
          </div>
          <div>
            <FormSelect
              label="Mức độ"
              value={form.priority}
              onChange={value => setForm(f => ({ ...f, priority: value as any }))}
              options={[
                { value: 'LOW', label: 'Thấp' },
                { value: 'NORMAL', label: 'Bình thường' },
                { value: 'HIGH', label: 'Cần xử lý sớm' },
              ]}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Tiêu đề *</label>
            <input className={inputCls} style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Cần thêm mẫu đề kiểm tra 15 phút" />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Nội dung góp ý *</label>
            <textarea rows={6} className={inputCls} style={inputStyle} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Mô tả rõ vấn đề, mong muốn hoặc tình huống sử dụng thực tế..." />
          </div>
          <label className="flex items-center gap-2 text-[13px] md:col-span-2" style={{ color: 'var(--t1)' }}>
            <input type="checkbox" checked={form.contactBack} onChange={e => setForm(f => ({ ...f, contactBack: e.target.checked }))} />
            Có thể liên hệ lại với tôi qua email tài khoản
          </label>
        </div>
        <div className="mt-4">
          <ActionButton tone="primary" onClick={submit} disabled={saving}>
            <PaperPlaneTilt size={14} /> {saving ? 'Đang gửi...' : 'Gửi góp ý'}
          </ActionButton>
        </div>
      </PanelSection>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TEACHER PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

function TeacherProfilePanel({ profile, onSaved }: { profile: TeacherProfile | null; onSaved: (profile: TeacherProfile) => void }) {
  const setUser = useAuthStore(s => s.setUser)
  const currentUser = useAuthStore(s => s.user)
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    position: '',
    subjectSpecialization: '',
    workplaces: [] as string[],
    defaultWorkplace: '',
    gradeLevels: [10, 11, 12] as number[],
    bio: '',
  })
  const [newWorkplace, setNewWorkplace] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    if (!profile) return
    setForm({
      fullName: profile.fullName || '',
      phone: profile.phone || '',
      position: profile.position || '',
      subjectSpecialization: profile.subjectSpecialization || '',
      workplaces: profile.workplaces || [],
      defaultWorkplace: profile.defaultWorkplace || '',
      gradeLevels: profile.gradeLevels?.length ? profile.gradeLevels : [10, 11, 12],
      bio: profile.bio || '',
    })
  }, [profile])

  const addWorkplace = () => {
    const value = newWorkplace.trim()
    if (!value || form.workplaces.includes(value)) return
    setForm(f => ({
      ...f,
      workplaces: [...f.workplaces, value],
      defaultWorkplace: f.defaultWorkplace || value,
    }))
    setNewWorkplace('')
  }

  const removeWorkplace = (value: string) => {
    setForm(f => {
      const workplaces = f.workplaces.filter(item => item !== value)
      return {
        ...f,
        workplaces,
        defaultWorkplace: f.defaultWorkplace === value ? workplaces[0] || '' : f.defaultWorkplace,
      }
    })
  }

  const toggleGrade = (grade: number) => {
    setForm(f => ({
      ...f,
      gradeLevels: f.gradeLevels.includes(grade)
        ? f.gradeLevels.filter(item => item !== grade)
        : [...f.gradeLevels, grade].sort(),
    }))
  }

  const saveProfile = async () => {
    if (!form.fullName.trim()) return setError('Vui lòng nhập họ tên.')
    if (form.gradeLevels.length === 0) return setError('Vui lòng chọn ít nhất một khối lớp giảng dạy.')
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const saved = await profiles.updateCurrent(form)
      if (currentUser) setUser({ ...currentUser, name: saved.fullName })
      onSaved(saved)
      setMessage('Đã lưu hồ sơ giáo viên.')
    } catch (err: any) {
      setError(err.message || 'Không thể lưu hồ sơ.')
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    setError('')
    setMessage('')
    if (passwords.next.length < 6) return setError('Mật khẩu mới phải có ít nhất 6 ký tự.')
    if (passwords.next !== passwords.confirm) return setError('Mật khẩu xác nhận không khớp.')
    setChangingPassword(true)
    try {
      await auth.changePassword(passwords.current, passwords.next)
      setPasswords({ current: '', next: '', confirm: '' })
      setMessage('Đã đổi mật khẩu.')
    } catch (err: any) {
      const code = err?.code || ''
      setError(code === 'auth/invalid-credential'
        ? 'Mật khẩu hiện tại không đúng.'
        : code === 'auth/weak-password'
          ? 'Mật khẩu mới chưa đủ mạnh.'
          : err.message || 'Không thể đổi mật khẩu.')
    } finally {
      setChangingPassword(false)
    }
  }

  if (!profile) return <EmptyState>Đang tải hồ sơ...</EmptyState>

  return (
    <div className="space-y-5">
      {(message || error) && (
        <div className="rounded-[8px] border px-4 py-3 text-[13px] font-semibold"
          style={{ borderColor: 'var(--bd)', background: error ? 'var(--color-card-pink)' : 'var(--color-card-mint)', color: 'var(--t0)' }}>
          {error || message}
        </div>
      )}

      <PanelSection title="Thông tin giáo viên" description="Thông tin này sẽ tự động áp dụng khi tạo đề thi mới">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Họ tên *</label>
            <input className={inputCls} style={inputStyle} value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Nguyễn Văn A" />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Email đăng nhập</label>
            <input className={inputCls} style={{ ...inputStyle, opacity: 0.65 }} value={profile.email} disabled />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Số điện thoại</label>
            <input className={inputCls} style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="09xx xxx xxx" />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Chức vụ / vai trò</label>
            <input className={inputCls} style={inputStyle} value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="Giáo viên, Tổ trưởng chuyên môn..." />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Môn giảng dạy / chuyên môn</label>
            <input className={inputCls} style={inputStyle} value={form.subjectSpecialization} onChange={e => setForm(f => ({ ...f, subjectSpecialization: e.target.value }))} placeholder="Toán học, Vật lý..." />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Giới thiệu ngắn</label>
            <textarea rows={3} className={inputCls} style={inputStyle} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Thông tin bổ sung về giáo viên..." />
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Đơn vị công tác" description="Có thể thêm nhiều trường hoặc trung tâm đang giảng dạy">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={inputCls} style={inputStyle} value={newWorkplace} onChange={e => setNewWorkplace(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addWorkplace() }} placeholder="Tên trường / đơn vị công tác" />
          <ActionButton tone="primary" onClick={addWorkplace} disabled={!newWorkplace.trim()}><Plus size={14} /> Thêm đơn vị</ActionButton>
        </div>
        <div className="mt-3 grid gap-2">
          {form.workplaces.map(workplace => (
            <div key={workplace} className="bf-list-card flex items-center gap-3 p-3">
              <Buildings size={18} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{workplace}</span>
              <ActionButton iconOnly tone="danger" title="Xóa đơn vị" ariaLabel="Xóa đơn vị" onClick={() => removeWorkplace(workplace)}><Trash size={14} /></ActionButton>
            </div>
          ))}
          {form.workplaces.length === 0 && <EmptyState>Chưa có đơn vị công tác.</EmptyState>}
        </div>
        {form.workplaces.length > 0 && (
          <div className="mt-3">
            <FormSelect
              label="Đơn vị mặc định khi tạo đề"
              value={form.defaultWorkplace}
              onChange={value => setForm(f => ({ ...f, defaultWorkplace: value }))}
              options={form.workplaces.map(workplace => ({ value: workplace, label: workplace }))}
            />
          </div>
        )}
      </PanelSection>

      <PanelSection title="Khối lớp giảng dạy" description="Hiện hệ thống hỗ trợ khối THPT 10, 11 và 12">
        <div className="grid grid-cols-3 gap-3">
          {[10, 11, 12].map(grade => (
            <button key={grade} onClick={() => toggleGrade(grade)}
              className={`bf-btn bf-btn--large ${form.gradeLevels.includes(grade) ? 'bf-btn--primary' : ''}`}>
              {form.gradeLevels.includes(grade) && <Check size={15} weight="bold" />} Khối {grade}
            </button>
          ))}
        </div>
      </PanelSection>

      <div className="bf-card bf-card--raised" style={{ background: 'var(--color-card-mint)' }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[14px] font-bold" style={{ color: 'var(--t0)' }}>Lưu toàn bộ chỉnh sửa hồ sơ</div>
            <div className="mt-1 text-[12px]" style={{ color: 'var(--t2)' }}>
              Áp dụng thông tin cá nhân, đơn vị công tác và khối lớp giảng dạy cho các lần tạo đề tiếp theo.
            </div>
          </div>
          <ActionButton tone="primary" onClick={saveProfile} disabled={saving} className="w-full sm:w-auto">
            <Check size={14} weight="bold" /> {saving ? 'Đang lưu...' : 'Lưu toàn bộ hồ sơ'}
          </ActionButton>
        </div>
      </div>

      <PanelSection title="Đổi mật khẩu" description="Nhập mật khẩu hiện tại để xác nhận thay đổi">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Mật khẩu hiện tại</label>
            <input type="password" className={inputCls} style={inputStyle} value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Mật khẩu mới</label>
            <input type="password" className={inputCls} style={inputStyle} value={passwords.next} onChange={e => setPasswords(p => ({ ...p, next: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--t2)' }}>Xác nhận mật khẩu mới</label>
            <input type="password" className={inputCls} style={inputStyle} value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} />
          </div>
        </div>
        <div className="mt-4">
          <ActionButton onClick={changePassword} disabled={changingPassword || !passwords.current || !passwords.next || !passwords.confirm}>
            <Key size={14} /> {changingPassword ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </ActionButton>
        </div>
      </PanelSection>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SUBJECT MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

function SubjectManager({ token, subjects, onReload }: { token: string; subjects: ExamSubject[]; onReload: () => void }) {
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [busyId, setBusyId] = useState('')

  const handleAdd = async () => {
    if (!newName.trim() || !newCode.trim()) return
    setSaving(true)
    try {
      await exams.createSubject(token, { name: newName.trim(), code: newCode.trim().toUpperCase(), gradeLevels: [10, 11, 12], isActive: true })
      setNewName(''); setNewCode('')
      onReload()
    } finally { setSaving(false) }
  }

  const startEdit = (subject: ExamSubject) => {
    setEditingId(subject._id)
    setEditName(subject.name || '')
    setEditCode(subject.code || '')
  }

  const cancelEdit = () => {
    setEditingId('')
    setEditName('')
    setEditCode('')
  }

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim() || !editCode.trim()) return
    setBusyId(id)
    try {
      await exams.updateSubject(token, id, {
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
      } as Partial<ExamSubject>)
      cancelEdit()
      onReload()
    } finally {
      setBusyId('')
    }
  }

  const handleDelete = async (subject: ExamSubject) => {
    if (!confirm(`Xóa môn "${subject.name}" khỏi danh sách?`)) return
    setBusyId(subject._id)
    try {
      await exams.deleteSubject(token, subject._id)
      onReload()
    } finally {
      setBusyId('')
    }
  }

  return (
    <PanelSection title="Quản lý môn học" description="Thêm môn học để phân loại câu hỏi và đề thi">
      <div className="flex flex-col gap-2 mb-4 sm:flex-row">
        <input className={inputCls} style={{ ...inputStyle, flex: 2 }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Tên môn (VD: Toán)" />
        <input className={inputCls} style={{ ...inputStyle, flex: 1 }} value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="Mã (VD: MATH)" />
        <ActionButton tone="primary" onClick={handleAdd} disabled={saving || !newName || !newCode}>
          <Plus size={14} weight="bold" /> {saving ? '...' : 'Thêm'}
        </ActionButton>
      </div>
      <div className="grid gap-2">
        {subjects.map(s => (
          <div key={s._id} className="bf-list-card flex flex-col gap-2 p-2 sm:flex-row sm:items-center"
            style={{ borderColor: 'var(--bd)', background: 'var(--bg1)', color: 'var(--t1)' }}>
            {editingId === s._id ? (
              <>
                <input
                  className={inputCls}
                  style={{ ...inputStyle, flex: 2 }}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Tên môn"
                />
                <input
                  className={inputCls}
                  style={{ ...inputStyle, flex: 1 }}
                  value={editCode}
                  onChange={e => setEditCode(e.target.value)}
                  placeholder="Mã"
                />
                <div className="flex gap-2">
                  <ActionButton tone="primary" onClick={() => handleSaveEdit(s._id)} disabled={busyId === s._id || !editName.trim() || !editCode.trim()}>
                    <Check size={14} weight="bold" /> Lưu
                  </ActionButton>
                  <ActionButton onClick={cancelEdit} disabled={busyId === s._id}>
                    <X size={14} weight="bold" /> Hủy
                  </ActionButton>
                </div>
              </>
            ) : (
              <>
                <div className="flex min-w-0 flex-1 items-center gap-2 text-[12px] font-semibold">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: s.color || 'var(--green)' }} />
                  <span className="truncate">{s.name}</span>
                  <span className="flex-shrink-0" style={{ color: 'var(--t3)' }}>({s.code})</span>
                </div>
                <div className="flex gap-2">
                  <ActionButton onClick={() => startEdit(s)} disabled={!!busyId}>
                    <PencilSimple size={14} /> Sửa
                  </ActionButton>
                  <ActionButton tone="danger" onClick={() => handleDelete(s)} disabled={busyId === s._id}>
                    <Trash size={14} /> Xóa
                  </ActionButton>
                </div>
              </>
            )}
          </div>
        ))}
        {subjects.length === 0 && <span className="text-[12px]" style={{ color: 'var(--t3)' }}>Chưa có môn học nào</span>}
      </div>
    </PanelSection>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ANALYTICS PANEL — Phân tích câu hỏi + xuất PDF
// ═══════════════════════════════════════════════════════════════════════════════

function AnalyticsPanel({ token }: { token: string; subjects: ExamSubject[] }) {
  const [examList, setExamList] = useState<ExamItem[]>([])
  const [selectedExam, setSelectedExam] = useState('')
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportClass, setExportClass] = useState('')
  const [exportYear, setExportYear] = useState('')

  useEffect(() => {
    exams.getExams(token, { page: 1, limit: 100 }).then(r => setExamList(r.items)).catch(() => { })
  }, [token])

  const loadAnalytics = async () => {
    if (!selectedExam) return
    setLoading(true)
    try {
      const data = await exams.getQuestionAnalytics(token, selectedExam)
      setAnalytics(data)
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally { setLoading(false) }
  }

  const handleExportPdf = async () => {
    if (!selectedExam) return
    setExporting(true)
    try {
      const res = await exams.downloadPdfReport(token, selectedExam, exportClass || undefined, exportYear || undefined)
      if (!res.ok) throw new Error('Xuất PDF thất bại')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: `bao-cao-${selectedExam}.pdf` })
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('Lỗi xuất PDF: ' + err.message)
    } finally { setExporting(false) }
  }

  const getRateColor = (rate: number) => rate >= 70 ? 'var(--green)' : rate >= 40 ? 'var(--amber,#f59e0b)' : 'var(--red,#ef4444)'

  return (
    <div className="space-y-5">
      {/* Chọn đề thi */}
      <PanelSection title="Phân tích câu hỏi" description="Xem tỷ lệ đúng/sai từng câu dựa trên kết quả học sinh đã nộp">
        <div className="flex gap-3 flex-wrap mb-4">
          <FormSelect
            className="min-w-[200px] flex-1"
            value={selectedExam}
            onChange={value => { setSelectedExam(value); setAnalytics(null) }}
            options={[{ value: '', label: 'Chọn đề thi...' }, ...examList.map(ex => ({ value: ex._id, label: ex.title }))]}
          />
          <ActionButton tone="primary" onClick={loadAnalytics}>
            <ChartBar size={14} /> Phân tích
          </ActionButton>
        </div>

        {loading && <div className="text-center py-10 text-[13px]" style={{ color: 'var(--t3)' }}>Đang tải phân tích...</div>}

        {analytics && !loading && (
          <div className="space-y-4">
            <div className="text-[12px]" style={{ color: 'var(--t2)' }}>
              Dựa trên <strong style={{ color: 'var(--t0)' }}>{analytics.totalSessions}</strong> lượt thi đã nộp
            </div>

            {/* Part I */}
            {analytics.analytics.part1.length > 0 && (
              <div>
                <div className="font-semibold text-[13px] mb-2" style={{ color: 'var(--t1)' }}>Phần I — Trắc nghiệm ({analytics.analytics.part1.length} câu)</div>
                <div className="space-y-2">
                  {analytics.analytics.part1.map((q: any, i: number) => (
                    <div key={q.questionId} className="rounded-[8px] p-3 border" style={{ borderColor: 'var(--bds)', background: 'var(--bg1)' }}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-[12px]" style={{ color: 'var(--t2)' }}>Câu {i + 1} · Đáp án đúng: <strong>{q.correctAnswer}</strong></span>
                        <span className="font-bold text-[13px]" style={{ color: getRateColor(q.correctRate) }}>{q.correctRate}%</span>
                      </div>
                      <div className="flex gap-2">
                        {['A', 'B', 'C', 'D'].map(opt => (
                          <div key={opt} style={{ flex: 1, background: opt === q.correctAnswer ? 'rgba(34,197,94,0.12)' : 'var(--bg0)', borderRadius: 6, padding: '4px 8px', textAlign: 'center', border: `1px solid ${opt === q.correctAnswer ? 'rgba(34,197,94,0.3)' : 'var(--bds)'}` }}>
                            <div className="text-[11px] font-bold" style={{ color: opt === q.correctAnswer ? 'var(--green)' : 'var(--t2)' }}>{opt}</div>
                            <div className="text-[12px]" style={{ color: 'var(--t0)' }}>{q.optionDistribution[opt] || 0}</div>
                          </div>
                        ))}
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 rounded-full" style={{ background: 'var(--bg0)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${q.correctRate}%`, background: getRateColor(q.correctRate) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Part III */}
            {analytics.analytics.part3.length > 0 && (
              <div>
                <div className="font-semibold text-[13px] mb-2" style={{ color: 'var(--t1)' }}>Phần III — Trả lời ngắn ({analytics.analytics.part3.length} câu)</div>
                <div className="space-y-1.5">
                  {analytics.analytics.part3.map((q: any, i: number) => (
                    <div key={q.questionId} className="flex items-center gap-3 rounded-[6px] px-3 py-2 border" style={{ borderColor: 'var(--bds)', background: 'var(--bg1)' }}>
                      <span className="text-[12px]" style={{ color: 'var(--t2)' }}>Câu {i + 1}: <strong>{q.correctAnswer}</strong></span>
                      <span className="ml-auto font-bold text-[13px]" style={{ color: getRateColor(q.correctRate) }}>{q.correctRate}%</span>
                      <span className="text-[11px]" style={{ color: 'var(--t3)' }}>{q.correctCount}/{q.totalAttempts}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!analytics && !loading && selectedExam && (
          <EmptyState>Bấm Phân tích để tải dữ liệu</EmptyState>
        )}
        {!selectedExam && <EmptyState>Chọn một đề thi để xem thống kê</EmptyState>}
      </PanelSection>

      {/* PDF Export */}
      <PanelSection title="Xuất báo cáo PDF" description="Tải báo cáo điểm và phân tích cho một kỳ thi">
        <div className="flex gap-3 flex-wrap">
          <FormSelect
            className="min-w-[180px] flex-1"
            value={selectedExam}
            onChange={setSelectedExam}
            options={[{ value: '', label: 'Chọn đề thi...' }, ...examList.map(ex => ({ value: ex._id, label: ex.title }))]}
          />
          <input
            className="rounded-[8px] border px-3 py-2 text-[13px] w-28"
            style={{ borderColor: 'var(--bd)', background: 'var(--bg1)', color: 'var(--t0)' }}
            placeholder="Lớp (VD: 12A1)" value={exportClass} onChange={e => setExportClass(e.target.value)} />
          <input
            className="rounded-[8px] border px-3 py-2 text-[13px] w-32"
            style={{ borderColor: 'var(--bd)', background: 'var(--bg1)', color: 'var(--t0)' }}
            placeholder="Năm học" value={exportYear} onChange={e => setExportYear(e.target.value)} />
          <ActionButton tone="primary" onClick={handleExportPdf} disabled={!selectedExam || exporting}>
            <FilePdf size={14} /> {exporting ? 'Đang xuất...' : 'Xuất PDF'}
          </ActionButton>
        </div>
      </PanelSection>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FLASHCARD MANAGER PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function FlashcardManagerPanel({ token, subjects }: { token: string; subjects: ExamSubject[] }) {
  const [sets, setSets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', subjectId: '', gradeLevel: 12 })
  const [copiedCode, setCopiedCode] = useState('')
  const [managingSet, setManagingSet] = useState<any | null>(null)
  const [cardForm, setCardForm] = useState({ front: '', back: '', hint: '', imageUrl: '' })
  const [matchForm, setMatchForm] = useState({ prompt: '', correctText: '', distractorText: '', imageUrl: '' })
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null)
  const [editingMatchIndex, setEditingMatchIndex] = useState<number | null>(null)
  const [savingCards, setSavingCards] = useState(false)
  const [bankQuestions, setBankQuestions] = useState<ExamQuestion[]>([])
  const [bankLoading, setBankLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await exams.getFlashcardSets(token)
      setSets(data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [token]) // eslint-disable-line

  const handleCreate = async () => {
    if (!form.title.trim()) return alert('Nhập tên bộ flashcard')
    setCreating(true)
    try {
      const created = await exams.createFlashcardSet(token, {
        title: form.title,
        description: form.description || undefined,
        subjectId: form.subjectId || undefined,
        gradeLevel: form.gradeLevel || undefined,
        cards: [],
      })
      setForm({ title: '', description: '', subjectId: '', gradeLevel: 12 })
      setManagingSet(created)
      await load()
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally { setCreating(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa bộ flashcard này?')) return
    await exams.deleteFlashcardSet(token, id)
    load()
  }

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/quiz/flashcard/${code}`
    navigator.clipboard.writeText(url)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(''), 2000)
  }

  const openPreview = (code: string) => {
    window.open(`/quiz/flashcard/${code}`, '_blank', 'noopener,noreferrer')
  }

  const openMatchingPreview = (code: string) => {
    window.open(`/quiz/flashcard/${code}?mode=match`, '_blank', 'noopener,noreferrer')
  }

  const textToHtml = (value: string) => value.trim().replace(/\n/g, '<br>')
  const stripHtml = (value: string) => String(value || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim()

  const questionToCard = (q: ExamQuestion) => {
    let front = q.content || ''
    let back = ''
    if (q.type === 'MULTIPLE_CHOICE') {
      const options = q.options || []
      front = `${front}<br><br>${options.map(o => `${o.key}. ${o.content}`).join('<br>')}`
      const correct = options.find(o => o.key === q.correctAnswer)
      back = `<strong>Đáp án: ${q.correctAnswer || ''}</strong>${correct?.content ? `<br>${correct.content}` : ''}`
    } else if (q.type === 'TRUE_FALSE') {
      const statements = q.statements || []
      front = `${front}<br><br>${statements.map(s => `${s.key}. ${s.content}`).join('<br>')}`
      back = `<strong>Đáp án:</strong><br>${statements.map(s => `${s.key}. ${s.answer ? 'Đúng' : 'Sai'}`).join('<br>')}`
    } else {
      back = `<strong>Đáp án: ${q.shortAnswer || ''}</strong>`
    }
    const questionImage = Array.isArray((q as any).images) ? (q as any).images[0] : ''
    return { front, back, hint: q.topic || q.chapter || '', imageUrl: questionImage || undefined, questionId: q._id }
  }

  const updateManagedCards = async (cards: any[]) => {
    if (!managingSet) return
    setSavingCards(true)
    try {
      await exams.updateFlashcardSet(token, managingSet._id, { cards })
      const updated = { ...managingSet, cards }
      setManagingSet(updated)
      setSets(prev => prev.map(item => item._id === updated._id ? updated : item))
    } catch (err: any) {
      alert('Lỗi: ' + (err.message || 'Không lưu được thẻ flashcard.'))
    } finally {
      setSavingCards(false)
    }
  }

  const updateManagedMatches = async (matchingItems: any[]) => {
    if (!managingSet) return
    setSavingCards(true)
    try {
      await exams.updateFlashcardSet(token, managingSet._id, { matchingItems })
      const updated = { ...managingSet, matchingItems }
      setManagingSet(updated)
      setSets(prev => prev.map(item => item._id === updated._id ? updated : item))
    } catch (err: any) {
      alert('Lỗi: ' + (err.message || 'Không lưu được trò chơi ghép thẻ.'))
    } finally {
      setSavingCards(false)
    }
  }

  const saveManualCard = async () => {
    if (!cardForm.front.trim() || !cardForm.back.trim()) return alert('Vui lòng nhập mặt trước và mặt sau của thẻ.')
    const cards = [...(managingSet?.cards || [])]
    const card = {
      front: textToHtml(cardForm.front),
      back: textToHtml(cardForm.back),
      hint: cardForm.hint.trim() || undefined,
      imageUrl: cardForm.imageUrl.trim() || undefined,
    }
    if (editingCardIndex === null) cards.push(card)
    else cards[editingCardIndex] = { ...cards[editingCardIndex], ...card }
    await updateManagedCards(cards)
    setCardForm({ front: '', back: '', hint: '', imageUrl: '' })
    setEditingCardIndex(null)
  }

  const editCard = (index: number) => {
    const card = managingSet?.cards?.[index]
    if (!card) return
    setEditingCardIndex(index)
    setCardForm({ front: stripHtml(card.front), back: stripHtml(card.back), hint: card.hint || '', imageUrl: card.imageUrl || '' })
  }

  const removeCard = async (index: number) => {
    if (!confirm('Xóa thẻ này khỏi bộ flashcard?')) return
    const cards = [...(managingSet?.cards || [])]
    cards.splice(index, 1)
    await updateManagedCards(cards)
  }

  const saveMatchingItem = async () => {
    const correct = matchForm.correctText.split('\n').map(v => v.trim()).filter(Boolean)
    const distractors = matchForm.distractorText.split('\n').map(v => v.trim()).filter(Boolean)
    if (!matchForm.prompt.trim()) return alert('Vui lòng nhập chủ đề/thẻ chính.')
    if (correct.length === 0) return alert('Vui lòng nhập ít nhất một cụm đúng.')
    const items = [...(managingSet?.matchingItems || [])]
    const item = {
      prompt: matchForm.prompt.trim(),
      correct,
      distractors,
      imageUrl: matchForm.imageUrl.trim() || undefined,
    }
    if (editingMatchIndex === null) items.push(item)
    else items[editingMatchIndex] = { ...items[editingMatchIndex], ...item }
    await updateManagedMatches(items)
    setMatchForm({ prompt: '', correctText: '', distractorText: '', imageUrl: '' })
    setEditingMatchIndex(null)
  }

  const editMatchingItem = (index: number) => {
    const item = managingSet?.matchingItems?.[index]
    if (!item) return
    setEditingMatchIndex(index)
    setMatchForm({
      prompt: item.prompt || '',
      correctText: (item.correct || []).join('\n'),
      distractorText: (item.distractors || []).join('\n'),
      imageUrl: item.imageUrl || '',
    })
  }

  const removeMatchingItem = async (index: number) => {
    if (!confirm('Xóa trò chơi ghép thẻ này?')) return
    const items = [...(managingSet?.matchingItems || [])]
    items.splice(index, 1)
    await updateManagedMatches(items)
  }

  const loadBankQuestions = async () => {
    if (!managingSet) return
    setBankLoading(true)
    try {
      const res = await exams.getQuestions(token, {
        subjectId: managingSet.subjectId || undefined,
        gradeLevel: managingSet.gradeLevel || undefined,
        page: 1,
        limit: 500,
      })
      setBankQuestions(res.items || [])
    } catch (err: any) {
      alert('Không tải được ngân hàng câu hỏi: ' + (err.message || 'Lỗi không xác định'))
    } finally {
      setBankLoading(false)
    }
  }

  const addQuestionCard = async (q: ExamQuestion) => {
    const cards = [...(managingSet?.cards || []), questionToCard(q)]
    await updateManagedCards(cards)
  }

  const inputCls = 'rounded-[8px] border px-3 py-2 text-[13px] w-full'
  const inputStyle = { borderColor: 'var(--bd)', background: 'var(--bg1)', color: 'var(--t0)' }
  const totalCards = sets.reduce((sum, item) => sum + (item.cards?.length || 0), 0)
  const selectedSubject = subjects.find(subject => subject._id === form.subjectId)
  const previewTitle = form.title.trim() || 'Ôn tập nhanh trước giờ kiểm tra'
  const previewMeta = `${selectedSubject?.name || 'Môn học'}${form.gradeLevel ? ` · Lớp ${form.gradeLevel}` : ''}`

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BrainfishVisualCard icon={Cards} title="Thẻ lật tương tác" desc="Học sinh bấm để xem đáp án, sau đó tự đánh giá mức độ nhớ." tone="lavender" />
        <BrainfishVisualCard icon={Sparkle} title="Ôn tập lặp lại" desc="SM-2 tự tính lịch ôn theo câu chưa nhớ, khó, ổn hoặc dễ." tone="mint" />
        <BrainfishVisualCard icon={BookOpen} title="Chia sẻ nhanh" desc="Mỗi bộ có link public để gửi qua nhóm lớp hoặc mã QR sau này." tone="saffron" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Bộ flashcard" value={sets.length} accent="var(--blue)" />
        <StatCard label="Tổng số thẻ" value={totalCards} accent="var(--green)" />
        <StatCard label="Khối mặc định" value={`Lớp ${form.gradeLevel}`} accent="var(--amber)" />
        <StatCard label="Chế độ học" value="SRS" accent="var(--purple)" />
      </div>

      <PanelSection title="Tạo bộ Flashcard mới" description="Thiết lập bộ thẻ ôn tập có link public cho học sinh">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t2)' }}>Tên bộ flashcard *</label>
                <input className={inputCls} style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Ôn tập Toán 12 — Chương Đạo Hàm" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <FormSelect
                  label="Môn học"
                  value={form.subjectId}
                  onChange={value => setForm(f => ({ ...f, subjectId: value }))}
                  options={[{ value: '', label: 'Tất cả môn' }, ...subjects.map(s => ({ value: s._id, label: s.name }))]}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <FormSelect
                  label="Khối lớp"
                  value={String(form.gradeLevel)}
                  onChange={value => setForm(f => ({ ...f, gradeLevel: Number(value) }))}
                  options={[10, 11, 12].map(g => ({ value: String(g), label: `Lớp ${g}` }))}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t2)' }}>Mô tả (tuỳ chọn)</label>
                <input className={inputCls} style={inputStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ghi chú cho học sinh..." />
              </div>
            </div>
            <ActionButton tone="primary" onClick={handleCreate} disabled={creating}>
              <Plus size={14} /> {creating ? 'Đang tạo...' : 'Tạo bộ flashcard'}
            </ActionButton>
            <p className="text-[11px] mt-2" style={{ color: 'var(--t3)' }}>
              Sau khi tạo, bấm Quản lý thẻ để nhập thẻ thủ công hoặc chọn câu hỏi từ ngân hàng.
            </p>
          </div>

          <div className="bf-card bf-card--raised flex min-h-[230px] flex-col justify-between" style={{ background: 'var(--color-card-lavender)' }}>
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-[4px] border" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
                  <Cards size={24} weight="duotone" />
                </div>
                <span className="bf-tag bf-tag--green">Preview</span>
              </div>
              <div className="text-[15px] font-bold leading-snug" style={{ color: 'var(--t0)' }}>{previewTitle}</div>
              <div className="mt-1 text-[12px]" style={{ color: 'var(--t2)' }}>{previewMeta}</div>
              <div className="mt-4 rounded-[6px] border p-3 text-[12px] leading-relaxed" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)', color: 'var(--t1)' }}>
                Học sinh sẽ thấy thẻ lật, thanh tiến độ và 4 mức tự đánh giá sau mỗi đáp án.
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px] font-bold">
              {['Chưa nhớ', 'Khó', 'Ổn', 'Dễ'].map((label, index) => (
                <div key={label} className="rounded-[4px] border px-1 py-2" style={{ borderColor: 'var(--bd)', background: index >= 2 ? 'var(--color-card-mint)' : 'var(--color-card-pink)', color: 'var(--t0)' }}>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Bộ Flashcard đã tạo" description={`${sets.length} bộ`}>
        {loading ? (
          <div className="text-center py-8 text-[13px]" style={{ color: 'var(--t3)' }}>Đang tải...</div>
        ) : sets.length === 0 ? (
          <EmptyState>Chưa có bộ flashcard nào. Tạo bộ đầu tiên ở trên!</EmptyState>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {sets.map((set: any) => (
              <div key={set._id} className="bf-card bf-card--raised flex flex-col gap-4" style={{ background: 'var(--bg1)' }}>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[4px] border" style={{ borderColor: 'var(--bd)', background: 'var(--color-card-mint)' }}>
                    <Cards size={23} weight="duotone" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[14px]" style={{ color: 'var(--t0)' }}>{set.title}</div>
                    {set.description && <div className="text-[12px] mt-0.5 line-clamp-2" style={{ color: 'var(--t2)' }}>{set.description}</div>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Pill tone="blue">{set.cards?.length || 0} thẻ</Pill>
                      <Pill tone="green">{set.matchingItems?.length || 0} ghép thẻ</Pill>
                      {set.gradeLevel && <Pill tone="green">Lớp {set.gradeLevel}</Pill>}
                      <Pill tone="amber">SRS</Pill>
                    </div>
                  </div>
                  <ActionButton iconOnly tone="danger" title="Xóa bộ flashcard" ariaLabel="Xóa bộ flashcard" onClick={() => handleDelete(set._id)}>
                    <Trash size={15} />
                  </ActionButton>
                </div>

                {set.accessCode && (
                  <div className="flex flex-col gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-[4px] border px-2 py-2 text-[11px]" style={{ borderColor: 'var(--bds)', background: 'var(--bg0)', color: 'var(--blue)' }}>
                      /quiz/flashcard/{set.accessCode}
                    </code>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton tone="primary" onClick={() => setManagingSet(set)}>
                        <PencilSimple size={14} /> Quản lý thẻ
                      </ActionButton>
                      <ActionButton onClick={() => openPreview(set.accessCode)}>
                        <Eye size={14} /> Xem thử
                      </ActionButton>
                      <ActionButton onClick={() => openMatchingPreview(set.accessCode)}>
                        <ListBullets size={14} /> Ghép thẻ
                      </ActionButton>
                      <ActionButton onClick={() => copyLink(set.accessCode)}>
                        {copiedCode === set.accessCode ? <Check size={14} /> : <Copy size={14} />}
                        {copiedCode === set.accessCode ? 'Đã copy' : 'Copy link'}
                      </ActionButton>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </PanelSection>

      {managingSet && (
        <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto p-4 sm:items-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="bf-modal flex w-full max-w-5xl flex-col" style={{ maxHeight: 'calc(100dvh - 32px)' }}>
            <div className="bf-modal__header flex flex-shrink-0 items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold" style={{ color: 'var(--t0)' }}>Quản lý thẻ Flashcard</h3>
                <p className="mt-0.5 text-[12px]" style={{ color: 'var(--t2)' }}>
                  {managingSet.title} · {managingSet.cards?.length || 0} thẻ lật · {managingSet.matchingItems?.length || 0} ghép thẻ
                </p>
              </div>
              <ActionButton iconOnly title="Đóng" ariaLabel="Đóng" onClick={() => setManagingSet(null)}><X size={16} /></ActionButton>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-[14px]" style={{ color: 'var(--t0)' }}>Danh sách thẻ</div>
                    <ActionButton onClick={loadBankQuestions} disabled={bankLoading}>
                      <BookOpen size={14} /> {bankLoading ? 'Đang tải...' : 'Chọn từ ngân hàng'}
                    </ActionButton>
                  </div>

                  {bankQuestions.length > 0 && (
                    <div className="bf-card bf-card--subtle max-h-[280px] overflow-y-auto">
                      <div className="mb-2 text-[12px] font-bold" style={{ color: 'var(--t0)' }}>Ngân hàng câu hỏi phù hợp</div>
                      <div className="space-y-2">
                        {bankQuestions.map(q => (
                          <div key={q._id} className="bf-list-card flex items-start gap-3 p-3">
                            <div className="min-w-0 flex-1">
                              <div className="line-clamp-2 text-[12px] font-semibold" style={{ color: 'var(--t0)' }}>{q.content}</div>
                              <div className="mt-1 flex gap-2">
                                <Pill>{TYPE_LABEL[q.type] || q.type}</Pill>
                                <Pill tone={DIFFICULTY_TONE[q.difficulty] || 'default'}>{DIFFICULTY_LABEL[q.difficulty] || q.difficulty}</Pill>
                              </div>
                            </div>
                            <ActionButton onClick={() => addQuestionCard(q)} disabled={savingCards}>
                              <Plus size={14} /> Thêm
                            </ActionButton>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(managingSet.cards || []).length === 0 ? (
                    <EmptyState>Chưa có thẻ nào. Thêm thủ công hoặc chọn từ ngân hàng câu hỏi.</EmptyState>
                  ) : (
                    <div className="space-y-2">
                      {(managingSet.cards || []).map((card: any, index: number) => (
                        <div key={`${card.questionId || 'manual'}-${index}`} className="bf-list-card p-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[4px] border text-[12px] font-bold" style={{ borderColor: 'var(--bd)', background: 'var(--color-card-mint)' }}>
                              {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-3">
                                {card.imageUrl && (
                                  <img
                                    src={card.imageUrl}
                                    alt=""
                                    className="h-14 w-20 flex-shrink-0 rounded-[4px] border object-cover"
                                    style={{ borderColor: 'var(--bd)', background: 'var(--bg0)' }}
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="line-clamp-2 text-[13px] font-bold" style={{ color: 'var(--t0)' }}>{stripHtml(card.front)}</div>
                                  <div className="mt-1 line-clamp-2 text-[12px]" style={{ color: 'var(--t2)' }}>{stripHtml(card.back)}</div>
                                </div>
                              </div>
                            </div>
                            <ActionButton iconOnly title="Sửa thẻ" ariaLabel="Sửa thẻ" onClick={() => editCard(index)}><PencilSimple size={14} /></ActionButton>
                            <ActionButton iconOnly tone="danger" title="Xóa thẻ" ariaLabel="Xóa thẻ" onClick={() => removeCard(index)}><Trash size={14} /></ActionButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-5 space-y-3 border-t pt-4" style={{ borderColor: 'var(--bds)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-[14px]" style={{ color: 'var(--t0)' }}>Ghép thẻ</div>
                        <div className="text-[12px]" style={{ color: 'var(--t2)' }}>Học sinh chọn các cụm đúng liên quan tới một chủ đề.</div>
                      </div>
                      {managingSet.accessCode && (
                        <ActionButton onClick={() => openMatchingPreview(managingSet.accessCode)}>
                          <ListBullets size={14} /> Xem ghép thẻ
                        </ActionButton>
                      )}
                    </div>

                    {(managingSet.matchingItems || []).length === 0 ? (
                      <EmptyState>Chưa có trò chơi ghép thẻ nào.</EmptyState>
                    ) : (
                      <div className="space-y-2">
                        {(managingSet.matchingItems || []).map((item: any, index: number) => (
                          <div key={`${item.prompt}-${index}`} className="bf-list-card p-3">
                            <div className="flex items-start gap-3">
                              {item.imageUrl && (
                                <img
                                  src={item.imageUrl}
                                  alt=""
                                  className="h-14 w-20 flex-shrink-0 rounded-[4px] border object-cover"
                                  style={{ borderColor: 'var(--bd)', background: 'var(--bg0)' }}
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="line-clamp-2 text-[13px] font-bold" style={{ color: 'var(--t0)' }}>{item.prompt}</div>
                                <div className="mt-1 text-[12px]" style={{ color: 'var(--t2)' }}>
                                  {(item.correct || []).length} cụm đúng · {(item.distractors || []).length} cụm nhiễu
                                </div>
                              </div>
                              <ActionButton iconOnly title="Sửa ghép thẻ" ariaLabel="Sửa ghép thẻ" onClick={() => editMatchingItem(index)}><PencilSimple size={14} /></ActionButton>
                              <ActionButton iconOnly tone="danger" title="Xóa ghép thẻ" ariaLabel="Xóa ghép thẻ" onClick={() => removeMatchingItem(index)}><Trash size={14} /></ActionButton>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bf-card bf-card--raised self-start" style={{ background: 'var(--color-card-lavender)' }}>
                  <div className="text-[14px] font-bold" style={{ color: 'var(--t0)' }}>
                    {editingCardIndex === null ? 'Thêm thẻ thủ công' : `Sửa thẻ ${editingCardIndex + 1}`}
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className={labelCls} style={{ color: 'var(--t2)' }}>Mặt trước *</label>
                      <textarea rows={5} className={inputCls} style={inputStyle} value={cardForm.front} onChange={e => setCardForm(f => ({ ...f, front: e.target.value }))} placeholder="Nhập câu hỏi, khái niệm hoặc từ khóa..." />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--t2)' }}>Mặt sau *</label>
                      <textarea rows={5} className={inputCls} style={inputStyle} value={cardForm.back} onChange={e => setCardForm(f => ({ ...f, back: e.target.value }))} placeholder="Nhập đáp án hoặc giải thích ngắn..." />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--t2)' }}>Gợi ý</label>
                      <input className={inputCls} style={inputStyle} value={cardForm.hint} onChange={e => setCardForm(f => ({ ...f, hint: e.target.value }))} placeholder="Gợi ý ngắn nếu cần" />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--t2)' }}>URL hình ảnh</label>
                      <input className={inputCls} style={inputStyle} value={cardForm.imageUrl} onChange={e => setCardForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://.../hinh-minh-hoa.png" />
                      {cardForm.imageUrl.trim() && (
                        <div className="mt-2 overflow-hidden rounded-[4px] border" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
                          <img src={cardForm.imageUrl.trim()} alt="Preview hình flashcard" className="max-h-44 w-full object-contain" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton tone="primary" onClick={saveManualCard} disabled={savingCards}>
                        <Check size={14} /> {savingCards ? 'Đang lưu...' : editingCardIndex === null ? 'Thêm thẻ' : 'Lưu thẻ'}
                      </ActionButton>
                      {editingCardIndex !== null && (
                        <ActionButton onClick={() => { setEditingCardIndex(null); setCardForm({ front: '', back: '', hint: '', imageUrl: '' }) }}>
                          Hủy sửa
                        </ActionButton>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bf-card bf-card--raised self-start lg:col-start-2" style={{ background: 'var(--color-card-mint)' }}>
                  <div className="text-[14px] font-bold" style={{ color: 'var(--t0)' }}>
                    {editingMatchIndex === null ? 'Thêm trò chơi ghép thẻ' : `Sửa ghép thẻ ${editingMatchIndex + 1}`}
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className={labelCls} style={{ color: 'var(--t2)' }}>Thẻ/chủ đề chính *</label>
                      <textarea rows={3} className={inputCls} style={inputStyle} value={matchForm.prompt} onChange={e => setMatchForm(f => ({ ...f, prompt: e.target.value }))} placeholder="VD: Ô nhiễm môi trường biển" />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--t2)' }}>Các cụm đúng *</label>
                      <textarea rows={5} className={inputCls} style={inputStyle} value={matchForm.correctText} onChange={e => setMatchForm(f => ({ ...f, correctText: e.target.value }))} placeholder={'Mỗi dòng một cụm đúng\nVD: Rác thải nhựa\nTràn dầu\nSuy giảm đa dạng sinh học'} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--t2)' }}>Cụm gây nhiễu</label>
                      <textarea rows={4} className={inputCls} style={inputStyle} value={matchForm.distractorText} onChange={e => setMatchForm(f => ({ ...f, distractorText: e.target.value }))} placeholder={'Mỗi dòng một cụm nhiễu\nVD: Núi lửa phun trào\nBão tuyết'} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--t2)' }}>URL hình ảnh</label>
                      <input className={inputCls} style={inputStyle} value={matchForm.imageUrl} onChange={e => setMatchForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://.../hinh-minh-hoa.png" />
                      {matchForm.imageUrl.trim() && (
                        <div className="mt-2 overflow-hidden rounded-[4px] border" style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}>
                          <img src={matchForm.imageUrl.trim()} alt="Preview hình ghép thẻ" className="max-h-44 w-full object-contain" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton tone="primary" onClick={saveMatchingItem} disabled={savingCards}>
                        <Check size={14} /> {savingCards ? 'Đang lưu...' : editingMatchIndex === null ? 'Thêm ghép thẻ' : 'Lưu ghép thẻ'}
                      </ActionButton>
                      {editingMatchIndex !== null && (
                        <ActionButton onClick={() => { setEditingMatchIndex(null); setMatchForm({ prompt: '', correctText: '', distractorText: '', imageUrl: '' }) }}>
                          Hủy sửa
                        </ActionButton>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bf-modal__footer flex flex-shrink-0 flex-wrap justify-between gap-2">
              <div className="text-[12px]" style={{ color: 'var(--t2)' }}>
                Học sinh chỉ nên nhận link sau khi bộ có ít nhất 1 thẻ.
              </div>
              <div className="flex flex-wrap gap-2">
                {managingSet.accessCode && <ActionButton onClick={() => openPreview(managingSet.accessCode)}><Eye size={14} /> Xem thử</ActionButton>}
                {managingSet.accessCode && <ActionButton onClick={() => openMatchingPreview(managingSet.accessCode)}><ListBullets size={14} /> Ghép thẻ</ActionButton>}
                <ActionButton tone="primary" onClick={() => setManagingSet(null)}>Xong</ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'overview', label: 'Tổng quan', description: 'Chỉ số nhanh và hướng dẫn thao tác.', icon: GraduationCap },
  { id: 'questions', label: 'Ngân hàng câu hỏi', description: 'Tạo, sửa, lọc và import câu hỏi.', icon: BookOpen },
  { id: 'exams', label: 'Đề thi', description: 'Thiết lập cấu trúc đề và publish.', icon: ClipboardText },
  { id: 'skills', label: 'Đề thi kỹ năng', description: 'Reading, Listening, Writing và Quiz.', icon: Headphones },
  { id: 'results', label: 'Kết quả', description: 'Xem điểm, phân tích và phát hiện bất thường.', icon: BookBookmark },
  { id: 'analytics', label: 'Phân tích', description: 'Thống kê tỷ lệ đúng/sai từng câu và xuất báo cáo PDF.', icon: ChartBar },
  { id: 'flashcards', label: 'Flashcard SRS', description: 'Tạo bộ thẻ flashcard chia sẻ cho học sinh ôn tập.', icon: Cards },
  { id: 'students', label: 'Học sinh', description: 'Quản lý hồ sơ và thống kê theo năm học.', icon: UsersThree },
  { id: 'quizlive', label: 'Quiz Live', description: 'Trắc nghiệm realtime cho lớp học.', icon: GameController },
  { id: 'polllive', label: 'Bình chọn', description: 'Khảo sát ý kiến trực tiếp theo thời gian.', icon: ListBullets },
  { id: 'guide', label: 'Hướng dẫn', description: 'Hướng dẫn giáo viên sử dụng toàn bộ chức năng.', icon: Lightbulb },
  { id: 'feedback', label: 'Góp ý', description: 'Gửi phản hồi, báo lỗi và đề xuất tính năng.', icon: ChatCircleText },
  { id: 'profile', label: 'Hồ sơ', description: 'Thông tin giáo viên, đơn vị công tác và bảo mật tài khoản.', icon: UserCircle },
]

export default function ExamPanel({
  activeTab,
  onTabChange,
}: {
  activeTab?: string
  onTabChange?: (tab: string) => void
}) {
  const token = useAuthStore(s => s.token) || ''
  const [internalTab, setInternalTab] = useState('overview')
  const [stats, setStats] = useState<any>(null)
  const [subjects, setSubjects] = useState<ExamSubject[]>([])
  const [viewingExam, setViewingExam] = useState<ExamItem | null>(null)
  const [profile, setProfile] = useState<TeacherProfile | null>(null)
  const tab = activeTab || internalTab
  const setTab = useCallback((nextTab: string) => {
    setInternalTab(nextTab)
    onTabChange?.(nextTab)
  }, [onTabChange])

  const loadSubjects = useCallback(async () => {
    if (!token) return
    try {
      const res = await exams.getSubjects(token)
      setSubjects(res)
    } catch (err) {
      console.error('Failed to load subjects:', err)
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    exams.getStats(token).then(setStats).catch(() => { })
    profiles.getCurrent().then(setProfile).catch(err => console.error('Failed to load profile:', err))
    loadSubjects()
  }, [token, loadSubjects])

  // Navigate to results when exam selected
  const handleViewResults = (exam: ExamItem) => {
    setViewingExam(exam)
    setTab('results')
  }

  return (
    <div className="grid items-start gap-4 px-4 pb-24 pt-4 md:px-6 md:py-6 lg:grid-cols-[236px_minmax(0,1fr)] 2xl:px-8 2xl:py-7">
      <AdminNavigation
        tabs={TABS}
        active={tab}
        onChange={id => { setTab(id); if (id !== 'results') setViewingExam(null) }}
      />
      <MobileBottomNav
        tabs={TABS}
        active={tab}
        onChange={id => { setTab(id); if (id !== 'results') setViewingExam(null) }}
      />

      <div className="min-w-0 self-start space-y-4">
        {/* ── Tổng quan ── */}
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <BrainfishVisualCard icon={BookOpen} title="Ngân hàng tri thức" desc="Tổ chức câu hỏi theo môn, khối, loại câu và mức độ." tone="lavender" />
              <BrainfishVisualCard icon={QrCode} title="Phát đề bằng QR" desc="Học sinh vào thi nhanh bằng mã truy cập hoặc QR code." tone="mint" />
              <BrainfishVisualCard icon={Camera} title="Chấm và phân tích" desc="Theo dõi kết quả, quét phiếu và dùng AI hỗ trợ phân tích lớp." tone="saffron" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Tổng bài thi" value={stats?.totalExams ?? '—'} accent="var(--blue)" />
              <StatCard label="Đang mở" value={stats?.activeExams ?? '—'} accent="var(--green)" />
              <StatCard label="Lượt thi" value={stats?.totalSessions ?? '—'} accent="var(--amber)" />
              <StatCard label="Câu hỏi trong NH" value={stats?.totalQuestions ?? '—'} accent="var(--purple)" />
            </div>
            <SubjectManager token={token} subjects={subjects} onReload={loadSubjects} />
            <PanelSection title="Hướng dẫn nhanh">
              <div className="grid md:grid-cols-3 gap-4 text-[13px]">
                {[
                  { step: '1', title: 'Thêm câu hỏi', desc: 'Vào tab Ngân hàng câu hỏi, thêm từng câu hoặc sẽ hỗ trợ upload Word/PDF sắp tới.' },
                  { step: '2', title: 'Tạo bài thi', desc: 'Vào tab Đề thi, điền thông tin và cấu trúc đề (BGD 2025 mặc định: 18+4+6 câu = 10đ).' },
                  { step: '3', title: 'Publish & Chia sẻ', desc: 'Bấm Publish → hệ thống tạo link + QR code. Mỗi học sinh nhập họ tên/lớp/trường sẽ nhận mã đề khác nhau.' },
                ].map(item => (
                  <div key={item.step} className="bf-card bf-card--subtle">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[13px] mb-2" style={{ background: 'var(--blue)' }}>{item.step}</div>
                    <div className="font-semibold mb-1" style={{ color: 'var(--t0)' }}>{item.title}</div>
                    <div style={{ color: 'var(--t2)' }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </PanelSection>
          </div>
        )}

        {/* ── Ngân hàng câu hỏi ── */}
        {tab === 'questions' && (
          <PanelSection title="Ngân hàng câu hỏi" description="Thêm, sửa, lọc câu hỏi theo môn học — khối lớp — loại câu — mức độ">
            <QuestionBank token={token} subjects={subjects} />
          </PanelSection>
        )}

        {/* ── Đề thi ── */}
        {tab === 'exams' && (
          <ExamList token={token} subjects={subjects} profile={profile} onViewResults={handleViewResults} />
        )}

        {/* ── Đề thi kỹ năng ── */}
        {tab === 'skills' && <SkillsExamPanel />}

        {/* ── Kết quả ── */}
        {tab === 'results' && (
          viewingExam
            ? <ResultsPanel token={token} examId={viewingExam._id} examTitle={viewingExam.title} onBack={() => setViewingExam(null)} />
            : (
              <PanelSection title="Kết quả thi" description="Chọn một bài thi từ tab Đề thi để xem kết quả học sinh">
                <EmptyState>Chọn một bài thi từ tab <strong>Đề thi</strong> → bấm nút <strong>Kết quả</strong> để xem bảng điểm</EmptyState>
              </PanelSection>
            )
        )}

        {/* ── Học sinh ── */}
        {tab === 'students' && (
          <StudentDashboard token={token} />
        )}

        {/* ── Quiz Live ── */}
        {tab === 'quizlive' && (
          <QuizLivePanel />
        )}

        {/* ── Poll Live ── */}
        {tab === 'polllive' && (
          <PollLivePanel />
        )}

        {/* ── Analytics — Phân tích câu hỏi ── */}
        {tab === 'analytics' && (
          <AnalyticsPanel token={token} subjects={subjects} />
        )}

        {/* ── Flashcard SRS ── */}
        {tab === 'flashcards' && (
          <FlashcardManagerPanel token={token} subjects={subjects} />
        )}

        {/* ── Hướng dẫn ── */}
        {tab === 'guide' && (
          <GuidePanel />
        )}

        {/* ── Góp ý ── */}
        {tab === 'feedback' && (
          <FeedbackPanel />
        )}

        {/* ── Hồ sơ giáo viên ── */}
        {tab === 'profile' && (
          <TeacherProfilePanel profile={profile} onSaved={setProfile} />
        )}

      </div>
    </div>
  )
}
