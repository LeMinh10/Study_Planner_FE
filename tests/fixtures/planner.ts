import type { PlannerData } from '../../src/types/planner'
import { addDays, dateKey, vietnamToday } from '../../src/utils/planner'


export function createPlannerFixture(): PlannerData {
  const today = vietnamToday()
  const year = today.getFullYear()
  const firstSemester = today.getMonth() >= 6 || today.getMonth() === 0
  const academicYear = today.getMonth() >= 6 ? year : year - 1
  const day = (offset: number) => dateKey(addDays(today, offset))
  const doneAt = (offset: number) => `${day(offset)}T10:00:00+07:00`
  const data: PlannerData = {
    version: 1,
    profile: { name: 'Minh Anh', email: 'minhanh@example.com', studentId: 'SV2026001', school: 'Trường Đại học', major: 'Công nghệ thông tin', year: 'Năm 2', goal: 'Hoàn thành nhiệm vụ đúng hạn và dành thời gian ôn tập mỗi tuần.' },
    semesters: [
      { id: 'semester-1', name: `Học kỳ ${firstSemester ? 'I' : 'II'} · ${academicYear}–${academicYear + 1}`, startDate: firstSemester ? `${academicYear}-07-01` : `${year}-02-01`, endDate: firstSemester ? `${academicYear + 1}-01-31` : `${year}-06-30` },
      { id: 'semester-2', name: firstSemester ? `Học kỳ II · ${academicYear}–${academicYear + 1}` : `Học kỳ I · ${year}–${year + 1}`, startDate: firstSemester ? `${academicYear + 1}-02-01` : `${year}-07-01`, endDate: firstSemester ? `${academicYear + 1}-06-30` : `${year + 1}-01-31` },
    ],
    selectedSemesterId: 'semester-1',
    subjects: [
      { id: 'math', semesterId: 'semester-1', code: 'MAT101', name: 'Toán cao cấp', credits: 3, teacher: 'Nguyễn Văn Hùng', color: 'sage' },
      { id: 'english', semesterId: 'semester-1', code: 'ENG201', name: 'Tiếng Anh', credits: 3, teacher: 'Trần Thu Hà', color: 'clay' },
      { id: 'web', semesterId: 'semester-1', code: 'WEB202', name: 'Lập trình Web', credits: 4, teacher: 'Lê Hoàng Nam', color: 'lavender' },
    ],
    schedule: [
      { id: 'slot-1', subjectId: 'math', title: 'Đạo hàm & ứng dụng', weekday: (today.getDay() + 6) % 7 + 1, start: '08:00', end: '09:30', room: 'A.203', note: 'Mang giáo trình và bài tập chương 3.' },
      { id: 'slot-2', subjectId: 'web', title: 'Thực hành React', weekday: (today.getDay() + 6) % 7 + 1, start: '13:00', end: '15:00', room: 'Phòng máy B.105', note: 'Chuẩn bị laptop.' },
      { id: 'slot-3', subjectId: 'english', title: 'Reading & vocabulary', weekday: (today.getDay() + 1) % 7 + 1, start: '09:00', end: '10:30', room: 'C.302', note: '' },
    ],
    tasks: [
      { id: 'task-math', subjectId: 'math', title: 'Hoàn thành bài tập chương 3', description: 'Làm bài 1–10 về đạo hàm và ứng dụng, nộp bản PDF.', kind: 'assignment', dueDate: day(1), dueTime: '10:00', status: 'doing', importance: 'high', subtasks: [{ id: 'sub-1', title: 'Ôn lại lý thuyết đạo hàm', done: true }, { id: 'sub-2', title: 'Giải bài tập 1–5', done: false }, { id: 'sub-3', title: 'Giải bài tập 6–10 và nộp bài', done: false }] },
      { id: 'task-exam', subjectId: 'english', title: 'Thi giữa kỳ Tiếng Anh', description: 'Ôn Unit 1–6. Thi tại phòng C.302, mang thẻ sinh viên.', kind: 'exam', dueDate: day(4), dueTime: '08:00', status: 'todo', importance: 'high', subtasks: [] },
      { id: 'task-project', subjectId: 'web', title: 'Thiết kế giao diện Study Planner', description: 'Hoàn thiện giao diện theo phiếu đề tài và chuẩn bị demo.', kind: 'project', dueDate: day(2), dueTime: '23:59', status: 'doing', importance: 'high', subtasks: [{ id: 'sub-4', title: 'Dựng khung trang và thanh điều hướng', done: true }, { id: 'sub-5', title: 'Thiết kế các trang chức năng', done: false }, { id: 'sub-6', title: 'Kiểm tra và chuẩn bị trình bày', done: false }] },
      { id: 'task-overdue', subjectId: 'math', title: 'Nộp bản tổng hợp công thức', description: 'Tổng hợp công thức chương 1–2 và ví dụ minh họa.', kind: 'deadline', dueDate: day(-2), dueTime: '23:59', status: 'todo', importance: 'normal', subtasks: [] },
      { id: 'task-vocab', subjectId: 'english', title: 'Ôn 20 từ vựng Unit 6', description: 'Ghi nghĩa và đặt câu cho mỗi từ mới.', kind: 'assignment', dueDate: day(0), dueTime: '23:59', status: 'todo', importance: 'normal', subtasks: [] },
      { id: 'task-done-1', subjectId: 'web', title: 'Đọc tài liệu React Router', description: 'Ghi chú về nested routes và điều hướng.', kind: 'assignment', dueDate: day(-1), dueTime: '09:00', status: 'done', importance: 'normal', subtasks: [], completedAt: doneAt(0) },
      { id: 'task-done-2', subjectId: 'english', title: 'Luyện đọc Unit 5', description: '', kind: 'assignment', dueDate: day(-3), dueTime: '23:59', status: 'done', importance: 'low', subtasks: [], completedAt: doneAt(-4) },
      { id: 'task-done-3', subjectId: 'math', title: 'Ôn tập chương 2', description: '', kind: 'assignment', dueDate: day(-1), dueTime: '23:59', status: 'done', importance: 'normal', subtasks: [], completedAt: doneAt(-1) },
    ],
    readAlerts: [],
  }
  return data
}

