// Tập trung cấu hình HTTP tại đây để đối chiếu với backend đang triển khai.
const env = import.meta.env
export const apiBaseUrl = (env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
const mockSetting = import.meta.env.VITE_USE_MOCK_API
export const useMockApi = mockSetting === 'true'
export const authEndpoints = {
  register: env.VITE_AUTH_REGISTER_PATH || '/auth/register',
  login: env.VITE_AUTH_LOGIN_PATH || '/auth/login',
  profile: env.VITE_AUTH_PROFILE_PATH || '/users/me',
  changePassword: env.VITE_AUTH_CHANGE_PASSWORD_PATH || '/users/me/change-password',
}
