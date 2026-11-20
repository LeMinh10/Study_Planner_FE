# 2026-11-20 — Giải quyết conflict PR 9 với main

## Yêu cầu và lý do
Gỡ xung đột PR 9, nhánh feat/tich-hop-quan-tri-sinh-vien, đích main. Đã fetch origin và merge origin/main (8a93a13). Trước thao tác chỉ có .backend-integration/ chưa được theo dõi; giữ ngoài index.

## Code và luồng trước/sau
Git hiện chỉ báo conflict tại src/pages/AcademicEditors.tsx. Năm file nhiệm vụ/đính kèm và test do người dùng liệt kê không phát sinh conflict ở lần merge main mới nhất; không ghi đè các file đó.
AcademicEditors trước đọc FormData và kiểm tra tên/ngày đơn giản. Giữ phiên bản main sử dụng fields, normalizeSemesterName, validateSemester và parseDate; giữ canManageSemesters, thêm chặn pending/academicBusy, focus trường lỗi, trạng thái đang lưu và finally mở lại form. Nhập dữ liệu -> validation -> API saveSemester -> đóng khi thành công; lỗi giữ form.
Các file còn lại được Git đưa vào từ main, gồm kiểm tra môn/học kỳ, DateInput, cập nhật giao diện và test. Đã đọc diff biểu mẫu và các điểm tự gộp PlannerUI, Dashboard, browser-auth; build/test kiểm tra tích hợp.

## Kiểm chứng
- npm run build: đạt; Vite cảnh báo chunk JS lớn hơn 500 kB.
- npm test: 197/197 đạt; có thông báo EPERM cache Vite và trùng cổng WebSocket, exit 0.
- node tests/browser-hoc-tap.mjs: đạt, 578 request fixture.
- CORE_ATTACHMENTS_ONLY=1 node tests/browser-hoc-tap.mjs: đạt upload, tải xuống JWT, lỗi/thử lại, xóa, dung lượng, ảnh và mobile.
- node tests/browser-semesters.mjs: exit 0.
- git diff --check và danh sách unmerged: sạch sau khi giải quyết.
Các bài trình duyệt dùng dữ liệu giả lập, không xác minh dữ liệu thật hoặc thay đổi DB.

## Việc còn lại
Chưa tạo merge commit, chưa push. Người dùng cần commit/push để GitHub cập nhật trạng thái PR. Chưa ghi nhận người dùng đã đọc hoặc duyệt code.