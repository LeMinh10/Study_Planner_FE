import { Navigate, useLocation, useParams } from 'react-router-dom'

// Preserve saved links while keeping one workspace for each subject.
export function SubjectDetailPage() {
  const { subjectId } = useParams()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (subjectId) params.set('subject', subjectId)
  return <Navigate replace to={{ pathname: '/tasks', search: '?' + params.toString(), hash: location.hash }} />
}
