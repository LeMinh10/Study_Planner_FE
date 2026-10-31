export const DEMO_ACCOUNT = {
  name: 'Sinh viên mẫu',
  email: 'demo@studyplanner.vn',
  password: '123456',
}

const SESSION_KEY = 'studyplanner.demo-session.v1'

export function matchesDemoAccount(email: string, password: string) {
  return email.trim().toLowerCase() === DEMO_ACCOUNT.email && password === DEMO_ACCOUNT.password
}

export function hasDemoSession() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === DEMO_ACCOUNT.email
  } catch {
    return false
  }
}

export function saveDemoSession(loggedIn: boolean) {
  try {
    if (loggedIn) sessionStorage.setItem(SESSION_KEY, DEMO_ACCOUNT.email)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // The current session still works when browser storage is unavailable.
  }
}
