import { ConfigService } from '@nestjs/config'

export type PromptAudience = 'internal' | 'specialist'
export type PromptTask =
  | 'exam_support'
  | 'answer_explanation'
  | 'question_generation'
  | 'question_analysis'
export type PromptOutputFormat = 'markdown' | 'json' | 'html' | 'plain'

export interface CompanyPromptContext {
  companyName: string
  officeArea: string
  phone: string
  email: string
  address: string
}

export interface PromptContextSection {
  title: string
  content?: string | null
}

export interface UnifiedPromptInput {
  audience: PromptAudience
  task: PromptTask
  company: CompanyPromptContext
  currentTaskLabel?: string
  currentInput?: string
  ragContext?: string
  history?: string
  contextSections?: PromptContextSection[]
  outputFormat?: PromptOutputFormat
  outputSchemaDescription?: string
  extraRules?: string[]
}

// ⚠️  Các giá trị mặc định này sẽ được ghi đè bởi biến môi trường:
// COMPANY_NAME, COMPANY_PHONE, COMPANY_EMAIL, COMPANY_ADDRESS, COMPANY_OFFICE_AREA
// Hãy đặt đúng các biến này trong file .env để AI dùng thông tin thật!
export const DEFAULT_COMPANY_PROMPT_CONTEXT: CompanyPromptContext = {
  companyName: 'Greenfield',
  officeArea: 'TP.HCM',
  phone: '',
  email: '',
  address: '',
}

const compact = (value?: string | null) => String(value || '').trim()

export function resolveCompanyPromptContext(
  config?: ConfigService,
  overrides: Partial<CompanyPromptContext> = {},
): CompanyPromptContext {
  return {
    companyName: compact(overrides.companyName)
      || compact(config?.get<string>('COMPANY_NAME'))
      || DEFAULT_COMPANY_PROMPT_CONTEXT.companyName,
    officeArea: compact(overrides.officeArea)
      || compact(config?.get<string>('COMPANY_OFFICE_AREA'))
      || 'TP.HCM',
    phone: compact(overrides.phone)
      || compact(config?.get<string>('COMPANY_PHONE'))
      || compact(config?.get<string>('SUPPORT_PHONE'))
      || DEFAULT_COMPANY_PROMPT_CONTEXT.phone,
    email: compact(overrides.email)
      || compact(config?.get<string>('COMPANY_EMAIL'))
      || compact(config?.get<string>('SUPPORT_EMAIL'))
      || DEFAULT_COMPANY_PROMPT_CONTEXT.email,
    address: compact(overrides.address)
      || compact(config?.get<string>('COMPANY_ADDRESS'))
      || DEFAULT_COMPANY_PROMPT_CONTEXT.address,
  }
}

function buildIdentityBlock(audience: PromptAudience, company: CompanyPromptContext) {
  if (audience === 'internal') {
    return [
      '[HÀNH VI & DANH TÍNH]',
      `Bạn là trợ lý Trí tuệ Nhân tạo nội bộ của ${company.companyName}.`,
      'Bạn đang hỗ trợ nhân viên nội bộ (Admin/Sales/Kho/Kỹ thuật), không phải khách hàng cuối.',
      'Giọng văn phải ngắn gọn, trực diện, chính xác, ưu tiên số liệu và hành động cụ thể.',
      '',
      '[THÔNG TIN DOANH NGHIỆP DYNAMIC]',
      `Tên công ty: ${company.companyName}`,
      `Khu vực phục vụ chính: ${company.officeArea}`,
      ...(company.phone ? [`Hotline: ${company.phone}`] : []),
      ...(company.email ? [`Email: ${company.email}`] : []),
      ...(company.address ? [`Địa chỉ: ${company.address}`] : []),
      '',
      '[QUY TẮC XƯNG HÔ - QUAN TRỌNG]',
      '- Giao tiếp như một trợ lý nội bộ chuyên nghiệp.',
      '- Không dùng giọng bán hàng, không dùng từ ngữ quá tình cảm.',
      '- Ưu tiên trả lời ngắn, có cấu trúc, dễ chuyển tiếp cho khách hàng nếu cần.',
    ].join('\n')
  }

  const toneLine = audience === 'specialist'
    ? 'Giọng văn phải chuyên nghiệp, chuẩn thương hiệu, bám chặt dữ liệu đầu vào và mục tiêu tác vụ.'
    : 'Giọng văn phải chân thành, chuyên nghiệp, tận tâm, gần gũi theo phong cách phục vụ miền Nam.'

  return [
    '[HÀNH VI & DANH TÍNH]',
    `Bạn là Chuyên viên Tư vấn Trí tuệ Nhân tạo của ${company.companyName}.`,
    `Bạn đang hỗ trợ khách hàng tại khu vực ${company.officeArea}.`,
    toneLine,
    '',
    '[THÔNG TIN LIÊN HỆ DYNAMIC]',
    ...(company.phone ? [`Hotline: ${company.phone}`] : []),
    ...(company.email ? [`Email: ${company.email}`] : []),
    ...(company.address ? [`Địa chỉ: ${company.address}`] : []),
    '',
    '[QUY TẮC XƯNG HÔ - QUAN TRỌNG]',
    '- Tuyệt đối không gọi khách hàng là "Zai", "ông chủ" hay tên riêng nếu chưa được phép.',
    '- Luôn gọi khách là: "Khách ơi", "Quý khách", hoặc "Dạ anh/chị".',
    `- Tự xưng là: "${company.companyName}" hoặc "Dạ em".`,
    '- Có thể kết thúc nhẹ nhàng bằng "ạ", "nhé", "nha", "nà" nhưng không lạm dụng.',
    '- Không nói quá suồng sã trong ngữ cảnh nghiêm túc như ticket, báo giá, hợp đồng, hỗ trợ sự cố.',
  ].join('\n')
}

function buildTaskRules(task: PromptTask, _audience: PromptAudience) {
  switch (task) {
    case 'exam_support':
      return [
        '[NHIỆM VỤ]',
        'Bạn đang làm tác vụ trợ lý phòng thi online.',
        '',
        '[NGUYÊN TẮC PHẢN HỒI]',
        '- Chỉ hỗ trợ quy định thi, thao tác làm bài, nộp bài, thời gian và lỗi kỹ thuật liên quan kỳ thi.',
        '- Nếu câu hỏi ngoài phạm vi thi, từ chối nhẹ nhàng và kéo người dùng về đúng phạm vi.',
        '- Ưu tiên trả lời dạng checklist hoặc từng bước ngắn.',
      ].join('\n')
    case 'answer_explanation':
      return [
        '[NHIỆM VỤ]',
        'Bạn là giáo viên giỏi đang giải thích đáp án cho học sinh cấp THPT tại Việt Nam.',
        '',
        '[NGUYÊN TẮC PHẢN HỒI]',
        '- Giải thích ngắn gọn, rõ ràng, dễ hiểu — tối đa 3-4 câu mỗi câu hỏi.',
        '- Chỉ ra tại sao đáp án đúng là đúng và tại sao các lựa chọn sai là sai (nếu cần).',
        '- Dùng ví dụ thực tế hoặc gợi ý cách nhớ nếu phù hợp.',
        '- Không giải thích dài dòng — ưu tiên ngắn gọn, dễ nhớ.',
        '- Phù hợp chương trình THPT Việt Nam (BGD).',
      ].join('\n')
    case 'question_generation':
      return [
        '[NHIỆM VỤ]',
        'Bạn là giáo viên soạn đề thi theo chuẩn BGD Việt Nam.',
        '',
        '[NGUYÊN TẮC PHẢN HỒI]',
        '- Câu hỏi phải chính xác về kiến thức, không sai lệch nội dung.',
        '- Đáp án phải rõ ràng, có duy nhất 1 đáp án đúng cho MULTIPLE_CHOICE.',
        '- Đảm bảo 4 lựa chọn A/B/C/D hợp lý, không có lựa chọn quá lộ liễu.',
        '- Nội dung phù hợp chương trình lớp được yêu cầu.',
      ].join('\n')
    case 'question_analysis':
      return [
        '[NHIỆM VỤ]',
        'Bạn là chuyên gia phân tích đề thi và thống kê học sinh.',
        '',
        '[NGUYÊN TẮC PHẢN HỒI]',
        '- Phân tích dựa trên dữ liệu thực tế từ kết quả thi.',
        '- Chỉ ra điểm mạnh/yếu của đề và của học sinh.',
        '- Đề xuất cải thiện cụ thể, có thể hành động ngay.',
      ].join('\n')
    default:
      return ''
  }
}

function buildSharedResponseRules(audience: PromptAudience) {
  const common = [
    '[NGUYÊN TẮC CHUNG]',
    '- Luôn ưu tiên dữ liệu thật từ hệ thống trước suy diễn.',
    '- Nếu không chắc, phải nói rõ phần chưa chắc và đề xuất bước tiếp theo.',
    '- Không bịa giá, model, tồn kho, thời gian xử lý, tiến độ hoặc thông tin liên hệ.',
    '- Nếu có mâu thuẫn dữ liệu, ưu tiên nguồn dữ liệu mới hơn hoặc nói rõ mâu thuẫn.',
  ]

  if (audience === 'internal') {
    common.push('- Tối ưu cho người dùng nội bộ: rõ số liệu, rõ hành động, ít xã giao.')
  } else {
    common.push('- Giữ sự lịch sự, ấm áp và đúng chuẩn thương hiệu khi giao tiếp với khách hàng.')
  }

  return common.join('\n')
}

function buildOutputContract(format: PromptOutputFormat = 'markdown', schema?: string) {
  const lines = ['[YÊU CẦU ĐẦU RA]']
  if (format === 'json') {
    lines.push('- Chỉ trả về JSON hợp lệ.')
    lines.push('- Không bọc trong markdown code block.')
    lines.push('- Không thêm diễn giải ngoài JSON.')
    if (compact(schema)) lines.push(`- Schema yêu cầu: ${compact(schema)}`)
    return lines.join('\n')
  }
  if (format === 'html') {
    lines.push('- Trả về HTML hoàn chỉnh hoặc fragment HTML theo đúng yêu cầu.')
    lines.push('- Không thêm markdown hoặc lời giải thích ngoài HTML.')
    return lines.join('\n')
  }
  if (format === 'plain') {
    lines.push('- Trả lời plain text, rõ ràng, không markdown nếu không cần.')
    return lines.join('\n')
  }
  lines.push('- Trả lời bằng Markdown rõ ràng, ưu tiên bullet list hoặc đoạn ngắn dễ đọc.')
  return lines.join('\n')
}

function buildContextSections(sections: PromptContextSection[] = [], ragContext?: string, history?: string) {
  const blocks: string[] = []

  if (compact(history)) {
    blocks.push(['[LỊCH SỬ HỘI THOẠI/TÁC VỤ]', compact(history)].join('\n'))
  }

  if (compact(ragContext)) {
    blocks.push(['[NGUỒN TRI THỨC (RAG)]', compact(ragContext)].join('\n'))
  }

  for (const section of sections) {
    if (!compact(section?.content)) continue
    blocks.push([`[${compact(section.title) || 'NGỮ CẢNH'}]`, compact(section.content)].join('\n'))
  }

  return blocks.filter(Boolean).join('\n\n')
}

export function buildUnifiedPrompt(input: UnifiedPromptInput) {
  const system = [
    buildIdentityBlock(input.audience, input.company),
    buildTaskRules(input.task, input.audience),
    buildSharedResponseRules(input.audience),
    buildOutputContract(input.outputFormat, input.outputSchemaDescription),
    ...(input.extraRules || []).map((rule) => compact(rule)).filter(Boolean),
  ].filter(Boolean).join('\n\n')

  const promptBlocks = [
    input.currentTaskLabel ? `[NHIỆM VỤ HIỆN TẠI]\n${input.currentTaskLabel}` : '',
    buildContextSections(input.contextSections, input.ragContext, input.history),
    input.currentInput ? `[YÊU CẦU/ĐẦU VÀO HIỆN TẠI]\n${compact(input.currentInput)}` : '',
  ].filter(Boolean)

  return {
    system,
    prompt: promptBlocks.join('\n\n').trim(),
  }
}
