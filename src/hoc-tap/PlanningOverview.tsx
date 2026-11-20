import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { useHocTap } from './HocTapPage'
import './planning-design.css'

const sections: { key: string; title: string; description: string; icon: IconName }[] = [
  { key: 'calendar', title: 'Thời khóa biểu', description: 'Xem lịch lên lớp, phiên tự học và hạn nhiệm vụ trong cùng một lịch.', icon: 'calendar' },
  { key: 'classes', title: 'Lịch học theo môn', description: 'Nhập các buổi học trên lớp để tránh xếp trùng giờ.', icon: 'book' },
  { key: 'free', title: 'Giờ rảnh của tôi', description: 'Chọn những khoảng thời gian bạn có thể tự học trong tuần.', icon: 'clock' },
  { key: 'planning', title: 'Gợi ý lịch tự học', description: 'Xếp thời gian cho nhiệm vụ, xem gợi ý rồi chọn lịch muốn lưu.', icon: 'leaf' },
  { key: 'sessions', title: 'Phiên tự học', description: 'Xem các phiên đã đặt, bắt đầu học và theo dõi kết quả.', icon: 'play' },
]
export function PlanningOverview() {
  const c = useHocTap()
  return <section className="ht-planning-overview">
    <p className="ht-planning-intro">Quản lý lịch lên lớp, giờ rảnh và thời gian tự học của bạn.</p>
    <div className="ht-planning-destinations">
      {sections.map(item => <button type="button" key={item.key} data-planning-link={item.key} className={'ht-planning-destination' + (item.key === 'planning' ? ' ht-planning-featured' : '')} onClick={() => c.moTab(item.key)}>
        <span className="ht-planning-card-icon"><Icon name={item.icon} size={25} /></span>
        <span><strong>{item.title}</strong><small>{item.description}</small></span><Icon name="chevron-right" size={18} />
      </button>)}
    </div>
    <section className="ht-planning-guide" aria-labelledby="planning-guide-title"><h2 id="planning-guide-title">Bắt đầu từ đâu?</h2>
      <ol><li><button type="button" onClick={() => c.moTab('tasks')}>Chuẩn bị nhiệm vụ</button><span>Nhập thời lượng dự kiến cho phần việc cần học.</span></li>
        <li><button type="button" onClick={() => c.moTab('free')}>Thiết lập giờ rảnh</button><span>Thêm lịch lên lớp để hệ thống tránh giờ bận.</span></li>
        <li><button type="button" onClick={() => c.moTab('planning')}>Tạo gợi ý và chọn lịch</button><span>Lịch chỉ được lưu khi bạn xác nhận áp dụng.</span></li></ol>
    </section>
  </section>
}

export function PlanningSteps({ step }: { step: 1 | 2 | 3 }) {
  return <ol className="ht-planning-steps" aria-label="Các bước lập lịch">
    {['Thiết lập', 'Xem gợi ý', 'Hoàn tất'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} data-done={step > index + 1 || undefined}>
      <span>{step > index + 1 ? <Icon name="check" size={15} /> : index + 1}</span><strong>{label}</strong>
    </li>)}
  </ol>
}
