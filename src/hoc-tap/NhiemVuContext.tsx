import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { Semester, Subject } from '../types/planner'
import type { NhiemVu } from './types'

// Dùng chung phần xem/sửa chi tiết nhiệm vụ ở cả trang nhiệm vụ và trang tập trung.
export interface NhiemVuActions {
  token: string
  zone: string
  zoneReady: boolean
  revision: number
  semesters: Semester[]
  subjects: Subject[]
  hocKy: string
  monHoc: string
  tienDoXemTruoc: { ma: number; tienDo: number } | null
  chonNhiemVu: (id: number | null) => void
  hienNhiemVuMoi: (task: NhiemVu, giuDanhSach?: boolean) => void
  xemPhienNhiemVu: (task: NhiemVu | null) => void
  reload: () => void
  modal: (content: ReactNode) => void
  close: () => void
  run: (operation: () => Promise<unknown>) => Promise<void>
  thongBaoThanhCong: (message: string, undo?: () => Promise<unknown>) => void
}
const Context = createContext<NhiemVuActions | null>(null)
export const NhiemVuProvider = Context.Provider
export function useNhiemVu() {
  const value = useContext(Context)
  if (!value) throw new Error('NhiemVuProvider is required')
  return value
}
