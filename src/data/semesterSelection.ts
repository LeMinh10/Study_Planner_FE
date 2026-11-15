const prefix = 'studyplanner.selected-semester.v1:'
const key = (email: string) => prefix + encodeURIComponent(email.trim().toLowerCase())

// Chỉ lưu lựa chọn giao diện trong tab này, tách riêng theo từng tài khoản.
export function readSelectedSemester(email: string, availableIds: string[]) {
  if (!email) return undefined
  try {
    const id = sessionStorage.getItem(key(email))
    return id && availableIds.includes(id) ? id : undefined
  } catch { return undefined }
}

export function saveSelectedSemester(email: string, id: string) {
  if (!email || !id) return
  try { sessionStorage.setItem(key(email), id) }
  catch { /* Vẫn đổi được học kỳ khi trình duyệt không cho lưu lựa chọn. */ }
}
