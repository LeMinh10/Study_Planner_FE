import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeading } from '../../components/PlannerUI'
import { Icon } from '../../components/Icon'
import { newPasswordError, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../auth/validation'
import type { Profile } from '../../types/planner'
import { useMockApi } from '../../api/config'

function ProfileForm({ profile }: { profile: Profile }) {
  const { saveProfile, isDemo } = useAuth()
  const viewOnlyDemo = isDemo && !useMockApi
  const [values, setValues] = useState(profile)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  function field(key: keyof Profile, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }))
    setError('')
    setSuccess(false)
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError(''); setSuccess(false)
    const requiredFields = [['name', 'họ và tên'], ['school', 'tên trường'], ['className', 'tên lớp'], ['major', 'ngành học']] as const
    for (const [key, label] of requiredFields) {
      if (!values[key].trim()) { setError(`Vui lòng nhập ${label}.`); return }
    }
    if (!event.currentTarget.reportValidity()) return
    const updatedProfile = {
      ...profile, name: values.name.trim(), school: values.school.trim(),
      className: values.className.trim(), major: values.major.trim(),
    }
    setPending(true)
    try { await saveProfile(updatedProfile); setValues(updatedProfile); setSuccess(true) }
    catch (error) { setError(error instanceof Error ? error.message : 'Không lưu được hồ sơ.') }
    finally { setPending(false) }
  }
  return <section className="paper-panel profile-form-panel">
    <div className="panel-heading"><h2>Thông tin cá nhân</h2></div>
    <form className="session-form" onSubmit={submit} noValidate aria-busy={pending}>
      <fieldset className="form-fields" disabled={pending || viewOnlyDemo}>
        <div className="form-grid">
          <label>Họ và tên<input name="fullName" autoComplete="name" value={values.name} onChange={(event) => field('name', event.target.value)} maxLength={100} required /></label>
          <label>Email<input name="email" type="email" value={profile.email} readOnly /></label>
        </div>
        <div className="form-grid">
          <label>Mã sinh viên<input name="studentCode" value={profile.studentId} readOnly /></label>
          <label>Tên lớp<input name="className" value={values.className} onChange={(event) => field('className', event.target.value)} maxLength={100} required /></label>
        </div>
        <label>Tên trường<input name="schoolName" value={values.school} onChange={(event) => field('school', event.target.value)} maxLength={150} required /></label>
        <label>Ngành học<input name="major" value={values.major} onChange={(event) => field('major', event.target.value)} maxLength={120} required /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {success && <p className="auth-notice" role="status">Đã lưu hồ sơ.</p>}
        <div className="profile-save-row"><button className="button button-primary" type="submit">{pending ? 'Đang lưu…' : 'Lưu hồ sơ'}<Icon name="check" size={16} /></button></div>
      </fieldset>
    </form>
  </section>
}

function PasswordForm() {
  const { changePassword, isDemo } = useAuth()
  const viewOnlyDemo = isDemo && !useMockApi
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError('')
    if (!event.currentTarget.reportValidity()) return
    const message = newPasswordError(newPassword, confirmPassword)
    if (message) { setError(message); return }
    setPending(true)
    try {
      await changePassword({ currentPassword, newPassword })
      navigate('/login', { replace: true })
    } catch (error) { setError(error instanceof Error ? error.message : 'Không đổi được mật khẩu.') }
    finally { setPending(false) }
  }
  return <section className="paper-panel profile-form-panel profile-password-panel">
    <div className="panel-heading"><h2>Đổi mật khẩu</h2></div>
    <p className="profile-password-note">Sau khi đổi mật khẩu thành công, bạn cần đăng nhập lại.</p>
    <form className="session-form" onSubmit={submit} noValidate aria-busy={pending}>
      <fieldset className="form-fields" disabled={pending || viewOnlyDemo}>
        <label>Mật khẩu hiện tại<input name="currentPassword" type="password" autoComplete="current-password" maxLength={PASSWORD_MAX_LENGTH} required value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setError('') }} /></label>
        <div className="form-grid">
          <label>Mật khẩu mới<input name="newPassword" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} required value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setError('') }} /></label>
          <label>Nhập lại mật khẩu mới<input name="confirmPassword" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} required value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError('') }} /></label>
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="profile-save-row"><button className="button button-primary" type="submit">{pending ? 'Đang đổi…' : 'Đổi mật khẩu'}</button></div>
      </fieldset>
    </form>
  </section>
}

export function ProfilePage() {
  const { user, logout, isDemo } = useAuth()
  const viewOnlyDemo = isDemo && !useMockApi
  const navigate = useNavigate()
  if (!user) return null
  function handleLogout() { logout(); navigate('/login', { replace: true }) }
  return <>
    <PageHeading title="Hồ sơ cá nhân" />
    {viewOnlyDemo && <p className="auth-notice" role="status">Bạn đang dùng tài khoản mẫu để xem giao diện. Đăng nhập tài khoản đã đăng ký để lưu hồ sơ và đổi mật khẩu.</p>}
    <div className="profile-grid">
      <aside className="paper-panel profile-summary">
        <span className="profile-large-avatar">{user.name.split(' ').filter(Boolean).slice(-2).map((word) => word.charAt(0)).join('').toLocaleUpperCase('vi') || <Icon name="user" size={32} />}</span>
        <h2>{user.name || 'Chưa có thông tin cá nhân'}</h2><p>{user.email}</p>
        <dl>{[['Mã sinh viên', user.studentId], ['Trường', user.school], ['Lớp', user.className], ['Ngành học', user.major]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Chưa cập nhật'}</dd></div>)}</dl>
        <button type="button" className="button button-secondary" onClick={handleLogout}>Đăng xuất<Icon name="arrow-right" size={15} /></button>
      </aside>
      <div className="profile-sections"><ProfileForm profile={user} /><PasswordForm /></div>
    </div>
  </>
}
