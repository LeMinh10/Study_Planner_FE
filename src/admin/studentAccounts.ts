export interface StudentAccount {
  id: string
  name: string
  email: string
  studentId: string
  schoolName: string
  className: string
  status: 'active' | 'locked'
  createdAt: string
}

export const demoStudents: readonly StudentAccount[] = [
  { id: 'demo-student-1', name: 'Lê Công Minh', email: '0306231307@caothang.edu.vn', studentId: '0306231307', schoolName: 'Cao đẳng Kỹ Thuật Cao Thắng', className: 'CDTH23WEBC', status: 'active', createdAt: '2026-10-30T08:00:00+07:00' },
  { id: 'demo-student-2', name: 'Trần Hồng Kỳ', email: '0306231303@caothang.edu.vn', studentId: '0306231303', schoolName: 'Cao đẳng Kỹ Thuật Cao Thắng', className: 'CDTH23WEBC', status: 'locked', createdAt: '2026-10-31T09:00:00+07:00' },
]
