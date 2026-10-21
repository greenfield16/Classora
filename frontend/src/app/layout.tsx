import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Classora',
  description: 'Hệ thống quản lý đề thi, ngân hàng câu hỏi, quiz live và kết quả học sinh.',
  icons: {
    icon: '/classora-wordmark.svg',
    shortcut: '/classora-wordmark.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
