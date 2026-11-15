# Tổng quan admin

Trang `/admin/overview` gồm ba phần: bốn thẻ thống kê sinh viên, năm sinh viên mới đăng ký và quy tắc ưu tiên đang áp dụng. Không có biểu đồ.

## Dữ liệu

`GET /api/v1/admin/overview` yêu cầu JWT có quyền Admin. BE lọc vai trò Student rồi tổng hợp trực tiếp trong database, không đếm từ trang đầu của danh sách tài khoản.

| Thẻ | Cách tính |
| --- | --- |
| Tổng sinh viên | Tất cả tài khoản Student |
| Đang mở | Student có `DangHoatDong = true` |
| Đã khóa | Student có `DangHoatDong = false` |
| Mới trong 7 ngày | Student có ngày tạo trong khoảng `[now − 7 ngày, now]`, bao gồm hai đầu |

Khoảng bảy ngày là 168 giờ, không phải bảy ngày lịch. “Đang mở” là tài khoản được phép đăng nhập, không phải trạng thái online.

Thống kê và năm sinh viên mới dùng một transaction RepeatableRead để giữ cùng ảnh chụp dữ liệu. Danh sách mới sắp theo ngày tạo giảm dần, nếu bằng nhau thì mã giảm dần; tối đa năm dòng và chỉ gồm Student. DTO chỉ có mã, họ tên, email, trạng thái và ngày tạo; không chứa thông tin xác thực.

Thẻ quy tắc dùng API `GET /api/v1/priority-rules/active` hiện có. Khi chưa có phiên bản áp dụng thì BE trả mặc định. API này và API thống kê tải độc lập: lỗi một phần không làm phần còn lại mất nội dung.

## Điều hướng

Sau khi đăng nhập, admin vào `/admin/overview` trước tiên. Mở `/admin`, `/` hoặc `/login` khi đã có phiên admin cũng chuyển về Tổng quan. Các đường dẫn danh sách, chi tiết sinh viên và quy tắc vẫn mở trực tiếp được.

- Bốn thẻ thống kê chỉ hiển thị số liệu, không có liên kết chuyển trang.
- Nút mũi tên ở mỗi sinh viên mở chi tiết; Xem tất cả mở danh sách Student.
- Quản lý quy tắc mở `/admin/priority-rules`.

Danh sách tài khoản nhận thêm bộ lọc vai trò và ngày tạo, giữ chúng trong URL khi tìm kiếm, phân trang hoặc quay lại từ chi tiết. Chip bộ lọc cho biết đang xem sinh viên/khoảng ngày nào và có thể bỏ từng bộ lọc.

## Trạng thái và kiểm tra

Khi chưa tải xong hoặc gặp lỗi, thẻ thống kê hiển thị dấu gạch; chỉ hiển thị 0 khi API xác nhận dữ liệu rỗng. Đã bỏ nút Tải lại trên đầu trang; vẫn có Thử lại riêng khi nguồn dữ liệu gặp lỗi. Trang không ghi thay đổi tài khoản hoặc quy tắc.

- FE: `src/admin/AdminOverviewPage.tsx`, `src/api/adminOverview.ts`, `src/admin/overview.css`.
- Bộ lọc: `src/api/admin.ts`, `src/admin/StudentAccountsPage.tsx`; BE `DanhSachNguoiDungRequest`/`QuanLyNguoiDungService`.
- BE thống kê: `TongQuanAdminController`, `TongQuanAdminService`.
- Mock: chỉ hoạt động khi chủ động bật `VITE_USE_MOCK_API`, dùng cùng tài khoản với mock auth/admin.

Kiểm thử: `npm.cmd test`, `npm.cmd run test:auth:browser -- --overview`, và `dotnet run --project backend/tests/StudyPlanner.OverviewChecks/StudyPlanner.OverviewChecks.csproj`. Phần BE yêu cầu `STUDYPLANNER_TEST_POSTGRES` là PostgreSQL localhost biệt lập, database quản trị `postgres`; bộ test tự tạo database ngẫu nhiên rồi dọn, không dùng cấu hình DB ứng dụng.

Khởi động lại BE sau khi cập nhật để nạp endpoint và bộ lọc mới, rồi F5 FE.
