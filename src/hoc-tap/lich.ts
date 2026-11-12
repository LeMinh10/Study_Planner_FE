import type { SuKien } from './types'
import { congNgay, gioNhap } from './time'

export const nhanLoaiLich: Record<string, string> = {
  LichHoc: 'Học trên lớp', SuKien: 'Sự kiện', HanNhiemVu: 'Hạn nộp', PhienTuHoc: 'Tự học', GioRanh: 'Giờ rảnh',
}

export function mocDauNgay(day: string, zone: string) {
  const midnight = Date.parse(day + 'T00:00:00Z') / 60000
  let from = midnight - 1440
  let to = midnight + 1440
  // Một số múi giờ đổi offset ngay tại 00:00. Tìm phút đầu tiên thuộc ngày lịch.
  while (from < to) {
    const middle = Math.floor((from + to) / 2)
    const local = gioNhap(new Date(middle * 60000).toISOString(), zone)
    if (local.slice(0, 10) < day) from = middle + 1
    else to = middle
  }
  return from * 60000
}

function phutTrenLich(value: number, zone: string) {
  const local = gioNhap(new Date(value).toISOString(), zone)
  return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16))
}

export interface KhoiLich {
  suKien: SuKien
  batDau: number
  ketThuc: number
  cot: number
  soCot: number
  top: number
  height: number
}
export function xepKhoiLich(day: string, events: SuKien[], zone: string, from = mocDauNgay(day, zone), to = mocDauNgay(congNgay(day, 1), zone)): KhoiLich[] {
  if (from >= to) return []
  const minHeight = 22
  const blocks = events.flatMap(suKien => {
    const start = Date.parse(suKien.batDau)
    const end = suKien.ketThuc ? Date.parse(suKien.ketThuc) : start
    if (suKien.loai === 'HanNhiemVu' || start >= to || (suKien.ketThuc ? end <= from : start < from)) return []
    const batDau = Math.max(from, start)
    const ketThuc = Math.min(to, end)
    const top = Math.min(phutTrenLich(batDau, zone), 1440 - minHeight)
    const bottom = ketThuc === to ? 1440 : phutTrenLich(ketThuc, zone)
    const height = Math.max(minHeight, bottom - top)
    return [{ suKien, batDau, ketThuc, cot: 0, soCot: 1, top, height }]
  })
  const normal = blocks.filter(b => b.suKien.loai !== 'GioRanh').sort((a, b) => a.top - b.top || a.height - b.height)
  let group: KhoiLich[] = []
  let maxEnd = 0
  function finish() {
    const lanes: number[] = []
    for (const block of group) {
      let lane = lanes.findIndex(end => end <= block.top)
      if (lane < 0) lane = lanes.length
      lanes[lane] = block.top + block.height
      block.cot = lane
    }
    for (const block of group) block.soCot = lanes.length
    group = []
  }
  for (const block of normal) {
    if (group.length && block.top >= maxEnd) finish()
    group.push(block)
    maxEnd = Math.max(maxEnd, block.top + block.height)
  }
  finish()
  return blocks
}
