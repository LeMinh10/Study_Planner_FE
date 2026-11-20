import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal, FormActions } from '../components/PlannerUI'
import { useAuth } from '../contexts/AuthContext'
import { useMockApi } from '../api/config'
import { saveManagedStudent } from '../api/admin'
import type { ManagedStudentInput } from '../api/admin'
import type { ManagedUser } from '../types/admin'
import './account-editor.css'

export function StudentAccountEditor({ student, onClose, onSaved }: { student?: ManagedUser; onClose: () => void; onSaved: (user: ManagedUser) => void }) {
  const { getAccessToken } = useAuth()
  const [form, setForm] = useState<ManagedStudentInput>(() => ({ name: student?.name ?? '', email: student?.email ?? '', studentId: student?.studentId ?? '', schoolName: student?.schoolName ?? '', className: student?.className ?? '', major: student?.major ?? '', password: '' }))
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [visible, setVisible] = useState(false)
  const saving = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  function change(key: keyof ManagedStudentInput, value: string) { setForm(current => ({ ...current, [key]: value })) }
  function close() { if (!saving.current) onClose() }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving.current || useMockApi || !event.currentTarget.reportValidity()) return
    saving.current = true; setBusy(true); setError('')
    try {
      const saved = await saveManagedStudent(getAccessToken(), form, student)
      // Khi người dùng rời trang giữa lúc lưu, không cập nhật lại màn đã unmount.
      // Không ghi dữ liệu form/mật khẩu vào log hoặc localStorage.
      if (mounted.current) onSaved(saved)
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Chưa lưu được tài khoản.')
    } finally {
      saving.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return <Modal title={student ? 'Sửa thông tin sinh viên' : 'Thêm tài khoản sinh viên'} onClose={close}>
    <form className="account-editor" onSubmit={event => { void submit(event) }}>
      {useMockApi && <p role="alert">Chuyển sang kết nối backend để lưu tài khoản thật.</p>}
      {error && <p role="alert" className="account-editor-error">{error}</p>}
      <fieldset disabled={busy || useMockApi}>
        <label>Họ và tên<input name="managedName" required maxLength={200} value={form.name} autoFocus onChange={e => change('name', e.target.value)} /></label>
        <label>Email<input name="managedEmail" type="email" required maxLength={320} value={form.email} autoComplete="off" onChange={e => change('email', e.target.value)} /></label>
        <div className="account-editor-grid"><label>Mã sinh viên<input name="managedCode" maxLength={50} value={form.studentId} onChange={e => change('studentId', e.target.value)} /></label><label>Lớp<input name="managedClass" maxLength={200} value={form.className} onChange={e => change('className', e.target.value)} /></label></div>
        <label>Trường<input name="managedSchool" maxLength={200} value={form.schoolName} onChange={e => change('schoolName', e.target.value)} /></label>
        <label>Ngành học<input name="managedMajor" maxLength={200} value={form.major} onChange={e => change('major', e.target.value)} /></label>
        {!student && <label>Mật khẩu ban đầu<div className="account-password"><input name="managedPassword" type={visible ? 'text' : 'password'} minLength={8} maxLength={128} required autoComplete="new-password" value={form.password} onChange={e => change('password', e.target.value)} /><button type="button" aria-label={visible ? 'Ẩn mật khẩu ban đầu' : 'Hiện mật khẩu ban đầu'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Ẩn' : 'Hiện'}</button></div><small>Từ 8 đến 128 ký tự. Sinh viên có thể đổi sau khi đăng nhập.</small></label>}
      </fieldset>
      <p className="account-editor-note">{student ? 'Chỉ cập nhật thông tin tài khoản. Khóa hoặc mở khóa tại thao tác riêng.' : 'Tài khoản mới có vai trò Sinh viên và được mở để đăng nhập.'}</p>
      <FormActions onClose={close} disabled={busy || useMockApi} label={busy ? 'Đang lưu…' : student ? 'Lưu thông tin' : 'Tạo tài khoản'} />
    </form>
  </Modal>
}
