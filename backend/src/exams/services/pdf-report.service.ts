import { Injectable } from '@nestjs/common'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake/src/printer')
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { TDocumentDefinitions } from 'pdfmake/interfaces'

/** Hàm format điểm thành Xếp loại BGD */
function getGrade(score: number): string {
  if (score >= 8) return 'Giỏi'
  if (score >= 6.5) return 'Khá'
  if (score >= 5) return 'TB'
  return 'Yếu'
}

function formatDate(date?: Date | string | null): string {
  if (!date) return ''
  const d = new Date(date)
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d)
}

@Injectable()
export class PdfReportService {
  private printer: any

  constructor() {
    // Fonts mặc định của pdfmake (bundled Roboto)
    const fonts = {
      Roboto: {
        normal: 'node_modules/pdfmake/build/vfs_fonts.js',
        bold: 'node_modules/pdfmake/build/vfs_fonts.js',
        italics: 'node_modules/pdfmake/build/vfs_fonts.js',
        bolditalics: 'node_modules/pdfmake/build/vfs_fonts.js',
      },
    }
    this.printer = new PdfPrinter(fonts)
  }

  /**
   * Tạo báo cáo PDF danh sách điểm cho một kỳ thi.
   */
  async generateClassReport(opts: {
    examTitle: string
    subjectName: string
    gradeLevel: number
    academicYear?: string
    className?: string
    school?: string
    sessions: Array<{
      fullName: string
      className: string
      score: number
      scoreBreakdown?: { part1Score?: number; part2Score?: number; part3Score?: number }
      submittedAt?: Date | string
      timeSpent?: number
    }>
    stats: {
      totalSessions: number
      avgScore: number
      maxScore: number
      minScore: number
      passRate: number
    }
    exportedAt?: Date
  }): Promise<Buffer> {
    const { examTitle, subjectName, gradeLevel, academicYear, className, school, sessions, stats } = opts
    const exportedAt = opts.exportedAt || new Date()

    // Header info
    const headerLines = [
      school || 'Trường',
      `Môn: ${subjectName} — Lớp ${gradeLevel}`,
      academicYear ? `Năm học: ${academicYear}` : '',
    ].filter(Boolean)

    // Bảng điểm
    const tableBody: any[][] = [
      [
        { text: 'STT', bold: true, fillColor: '#2563EB', color: '#fff', alignment: 'center' },
        { text: 'Họ và tên', bold: true, fillColor: '#2563EB', color: '#fff' },
        { text: 'Lớp', bold: true, fillColor: '#2563EB', color: '#fff', alignment: 'center' },
        { text: 'P.I', bold: true, fillColor: '#2563EB', color: '#fff', alignment: 'center' },
        { text: 'P.II', bold: true, fillColor: '#2563EB', color: '#fff', alignment: 'center' },
        { text: 'P.III', bold: true, fillColor: '#2563EB', color: '#fff', alignment: 'center' },
        { text: 'Tổng', bold: true, fillColor: '#2563EB', color: '#fff', alignment: 'center' },
        { text: 'Xếp loại', bold: true, fillColor: '#2563EB', color: '#fff', alignment: 'center' },
        { text: 'Ngày nộp', bold: true, fillColor: '#2563EB', color: '#fff', alignment: 'center' },
      ],
    ]

    sessions
      .sort((a, b) => b.score - a.score)
      .forEach((s, idx) => {
        const isEven = idx % 2 === 0
        const fillColor = isEven ? '#F8FAFC' : '#FFFFFF'
        tableBody.push([
          { text: String(idx + 1), alignment: 'center', fillColor },
          { text: s.fullName || '—', fillColor },
          { text: s.className || '—', alignment: 'center', fillColor },
          { text: s.scoreBreakdown?.part1Score?.toFixed(2) ?? '—', alignment: 'center', fillColor },
          { text: s.scoreBreakdown?.part2Score?.toFixed(2) ?? '—', alignment: 'center', fillColor },
          { text: s.scoreBreakdown?.part3Score?.toFixed(2) ?? '—', alignment: 'center', fillColor },
          { text: s.score?.toFixed(2) ?? '—', alignment: 'center', bold: true, fillColor },
          { text: getGrade(s.score), alignment: 'center', fillColor, color: s.score >= 5 ? '#16A34A' : '#DC2626' },
          { text: formatDate(s.submittedAt), alignment: 'center', fontSize: 8, fillColor },
        ])
      })

    // Phân phối điểm
    const distribution = [
      { label: 'Giỏi (≥8)', count: sessions.filter(s => s.score >= 8).length },
      { label: 'Khá (6.5-7.9)', count: sessions.filter(s => s.score >= 6.5 && s.score < 8).length },
      { label: 'Trung bình (5-6.4)', count: sessions.filter(s => s.score >= 5 && s.score < 6.5).length },
      { label: 'Yếu (<5)', count: sessions.filter(s => s.score < 5).length },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docDef: any = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [30, 50, 30, 40],
      header: {
        margin: [30, 15, 30, 0],
        columns: [
          { text: 'GREENFIELD EXAMS', fontSize: 8, color: '#6B7280' },
          { text: `Xuất ngày: ${formatDate(exportedAt)}`, fontSize: 8, color: '#6B7280', alignment: 'right' },
        ],
      },
      footer: (currentPage: number, pageCount: number) => ({
        margin: [30, 0, 30, 0],
        columns: [
          { text: `${examTitle}`, fontSize: 8, color: '#9CA3AF' },
          { text: `Trang ${currentPage} / ${pageCount}`, fontSize: 8, color: '#9CA3AF', alignment: 'right' },
        ],
      }),
      content: [
        // Tiêu đề
        ...headerLines.map((line, idx) => ({
          text: line,
          fontSize: idx === 0 ? 14 : 10,
          bold: idx === 0,
          alignment: 'center' as const,
          color: idx === 0 ? '#1E40AF' : '#374151',
          margin: [0, idx === 0 ? 0 : 2, 0, idx === 0 ? 4 : 0] as [number, number, number, number],
        })),
        {
          text: examTitle,
          fontSize: 16,
          bold: true,
          alignment: 'center',
          color: '#111827',
          margin: [0, 6, 0, 12],
        },

        // Thống kê tổng quan
        {
          margin: [0, 0, 0, 14],
          table: {
            widths: ['*', '*', '*', '*', '*'],
            body: [
              [
                { text: 'Số học sinh', bold: true, alignment: 'center', fillColor: '#EFF6FF', color: '#1D4ED8' },
                { text: 'Điểm TB', bold: true, alignment: 'center', fillColor: '#EFF6FF', color: '#1D4ED8' },
                { text: 'Cao nhất', bold: true, alignment: 'center', fillColor: '#EFF6FF', color: '#1D4ED8' },
                { text: 'Thấp nhất', bold: true, alignment: 'center', fillColor: '#EFF6FF', color: '#1D4ED8' },
                { text: 'Tỷ lệ đạt', bold: true, alignment: 'center', fillColor: '#EFF6FF', color: '#1D4ED8' },
              ],
              [
                { text: String(stats.totalSessions), alignment: 'center', bold: true, fontSize: 14 },
                { text: stats.avgScore.toFixed(2), alignment: 'center', bold: true, fontSize: 14 },
                { text: stats.maxScore.toFixed(2), alignment: 'center', bold: true, fontSize: 14, color: '#16A34A' },
                { text: stats.minScore.toFixed(2), alignment: 'center', bold: true, fontSize: 14, color: '#DC2626' },
                { text: `${stats.passRate.toFixed(1)}%`, alignment: 'center', bold: true, fontSize: 14, color: stats.passRate >= 50 ? '#16A34A' : '#DC2626' },
              ],
            ],
          },
          layout: 'lightHorizontalLines',
        },

        // Bảng điểm học sinh
        {
          table: {
            headerRows: 1,
            widths: [25, '*', 55, 35, 35, 35, 40, 50, 60],
            body: tableBody,
          },
          layout: {
            hLineWidth: (i: number) => (i === 0 || i === 1) ? 1.5 : 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#E5E7EB',
            vLineColor: () => '#E5E7EB',
          },
          fontSize: 9,
        },

        // Phân phối xếp loại
        {
          margin: [0, 16, 0, 0],
          columns: [
            {
              width: '40%',
              stack: [
                { text: 'Phân phối xếp loại', bold: true, fontSize: 10, color: '#374151', margin: [0, 0, 0, 6] },
                {
                  table: {
                    widths: ['*', 50, 60],
                    body: [
                      [
                        { text: 'Xếp loại', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
                        { text: 'Số HS', bold: true, fillColor: '#F3F4F6', alignment: 'center', fontSize: 9 },
                        { text: 'Tỷ lệ', bold: true, fillColor: '#F3F4F6', alignment: 'center', fontSize: 9 },
                      ],
                      ...distribution.map(d => [
                        { text: d.label, fontSize: 9 },
                        { text: String(d.count), alignment: 'center', fontSize: 9 },
                        {
                          text: stats.totalSessions > 0 ? `${((d.count / stats.totalSessions) * 100).toFixed(1)}%` : '0%',
                          alignment: 'center', fontSize: 9,
                        },
                      ]),
                    ],
                  },
                  layout: 'lightHorizontalLines',
                },
              ],
            },
            {
              width: '*',
              stack: [
                { text: 'Phân tích điểm theo từng phần', bold: true, fontSize: 10, color: '#374151', margin: [0, 0, 0, 6] },
                {
                  table: {
                    widths: ['*', 60, 60],
                    body: [
                      [
                        { text: 'Phần', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
                        { text: 'TB điểm', bold: true, fillColor: '#F3F4F6', alignment: 'center', fontSize: 9 },
                        { text: 'Max điểm', bold: true, fillColor: '#F3F4F6', alignment: 'center', fontSize: 9 },
                      ],
                      ...[
                        { label: 'Phần I (Trắc nghiệm)', key: 'part1Score' },
                        { label: 'Phần II (Đúng/Sai)', key: 'part2Score' },
                        { label: 'Phần III (Trả lời ngắn)', key: 'part3Score' },
                      ].map(p => {
                        const scores = sessions.map(s => (s.scoreBreakdown as any)?.[p.key] ?? 0)
                        const avg = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0
                        const max = scores.length ? Math.max(...scores) : 0
                        return [
                          { text: p.label, fontSize: 9 },
                          { text: avg.toFixed(2), alignment: 'center', fontSize: 9 },
                          { text: max.toFixed(2), alignment: 'center', fontSize: 9 },
                        ]
                      }),
                    ],
                  },
                  layout: 'lightHorizontalLines',
                },
              ],
            },
          ],
        },

        // Ghi chú cuối
        {
          text: `* Báo cáo được tạo tự động bởi Classora — ${className ? `Lớp ${className}` : 'Toàn bộ'}${academicYear ? ` — Năm học ${academicYear}` : ''}`,
          fontSize: 8,
          color: '#9CA3AF',
          margin: [0, 16, 0, 0],
          italics: true,
        },
      ],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
        color: '#111827',
      },
    }

    return new Promise((resolve, reject) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const vfsFonts = require('pdfmake/build/vfs_fonts')
        this.printer = new PdfPrinter({
          Roboto: {
            normal: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Regular.ttf'], 'base64'),
            bold: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Medium.ttf'], 'base64'),
            italics: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Italic.ttf'], 'base64'),
            bolditalics: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-MediumItalic.ttf'], 'base64'),
          },
        })
        const doc = this.printer.createPdfKitDocument(docDef)
        const chunks: Buffer[] = []
        doc.on('data', (chunk: Buffer) => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)
        doc.end()
      } catch (err) {
        reject(err)
      }
    })
  }
}
