const prefix = 'studyplanner.selected-semester.v1:'
const key = (email: string) => prefix + encodeURIComponent(email.trim().toLowerCase())

// Store only a UI preference in this tab, separately for each account.
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
  catch { /* Changing semesters still works when browser storage is unavailable. */ }
}
