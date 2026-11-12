import type { NhiemVu } from '../../hoc-tap/types'
import { ngay } from '../../hoc-tap/time'
import type { TodayCalendar } from './todayModel'

interface Entry<T> { value: T; at: number }
interface Stored { tasks?: Entry<NhiemVu[]>; calendar?: Entry<TodayCalendar> }
const cache = new WeakMap<object, Stored>()
export function readTodayCache(session: object, now = Date.now()) {
  const stored = cache.get(session)
  const zone = stored?.calendar?.value.muiGio ?? 'Asia/Ho_Chi_Minh'
  const valid = <T,>(entry?: Entry<T>) => entry && now >= entry.at && now - entry.at < 300000 && ngay(now, zone) === ngay(entry.at, zone) ? entry.value : undefined
  return { tasks: valid(stored?.tasks), calendar: valid(stored?.calendar) }
}
export function cacheTodayTasks(session: object, value: NhiemVu[], now = Date.now()) {
  cache.set(session, { ...cache.get(session), tasks: { value, at: now } })
}
export function cacheTodayCalendar(session: object, value: TodayCalendar, now = Date.now()) {
  cache.set(session, { ...cache.get(session), calendar: { value, at: now } })
}
