# Quản lý tài khoản sinh viên

Nhánh `feat/admin-quan-ly-tai-khoan-sinh-vien` bổ sung Thêm sinh viên tại danh sách và Sửa thông tin tại danh sách/chi tiết. Có thể cập nhật họ tên, email, mã sinh viên, trường, lớp, ngành; khóa/mở khóa vẫn ở thao tác riêng. Không thêm xóa tài khoản, đổi vai trò hoặc thay mật khẩu sinh viên hiện có.

Biểu mẫu tạo có mật khẩu ban đầu; biểu mẫu sửa không đọc hoặc gửi lại mật khẩu. Không ghi dữ liệu form vào log/localStorage. Mock không giả vờ lưu tài khoản thật. Mọi quyền vẫn phải được backend xác nhận.

POST/PUT dùng `/api/v1/admin/users`. PUT gửi `ngayCapNhatMongDoi` của lần đọc hồ sơ; backend mới kiểm tra mốc này trong transaction. Khi nhận 409/ACCOUNT_CHANGED, đóng form, tải lại và sửa từ dữ liệu mới. Cần chạy backend cùng nhánh để có bảo vệ này; backend cũ có thể bỏ qua trường mới.

Code: `src/admin/StudentAccountEditor.tsx`, `src/admin/StudentAccountsPage.tsx`, `src/admin/StudentDetails.tsx`, `src/api/admin.ts`. Comment nghiệp vụ mới viết bằng tiếng Việt.

Kiểm chứng: build đạt; toàn bộ 180 test frontend đạt; Chrome `node tests/browser-auth.mjs --admin-accounts` đạt tạo/sửa, email trùng, lỗi giữ form, hủy, payload bảo vệ và mobile. Bài trình duyệt dùng fixture. Backend cùng nhánh đạt 169 kiểm tra HTTP/PostgreSQL độc lập. Chưa nghiệm thu bằng tài khoản thật, chưa commit/push hoặc triển khai.
