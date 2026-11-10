import type { SuKien } from './types'
import { congNgay, gioNhap, utc } from './time'

export interface KhoiLich {
  suKien: SuKien
  batDau: number
  ketThuc: number
  cot: number
  soCot: number
  top: number
  height: number
}
// Giữ cách chia cột của renderDayBlocks trong frontend-preview để các lịch trùng giờ vẫn đọc được.
export function xepKhoiLich(day: string, events: SuKien[], zone: string): KhoiLich[] {
  const from = Date.parse(utc(day + 'T00:00', zone)!)
  const to = Date.parse(utc(congNgay(day, 1) + 'T00:00', zone)!)
  const blocks = events.filter(e => e.loai !== 'HanNhiemVu' && e.ketThuc && Date.parse(e.batDau) < to && Date.parse(e.ketThuc) > from).map(e => {
    const batDau = Math.max(from, Date.parse(e.batDau))
    const ketThuc = Math.min(to, Date.parse(e.ketThuc!))
    const local = gioNhap(new Date(batDau).toISOString(), zone)
    return { suKien: e, batDau, ketThuc, cot: 0, soCot: 1, top: Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16)), height: Math.max(20, (ketThuc - batDau) / 60000) }
  })
  const normal = blocks.filter(b => b.suKien.loai !== 'GioRanh').sort((a, b) => a.batDau - b.batDau || a.ketThuc - b.ketThuc)
  let group: KhoiLich[] = []
  let maxEnd = 0
  function finish() {
    const lanes: number[] = []
    for (const block of group) {
      let lane = lanes.findIndex(end => end <= block.batDau)
      if (lane < 0) lane = lanes.length
      lanes[lane] = block.ketThuc
      block.cot = lane
    }
    for (const block of group) block.soCot = lanes.length
    group = []
  }
  for (const block of normal) {
    if (group.length && block.batDau >= maxEnd) finish()
    group.push(block)
    maxEnd = Math.max(maxEnd, block.ketThuc)
  }
  finish()
  return blocks
}
