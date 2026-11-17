import type { Semester } from '../types/planner'
import { parseDate } from './dateInput'
import { normalizeSubjectText } from './subjectValidation'

export type SemesterFields = { name: string; startDate: string; endDate: string }
export type SemesterErrors = Partial<Record<keyof SemesterFields, string>>
export const normalizeSemesterName = normalizeSubjectText

export function validateSemester(fields: SemesterFields, semesters: readonly Semester[], editingId = ''): SemesterErrors {
  const errors: SemesterErrors = {}
  const name = normalizeSemesterName(fields.name)
  if (!name) errors.name = 'Vui lòng nhập tên học kỳ.'
  else if (name.length < 2 || name.length > 200) errors.name = 'Tên học kỳ phải có từ 2 đến 200 ký tự.'
  else if (!/\p{L}/u.test(name) || !/^[\p{L}\p{M}\p{N} ()·–—.,:/-]+$/u.test(name) || /[\p{Cc}\p{Cf}]/u.test(fields.name)) errors.name = 'Tên học kỳ chỉ được chứa chữ, số, khoảng trắng và dấu ( ) · – — . , : / -.'
  else if (semesters.some(item => item.id !== editingId && normalizeSemesterName(item.name).toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'))) errors.name = 'Tên học kỳ đã tồn tại.'
  for (const field of ['startDate', 'endDate'] as const) {
    if (!fields[field]) errors[field] = field === 'startDate' ? 'Vui lòng nhập ngày bắt đầu.' : 'Vui lòng nhập ngày kết thúc.'
    else if (!parseDate(fields[field])) errors[field] = 'Nhập ngày hợp lệ theo định dạng dd/mm/yyyy.'
  }
  if (!errors.startDate && !errors.endDate && parseDate(fields.endDate)! < parseDate(fields.startDate)!) errors.endDate = 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'
  return errors
}
