// src/lib/store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LandingConfig, User } from './api'

const LANDING_DEFAULT: LandingConfig = {


  svcTitle: 'Chọn đúng giải pháp cho đúng giai đoạn tăng trưởng',
  svcDesc: 'Mỗi dịch vụ được thiết kế để giải quyết một nút thắt vận hành: phản hồi chậm, hạ tầng thiếu ổn định, dữ liệu rời rạc, hoặc an ninh chưa đủ sâu.',
  portTitle: 'Dự án đã thực hiện',
  portDesc: 'Một số dự án tiêu biểu chúng tôi đã triển khai thành công.',
  teamTitle: 'Những người xây dựng giải pháp cho bạn',
  ctaTitle: 'Sẵn sàng nâng cấp hệ thống của bạn?',
  phone: '0901 234 567', email: 'contact@itservices.vn',
  address: '123 Nguyễn Văn Linh, Q.7, TP.HCM',
  hours: 'T2–T6: 8:00–17:30 · T7: 8:00–12:00',
  hotline: '0901 999 247',
  hotlineNote: 'Dành cho khách hàng có hợp đồng bảo trì',
  footerDesc: 'Giải pháp công nghệ cho đội ngũ đang tăng tốc — vận hành ổn định, bảo mật vững vàng, tăng trưởng bền vững.',
  copyright: '© 2026 IT Services. MST: 0312345678 — TP.Hồ Chí Minh',
  botGreeting: 'Xin chào! 👋 Tôi là Robo của IT Services. Tôi có thể giúp bạn chọn giải pháp phù hợp, đặt lịch tư vấn 1:1 hoặc gửi yêu cầu hỗ trợ ngay.',

  navbarLeftPrimaryLabel: 'Shop',
  navbarLeftPrimaryHref: '/store',
  navbarLeftSecondaryLabel: 'Search',
  navbarLeftSecondaryHref: '/store',
  navbarCenterFallbackText: 'GREENFIELD',
  navbarIconWishlistHref: '/projects',
  navbarIconBagHref: '/store',
  navbarIconAccountHref: '/profile',
  navbarBgColor: '#e5e5e5',
  navbarTextColor: '#111111',

  storeEyebrow: 'Cửa hàng',
  storeTitle: 'Thiết bị chuẩn doanh nghiệp, mua nhanh như retail',
  storeDesc: 'Chọn đúng sản phẩm, thêm vào giỏ và xác nhận trong vài bước. Có CO/CQ, VAT và hỗ trợ kỹ thuật trước khi mua.',
  storeHeroBadge: 'Curated Storefront',
  storeHeroTitle: 'Chọn đúng giải pháp ngay từ lần đầu',
  storeHeroDesc: 'Có hỗ trợ xuất VAT, CO/CQ, tư vấn trước mua và gọi hỗ trợ nhanh nếu bạn cần người hướng dẫn trực tiếp.',
  storeStep1Title: 'Khám phá theo nhu cầu',
  storeStep1Desc: 'Dùng bộ lọc để chọn đúng thiết bị cho bài toán của bạn.',
  storeStep2Title: 'Thêm nhanh vào giỏ',
  storeStep2Desc: 'Gom sản phẩm chỉ với 1 chạm và kiểm tra tổng đơn tức thì.',
  storeStep3Title: 'Chốt đơn trong vài phút',
  storeStep3Desc: 'Nhập thông tin cơ bản, hệ thống sẽ liên hệ xác nhận ngay.',
  heroBannerUrl: '/brand/hero-abstract.svg',
  heroBannerTitle: 'Greenmind — See. Think. Protect.',
  heroCardExamImageUrl: '',
  heroCardHelpdeskImageUrl: '',
  heroCardCctvImageUrl: '',
  heroCardExamTitle: 'Hệ thống thi',
  heroCardHelpdeskTitle: 'IT Helpdesk',
  heroCardCctvTitle: 'Lắp đặt hệ thống CCTV',
  heroCardExamCtaHref: '/services',
  heroCardHelpdeskCtaHref: '/services',
  heroCardCctvCtaHref: '/services',
  heroCta1Href: '/services',
  heroBannerImageContext: '',
  heroCardExamImageContext: '',
  heroCardHelpdeskImageContext: '',
  heroCardCctvImageContext: '',
  storeBannerUrl: '/brand/store-abstract.svg',

  containerMain2k: '1540px',
  containerStore2k: '1720px',
  containerNav2k: '1860px',
  mishUiJson: '',

  logoUrl: '',
  faviconUrl: '',
}

// ── Landing config store ─────────────────────────────────────
interface LandingStore {
  config: LandingConfig
  setConfig: (c: LandingConfig) => void
  updateField: (key: keyof LandingConfig, value: string) => void
  reset: () => void
}

export const useLandingStore = create<LandingStore>()(
  persist(
    (set) => ({
      config: LANDING_DEFAULT,
      setConfig: (config) => set({ config }),
      updateField: (key, value) =>
        set((state) => ({ config: { ...state.config, [key]: value } })),
      reset: () => set({ config: LANDING_DEFAULT }),
    }),
    { name: 'itsvcs_landing' }
  )
)

// ── Auth store ───────────────────────────────────────────────
interface AuthStore {
  user: User | null
  token: string | null
  login: (user: User, token: string) => void
  logout: () => void
  setUser: (user: User) => void
  isAdmin: () => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      login: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
      setUser: (user) => set({ user }),
      isAdmin: () => {
        const role = get().user?.role
        return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'TEACHER'
      },
    }),
    { name: 'classora_auth', version: 1 }
  )
)
