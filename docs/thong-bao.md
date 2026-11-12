# Thông báo nhắc hạn

Chuông ở đầu trang đọc hộp thông báo của tài khoản từ BE, dùng chung khi đổi học kỳ. Mỗi thông báo có tên nhiệm vụ, môn/học kỳ nếu có, hạn và thời điểm phát; chấm xanh là chưa đọc. Bấm vào sẽ đánh dấu đã đọc rồi mở đúng nhiệm vụ qua query `task`, `semester`, `subject` của trang Nhiệm vụ hiện có. Không sửa source module Nhiệm vụ.

## Quy tắc

- Chỉ tạo lời nhắc mới cho nhiệm vụ lá chưa hoàn thành, có hạn hiệu lực. Hạn có thể kế thừa từ nhiệm vụ cha.
- Giờ nhắc lấy từ nhiệm vụ; nếu chưa đặt thì dùng mặc định tài khoản (24 giờ với tài khoản mặc định hiện tại). Đặt 0 nghĩa là nhắc đúng hạn.
- Khi vào khoảng nhắc, phát thông báo sắp đến hạn. Khi `hạn < thời điểm hiện tại`, thay bằng thông báo quá hạn và đặt chưa đọc một lần. Tải lại không tạo trùng hoặc xóa trạng thái đọc.
- Tái sử dụng một bản ghi mỗi nhiệm vụ theo unique index BE hiện có; không lưu lịch sử từng lần phát. Đổi hạn có thể thay thế thông báo cũ.
- Hoàn thành giữ thông báo đã phát để xem lại, có nhãn “Đã hoàn thành”, và ngừng phát mới. Bỏ hạn, chuyển thành nhiệm vụ cha hoặc dời hạn ra ngoài khoảng nhắc thì thông báo cũ bị hủy khỏi hộp thư.
- Hộp thư có Tất cả/Chưa đọc, phân trang 20 dòng, số chưa đọc và Đọc tất cả. Trạng thái đọc lưu tại DB, giữ sau F5 và giữa các thiết bị.

## Cách cập nhật

Worker BE chạy ngay khi khởi động và mỗi phút. API danh sách cũng kiểm tra lại dữ liệu hiện hành trước khi trả kết quả. Các thao tác dùng khóa hàng tài khoản chung với task writes để không phát trùng khi nhiều lượt xử lý đồng thời.

FE đọc lại khi vào trang, mỗi phút trong tab đang hiện, lấy lại focus hoặc nhận sự kiện lưu/làm mới. Dữ liệu được nhớ trong bộ nhớ theo phiên đăng nhập, không lưu bản ghi học tập vào trình duyệt. Lỗi được báo riêng và cho Thử lại.

API mới:

| Thao tác | Route và dữ liệu |
| --- | --- |
| Danh sách | `GET /api/v1/notifications?chuaDoc=false&trang=1&kichThuocTrang=20` |
| Đọc một thông báo | `PATCH /api/v1/notifications/{id}/read`, body `{ ngayPhat }` của bản vừa xem |
| Đọc tất cả | `POST /api/v1/notifications/read-all`, body `{ docDenLuc }` từ GET |

Tất cả lấy chủ sở hữu từ JWT. `ngayPhat` ngăn thao tác cũ đọc nhầm thông báo vừa chuyển sang quá hạn; `docDenLuc` ngăn Đọc tất cả đánh dấu cả những thông báo mới xuất hiện sau lần xem danh sách. Ghi thông báo không tăng phiên bản nhiệm vụ/lịch.

## Chạy và kiểm tra

Khởi động lại BE tại `D:\study-planner-datn` để nạp API/worker mới, sau đó F5 FE. BE được triển khai trên nhánh `feat/thong-bao`. Không thêm migration mới cho phần này.

- FE: `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:auth:browser -- --notifications`.
- Hồi quy Hôm nay: `npm.cmd run test:auth:browser -- --today`.
- BE: `dotnet run --project backend/tests/StudyPlanner.NotificationChecks/StudyPlanner.NotificationChecks.csproj`. Có 13 kiểm tra quy tắc luôn chạy; phần DB/HTTP chỉ chạy khi `STUDYPLANNER_TEST_POSTGRES` trỏ tới PostgreSQL localhost, database quản trị `postgres`. Bộ kiểm thử tự tạo database tên ngẫu nhiên và dọn chính database đó, không dùng cấu hình DB ứng dụng.
- Đã kiểm tra: build FE/BE, lint các file thông báo, 118 kiểm thử FE, 13 kiểm tra quy tắc BE, cạnh tranh/quyền sở hữu/lưu trạng thái/hạn kế thừa trên PostgreSQL, endpoint HTTP/JWT và giao diện Chrome ở desktop/mobile. Kiểm thử trình duyệt dùng dữ liệu API kiểm soát; kiểm thử BE dùng database riêng.

Chưa có nhắc lớp học/phiên tự học, email hay browser push. Worker cần BE đang chạy. Khi trình duyệt đóng, thông báo vẫn có thể được ghi vào hộp thư nếu BE còn chạy; chỉ xem được khi mở lại ứng dụng. Bảng `LichNhac` hiện có của module nhiệm vụ vẫn giữ nguyên; worker bản này tính từ dữ liệu nhiệm vụ hiện hành và ghi hộp thư `ThongBao`.
