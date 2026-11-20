# Admin theo dõi học tập sinh viên

Nhánh `feat/admin-theo-doi-hoc-tap-sinh-vien` thêm trang `/admin/learning` và liên kết từ chi tiết sinh viên. Trang có bảng nhiệm vụ, thẻ thống kê, lọc theo sinh viên, môn/học kỳ, trạng thái, quá hạn và bước nhỏ. Bộ lọc bảng nằm trong URL; mặc định chỉ đếm nhiệm vụ chính.

Khi chọn sinh viên có thêm kế hoạch và thời gian học theo khoảng ngày riêng, dùng múi giờ tài khoản sinh viên. Thời lượng dự kiến và thời gian thực học được trình bày riêng; thực học tách bấm giờ và nhập tay. Số giờ là thời gian được ghi nhận, không tự chứng minh chất lượng học.

Toàn bộ API mới là GET có quyền Admin dưới `/api/v1/admin/learning`. Không có sửa/xóa nhiệm vụ. Chỉ xem nhiệm vụ học tập có môn/học kỳ và khác loại Personal; không đọc mô tả, checklist, ghi chú, tệp, giờ rảnh hoặc phiên tập trung tự do.

Code: `src/admin/AdminLearningPage.tsx`, `learning.css`, AdminLayout, AdminRoutes và StudentDetails. Comment mới dùng tiếng Việt. API dùng DTO quản trị riêng; không nới quyền chủ sở hữu của API sinh viên.

Kiểm chứng trong worktree độc lập: build đạt, 179/179 test frontend và Chrome `node tests/browser-auth.mjs --admin-learning` đạt. Backend cùng nhánh đạt 116 kiểm tra HTTP/PostgreSQL riêng. Ảnh giao diện ở `.backend-integration/screenshots/admin-learning.png` dùng fixture. Chưa thử bằng tài khoản/DB thật, chưa commit/push hoặc triển khai.
