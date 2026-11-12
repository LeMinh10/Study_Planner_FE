import { apiBaseUrl, useMockApi } from './config'
import { mockAuthRequest } from './mockAuth'

export const SESSION_INVALID_EVENT = 'studyplanner:session-invalid'
export const ACCOUNT_LOCKED_NOTICE = 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.'
export function isAccountDisabled(code: string) {
  return ['ACCOUNT_DISABLED', 'ACCOUNT_INACTIVE', 'USER_DISABLED'].includes(code.toUpperCase())
}
export function invalidateSession(token: string, code = '') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SESSION_INVALID_EVENT, { detail: { token, code } }))
}
export class ApiError extends Error {
  status: number
  code: string
  errors: Record<string, string[]>
  constructor(message: string, status = 0, code = '', errors: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = errors
  }
}

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export async function apiRequest(path: string, options: { method?: string; body?: unknown; token?: string; signal?: AbortSignal } = {}): Promise<unknown> {
  let response: Response
  try {
    response = useMockApi ? await mockAuthRequest(path, options) : await fetch(apiBaseUrl + path, {
      method: options.method || 'GET',
      headers: { Accept: 'application/json', ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}) },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: options.signal,
      cache: 'no-store',
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new ApiError('Không thể kết nối máy chủ. Vui lòng thử lại.')
  }
  return readApiResponse(response, options.token)
}

export async function readApiResponse(response: Response, token?: string): Promise<unknown> {
  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try { payload = JSON.parse(text) } catch {
      if (response.ok) throw new ApiError('Máy chủ trả về dữ liệu không hợp lệ.', response.status)
    }
  }
  if (!response.ok) {
    const problem = record(payload)
    const errors: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(record(problem.errors))) {
      if (typeof value === 'string') errors[key] = [value]
      else if (Array.isArray(value)) errors[key] = value.filter((item): item is string => typeof item === 'string')
    }
    const code = typeof problem.code === 'string' ? problem.code : ''
    const defaultMessage = response.status === 401 ? 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.'
      : response.status === 403 ? 'Tài khoản không có quyền truy cập hoặc đã bị vô hiệu hóa.'
      : response.status === 409 ? 'Email hoặc mã sinh viên đã được sử dụng.'
      : response.status === 429 ? 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.'
      : response.status >= 500 ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.' : 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.'
    const message = response.status >= 500 ? defaultMessage : [problem.detail, problem.thongBao, problem.message, ...Object.values(errors).flat(), problem.title].find((value) => typeof value === 'string' && value.trim()) || defaultMessage
    if (token && (response.status === 401 || isAccountDisabled(code))) invalidateSession(token, code)
    throw new ApiError(String(message), response.status, code, errors)
  }
  return payload
}
