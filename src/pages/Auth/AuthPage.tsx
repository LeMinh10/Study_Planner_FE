import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Brand } from '../../components/Brand'
import { PasswordInput } from '../../components/PasswordInput'
import { useAuth } from '../../contexts/AuthContext'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, registrationError, loginErrors, serverLoginErrors, type LoginErrors } from '../../auth/validation'
import { roleHome } from '../../auth/session'
import { ApiError } from '../../api/client'

export function AuthPage({ register = false }: { register?: boolean }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [taiKhoan, setTaiKhoan] = useState('')
  const [studentCode, setStudentCode] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [className, setClassName] = useState('')
  const [major, setMajor] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({})
  const registrationInput = { fullName, email, password, studentCode, schoolName, className, major }
  const notice = location.state?.registered ? 'Đăng ký thành công. Bạn có thể đăng nhập bằng tài khoản vừa tạo.' : auth.notice

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError('')
    if (register) {
      const message = registrationError(registrationInput, confirmPassword)
      if (message) { setError(message); return }
    } else {
      const errors = loginErrors(taiKhoan, password)
      setFieldErrors(errors)
      const firstField = errors.taiKhoan ? 'taiKhoan' : errors.password ? 'password' : null
      if (firstField) {
        event.currentTarget.querySelector<HTMLInputElement>('input[name="' + firstField + '"]')?.focus()
        return
      }
    }
    if (!event.currentTarget.reportValidity()) return
    setPending(true)
    try {
      if (register) {
        await auth.register(registrationInput)
        navigate('/login', { replace: true, state: { registered: true } })
      } else {
        const user = await auth.login(taiKhoan, password)
        navigate(roleHome(user.role), { replace: true })
      }
    } catch (error) {
      if (!register && error instanceof ApiError) {
        const errors = serverLoginErrors(error.errors)
        if (errors.taiKhoan || errors.password) { setFieldErrors(errors); return }
      }
      setError(error instanceof Error ? error.message : 'Không thực hiện được yêu cầu. Vui lòng thử lại.')
    } finally { setPending(false) }
  }
  if (auth.status === 'authenticated' && auth.user) return <Navigate to={roleHome(auth.user.role)} replace />
  return <div className="auth-page">
    <main className="auth-main">
      <div className={'auth-form-container' + (register ? ' auth-register-container' : '')}>
        <Link to="/" className="brand"><Brand variant="auth" /></Link>
        <h1>{register ? 'Đăng ký' : 'Đăng nhập'}</h1>
        {auth.status === 'loading' && <p role="status">Đang kiểm tra phiên đăng nhập…</p>}
        {!register && notice && <p className="auth-notice" role="status">{notice}</p>}
        <form className="session-form" onSubmit={submit} noValidate aria-busy={pending}>
          <fieldset className="form-fields" disabled={pending || auth.status === 'loading'}>
            {register ? <>
              <div className="form-grid">
                <label>Họ và tên<input name="fullName" autoComplete="name" maxLength={200} required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
                <label>Email<input name="email" type="email" autoComplete="email" placeholder="ban@example.com" maxLength={320} required value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} /></label>
              </div>
              <div className="form-grid">
                <label>MSSV<input name="studentCode" type="text" maxLength={50} required value={studentCode} onChange={(event) => setStudentCode(event.target.value)} /></label>
                <label>Lớp<input name="className" maxLength={200} required value={className} onChange={(event) => setClassName(event.target.value)} /></label>
              </div>
              <div className="form-grid">
                <label>Trường<input name="schoolName" autoComplete="organization" maxLength={200} required value={schoolName} onChange={(event) => setSchoolName(event.target.value)} /></label>
                <label>Ngành học<input name="major" maxLength={200} required value={major} onChange={(event) => setMajor(event.target.value)} /></label>
              </div>
            </> : <label>Email hoặc MSSV<input name="taiKhoan" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Nhập email hoặc MSSV" maxLength={320} required aria-invalid={!!fieldErrors.taiKhoan} aria-describedby={fieldErrors.taiKhoan ? 'login-account-error' : undefined} value={taiKhoan} onBlur={() => setFieldErrors((previous) => ({ ...previous, taiKhoan: loginErrors(taiKhoan, password).taiKhoan }))} onChange={(event) => { setTaiKhoan(event.target.value); setError(''); setFieldErrors((previous) => ({ ...previous, taiKhoan: undefined })) }} />{fieldErrors.taiKhoan && <span id="login-account-error" className="auth-field-error" role="alert">{fieldErrors.taiKhoan}</span>}</label>}
            <div className={register ? 'form-grid' : undefined}>
              <label>Mật khẩu<PasswordInput name="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? PASSWORD_MIN_LENGTH : undefined} maxLength={PASSWORD_MAX_LENGTH} placeholder={register ? 'Từ 8 đến 128 ký tự' : 'Nhập mật khẩu'} required aria-invalid={!register && !!fieldErrors.password} aria-describedby={!register && fieldErrors.password ? 'login-password-error' : undefined} value={password} onBlur={() => { if (!register) setFieldErrors((previous) => ({ ...previous, password: loginErrors(taiKhoan, password).password })) }} onChange={(event) => { setPassword(event.target.value); setError(''); setFieldErrors((previous) => ({ ...previous, password: undefined })) }} />{!register && fieldErrors.password && <span id="login-password-error" className="auth-field-error" role="alert">{fieldErrors.password}</span>}</label>
              {register && <label>Nhập lại mật khẩu<PasswordInput name="confirmPassword" passwordLabel="mật khẩu xác nhận" autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="button button-primary auth-submit">{pending ? 'Đang xử lý…' : register ? 'Đăng ký' : 'Đăng nhập'}</button>
          </fieldset>
        </form>
        <p className="auth-switch">{register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} <Link to={register ? '/login' : '/register'}>{register ? 'Đăng nhập' : 'Đăng ký'}</Link></p>
      </div>
    </main>
  </div>
}
