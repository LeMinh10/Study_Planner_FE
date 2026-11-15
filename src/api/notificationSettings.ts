import { ApiError, record } from './client'
import { goi } from '../hoc-tap/api'

export interface NotificationSettingsData { nhacTruocGio: number; nhacKeHoach: boolean }
function parse(value: unknown): NotificationSettingsData {
  const data = record(value)
  if (!Number.isSafeInteger(data.nhacTruocGio) || Number(data.nhacTruocGio) < 0 || Number(data.nhacTruocGio) > 8760 || typeof data.nhacKeHoach !== 'boolean')
    throw new ApiError('Dữ liệu thiết lập thông báo chưa hợp lệ. Hãy tải lại.')
  return data as unknown as NotificationSettingsData
}
export async function loadNotificationSettings(token: string, signal?: AbortSignal) {
  const result = await goi<unknown>(token, '/notifications/settings', { signal })
  return { data: parse(result.duLieu), version: result.phienBan }
}
export async function saveNotificationSettings(token: string, data: NotificationSettingsData, version: number) {
  const result = await goi<unknown>(token, '/notifications/settings', { method: 'PUT', body: parse(data), version })
  return { data: parse(result.duLieu), version: result.phienBan }
}
