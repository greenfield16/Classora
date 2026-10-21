'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { auth } from '@/lib/api'

const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
  'auth/user-not-found': 'Tài khoản này không tồn tại.',
  'auth/wrong-password': 'Mật khẩu không đúng.',
  'auth/invalid-email': 'Email không hợp lệ.',
  'auth/too-many-requests': 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.',
  'auth/network-request-failed': 'Không thể kết nối mạng. Vui lòng kiểm tra Internet và thử lại.',
  'auth/user-disabled': 'Tài khoản này đã bị vô hiệu hóa.',
}

function getLoginErrorMessage(err: any) {
  const code = err?.code || ''
  return FIREBASE_AUTH_MESSAGES[code] || 'Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.'
}

export default function LoginPage() {
  const router = useRouter()
  const login = useAuthStore(s => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { access_token, user } = await auth.login(email, password)
      login(user, access_token)
      router.push('/admin')
    } catch (err: any) {
      setError(getLoginErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 dot-bg" style={{ background: 'var(--color-pale-ash, #f5f5f5)' }}>
      <div className="w-full max-w-[380px]">
        {/* Logo / Header */}
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-[24px] font-extrabold mb-1" style={{ fontFamily: 'var(--font-satoshi)', color: 'var(--color-midnight-ink, #000000)' }}>
            Classora
          </h1>
          <p className="text-[13px] font-medium" style={{ color: 'var(--color-charcoal-border, #171717)', opacity: 0.7 }}>Đăng nhập tài khoản giáo viên / quản trị viên</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-[8px] border p-8"
          style={{
            background: 'var(--color-canvas-white, #ffffff)',
            borderColor: 'var(--color-charcoal-border, #171717)',
            boxShadow: 'var(--shadow-subtle-2, 4px 4px 0px 0px #0a0a0d)'
          }}>
          {error && (
            <div className="mb-5 p-3.5 rounded-[4px] text-[12px] font-semibold" style={{ background: 'var(--color-card-pink, #f5d1fe)', color: 'var(--color-midnight-ink, #000000)', border: '1px solid var(--color-charcoal-border, #171717)' }}>
              ⚠️ {error}
            </div>
          )}
          <div className="mb-4">
            <label className="block text-[13px] font-bold mb-1.5" style={{ color: 'var(--color-midnight-ink, #000000)' }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-3 py-3 rounded-[4px] text-[14px] font-medium outline-none transition-all focus:ring-1 focus:ring-[#a3e635]"
              style={{
                background: 'var(--color-canvas-white, #ffffff)',
                border: '1px solid #737373',
                color: 'var(--color-midnight-ink, #000000)'
              }}
              placeholder="teacher@example.com"
            />
          </div>
          <div className="mb-6">
            <label className="block text-[13px] font-bold mb-1.5" style={{ color: 'var(--color-midnight-ink, #000000)' }}>Mật khẩu</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-3 py-3 rounded-[4px] text-[14px] font-medium outline-none transition-all focus:ring-1 focus:ring-[#a3e635]"
              style={{
                background: 'var(--color-canvas-white, #ffffff)',
                border: '1px solid #737373',
                color: 'var(--color-midnight-ink, #000000)'
              }}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="bf-btn bf-btn--primary bf-btn--large bf-btn--block"
          >
            {loading ? '⟳ Đang đăng nhập...' : 'Đăng nhập'}
          </button>

        </form>

        <p className="mt-5 text-center text-[13px]" style={{ color: 'var(--t2)' }}>
          Học sinh mở đường dẫn bài thi hoặc ôn tập do giáo viên chia sẻ.
        </p>
      </div>
    </div>
  )
}
