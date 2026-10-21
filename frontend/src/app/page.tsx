'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin')
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--bg0)', color: 'var(--t0)' }}>
      <div className="text-center">
        <h1 className="text-xl font-bold">Classora</h1>
        <p role="status" className="mt-3 text-sm" style={{ color: 'var(--t2)' }}>Đang mở không gian giáo viên…</p>
        <Link href="/admin" className="bf-btn bf-btn--primary mt-5">Mở không gian giáo viên</Link>
      </div>
    </main>
  )
}
