import { useAuthStore } from './store'
// src/lib/api.ts
// Central API client — all fetch calls go through here


// ── Shared types ─────────────────────────────────────────
export type ServiceItem = { name: string; description: string }



// All application data and AI requests use the NestJS API.
import { request, jsonBody, API_BASE as BASE } from './http'
const aiReq = <T,>(task: string, payload: object) => request<T>('/ai', jsonBody('POST', { task, payload }))
export const examAI = {
  generateQuestions: (data: { subjectName: string; gradeLevel: number; topic: string; questionType: string; count: number; difficulty: string; chapter?: string }) => aiReq<{ ok: boolean; questions: any[]; count: number; model: string }>('generateQuestions', data),
  explainAnswer: (data: { question: string; choices: string[]; correctIndex: number; subjectName?: string; gradeLevel?: number }) => aiReq<{ ok: boolean; explanation: string; model: string }>('explainAnswer', data),
  parseQuestions: (data: { text: string; questionType?: string; gradeLevel?: number; difficulty?: string }) => aiReq<{ ok: boolean; questions: any[]; count: number; model: string }>('parseQuestions', data),
  analyzeQuizSession: (data: object) => aiReq<{ ok: boolean; analysis: string; model: string }>('analyzeQuizSession', data),
  analyzePollSession: (data: object) => aiReq<{ ok: boolean; analysis: string; model: string }>('analyzePollSession', data),
  detectCheating: (data: object) => aiReq<{ ok: boolean; analysis: string; model: string }>('detectCheating', data),
}
const req = request
function authed(token: string, init: RequestInit = {}): RequestInit {
  return { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } }
}
export const auth = {
  login: (email: string, password: string) => request<{ access_token: string; user: User }>('/auth/login', jsonBody('POST', { email, password })),
  updateMe: (token: string, data: { name?: string; email?: string }) => request<User>('/auth/me', authed(token, jsonBody('PATCH', data))),
  changePassword: (oldPassword: string, newPassword: string) => request('/auth/password', jsonBody('POST', { oldPassword, newPassword })),
}

// ── Licensing ───────────────────────────────────────────────
export const licensing = {
  me: (token: string) =>
    req<LicensingMeResponse>('/licensing/me', authed(token)),
  activate: (token: string, key: string) =>
    req<LicenseActivateResponse>('/licensing/activate', authed(token, {
      method: 'POST',
      body: JSON.stringify({ key }),
    })),
  createKey: (token: string, data: CreateLicenseKeyInput) =>
    req<CreatedLicenseKey>('/licensing/keys', authed(token, {
      method: 'POST',
      body: JSON.stringify(data),
    })),
}

// ── News ────────────────────────────────────────────────────
export const news = {
  list: (page = 1, source = 'all') =>
    req<{ articles: Article[]; total: number; pages: number }>(
      `/news?page=${page}&source=${source}`
    ),
  adminList: (token: string, page = 1) =>
    req<{ articles: Article[]; total: number; pages: number }>(
      `/news/admin?page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ),
  get: (id: string) => req<Article>(`/news/${id}`),
  fetch: (token: string) =>
    req('/news/fetch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
  update: (token: string, id: string, data: Partial<Article>) =>
    req<Article>(`/news/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),
  delete: (token: string, id: string) =>
    req(`/news/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),
}

// ── Tickets ─────────────────────────────────────────────────
export const tickets = {
  list: (token: string, page = 1, limit = 20, projectId?: string) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (projectId) q.set('projectId', projectId)
    return req<TicketListResponse>(`/tickets?${q.toString()}`, authed(token))
  },
  stats: (token: string) =>
    req<TicketStatsResponse>('/tickets/stats', authed(token)),
  create: (token: string, payload: any) =>
    req<Ticket>('/tickets', authed(token, { method: 'POST', body: JSON.stringify(payload) })),
  updateStatus: (token: string, id: string, status: string) =>
    req<Ticket>(`/tickets/${id}/status`, authed(token, { method: 'PATCH', body: JSON.stringify({ status }) })),
  checkMarketingVideoStatus: (token: string, id: string) =>
    req<Ticket>(`/tickets/${id}/marketing/check-video`, authed(token, { method: 'POST' })),
}

// ── IT Services ─────────────────────────────────────────────
export const itServices = {
  list: () => req<ItService[]>('/it-services'),
  create: (token: string, payload: any) =>
    req<ItService>('/it-services', authed(token, { method: 'POST', body: JSON.stringify(payload) })),
  update: (token: string, id: string, payload: any) =>
    req<ItService>(`/it-services/${id}`, authed(token, { method: 'PUT', body: JSON.stringify(payload) })),
  delete: (token: string, id: string) =>
    req<ItService>(`/it-services/${id}`, authed(token, { method: 'DELETE' })),
}

// ── Projects ────────────────────────────────────────────────
export const projects = {
  list: (token: string, page = 1, status = 'all') =>
    req<ProjectListResponse>(`/projects?page=${page}&status=${status}`, authed(token)),
  create: (token: string, data: ProjectPayload) =>
    req<ProjectSummary>('/projects', authed(token, {
      method: 'POST',
      body: JSON.stringify(data),
    })),
  update: (token: string, id: string, data: Partial<ProjectPayload>) =>
    req<ProjectSummary>(`/projects/${id}`, authed(token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })),
  updateQuote: (token: string, id: string, data: ProjectQuotePayload) =>
    req<ProjectSummary>(`/projects/${id}/quote`, authed(token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })),
  researchQuote: (token: string, id: string, data?: Partial<ProjectQuotePayload>) =>
    req<ProjectSummary>(`/projects/${id}/quote/research`, authed(token, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    })),
  warrantyAlerts: (token: string) =>
    req<ProjectSummary[]>('/projects/warranty-alerts', authed(token)),
  warrantyCheck: (token: string, keyword: string) =>
    req<ProjectWarrantyCheckResult[]>(`/projects/warranty-check?keyword=${encodeURIComponent(keyword)}`, authed(token)),
  getTickets: (token: string, projectId: string) =>
    req<Ticket[]>(`/projects/${projectId}/tickets`, authed(token)),
  delete: (token: string, id: string) =>
    req<{ success: boolean }>(`/projects/${id}`, authed(token, { method: 'DELETE' })),
  generateContract: (token: string, data: {
    projectName: string
    projectNo: string
    clientName: string
    taxId?: string
    address?: string
    contactPerson?: string
    contactPhone?: string
    description: string
    type?: string
    budget?: number
  }) =>
    req<{ html: string; model: string }>('/landing/generate-contract', authed(token, {
      method: 'POST',
      body: JSON.stringify(data),
    })),
  saveContract: (token: string, id: string, data: { html: string; model?: string }) =>
    req<ProjectSummary>(`/projects/${id}/contract`, authed(token, {
      method: 'POST',
      body: JSON.stringify(data),
    })),
  sendContractMail: (token: string, id: string, data: { to?: string; subject?: string; html?: string }) =>
    req<{ ok: boolean; to: string; project?: ProjectSummary }>(`/projects/${id}/contract/send-mail`, authed(token, {
      method: 'POST',
      body: JSON.stringify(data),
    })),
  sendWarrantyRenewalMail: (token: string, id: string, data?: { to?: string; subject?: string }) =>
    req<{ ok: boolean; to: string; project?: ProjectSummary }>(`/projects/${id}/warranty/send-renewal-mail`, authed(token, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    })),
  generateMarketingContent: (token: string, id: string) =>
    req<ProjectSummary>(`/projects/${id}/marketing/generate`, authed(token, {
      method: 'POST',
    })),
  checkMarketingVideoStatus: (token: string, id: string) =>
    req<ProjectSummary>(`/projects/${id}/marketing/check-video`, authed(token, {
      method: 'POST',
    })),
  publicList: (limit = 24) =>
    req<PublicProjectItem[]>(`/public-projects?limit=${limit}`),
}

// ── Customers (CRM mini) ───────────────────────────────────
export const users = {
  listCustomers: (token: string, search = '', isActive: 'all' | 'true' | 'false' = 'all') =>
    req<{ customers: Customer[]; total: number }>(
      `/users/customers?search=${encodeURIComponent(search)}&isActive=${isActive}`,
      authed(token),
    ),
  createCustomer: (token: string, data: CustomerCreateInput) =>
    req<Customer>('/users/customers', authed(token, {
      method: 'POST',
      body: JSON.stringify(data),
    })),
  updateCustomer: (token: string, id: string, data: CustomerUpdateInput) =>
    req<Customer>(`/users/customers/${id}`, authed(token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })),
  getCustomerOverview: (token: string, id: string) =>
    req<CustomerOverview>(`/users/customers/${id}/overview`, authed(token)),
  deleteCustomer: (token: string, id: string) =>
    req<{ success: boolean }>(`/users/customers/${id}`, authed(token, { method: 'DELETE' })),
  lookupTax: (token: string, taxId: string) =>
    req<{ ok: boolean; name?: string; address?: string; internationalName?: string; statusStr?: string; taxId?: string; error?: string }>(
      `/users/lookup-tax?taxId=${encodeURIComponent(taxId)}`, authed(token)
    ),
}

// ── Leads (auto từ chatbot) ───────────────────────────────
export const leads = {
  list: (token: string, page = 1, limit = 30, status = 'all', search = '') =>
    req<LeadListResponse>(
      `/leads?page=${page}&limit=${limit}&status=${status}&search=${encodeURIComponent(search)}`,
      authed(token),
    ),
  update: (token: string, id: string, data: LeadUpdateInput) =>
    req<LeadItem>(`/leads/${id}`, authed(token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })),
  confirmAppointment: (token: string, id: string) =>
    req<LeadConfirmResponse>(`/leads/${id}/confirm-appointment`, authed(token, {
      method: 'POST',
    })),
  delete: (token: string, id: string) =>
    req<{ success: boolean }>(`/leads/${id}`, authed(token, { method: 'DELETE' })),
}

// ── Landing config ──────────────────────────────────────────
export const landing = {
  getConfig: () => req<LandingConfig>('/landing/config'),
  getStats: () => req<LandingStats>('/landing/stats'),
  saveConfig: (data: LandingConfig, token: string) =>
    req('/landing/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  getProfile: () =>
    req<{ content: string; company: Record<string, string>; projectCount: number; generatedAt: string }>(
      '/landing/profile'
    ),
  generateProfile: (token: string) =>
    req<{ content: string; company: Record<string, string>; projectCount: number; generatedAt: string }>(
      '/landing/profile', authed(token, { method: 'POST' })
    ),
  getServices: () => req<ServiceItem[]>('/landing/services'),
  saveServices: (services: ServiceItem[], token: string) =>
    req<ServiceItem[]>('/landing/services', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ services }),
    }),
  composeServiceDescription: (serviceName: string, currentDesc: string | undefined, token: string) =>
    req<{ description: string; model: string }>('/landing/services/compose', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ serviceName, currentDesc }),
    }),
  generateImage: (
    payload: { prompt: string; section?: 'hero' | 'store' | 'cta' | 'generic'; aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' },
    token: string,
  ) =>
    req<{ imageBase64: string; mimeType: string; model: string; prompt: string; section: string }>('/landing/images/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),
}

// ── System health ──────────────────────────────────────────
export const systemApi = {
  health: (token: string) =>
    req<SystemHealthResponse>('/system/health', authed(token)),
  incidentCenter: (token: string) =>
    req<SystemIncidentCenterResponse>('/system/incident-center', authed(token)),
  alertRules: {
    list: (token: string) =>
      req<SystemAlertRulesListResponse>('/system/alert-rules', authed(token)),
    create: (token: string, body: Partial<AlertRule>) =>
      req<SystemAlertRuleResponse>('/system/alert-rules', authed(token, {
        method: 'POST',
        body: JSON.stringify(body),
      })),
    update: (token: string, id: string, body: Partial<AlertRule>) =>
      req<SystemAlertRuleResponse>(`/system/alert-rules/${id}`, authed(token, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })),
    delete: (token: string, id: string) =>
      req<{ ok: boolean; data: AlertRule }>(`/system/alert-rules/${id}`, authed(token, {
        method: 'DELETE',
      })),
  },
  checkAlerts: (token: string) =>
    req<SystemCheckAlertsResponse>('/system/check-alerts', authed(token, {
      method: 'POST',
      body: JSON.stringify({}),
    })),
  alertEvents: (token: string, page = 1, limit = 20, level?: string, breached?: string) =>
    req<SystemAlertEventsResponse>(
      `/system/alert-events?page=${page}&limit=${limit}${level ? `&level=${level}` : ''}${breached ? `&breached=${breached}` : ''}`,
      authed(token)
    ),
}

// ── Telegram Ops ───────────────────────────────────────────
export const telegramOps = {
  list: (token: string, page = 1, limit = 20, status = '', kind = '') =>
    req<TelegramOpsListResponse>(
      `/telegram/ops-items?page=${page}&limit=${limit}&status=${encodeURIComponent(status)}&kind=${encodeURIComponent(kind)}`,
      authed(token),
    ),
  update: (token: string, id: string, body: { status?: string; decisionNote?: string }) =>
    req<{ ok: boolean; item: TelegramOpsItem | null }>(`/telegram/ops-items/${id}`, authed(token, {
      method: 'PATCH',
      body: JSON.stringify(body || {}),
    })),
  systemHealth: (token: string) =>
    req<TelegramSystemHealthResponse>('/telegram/system-health', authed(token)),
  auditLogs: (token: string, page = 1, limit = 20, action = '') =>
    req<TelegramAuditLogListResponse>(
      `/telegram/audit-logs?page=${page}&limit=${limit}&action=${encodeURIComponent(action)}`,
      authed(token),
    ),
  autoHealWebhook: (token: string, body?: { url?: string; dropPendingUpdates?: boolean }) =>
    req<TelegramAutoHealResponse>('/telegram/webhook/auto-heal', authed(token, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    })),
}

// ── Storage (for direct-to-R2 uploads) ──────────────────
export const storage = {
  getPresignedUrl: (token: string, key: string, contentType: string) =>
    req<{ uploadUrl: string; publicUrl: string }>('/storage/presign', {
      method: 'POST',
      body: JSON.stringify({ key, contentType }),
      ...authed(token),
    }),
  uploadFile: (uploadUrl: string, file: File) =>
    fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    }),
}

// ── CCTV Quote ──────────────────────────────────────────────
export const cctv = {
  submitQuote: (data: CctvQuoteInput) =>
    req<CctvQuote>('/cctv/quote', { method: 'POST', body: JSON.stringify(data) }),
}

// ── Contact ─────────────────────────────────────────────────
export const contact = {
  submit: (data: ContactInput) =>
    req('/contact', { method: 'POST', body: JSON.stringify(data) }),
}

// ── Chat (Groq proxy) ───────────────────────────────────────
export const chat = {
  send: async (
    messages: { role: string; content: string }[],
    onChunk: (text: string) => void,
    system?: string,
  ) => {
    const { token } = useAuthStore.getState()
    const sessionKey = 'gai-senior-chat:session-id'
    let sessionId = ''
    try {
      sessionId = localStorage.getItem(sessionKey) || ''
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        localStorage.setItem(sessionKey, sessionId)
      }
    } catch { }

    const res = await fetch(`${BASE}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ messages, system, sessionId, source: 'web' }),
    })
    if (!res.ok) throw new Error('Chat API error')
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') break
        // Thử parse JSON trước, fallback về plain text từ AI worker.
        try {
          const j = JSON.parse(data)
          if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta') {
            onChunk(j.delta.text)
          }
        } catch {
          // Plain text chunk từ AI worker.
          if (data) onChunk(data)
        }
      }
    }
  },
  logs: (token: string, page = 1, limit = 20, sessionId = '') =>
    req<ChatLogListResponse>(
      `/chat/logs?page=${page}&limit=${limit}&sessionId=${encodeURIComponent(sessionId)}`,
      authed(token),
    ),
  sessionLogs: (token: string, sessionId: string) =>
    req<ChatLogListResponse>(`/chat/logs/${encodeURIComponent(sessionId)}`, authed(token)),
  promptPreview: (
    token: string,
    body: {
      audience?: 'customer' | 'internal' | 'specialist'
      task?: 'general_consulting' | 'ticket_support' | 'marketing_content' | 'inventory_consulting' | 'exam_support'
      outputFormat?: 'markdown' | 'json' | 'html' | 'plain'
      outputSchemaDescription?: string
      currentTaskLabel?: string
      currentInput?: string
      ragContext?: string
      history?: string
      contextSections?: Array<{ title?: string; content?: string }>
      extraRules?: string[]
      company?: {
        companyName?: string
        officeArea?: string
        phone?: string
        email?: string
        address?: string
      }
    },
  ) =>
    req<{
      meta: { audience: string; task: string; outputFormat: string }
      company: { companyName: string; officeArea: string; phone: string; email: string; address: string }
      system: string
      prompt: string
      combined: string
    }>('/chat/prompt-preview', authed(token, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    })),
  memoryPreview: (
    token: string,
    body: {
      sessionId: string
      message?: string
      includeTicket?: boolean
      syncTickets?: boolean
      topKCustomer?: number
      topKTicket?: number
    },
  ) =>
    req<{
      ok: boolean
      memoryEnabled: boolean
      sessionId: string
      query: string
      syncedTickets: number
      customer: { rawContext: string; snippets: string[] }
      ticket: { rawContext: string; snippets: string[] }
      generatedAt: string
      reason?: string
    }>('/chat/memory-preview', authed(token, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    })),
  getAaakConfig: (token: string) =>
    req<{
      ok: boolean
      enabled: boolean
      name: string
    }>('/chat/aaak-config', authed(token)),
  updateAaakConfig: (token: string, body: { enabled?: boolean; name?: string }) =>
    req<{
      ok: boolean
      enabled: boolean
      name: string
    }>('/chat/aaak-config', authed(token, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    })),
}

// ── Warehouse / Product catalog ─────────────────────────────
export const warehouse = {
  listProducts: (token: string, params?: {
    page?: number
    limit?: number
    search?: string
    category?: string
    subCategory?: string
    brand?: string
    tag?: string
    useCase?: string
    showInStore?: boolean
  }) => {
    const q = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') q.set(k, String(v))
    })
    return req<WarehouseProductListResponse>(`/warehouse/products?${q.toString()}`, authed(token))
  },
  listProductsWithFreshness: (token: string, params?: {
    page?: number
    limit?: number
    search?: string
    category?: string
    subCategory?: string
    brand?: string
    tag?: string
    useCase?: string
    showInStore?: boolean
  }) => {
    const q = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') q.set(k, String(v))
    })
    return req<(WarehouseProductWithFreshness | WarehouseProductListResponse)>(`/warehouse/products-with-freshness?${q.toString()}`, authed(token))
  },
  createProduct: (token: string, data: WarehouseProductInput) =>
    req<WarehouseProduct>('/warehouse/products', authed(token, {
      method: 'POST',
      body: JSON.stringify(data),
    })),
  updateProduct: (token: string, id: string, data: Partial<WarehouseProductInput>) =>
    req<WarehouseProduct>(`/warehouse/products/${id}`, authed(token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })),
  listStoreProducts: (params?: {
    page?: number
    limit?: number
    search?: string
    category?: string
    useCase?: string
  }) => {
    const q = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') q.set(k, String(v))
    })
    return req<WarehouseProductListResponse>(`/store/products?${q.toString()}`)
  },
  getStoreProduct: (id: string) =>
    req<WarehouseProduct>(`/store/products/${id}`),
  createStoreOrder: (data: StoreOrderInput) =>
    req<StoreOrderCreateResponse>('/store/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  importVatPdf: (token: string, file: File, opts?: { markupRate?: number; tags?: string[]; useCases?: string[] }) => {
    const fd = new FormData()
    fd.append('file', file)
    if (opts?.markupRate) fd.append('markupRate', String(opts.markupRate))
      ; (opts?.tags || []).forEach((tag) => fd.append('tags', tag))
      ; (opts?.useCases || []).forEach((useCase) => fd.append('useCases', useCase))
    return req<WarehouseVatPreviewResponse>('/warehouse/products/import-vat-pdf', authed(token, {
      method: 'POST',
      body: fd,
    }))
  },
  commitVatImport: (token: string, items: WarehouseProductInput[]) =>
    req<WarehouseVatImportResponse>('/warehouse/products/import-vat-commit', authed(token, {
      method: 'POST',
      body: JSON.stringify({ items }),
    })),
  listServices: (token: string, search = '') =>
    req<{ items: WarehouseServiceItem[] }>(`/warehouse/services?search=${encodeURIComponent(search)}`, authed(token)),
  createService: (token: string, data: WarehouseServiceInput) =>
    req<WarehouseServiceItem>('/warehouse/services', authed(token, {
      method: 'POST',
      body: JSON.stringify(data),
    })),
  updateService: (token: string, id: string, data: Partial<WarehouseServiceInput>) =>
    req<WarehouseServiceItem>(`/warehouse/services/${id}`, authed(token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })),
  listBundles: (token: string, search = '') =>
    req<{ items: WarehouseBundle[] }>(`/warehouse/bundles?search=${encodeURIComponent(search)}`, authed(token)),
  createBundle: (token: string, data: WarehouseBundleInput) =>
    req<WarehouseBundle>('/warehouse/bundles', authed(token, {
      method: 'POST',
      body: JSON.stringify(data),
    })),
  updateBundle: (token: string, id: string, data: Partial<WarehouseBundleInput>) =>
    req<WarehouseBundle>(`/warehouse/bundles/${id}`, authed(token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })),
  listCatalogs: (token: string, search = '') =>
    req<{ items: WarehouseCatalog[] }>(`/warehouse/catalogs?search=${encodeURIComponent(search)}`, authed(token)),
  createCatalog: (token: string, data: WarehouseCatalogInput) =>
    req<WarehouseCatalog>('/warehouse/catalogs', authed(token, {
      method: 'POST',
      body: JSON.stringify(data),
    })),
  updateCatalog: (token: string, id: string, data: Partial<WarehouseCatalogInput>) =>
    req<WarehouseCatalog>(`/warehouse/catalogs/${id}`, authed(token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })),
  recommend: (token: string, params?: { useCase?: string; budget?: number; category?: string }) => {
    const q = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') q.set(k, String(v))
    })
    return req<{ products: WarehouseProduct[]; bundles: WarehouseBundle[] }>(`/warehouse/recommend?${q.toString()}`, authed(token))
  },
  listSolutions: (token: string, search = '') =>
    req<{ items: Solution[] }>(`/warehouse/solutions?search=${encodeURIComponent(search)}`, authed(token)),
  createSolution: (token: string, data: SolutionInput) =>
    req<Solution>('/warehouse/solutions', authed(token, {
      method: 'POST',
      body: JSON.stringify(data),
    })),
  getSolution: (token: string, id: string) =>
    req<Solution>(`/warehouse/solutions/${id}`, authed(token)),
  getSolutionsByRequirements: (token: string, params?: { useCase?: string; area?: number; budget?: number }) => {
    const q = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') q.set(k, String(v))
    })
    return req<Solution[]>(`/warehouse/solutions/search/by-requirements?${q.toString()}`, authed(token))
  },
  generateQuote: (token: string, data: QuotePayload) =>
    req<Quote>('/warehouse/quotes', authed(token, {
      method: 'POST',
      body: JSON.stringify(data),
    })),
  listQuotes: (token: string, filters?: { status?: string; search?: string; customerEmail?: string }) => {
    const q = new URLSearchParams()
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') q.set(k, String(v))
    })
    return req<{ items: Quote[] }>(`/warehouse/quotes?${q.toString()}`, authed(token))
  },
  getQuote: (token: string, id: string) =>
    req<Quote>(`/warehouse/quotes/${id}`, authed(token)),
  updateQuoteStatus: (token: string, id: string, status: string) =>
    req<Quote>(`/warehouse/quotes/${id}/status`, authed(token, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })),
  quoteToProject: (token: string, quoteId: string, data: {
    name?: string
    type?: string
    startDate?: string
    endDate?: string
    customerId?: string
  }) =>
    req<ProjectSummary>(`/warehouse/quotes/${quoteId}/to-project`, authed(token, {
      method: 'POST',
      body: JSON.stringify(data),
    })),
  listStoreOrders: (token: string, filters?: { status?: string; paymentStatus?: string }) => {
    const q = new URLSearchParams()
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') q.set(k, String(v))
    })
    return req<{ orders: any[] }>(`/warehouse/store-orders?${q.toString()}`, authed(token))
  },
  updateStoreOrderStatus: (token: string, orderId: string, status: string) =>
    req<any>(`/warehouse/store-orders/${orderId}/status`, authed(token, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })),
  updateStoreOrderPayment: (token: string, orderId: string, data: { paymentStatus: string; paymentMethod?: string }) =>
    req<any>(`/warehouse/store-orders/${orderId}/payment`, authed(token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })),
  manualRestoreOrderStock: (token: string, orderId: string) =>
    req<{ ok: boolean; message: string }>(`/warehouse/store-orders/${orderId}/restore-stock`, authed(token, {
      method: 'POST',
    })),
}

// ── Exams ────────────────────────────────────────────────────
export { exams, profiles, feedback } from './mongo-api'

export interface TeacherProfile {
  uid: string
  email: string
  fullName: string
  phone?: string
  position?: string
  subjectSpecialization?: string
  workplaces: string[]
  defaultWorkplace?: string
  gradeLevels: number[]
  bio?: string
  updatedAt?: string
}

export interface TeacherFeedback {
  _id?: string
  type: 'BUG' | 'FEATURE' | 'CONTENT' | 'UX' | 'OTHER'
  priority: 'LOW' | 'NORMAL' | 'HIGH'
  title: string
  message: string
  contactBack: boolean
  page?: string
  status?: 'NEW' | 'REVIEWING' | 'DONE'
  ownerId?: string
  createdAt?: string
}

export interface ExamSubject {
  _id: string; name: string; code: string; gradeLevels: number[]; color: string; isActive: boolean; ownerId?: string
}
export interface ExamQuestion {
  _id: string
  subjectId: string | ExamSubject
  gradeLevel: number
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'QUIZ' | 'POLL'
  content: string
  options?: { key: string; content: string }[]
  correctAnswer?: string
  statements?: { key: string; content: string; answer: boolean }[]
  shortAnswer?: string
  difficulty: 'NHAN_BIET' | 'THONG_HIEU' | 'VAN_DUNG' | 'VAN_DUNG_CAO'
  chapter?: string
  topic?: string
  tags: string[]
  usageCount: number
  isActive: boolean
  createdAt?: string
}
export interface ExamItem {
  _id: string
  title: string
  description?: string
  subjectId: string | ExamSubject
  gradeLevel: number
  examType: string
  schoolYear?: string
  semester?: number
  timeLimit: number
  variantCount: number
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  accessCode?: string
  defaultSchool: string
  structure: {
    part1Count: number; part1ScorePerQ: number
    part1Difficulty: Record<string, number>
    part2Count: number; part2Scoring: { correct1: number; correct2: number; correct3: number; correct4: number }
    part3Count: number; part3ScorePerQ: number
  }
  /** IDs of manually assigned questions (empty = will be auto-sampled at publish time) */
  part1Questions?: string[]
  part2Questions?: string[]
  part3Questions?: string[]
  sessionCount: number
  createdAt?: string
}

export interface QuizSet {
  _id: string
  title: string
  description?: string
  questions: Array<{
    prompt: string
    choices: Array<{ text: string }>
    correctIndex: number
    explanation?: string
  }>
  subjectId?: string
  gradeLevel?: number
  createdAt?: string
}

export interface QuizSessionAdmin {
  session: {
    _id: string
    code: string
    status: 'WAITING' | 'LIVE' | 'ENDED'
    currentQuestionIndex: number
    timePerQuestion: number
  }
  set: {
    _id: string
    title: string
    questionCount: number
  }
  currentQuestion: null | {
    index: number
    prompt: string
    choices: Array<{ text: string }>
    correctIndex: number
  }
  participants: Array<{ _id: string; name: string; score: number; correctCount: number }>
  answerStats: { totalAnswers: number; distribution: Record<string, number> }
}

export interface QuizPublicState {
  session: {
    _id: string
    code: string
    status: 'WAITING' | 'LIVE' | 'ENDED'
    currentQuestionIndex: number
    timePerQuestion: number
  }
  set: {
    _id: string
    title: string
    questionCount: number
  }
  question: null | {
    index: number
    prompt: string
    choices: Array<{ text: string }>
  }
  participant: null | {
    _id: string
    name: string
    score: number
    correctCount: number
    lastAnsweredIndex: number
  }
  leaderboard: Array<{ _id: string; name: string; score: number; correctCount: number }>
}

export interface PollSet {
  _id: string
  title: string
  description?: string
  questions: Array<{
    prompt: string
    type: 'SINGLE_CHOICE' | 'YES_NO' | 'TEXT'
    options: Array<{ text: string }>
    durationSeconds?: number
    showResults?: boolean
  }>
  createdAt?: string
}

export interface PollResultStats {
  totalResponses: number
  distribution: Record<string, number>
  textResponses: Array<{ _id?: string; text: string; participantName?: string }>
}

export interface PollSessionAdmin {
  session: {
    _id: string
    code: string
    status: 'WAITING' | 'LIVE' | 'ENDED'
    currentQuestionIndex: number
  }
  set: {
    _id: string
    title: string
    questionCount: number
  }
  currentQuestion: null | {
    index: number
    prompt: string
    type: 'SINGLE_CHOICE' | 'YES_NO' | 'TEXT'
    options: Array<{ text: string }>
    durationSeconds: number
    questionStartedAt?: string | null
    questionEndsAt?: string | null
    secondsLeft: number
    isQuestionClosed: boolean
    showResults: boolean
  }
  participants: Array<{ _id: string; name: string; isAnonymous?: boolean; lastAnsweredIndex: number }>
  responseStats: PollResultStats
}

export interface PollPublicState {
  session: {
    _id: string
    code: string
    status: 'WAITING' | 'LIVE' | 'ENDED'
    currentQuestionIndex: number
  }
  set: {
    _id: string
    title: string
    questionCount: number
  }
  question: null | {
    index: number
    prompt: string
    type: 'SINGLE_CHOICE' | 'YES_NO' | 'TEXT'
    options: Array<{ text: string }>
    durationSeconds: number
    questionStartedAt?: string | null
    questionEndsAt?: string | null
    secondsLeft: number
    isQuestionClosed: boolean
    showResults: boolean
  }
  participant: null | {
    _id: string
    name: string
    isAnonymous?: boolean
    lastAnsweredIndex: number
  }
  participantCount: number
  results: PollResultStats | null
}

export interface ExamSessionResult {
  _id: string
  variantCode: number
  studentInfo: { fullName: string; className: string; school: string }
  score?: number
  scoreBreakdown?: { part1Score: number; part2Score: number; part3Score: number }
  status: string
  startedAt: string
  submittedAt?: string
  timeSpent?: number
}

export interface ExamStudent {
  _id: string
  fullName: string
  className: string
  academicYear: string
  school: string
  scoresByExamType?: Record<string, ExamStudentScoreCell>
  createdAt?: string
}

export interface ExamStudentScoreCell {
  resultId: string
  score: number
  percentage: number
  examTitle: string
  submittedAt: string
  examType?: string
  semester?: number
}

export interface ExamStudentListResponse {
  total: number
  page: number
  limit: number
  items: ExamStudent[]
  scoreColumns: string[]
  filterOptions: {
    academicYears: string[]
    classNames: string[]
    schools: string[]
  }
}

export interface ExamStudentResultItem {
  _id: string
  examId: { _id: string; title?: string; examType?: string; semester?: number; schoolYear?: string } | string
  sessionId: string
  fullName: string
  className: string
  academicYear: string
  school: string
  score: number
  maxScore: number
  percentage: number
  scoreBreakdown?: any
  unansweredCount: number
  answeredCount: number
  totalQuestions: number
  timeSpentSeconds: number
  status: 'SUBMITTED' | 'TIMED_OUT' | 'INCOMPLETE'
  submittedAt: string
}

export interface ExamResultReport {
  totalResults: number
  avgScore: number
  maxScore: number
  minScore: number
  passRate: number
  topResults: Array<{
    _id: string
    fullName: string
    className: string
    academicYear: string
    school: string
    score: number
    percentage: number
    submittedAt: string
    examId: { _id: string; title?: string } | string
  }>
}

// ── Types ───────────────────────────────────────────────────
export interface User {
  id: string; email: string; name: string; role: string; organizationId?: string
}

export interface LicenseFeatureSet {
  exams?: boolean
  ai?: boolean
  advancedReports?: boolean
}

export interface LicenseSummary {
  _id: string
  organizationId: string
  planCode: string
  startsAt: string
  expiresAt: string
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'
  features?: LicenseFeatureSet
  aiQuotaMonthly?: number
  aiUsedMonthly?: number
}

export interface LicensingMeResponse {
  organization?: {
    _id: string
    name: string
    status: 'ACTIVE' | 'SUSPENDED'
  } | null
  license?: LicenseSummary | null
  isActive: boolean
}

export interface LicenseActivateResponse {
  ok: boolean
  planCode: string
  startsAt: string
  expiresAt: string
  aiQuotaMonthly: number
  features: LicenseFeatureSet
}

export interface CreateLicenseKeyInput {
  durationMonths: number
  planCode?: string
  aiQuotaMonthly?: number
  exams?: boolean
  ai?: boolean
  advancedReports?: boolean
  note?: string
}

export interface CreatedLicenseKey {
  key: string
  keyId: string
  durationMonths: number
  planCode: string
  features: LicenseFeatureSet
  aiQuotaMonthly: number
  createdBy?: string
}
export interface Article {
  _id?: string; id?: string; source: string; title?: string; titleVi?: string; summaryVi?: string
  summaryAi?: string; contentVi?: string; link: string; thumbnail?: string; tag?: string
  publishedAt: string; translated: boolean; published?: boolean
}
export interface ItService {
  _id: string
  name: string
  basePrice: number
  estimatedTime: number
  active: boolean
}

export interface Ticket {
  _id: string
  ticketNo: string
  title: string
  description: string
  status: string
  priority: string
  category?: string
  serviceId?: ItService
  refType?: string
  refId?: string
  createdAt: string
  projectId?: string | { _id: string; projectNo?: string; name?: string }
  assignedTo?: { name?: string; email?: string }
  createdBy?: { name?: string; email?: string }
  marketingContent?: {
    facebook_post?: string
    tiktok_script?: string
    tiktok_video_url?: string
    video_progress_pct?: number
    video_stage?: string
    video_attempt?: number
    video_max_attempts?: number
    video_last_polled_at?: string
    status?: 'IDLE' | 'GENERATING_CONTENT' | 'GENERATING_VIDEO' | 'COMPLETED' | 'FAILED'
    error?: string
    generatedAt?: string
  }
}
export interface TicketStatsResponse {
  total: number
  byStatus: { _id: string; count: number }[]
  byPriority: { _id: string; count: number }[]
}
export interface TicketListResponse {
  tickets: Ticket[]
  total: number
  page: number
  pages: number
}
export interface ProjectSummary {
  _id: string
  projectNo: string
  name: string
  description?: string
  client: string
  customerId?: string | { _id: string; name?: string; email?: string; company?: string }
  type: string
  status: string
  progress: number
  budget: number
  spent: number
  documents?: ProjectDocumentFile[]
  quoteItems?: ProjectQuoteItem[]
  quoteTotal?: number
  quoteHtml?: string
  contractHtml?: string
  contractModel?: string
  contractUpdatedAt?: string
  contractSentAt?: string
  contractSentTo?: string
  warrantyEnd?: string
  publishToWebsite?: boolean
  publicAiSummary?: string
  publicAiModel?: string
  publicAiUpdatedAt?: string
  marketingImages?: string[]
  marketingContent?: {
    facebook_post?: string;
    tiktok_script?: string;
    tiktok_video_url?: string;
    video_progress_pct?: number;
    video_stage?: string;
    video_attempt?: number;
    video_max_attempts?: number;
    video_last_polled_at?: string;
    status?: 'IDLE' | 'GENERATING_CONTENT' | 'GENERATING_VIDEO' | 'COMPLETED' | 'FAILED';
    error?: string;
    generatedAt?: Date;
  }
  createdAt?: string
  updatedAt?: string
}
export interface ProjectDocumentFile {
  name: string
  url: string
  category?: string
  source?: string
  contentType?: string
  size?: number
  uploadedAt?: string
}
export interface ProjectQuoteItem {
  name: string
  quantity: number
  unitPrice: number
  total: number
  costWithVat?: number
  description?: string
  thumbnailUrl?: string
}
export interface ProjectPayload {
  projectNo?: string
  name: string
  description?: string
  client: string
  customerId?: string | null
  type: string
  status?: string
  progress?: number
  budget: number
  spent?: number
  startDate?: string
  endDate?: string
  warrantyMonths?: number
  documents?: ProjectDocumentFile[]
  publishToWebsite?: boolean
  tags?: string[]
}

export interface PublicProjectItem {
  _id: string
  projectNo: string
  name: string
  type: string
  status: string
  progress: number
  budget: number
  client: string
  description: string
  images?: string[]
  aiGenerated?: boolean
  publicAiModel?: string
  publicAiUpdatedAt?: string
  updatedAt?: string
}
export interface ProjectQuotePayload {
  name?: string
  description?: string
  items: Array<{
    name: string
    quantity: number
    unitPrice: number
    costWithVat?: number
    description?: string
    thumbnailUrl?: string
    warrantyMonths?: number
  }>
}
export interface ProjectListResponse {
  projects: ProjectSummary[]
  total: number
  page: number
  pages: number
}

export interface ProjectWarrantyCheckResult {
  _id: string
  projectNo: string
  projectName: string
  client: string
  warrantyEnd?: string
  matchedItems: Array<{
    name: string
    quantity: number
  }>
}
export interface LandingConfig {
  logoUrl?: string; faviconUrl?: string
  // hero stats removed — stats are no longer part of LandingConfig
  svcTitle: string; svcDesc: string
  portTitle: string; portDesc: string
  teamTitle: string; ctaTitle: string
  phone: string; email: string; address: string
  hours: string; hotline: string; hotlineNote: string
  footerDesc: string; copyright: string; botGreeting: string
  heroBannerUrl?: string
  heroBannerTitle?: string
  heroInlineText?: string
  heroCardExamImageUrl?: string
  heroCardHelpdeskImageUrl?: string
  heroCardCctvImageUrl?: string
  heroCardExamTitle?: string
  heroCardHelpdeskTitle?: string
  heroCardCctvTitle?: string
  heroCardExamCtaHref?: string
  heroCardHelpdeskCtaHref?: string
  heroCardCctvCtaHref?: string
  heroCta1Href?: string
  heroBannerImageContext?: string
  heroCardExamImageContext?: string
  heroCardHelpdeskImageContext?: string
  heroCardCctvImageContext?: string
  storeBannerUrl?: string

  // Mishmash-style editable UI controls
  navbarLeftPrimaryLabel?: string
  navbarLeftPrimaryHref?: string
  navbarLeftSecondaryLabel?: string
  navbarLeftSecondaryHref?: string
  navbarCenterFallbackText?: string
  navbarIconWishlistHref?: string
  navbarIconBagHref?: string
  navbarIconAccountHref?: string
  navbarBgColor?: string
  navbarTextColor?: string

  storeEyebrow?: string
  storeTitle?: string
  storeDesc?: string
  storeHeroBadge?: string
  storeHeroTitle?: string
  storeHeroDesc?: string
  storeStep1Title?: string
  storeStep1Desc?: string
  storeStep2Title?: string
  storeStep2Desc?: string
  storeStep3Title?: string
  storeStep3Desc?: string

  containerMain2k?: string
  containerStore2k?: string
  containerNav2k?: string

  mishUiJson?: string
}
export interface LandingStats {
  completedProjects: number
  cameraInstalled: string
  uptime: string
  satisfaction: string
}
export interface SystemHealthItem {
  key: string
  label: string
  status: 'UP' | 'DEGRADED' | 'DOWN'
  text: string
  color: string
  latencyMs: number | null
  detail?: any
  checkedAt: string
}
export interface SystemHealthResponse {
  ok: boolean
  generatedAt: string
  items: SystemHealthItem[]
  summary: {
    up: number
    degraded: number
    down: number
  }
}

export interface SystemIncidentCenterResponse {
  ok: boolean
  generatedAt: string
  overall: 'healthy' | 'warning' | 'critical'
  summary: {
    critical: number
    warning: number
    info: number
  }
  metrics: {
    pendingUpdates: number
    pendingOps: number
    webhookError: string
    aiUrl: string
  }
  slos: Array<{
    key: string
    label: string
    target: number
    observed: number
    status: 'met' | 'risk' | 'breach'
  }>
  alerts: Array<{
    id: string
    level: 'critical' | 'warning' | 'info'
    title: string
    detail: string
    source: string
  }>
}

export interface AlertRule {
  _id?: string
  key: string
  label?: string
  targetPercentage: number
  severity: 'critical' | 'warning' | 'info'
  enabled: boolean
  description?: string
  source?: string
  createdBy?: string
  isDefault?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface SystemAlertRuleResponse {
  ok: boolean
  data: AlertRule
}

export interface SystemAlertRulesListResponse {
  ok: boolean
  data: AlertRule[]
}

export interface AlertEvent {
  _id?: string
  ruleKey: string
  level: 'critical' | 'warning' | 'info'
  ruleId: string
  ruleName?: string
  before?: number
  observed?: number
  threshold?: number
  breached?: boolean
  triggeredAt?: string
  metrics?: Record<string, any>
  notificationChannels?: string[]
  notificationStatus?: {
    telegram?: { sent: boolean; error?: string; messageId?: string; sentAt?: string }
    email?: { sent: boolean; error?: string; recipients?: string[]; sentAt?: string }
    slack?: { sent: boolean; error?: string; sentAt?: string }
  }
  resolvedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface SystemCheckAlertsResponse {
  ok: boolean
  triggeredCount: number
  alerts: AlertEvent[]
}

export interface SystemAlertEventsResponse {
  ok: boolean
  data: AlertEvent[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface Customer {
  _id: string
  email: string
  name: string
  role: string
  phone?: string
  company?: string
  customerType?: 'individual' | 'company'
  address?: string
  contactPerson?: string
  contactPhone?: string
  taxId?: string
  isActive: boolean
  createdAt?: string
}
export interface CustomerCreateInput {
  email: string
  name: string
  phone?: string
  company?: string
  customerType?: 'individual' | 'company'
  address?: string
  contactPerson?: string
  contactPhone?: string
  taxId?: string
}
export interface CustomerUpdateInput {
  name?: string
  phone?: string
  company?: string
  isActive?: boolean
  customerType?: 'individual' | 'company'
  address?: string
  contactPerson?: string
  contactPhone?: string
  taxId?: string
}
export interface CustomerOverview {
  customer: Customer
  summary: {
    totalTickets: number
    openTickets: number
    totalProjects: number
    activeProjects: number
    totalLeads: number
  }
  tickets: Ticket[]
  projects: ProjectSummary[]
  leads: LeadItem[]
}
export interface CctvQuoteInput {
  customerName: string; customerPhone: string; customerEmail?: string
  area: number; indoorCams: number; outdoorCams: number
  cameraType: string; includeCable: boolean; includeInstall: boolean
}
export interface CctvQuote extends CctvQuoteInput {
  id: string; quoteNo: string; total: number; estimatedDays: number
}
export interface ContactInput {
  name: string; phone: string; email?: string; service?: string; message?: string
}
export interface ChatLogItem {
  _id: string
  sessionId: string
  userId?: string
  source: string
  messages: { role: string; content: string }[]
  assistantReply: string
  model?: string
  createdAt: string
}
export interface ChatLogListResponse {
  items: ChatLogItem[]
  total: number
  page?: number
  pages?: number
  sessionId?: string
}
export interface TelegramOpsItem {
  _id: string
  kind: 'AI_REVIEW' | 'APPROVAL'
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MANUAL' | 'DONE'
  source?: string
  sessionId?: string
  sourceChannel?: string
  title?: string
  question?: string
  draft?: string
  finalReply?: string
  stopMessage?: string
  overrideReply?: string
  planSummary?: string
  escalationReason?: string
  confidence?: number
  payload?: Record<string, any>
  decision?: string
  decisionNote?: string
  actedByChatId?: string
  actedAt?: string
  createdAt: string
  updatedAt: string
}
export interface TelegramOpsListResponse {
  items: TelegramOpsItem[]
  total: number
  page: number
  pages: number
}

export type TelegramSystemHealthResponse = {
  ok: boolean
  now: string
  telegram: {
    botConfigured: boolean
    webhookSecretEnabled: boolean
    allowedChatIds: string[]
    webhook: {
      url: string
      pendingUpdateCount: number
      lastErrorMessage: string
      lastErrorDate: number | null
    }
  }
  ai: {
    url: string
    healthy: boolean
    status: number
    error: string
  }
  database: {
    mgmt: string
    chatbot: string
  }
}

export interface TelegramAuditLogItem {
  _id: string
  actorUserId?: string
  actorRole?: string
  action: string
  targetType?: string
  targetId?: string
  source?: string
  ip?: string
  userAgent?: string
  meta?: Record<string, any>
  createdAt: string
}

export interface TelegramAuditLogListResponse {
  items: TelegramAuditLogItem[]
  total: number
  page: number
  pages: number
}

export interface TelegramAutoHealResponse {
  ok: boolean
  requestedUrl: string
  setWebhook?: any
  webhookInfo?: {
    url?: string
    pending_update_count?: number
    last_error_message?: string
    last_error_date?: number
  }
}
export interface LeadItem {
  _id: string
  sessionId: string
  source: string
  name?: string
  phone?: string
  email?: string
  company?: string
  interests?: string[]
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  notes?: string
  nextAction?: string
  nextFollowUpAt?: string
  lastContactAt?: string
  linkedProjectId?: string
  customer?: {
    _id: string
    name?: string
    email?: string
    phone?: string
  }
  createdAt: string
}
export interface LeadListResponse {
  items: LeadItem[]
  total: number
  page: number
  pages: number
  stats: {
    new: number
    contacted: number
    qualified: number
    converted: number
  }
}
export interface LeadUpdateInput {
  name?: string
  phone?: string
  email?: string
  status?: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  notes?: string
  nextAction?: string
  nextFollowUpAt?: string | null
}

export interface LeadConfirmResponse {
  emailSent: boolean
  zaloSent: boolean
  reason?: string
}

export interface WarehouseProduct {
  _id: string
  name: string
  category: string
  subCategory: string
  price: number
  cost: number
  brand: string
  specs?: Record<string, string>
  features: string[]
  tags: string[]
  useCases: string[]
  stockQty: number
  vatRate: number
  warrantyMonths?: number
  stock: boolean
  active: boolean
  showInStore?: boolean
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface FreshnessMetadata {
  freshness: number
  freshnessBadge: 'green' | 'yellow' | 'red'
  lastUpdatedTime: string
  ageMinutes: number
  isStale: boolean
}

export interface WarehouseProductWithFreshness extends WarehouseProduct {
  freshness: FreshnessMetadata
}

export interface WarehouseProductInput {
  name: string
  category?: string
  subCategory?: string
  price?: number
  cost?: number
  brand?: string
  specs?: Record<string, string>
  features?: string[]
  tags?: string[]
  useCases?: string[]
  stockQty?: number
  vatRate?: number
  warrantyMonths?: number
  stock?: boolean
  active?: boolean
  showInStore?: boolean
  description?: string
  catalogId?: string
  newCatalogName?: string
}

export interface WarehouseProductListResponse {
  items: WarehouseProduct[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface StoreOrderInput {
  items: Array<{ productId: string; quantity: number }>
  customer: {
    name: string
    phone: string
    email?: string
    address?: string
    note?: string
  }
}

export interface StoreOrderCreateResponse {
  ok: boolean
  order: {
    _id: string
    orderNo: string
    status: string
    subtotal: number
    vat: number
    total: number
    createdAt?: string
  }
}

export interface WarehouseVatImportResponse {
  ok: boolean
  message: string
  created: number
  updated: number
  products: WarehouseProduct[]
}

export interface WarehouseVatPreviewResponse {
  ok: boolean
  mode: 'preview'
  message: string
  extractedRows: number
  items: WarehouseProductInput[]
}

export interface WarehouseServiceItem {
  _id: string
  name: string
  category: string
  description?: string
  unitPrice: number
  cost: number
  tags: string[]
  active: boolean
}

export interface WarehouseServiceInput {
  name: string
  category?: string
  description?: string
  unitPrice?: number
  cost?: number
  tags?: string[]
  active?: boolean
}

export interface WarehouseBundleItem {
  productId: string | WarehouseProduct
  quantity: number
}

export interface WarehouseBundle {
  _id: string
  name: string
  category: string
  items: WarehouseBundleItem[]
  suggestedPrice: number
  active: boolean
  notes?: string
}

export interface WarehouseBundleInput {
  name: string
  category?: string
  items: Array<{ productId: string; quantity: number }>
  suggestedPrice?: number
  active?: boolean
  notes?: string
}

export interface WarehouseCatalog {
  _id: string
  name: string
  description?: string
  category: string
  productIds: Array<string | WarehouseProduct>
  active: boolean
}

export interface WarehouseCatalogInput {
  name: string
  description?: string
  category?: string
  productIds: string[]
  active?: boolean
}
export interface SolutionComponent {
  productId: string | WarehouseProduct
  quantity: number
  type: string // 'camera' | 'nvr' | 'storage' | 'network' | 'service'
}

export interface Solution {
  _id: string
  name: string
  description?: string
  category: string
  components: SolutionComponent[]
  aggregated?: Record<string, any>
  baseCost: number
  suggestedPrice: number
  bundleDiscount: number
  suitableFor: string[]
  useCase: string
  maxArea: number
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface SolutionInput {
  name: string
  description?: string
  category?: string
  components: Array<{ productId: string; quantity: number; type: string }>
  aggregated?: Record<string, any>
  baseCost?: number
  suggestedPrice?: number
  bundleDiscount?: number
  suitableFor?: string[]
  useCase?: string
  maxArea?: number
  active?: boolean
}

export interface QuoteItem {
  name: string
  productId?: string | WarehouseProduct
  quantity: number
  unitPrice: number
  vatRate: number
  subtotal: number
  vat: number
  total: number
  notes?: string
}

export interface QuoteRequirements {
  useCase?: string
  area?: number
  cameraCount?: number
  budget?: number
  storageTime?: number
}

export interface QuoteCustomer {
  name: string
  phone: string
  email: string
  company?: string
}

export interface Quote {
  _id: string
  quoteNo: string
  customer: QuoteCustomer
  requirements: QuoteRequirements
  items: QuoteItem[]
  subtotal: number
  vat: number
  total: number
  discount: number
  finalPrice: number
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'completed'
  validUntil?: string
  createdBy?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export interface QuotePayload {
  customerName: string
  customerPhone: string
  customerEmail: string
  customerCompany?: string
  requirements?: QuoteRequirements
  productIds?: string[]
  notes?: string
}
