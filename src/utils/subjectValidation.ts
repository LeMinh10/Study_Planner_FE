import type { Subject } from '../types/planner'

export type SubjectFields = { name: string; code: string; credits: string; semesterId: string; teacher: string }
export type SubjectErrors = Partial<Record<keyof SubjectFields, string>>
export const normalizeSubjectText = (value: string) => value.normalize('NFC').trim().replace(/\s+/gu, ' ')
const key = (value: string) => normalizeSubjectText(value).toLocaleLowerCase('vi')

export function validateSubject(fields: SubjectFields, semesters: readonly { id: string }[], subjects: readonly Subject[], editingId = ''): SubjectErrors {
  const errors: SubjectErrors = {}
  const name = normalizeSubjectText(fields.name), code = fields.code.trim().toUpperCase(), teacher = normalizeSubjectText(fields.teacher)
  if (!name) errors.name = 'Vui lòng nhập tên môn học.'
  else if (name.length < 2 || name.length > 200) errors.name = 'Tên môn học phải có từ 2 đến 200 ký tự.'
  else if (!/\p{L}/u.test(name) || !/^[\p{L}\p{M}\p{N} ()+&#.,:/-]+$/u.test(name) || /[\p{Cc}\p{Cf}]/u.test(fields.name)) errors.name = 'Tên môn chỉ được chứa chữ, số, khoảng trắng và các dấu ( ) + & # . , : / -.'
  if (code && (code.length > 50 || !/^[A-Z0-9]+(?:[._-][A-Z0-9]+)*$/.test(code))) errors.code = 'Mã môn tối đa 50 ký tự, gồm chữ không dấu, số và dấu . _ - giữa các nhóm.'
  if (!fields.credits.trim()) errors.credits = 'Vui lòng nhập số tín chỉ.'
  else if (!/^\d+$/.test(fields.credits.trim()) || Number(fields.credits) < 1 || Number(fields.credits) > 30) errors.credits = 'Số tín chỉ phải là số nguyên từ 1 đến 30.'
  if (!semesters.some(semester => semester.id === fields.semesterId)) errors.semesterId = 'Vui lòng chọn học kỳ hợp lệ.'
  if (teacher && (teacher.length < 2 || teacher.length > 200 || !/\p{L}/u.test(teacher) || !/^[\p{L}\p{M} .,'’()-]+$/u.test(teacher) || /[\p{Cc}\p{Cf}]/u.test(fields.teacher))) errors.teacher = 'Tên giảng viên phải có 2–200 ký tự, gồm chữ, khoảng trắng và dấu câu thông dụng.'
  const others = subjects.filter(subject => subject.id !== editingId && subject.semesterId === fields.semesterId)
  if (!errors.name && others.some(subject => key(subject.name) === key(name))) errors.name = 'Tên môn học đã tồn tại trong học kỳ này.'
  if (code && !errors.code && others.some(subject => key(subject.code) === key(code))) errors.code = 'Mã môn đã tồn tại trong học kỳ này.'
  return errors
}
