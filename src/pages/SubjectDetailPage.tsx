import { Navigate, useLocation, useParams } from 'react-router-dom'

// Giữ các liên kết đã lưu và đưa mỗi môn về cùng một không gian làm việc.
export function SubjectDetailPage() {
  const { subjectId } = useParams()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (subjectId) params.set('subject', subjectId)
  return <Navigate replace to={{ pathname: '/tasks', search: '?' + params.toString(), hash: location.hash }} />
}
