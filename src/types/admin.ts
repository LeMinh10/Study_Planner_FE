import type { UserRole } from './auth'

export interface ManagedUser {
  id: string
  name: string
  email: string
  studentId: string
  schoolName: string
  className: string
  major: string
  role: UserRole
  status: 'active' | 'locked'
  createdAt: string
  updatedAt: string
}

export interface UserPage {
  items: ManagedUser[]
  page: number
  pageSize: number
  total: number
}

export interface UserListOptions {
  search?: string
  page?: number
  pageSize?: number
  isActive?: boolean
  signal?: AbortSignal
}
