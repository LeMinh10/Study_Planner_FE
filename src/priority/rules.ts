export const criteria = ['Deadline', 'Importance', 'InProgress'] as const
export type PriorityCriterion = typeof criteria[number]
export interface PriorityConfig { phienBanSchema: 1; tieuChi: readonly PriorityCriterion[] }
export interface PriorityRule {
  ma: number; ten: string; phienBan: number; dangSuDung: boolean
  cauHinh: PriorityConfig; ngayTao: string | null
}
export const criterionLabels: Record<PriorityCriterion, string> = {
  Deadline: 'Hạn hoàn thành', Importance: 'Mức quan trọng', InProgress: 'Đang thực hiện',
}
export const defaultPriorityConfig: PriorityConfig = { phienBanSchema: 1, tieuChi: ['Deadline', 'Importance', 'InProgress'] }
export const defaultPriorityRule: PriorityRule = { ma: 0, ten: 'Mặc định', phienBan: 0, dangSuDung: true, cauHinh: defaultPriorityConfig, ngayTao: null }
export function isPriorityConfig(value: unknown): value is PriorityConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const body = value as Record<string, unknown>
  return Object.keys(body).every(key => ['phienBanSchema', 'tieuChi'].includes(key)) && body.phienBanSchema === 1 && Array.isArray(body.tieuChi) &&
    body.tieuChi.length >= 1 && body.tieuChi.length <= 3 && body.tieuChi.includes('Deadline') &&
    body.tieuChi.every(item => criteria.includes(item)) && new Set(body.tieuChi).size === body.tieuChi.length
}
