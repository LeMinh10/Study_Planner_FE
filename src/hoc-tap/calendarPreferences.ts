export interface CalendarPreferences {
  mode: string
  layers: string[]
  compactDeadlines: boolean
  showCompleted: boolean
}
export const calendarLayers = ['LichHoc', 'SuKien', 'HanNhiemVu', 'PhienTuHoc', 'GioRanh']
const modes = ['day', 'threeDays', 'week', 'twoWeeks', 'month', 'agenda']
export const calendarPreferencesKey = (owner: string) => 'studyplanner:calendar-view:' + owner
export function readCalendarPreferences(storage: Pick<Storage, 'getItem'> | null, owner: string): CalendarPreferences {
  const defaults: CalendarPreferences = { mode: 'week', layers: [...calendarLayers], compactDeadlines: false, showCompleted: true }
  if (!storage || !owner) return defaults
  try {
    const value = JSON.parse(storage.getItem(calendarPreferencesKey(owner)) ?? 'null')
    if (!value || value.version !== 1) return defaults
    return {
      mode: modes.includes(value.mode) ? value.mode : defaults.mode,
      layers: Array.isArray(value.layers) && value.layers.every((layer: unknown) => typeof layer === 'string' && calendarLayers.includes(layer)) ? [...new Set<string>(value.layers)] : defaults.layers,
      compactDeadlines: typeof value.compactDeadlines === 'boolean' ? value.compactDeadlines : false,
      showCompleted: typeof value.showCompleted === 'boolean' ? value.showCompleted : true,
    }
  } catch { return defaults }
}
