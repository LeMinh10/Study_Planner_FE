import { apiBaseUrl } from '../api/config'
import { ApiError, record, SESSION_INVALID_EVENT } from '../api/client'
import type { AnhHuong, KetQua } from './types'
import { xacNhan } from './xacNhan'

const loiDeHieu: Record<string, string> = {
  TASK_CYCLE: 'Không thể chuyển nhiệm vụ vào chính nó hoặc vào một bước nhỏ thuộc nhiệm vụ đó.',
  TASK_TREE_INVALID: 'Chưa tải đủ nhiệm vụ và các bước nhỏ. Hãy tải lại danh sách.',
  TASK_TREE_LIMIT: 'Một nhiệm vụ có thể chia tối đa 10 cấp và tổng cộng 1.000 bước. Hãy tách bớt thành nhiệm vụ riêng.',
  TASK_NOT_LEAF: 'Hãy chọn một việc chưa được chia nhỏ để đặt phiên tự học.',
  TASK_ROOT_REQUIRED: 'Hãy mở nhiệm vụ lớn nhất để đổi học kỳ hoặc môn cho cả nhóm việc.',
  TASK_PROGRESS_IS_DERIVED: 'Tiến độ nhiệm vụ lớn được tính từ các bước nhỏ. Hãy cập nhật tiến độ từng bước.',
  TASK_ESTIMATE_IS_DERIVED: 'Hãy nhập thời gian ước lượng cho từng bước nhỏ.',
  TASK_SCOPE_CONFLICT: 'Nhiệm vụ lớn và các bước nhỏ cần thuộc cùng học kỳ và môn học.',
  TASK_DEADLINE_CONFLICT: 'Hạn của bước nhỏ phải cùng lúc hoặc sớm hơn hạn của nhiệm vụ lớn.',
  SESSION_STATE_CONFLICT: 'Trạng thái hoặc thời gian của phiên chưa phù hợp với thao tác. Hãy mở lại chi tiết phiên để kiểm tra.',
}
export class LoiHocTap extends ApiError {
  details: Record<string, unknown>
  constructor(message: string, status = 0, code = '', details: Record<string, unknown> = {}) {
    super(message, status, code)
    this.details = details
  }
}
export async function goi<T>(token: string, path: string, options: { method?: string; body?: unknown; version?: number; key?: string; signal?: AbortSignal } = {}): Promise<KetQua<T>> {
  const method = options.method ?? 'GET'
  let response: Response
  try {
    response = await fetch(apiBaseUrl + path, {
      method, signal: options.signal, cache: 'no-store',
      headers: {
        Accept: 'application/json', Authorization: 'Bearer ' + token,
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.version === undefined ? {} : { 'If-Match': `"ht-${options.version}"` }),
        ...(options.key ? { 'Idempotency-Key': options.key } : {}),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new LoiHocTap('Mất kết nối. Hãy kiểm tra kết quả trước khi gửi lại thao tác.')
  }
  const raw = await response.text()
  let value: unknown
  try { value = raw ? JSON.parse(raw) : null } catch { throw new LoiHocTap('Máy chủ trả dữ liệu chưa hợp lệ.', response.status) }
  const body = record(value)
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent(SESSION_INVALID_EVENT, { detail: { token } }))
    const errors = Object.values(record(body.errors)).flat().filter(x => typeof x === 'string')
    const message = loiDeHieu[String(body.code)] ?? String(body.detail ?? errors[0] ?? body.title ?? 'Chưa thể hoàn tất thao tác.')
    throw new LoiHocTap(message, response.status, String(body.code ?? ''), record(body.details))
  }
  const etag = response.headers.get('ETag')?.match(/^"ht-(\d+)"$/)
  const version = Number(body.phienBan ?? etag?.[1])
  if (!Number.isSafeInteger(version) || version < 0 || (response.status !== 204 && !Object.hasOwn(body, 'duLieu'))) throw new LoiHocTap('Phản hồi thiếu phiên bản dữ liệu. Hãy kiểm tra API đang chạy.')
  if (method !== 'GET' && (options.version !== undefined || options.key !== undefined) && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('studyplanner:saved'))
  }
  return { phienBan: version, duLieu: body.duLieu as T }
}
export async function thayDoi<T>(token: string, path: string, method: string, body: object | undefined, version: number, preview?: { path: string; body: object }, hoiXacNhan: typeof xacNhan = xacNhan) {
  if (preview) {
    const check = await goi<AnhHuong>(token, preview.path, { method: 'POST', body: preview.body })
    if (check.phienBan !== version) throw new LoiHocTap('Dữ liệu đã đổi. Đóng biểu mẫu và tải lại trước khi sửa.', 409, 'DATA_VERSION_CONFLICT')
    if (check.duLieu.canKetThucPhienDangHoc) throw new LoiHocTap('Hãy kết thúc phiên đang học trước khi thay đổi lịch liên quan.')
    const count = new Set([...(check.duLieu.maPhienBiHuy ?? []), ...(check.duLieu.phienBiAnhHuong ?? [])]).size
    if (count && !await hoiXacNhan({ tieuDe: 'Thay đổi lịch tự học?', noiDung: `Thay đổi này sẽ hủy ${count} phiên tự học đã lên lịch. Bạn muốn tiếp tục?`, nhanXacNhan: 'Hủy phiên và tiếp tục', nguyHiem: true })) return null
    body = body ? { ...body, huyPhienLienQuan: count > 0 } : undefined
    if (method === 'DELETE' && count) path += '?huyPhienLienQuan=true'
  }
  try { return await goi<T>(token, path, { method, body, version }) }
  catch (error) {
    if (error instanceof LoiHocTap && error.code === 'SCHEDULE_CHANGE_CONFIRMATION_REQUIRED' && body) {
      const impact = record(error.details.anhHuong ?? error.details)
      const count = Array.isArray(impact.maPhienBiHuy) ? impact.maPhienBiHuy.length : 0
      if (await hoiXacNhan({ tieuDe: 'Thay đổi lịch tự học?', noiDung: `Thay đổi này ảnh hưởng ${count || 'các'} phiên tự học đã lên lịch. Các phiên liên quan sẽ bị hủy để tiếp tục.`, nhanXacNhan: 'Hủy phiên và tiếp tục', nguyHiem: true })) {
        return goi<T>(token, path, { method, version, body: { ...body, huyPhienLienQuan: true } })
      }
      return null
    }
    if (error instanceof LoiHocTap && error.code === 'CLASS_OVERLAP_CONFIRMATION_REQUIRED' && body) {
      if (await hoiXacNhan({ tieuDe: 'Lịch học bị trùng', noiDung: 'Buổi học bị trùng với lịch lớp hiện có. Bạn vẫn muốn lưu lịch lớp này?', nhanXacNhan: 'Vẫn lưu lịch học' }))
        return goi<T>(token, path, { method, version, body: { ...body, xacNhanTrungLich: true } })
      return null
    }
    throw error
  }
}
