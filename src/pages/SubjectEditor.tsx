import { usePlanner } from '../contexts/PlannerContext'
import { Modal } from '../components/PlannerUI'
import { SubjectForm } from '../components/SubjectForm'
import type { Subject } from '../types/planner'

export function SubjectEditor({ subject, onClose, onSaved }: { subject: Subject; onClose: () => void; onSaved?: () => void }) {
  const { academicBusy } = usePlanner()
  return <Modal title="Chỉnh sửa môn học" onClose={() => { if (!academicBusy) onClose() }}>
    <SubjectForm subject={subject} onCancel={onClose} onSaved={() => { onSaved?.(); onClose() }} />
  </Modal>
}
