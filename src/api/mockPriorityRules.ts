import { defaultPriorityRule, isPriorityConfig } from '../priority/rules'
import type { PriorityRule } from '../priority/rules'

export interface MockPriorityState { priorityRules?: PriorityRule[]; nextPriorityVersion?: number }
export function mockPriorityRequest(state: MockPriorityState, url: URL, method: string, body: Record<string, unknown>): Response {
  const rows = state.priorityRules ??= []
  const active = () => rows.find(row => row.dangSuDung) ?? defaultPriorityRule
  const fail = (status: number, detail: string, code = 'VALIDATION_ERROR') => Response.json({ detail, code }, { status })
  if (url.pathname === '/priority-rules/active' && method === 'GET') return Response.json(active())
  if (url.pathname === '/admin/priority-rules') {
    if (method === 'GET') {
      const number = (key: string, fallback: number) => url.searchParams.has(key) ? Number(url.searchParams.get(key)) : fallback
      const page = number('trang', 1), size = number('kichThuocTrang', 20)
      if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(size) || size < 1 || size > 50) return fail(400, 'Phân trang quy tắc không hợp lệ.')
      const sorted = [...rows].sort((a, b) => b.phienBan - a.phienBan)
      return Response.json({ danhSach: sorted.slice((page - 1) * size, page * size), trang: page, kichThuocTrang: size, tongSo: rows.length })
    }
    if (method === 'POST') {
      if (typeof body.ten !== 'string' || !body.ten.trim() || body.ten.trim().length > 200 || !isPriorityConfig(body.cauHinh)) return fail(400, 'Tên hoặc cấu hình quy tắc không hợp lệ.')
      const version = Math.max(state.nextPriorityVersion ?? 1, ...rows.map(row => row.phienBan + 1))
      state.nextPriorityVersion = version + 1
      const row: PriorityRule = { ma: version, ten: body.ten.trim(), phienBan: version, dangSuDung: false, cauHinh: structuredClone(body.cauHinh), ngayTao: new Date().toISOString() }
      rows.push(row)
      return Response.json(row, { status: 201 })
    }
  }
  const match = url.pathname.match(/^\/admin\/priority-rules\/([1-9]\d*)(\/activate)?$/)
  if (match) {
    const row = rows.find(item => item.ma === Number(match[1]))
    if (!row) return fail(404, 'Không tìm thấy quy tắc.', 'RESOURCE_NOT_FOUND')
    if (match[2] && method === 'POST') {
      if (!Number.isSafeInteger(body.phienBanDangDung) || Number(body.phienBanDangDung) < 0) return fail(400, 'Cần phiên bản quy tắc đang dùng.')
      if (body.phienBanDangDung !== active().phienBan) return fail(409, 'Quy tắc đang dùng đã thay đổi. Tải lại trước khi áp dụng.', 'PRIORITY_RULE_CHANGED')
      rows.forEach(item => { item.dangSuDung = item.ma === row.ma })
      return Response.json(row)
    }
    if (!match[2] && method === 'DELETE') {
      if (row.dangSuDung) return fail(409, 'Không thể xóa quy tắc đang dùng.', 'PRIORITY_RULE_ACTIVE')
      state.priorityRules = rows.filter(item => item.ma !== row.ma)
      return new Response(null, { status: 204 })
    }
  }
  return fail(405, 'Phương thức yêu cầu chưa được hỗ trợ.')
}
