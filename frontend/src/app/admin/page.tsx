'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ExamPanel from '@/components/admin/ExamPanel'
import { useAuthStore } from '@/lib/store'
import { ChalkboardTeacher, GraduationCap, SignOut, UserCircle, UserFocus } from '@phosphor-icons/react'

const AVATAR_ICONS = [ChalkboardTeacher, GraduationCap, UserCircle, UserFocus]

function stableAvatarIndex(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  return hash % AVATAR_ICONS.length
}

export default function AdminPage() {
  const router = useRouter()
  const { token, isAdmin, user } = useAuthStore()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (!token || !isAdmin()) {
      router.replace('/admin/login')
    }
  }, [mounted, token, isAdmin, router])

  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg0)', color: 'var(--t2)' }}>
        Đang tải hệ thống thi...
      </div>
    )
  }

  if (!token || !isAdmin()) return null
  const displayName = user?.name || 'Giáo viên'
  const AvatarIcon = AVATAR_ICONS[stableAvatarIndex(displayName)]

  return (
    <main className="admin-shell min-h-screen" style={{ background: 'var(--bg0)' }}>
      {/* Header aligned perfectly with the tabs underneath */}
      <div
        className="sticky top-0 z-50 transition-shadow duration-200"
        style={{
          background: 'var(--bg1)',
          boxShadow: scrolled ? '0 4px 12px rgba(0, 0, 0, 0.05)' : 'none'
        }}
      >
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 px-4 py-3 md:px-6 md:py-5 2xl:px-8">
          <div className="flex items-center gap-2.5 text-left sm:gap-3">
            <div className="min-w-0">
              <h1 className="text-[18px] font-extrabold leading-tight sm:text-[20px]" style={{ color: 'var(--t0)', fontFamily: 'var(--font-head)' }}>
                Classora
              </h1>
              <p className="mt-1 hidden text-[12px] sm:block" style={{ color: 'var(--t2)' }}>
                Ngân hàng câu hỏi, đề thi, quiz live, poll và kết quả học sinh.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              useAuthStore.getState().logout()
              router.replace('/admin/login')
            }}
            className="bf-btn bf-btn--icon !h-9 !w-9 !min-w-9 sm:hidden"
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <SignOut size={17} weight="bold" />
          </button>
          <div className="hidden min-h-[58px] items-center justify-between gap-2 rounded-[8px] border px-2.5 py-2 sm:flex sm:justify-end" style={{ borderColor: 'var(--bds)', background: 'var(--bg1)' }}>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-[4px] px-1 text-left transition-colors hover:bg-black/[0.03] sm:flex-none sm:rounded-[6px]"
              onClick={() => setActiveTab('profile')}
              title="Mở hồ sơ"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] border sm:h-10 sm:w-10 sm:rounded-[8px]" style={{ borderColor: 'var(--bd)', background: 'var(--color-card-mint)', boxShadow: 'var(--shadow-subtle-3)' }}>
                <AvatarIcon size={18} weight="duotone" className="sm:hidden" />
                <AvatarIcon size={22} weight="duotone" className="hidden sm:block" />
              </div>
              <div className="min-w-0">
                <div className="max-w-[210px] truncate text-[12px] font-bold leading-tight sm:max-w-[240px]" style={{ color: 'var(--t0)' }}>
                  {displayName}
                </div>
                <div className="hidden text-[11px] font-medium leading-tight min-[380px]:block" style={{ color: 'var(--t2)' }}>
                  Giáo viên
                </div>
              </div>
            </button>
            <button
              onClick={() => {
                useAuthStore.getState().logout()
                router.replace('/admin/login')
              }}
              className="bf-btn bf-btn--icon !h-9 !w-9 !min-w-9 sm:!h-10 sm:!w-10 sm:!min-w-10"
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <SignOut size={17} weight="bold" />
            </button>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1440px]">
        <ExamPanel activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </main>
  )
}
