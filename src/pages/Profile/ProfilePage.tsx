import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePlanner } from '../../contexts/PlannerContext'
import { PageHeading } from '../../components/PlannerUI'
import { Icon } from '../../components/Icon'

export function ProfilePage() {
  const { data, loggedIn, logout } = usePlanner()
  const navigate = useNavigate()
  const profile = data.profile
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }
  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }
  return <>
    <PageHeading title="Hồ sơ cá nhân" />
    <div className="profile-grid"><aside className="paper-panel profile-summary"><span className="profile-large-avatar">{profile.name.split(' ').filter(Boolean).slice(-2).map((word) => word.charAt(0)).join('').toLocaleUpperCase('vi') || <Icon name="user" size={32} />}</span><h2>{profile.name || 'Chưa có thông tin cá nhân'}</h2><p>{profile.email}</p><dl><div><dt>Mã sinh viên</dt><dd>{profile.studentId || 'Chưa cập nhật'}</dd></div><div><dt>Ngành học</dt><dd>{profile.major || 'Chưa cập nhật'}</dd></div><div><dt>Năm học</dt><dd>{profile.year || 'Chưa cập nhật'}</dd></div></dl>{loggedIn ? <button type="button" className="button button-secondary" onClick={handleLogout}>Đăng xuất<Icon name="arrow-right" size={15} /></button> : <Link to="/login" className="button button-secondary">Đăng nhập<Icon name="arrow-right" size={15} /></Link>}</aside>
      <section className="paper-panel profile-form-panel"><div className="panel-heading"><div><h2>Thông tin cá nhân</h2></div></div><form className="session-form" onSubmit={submit} noValidate><fieldset className="form-fields"><div className="form-grid"><label>Họ và tên<input name="name" defaultValue={profile.name} maxLength={100} required /></label><label>Email<input name="email" type="email" defaultValue={profile.email} maxLength={150} required /></label></div><div className="form-grid"><label>Mã sinh viên<input name="studentId" defaultValue={profile.studentId} maxLength={40} /></label><label>Năm học<select name="year" defaultValue={profile.year}><option value="">Chưa chọn</option>{['Năm 1', 'Năm 2', 'Năm 3', 'Năm 4', 'Năm 5', 'Năm 6', 'Khác'].map((year) => <option key={year}>{year}</option>)}</select></label></div><label>Trường học<input name="school" defaultValue={profile.school} maxLength={150} /></label><label>Ngành học<input name="major" defaultValue={profile.major} maxLength={120} /></label><label>Mục tiêu học tập<textarea name="goal" defaultValue={profile.goal} rows={4} maxLength={1000} placeholder="Mục tiêu trong học kỳ" /></label><div className="profile-save-row"><button className="button button-primary" type="submit">Lưu hồ sơ<Icon name="check" size={16} /></button></div></fieldset></form></section>
    </div>
  </>
}
