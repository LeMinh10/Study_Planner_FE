import { ApiError, apiRequest, record } from './client'
import { isPriorityConfig } from '../priority/rules'
import type { PriorityConfig, PriorityRule } from '../priority/rules'

export interface PriorityRulePage { danhSach: PriorityRule[]; trang: number; kichThuocTrang: number; tongSo: number }
function invalid(): never { throw new ApiError('Dữ liệu quy tắc ưu tiên chưa hợp lệ. Vui lòng tải lại.') }
const integer = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= 2147483647
export function parsePriorityRule(value: unknown): PriorityRule {
  const body = record(value)
  if (!integer(body.ma) || !integer(body.phienBan) || typeof body.ten !== 'string' || !body.ten.trim() ||
    typeof body.dangSuDung !== 'boolean' || !isPriorityConfig(body.cauHinh) ||
    !(body.ngayTao === null || typeof body.ngayTao === 'string' && Number.isFinite(Date.parse(body.ngayTao)))) return invalid()
  if (body.ma === 0 ? body.phienBan !== 0 || !body.dangSuDung || body.ngayTao !== null : body.phienBan === 0 || body.ngayTao === null) return invalid()
  return body as unknown as PriorityRule
}
export async function loadActivePriorityRule(token: string, signal?: AbortSignal) {
  const rule = parsePriorityRule(await apiRequest('/priority-rules/active', { token, signal }))
  if (!rule.dangSuDung) return invalid()
  return rule
}
export async function listPriorityRules(token: string, page = 1, signal?: AbortSignal): Promise<PriorityRulePage> {
  if (!integer(page, 1)) return invalid()
  const body = record(await apiRequest('/admin/priority-rules?trang=' + page + '&kichThuocTrang=20', { token, signal }))
  if (!Array.isArray(body.danhSach) || body.trang !== page || !integer(body.kichThuocTrang, 1) || body.kichThuocTrang > 50 || !integer(body.tongSo) || body.danhSach.length > body.kichThuocTrang || body.danhSach.length > body.tongSo) return invalid()
  const rows = body.danhSach.map(parsePriorityRule)
  if (rows.some(row => row.ma === 0) || new Set(rows.map(row => row.ma)).size !== rows.length) return invalid()
  return { danhSach: rows, trang: page, kichThuocTrang: body.kichThuocTrang, tongSo: body.tongSo }
}
export async function createPriorityRule(token: string, name: string, config: PriorityConfig) {
  if (!name.trim() || name.trim().length > 200 || !isPriorityConfig(config)) return invalid()
  return parsePriorityRule(await apiRequest('/admin/priority-rules', { method: 'POST', token, body: { ten: name.trim(), cauHinh: config } }))
}
export async function activatePriorityRule(token: string, id: number, activeVersion: number) {
  if (!integer(id, 1) || !integer(activeVersion)) return invalid()
  const rule = parsePriorityRule(await apiRequest(`/admin/priority-rules/${id}/activate`, { method: 'POST', token, body: { phienBanDangDung: activeVersion } }))
  if (rule.ma !== id || !rule.dangSuDung) return invalid()
  return rule
}
export async function deletePriorityRule(token: string, id: number) {
  if (!integer(id, 1)) return invalid()
  await apiRequest(`/admin/priority-rules/${id}`, { method: 'DELETE', token })
}
