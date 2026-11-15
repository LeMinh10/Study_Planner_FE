# Khóa tài khoản và kết thúc phiên đang mở

Khi admin vô hiệu hóa sinh viên, backend lưu trạng thái khóa trước, rồi phát sự kiện `account-disabled` qua Server-Sent Events (SSE) đến các tab đang đăng nhập của tài khoản đó. Frontend xóa phiên và chuyển về Đăng nhập, hiển thị: **Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.** Sinh viên không cần bấm nút hay F5 để nhận thông báo.

## Luồng xử lý

1. `AuthProvider` mở `GET /api/v1/users/me/session-events` sau khi xác thực. Dùng `fetch` với Bearer trong header, không đưa JWT vào URL.
2. Backend đăng ký kênh cho mã người dùng lấy từ JWT; không cho khách chọn mã tài khoản cần theo dõi. Mỗi tab có một đăng ký riêng.
3. Admin gọi `PATCH /api/v1/admin/users/{id}/deactivate`. Chỉ Admin được phép. Backend commit thay đổi thành công rồi mới phát sự kiện; lỗi hoặc thao tác bị từ chối không phát sự kiện khóa.
4. `sessionEvents.ts` đọc dữ liệu streaming, kể cả khi sự kiện bị chia qua nhiều gói mạng. `AuthProvider` nhận lý do `ACCOUNT_DISABLED`, xóa thông tin xác thực và đặt thông báo. `RequireAuth` chuyển về `/login`; `AuthPage` hiển thị thông báo.
5. Những API dùng token của tài khoản đã khóa cũng trả `401` với code `ACCOUNT_DISABLED`; do đó kết nối lại sau khi lỡ sự kiện hoặc F5 vẫn nhận được đúng lý do.

## Kết nối và giới hạn

- SSE phát ngay khi admin thao tác qua cùng tiến trình API. Các tab và thiết bị đều nhận nếu đang kết nối đến tiến trình này.
- Heartbeat kiểm tra DB mỗi 15 giây để nhận biết thay đổi từ tiến trình API khác, tài khoản bị xóa, đổi mật khẩu hoặc token hết hạn. Sự kiện hết phiên có thông báo riêng, không bị gọi nhầm là khóa tài khoản.
- Khi mất mạng/kênh lỗi, FE kiểm tra hồ sơ và thử kết nối lại sau 5 giây; khi quay lại tab cũng kiểm tra. Kết nối im lặng quá 35 giây được mở lại. Mất mạng hoặc lỗi máy chủ không tự kết luận tài khoản bị khóa. Thiết bị offline hoặc trình duyệt bị hệ điều hành tạm dừng chỉ xử lý khi kết nối/chạy lại.
- Hủy stream khi logout, đổi phiên hoặc unmount để tránh sự kiện cũ đăng xuất nhầm phiên mới. Backend hủy đăng ký khi ngắt kết nối.
- Proxy production cần cho phép streaming và không buffer SSE. Endpoint gửi `Cache-Control: no-store, no-transform`, `X-Accel-Buffering: no`.
- Không xóa dữ liệu học tập. Admin có thể kích hoạt tài khoản lại. Chưa bổ sung security stamp vào DB: token JWT cũ chưa hết hạn vẫn có thể được backend chấp nhận sau khi mở khóa nếu token đó chưa bị FE xóa. Đây là cơ chế thoát giao diện và chặn khi đang khóa, chưa phải thu hồi JWT vĩnh viễn.
- Chế độ mock kiểm tra lại hồ sơ định kỳ và khi nhận thay đổi storage; phiên mock bị thu hồi vẫn bị từ chối sau khi mở khóa. Tài khoản demo chỉ xem giao diện, không có JWT thật, không mở SSE.

## Kiểm chứng

Các kiểm tra FE bao gồm sự kiện chia gói, CRLF, hủy đọc, token cũ, phân biệt lý do hết phiên/khóa và mất mạng. BE có `StudyPlanner.SessionChecks` dùng PostgreSQL localhost riêng, kiểm tra SSE bằng JWT, hai kết nối cùng tài khoản, tài khoản khác không bị ảnh hưởng, quyền admin, commit trước khi phát và kết nối lại nhận đúng lý do. Kết quả chạy thực tế được ghi trong lịch sử backend.
