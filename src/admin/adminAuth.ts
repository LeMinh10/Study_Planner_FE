// Temporary frontend account until the admin authentication API is available.
export const ADMIN_ACCOUNT = {
  email: 'admin@studyplanner.vn',
  password: '123456',
}

const SESSION_KEY = 'studyplanner.admin-session.v1'

export function matchesAdminAccount(email: string, password: string) {
  return email.trim().toLowerCase() === ADMIN_ACCOUNT.email && password === ADMIN_ACCOUNT.password
}

export function hasAdminSession() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === ADMIN_ACCOUNT.email
  } catch {
    return false
  }
}

export function saveAdminSession(loggedIn: boolean) {
  try {
    if (loggedIn) sessionStorage.setItem(SESSION_KEY, ADMIN_ACCOUNT.email)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Login remains available for this page when browser storage is blocked.
  }
}
