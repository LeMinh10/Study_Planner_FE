# Trang Hôm nay và gợi ý ưu tiên

## Phạm vi

Trang `/today` là trang tổng hợp để sinh viên biết hôm nay có việc gì và nên bắt đầu từ đâu. Nội dung gồm:

- Số nhiệm vụ chưa xong đến hạn hôm nay, số nhiệm vụ quá hạn và số lịch trong ngày.
- Năm gợi ý nên làm trước; có thể mở toàn bộ thứ tự gợi ý ngay tại trang.
- Thông tin chính của từng việc; phần giải thích quy tắc được giữ trong tài liệu này, không hiển thị trên giao diện.
- Các nhóm đến hạn hôm nay, quá hạn và đã hoàn thành với hạn hôm nay.
- Buổi học đang diễn ra hoặc tiếp theo trong bảy ngày, cùng lịch lớp/sự kiện/tự học trong ngày.
- Hộp xem thông tin nhiệm vụ. Nút “Mở trong Nhiệm vụ” mở đúng chi tiết trong trang đã được nhóm tích hợp.

Trang chỉ đọc API, không tạo/sửa/xóa nhiệm vụ, không đặt hay hủy phiên tự học. Không thay đổi source của trang Nhiệm vụ, module `hoc-tap`, state planner hay layout chung. BE cũng không cần thay đổi.

## Luồng dữ liệu

```text
Đăng nhập → dùng JWT hiện tại
          ├─ GET /tasks: lá NotStarted, phân trang đầy đủ
          ├─ GET /tasks: lá InProgress, phân trang đầy đủ
          ├─ GET /tasks: lá Completed + cheDo=today, phân trang đầy đủ
          └─ GET /calendar: lịch tổng hợp trong khoảng ngày bao phủ hôm nay và tuần tới
                       ↓
Lọc học kỳ trên thanh đầu trang + việc cá nhân không gắn học kỳ
                       ↓
Tính thứ tự ưu tiên → hiển thị lý do và các thông tin trong ngày
```

Ba lượt đọc trạng thái nhiệm vụ và lượt đọc lịch bắt đầu song song. Mỗi trạng thái tiếp tục tải các trang còn lại theo thứ tự; không chỉ xếp hạng 20 hoặc 100 bản ghi đầu tiên. API nhiệm vụ mặc định bỏ các việc đã xong và trả nhiệm vụ gốc, nên trang chủ động gửi `chiLa=true` và `trangThai` cụ thể. `Completed + cheDo=today` lấy các việc hoàn thành có hạn hôm nay theo múi giờ tài khoản, không tải toàn bộ lịch sử hoàn thành.

Các trang nhiệm vụ phải cùng `phienBan` để tránh đếm trùng hoặc thiếu khi có thay đổi giữa lúc tải. Nếu phiên bản lệch, tải lại một lần; nếu vẫn lệch, báo lỗi và cho thử lại. Lịch là một nguồn đọc riêng: lỗi lịch không làm mất gợi ý nhiệm vụ và ngược lại.

BE đã mở rộng lịch lặp theo học kỳ/ngày áp dụng, nên FE dùng `/calendar` thay vì gọi thêm một API lịch cho từng môn. FE dùng `muiGio` BE trả về để xác định ngày và hiển thị giờ; trước khi đọc được lịch, dùng mặc định Việt Nam.

## Thuật toán gợi ý

Đây là thuật toán theo quy tắc xác định, không phải mô hình AI được huấn luyện. Cùng dữ liệu và cùng thời điểm luôn có cùng kết quả.

Chỉ nhận nhiệm vụ **chưa hoàn thành** và **không có nhiệm vụ con**. Dùng `hanHieuLuc` do BE tính, bao gồm hạn kế thừa từ cha; không chỉ dùng hạn nhập riêng trên nhiệm vụ.

Mỗi nhiệm vụ được gán vào một nhóm mô tả độ gấp:

| Nhóm | Điều kiện tại thời điểm tính |
| --- | --- |
| 0 | Đã qua hạn |
| 1 | Còn từ 0 đến 6 giờ |
| 2 | Còn trên 6 đến 24 giờ |
| 3 | Còn trên 24 đến 72 giờ |
| 4 | Còn trên 72 đến 168 giờ |
| 5 | Còn hơn 168 giờ |
| 6 | Chưa có hạn hiệu lực |

Khi sắp xếp, chia ba nhóm chính: quá hạn trước, có hạn chưa quá tiếp theo, chưa có hạn cuối cùng. Trong mỗi nhóm chính, mặc định so sánh lần lượt:

1. Hạn hiệu lực: thời điểm sớm hơn trước.
2. Nếu cùng hạn (hoặc đều chưa có hạn), xét mức quan trọng: High → Medium → Low.
3. Trạng thái: InProgress trước NotStarted nếu hai tiêu chí trên bằng nhau.
4. Mã nhiệm vụ tăng dần nếu tất cả vẫn bằng nhau, để tránh thứ tự thay đổi ngẫu nhiên.

Đây là so sánh theo thứ tự tiêu chí, không cộng một điểm tổng. Mặc định việc mức quan trọng cao nhưng còn xa hạn không vượt việc có hạn sớm hơn. Việc quá hạn và việc chưa có hạn luôn giữ hai nhóm biên ngay cả khi admin đổi thứ tự tiêu chí.

Ví dụ, lúc 10:00:

| Việc | Hạn | Quan trọng | Vị trí tương đối |
| --- | --- | --- | --- |
| A | Hôm qua | Thấp | Đứng trước B và C vì đã quá hạn |
| B | Hôm nay 15:00 | Cao | Sau C vì hạn muộn hơn |
| C | Hôm nay 12:00 | Trung bình | Đứng trước B vì hạn sớm hơn, dù mức quan trọng thấp hơn |

Các mốc 6/24/72/168 giờ dùng để mô tả độ gấp. Mặc định hạn cụ thể được xét trước mức quan trọng, nên hạn sớm hơn đứng trước. Admin có thể đổi thứ tự/bỏ các tiêu chí phụ, lưu phiên bản và áp dụng tại trang Quy tắc ưu tiên. Hôm nay đọc cấu hình đang dùng từ BE; xem [quản lý quy tắc](quy-tac-uu-tien-admin.md). Nếu Mức quan trọng được đưa lên trước Hạn hoàn thành, cùng nhóm chính thì việc mức Cao có thể đứng trước việc hạn sớm hơn mức Trung bình.

## Lý do và việc cập nhật

Thứ tự có thể giải thích qua hạn hiệu lực, mức quan trọng, trạng thái và nguồn hạn dùng để sắp xếp. Ví dụ: việc hạn 17:00 mức Trung bình đứng trước việc hạn 22:00 mức Cao trong cùng ngày. Giao diện hiện chỉ giữ thứ tự, tên nhiệm vụ, môn và hạn; không hiển thị các đoạn lý do, quy tắc hay nhãn múi giờ.

Đồng hồ dùng chung cập nhật khoảng 30 giây và khi lấy lại focus, nên nhóm độ gấp/thứ tự được tính lại theo thời gian. Dữ liệu được đọc lại khi mở trang, nhấn Cập nhật, nhận sự kiện lưu/làm mới hoặc quay lại tab sau hơn 30 giây. Đây không phải đồng bộ đẩy thời gian thực; thay đổi từ thiết bị khác cần lượt tải mới để xuất hiện.

Bản đọc gần nhất được giữ trong bộ nhớ tối đa năm phút, tách theo phiên đăng nhập; thời hạn của nhiệm vụ và lịch được tính riêng. Khi quay lại trang, nội dung cũ hiện ngay và được làm mới ở nền. Không ghi nhiệm vụ/lịch vào localStorage hay sessionStorage. Tải lại toàn bộ ứng dụng cần đọc BE lại. Bản nhớ qua ngày không được dùng vì tập nhiệm vụ hoàn thành có hạn hôm nay đã thay đổi.

## Câu hỏi thường gặp khi phản biện

**“Đây là hệ thống đề xuất hay sinh viên tự đặt?”**

Sinh viên cung cấp dữ liệu đầu vào như hạn và mức quan trọng khi quản lý nhiệm vụ. Hệ thống tự kết hợp các dữ liệu đó để ra thứ tự và lý do; sinh viên không kéo sắp thứ tự gợi ý trên Hôm nay.

**“Tại sao không dùng `sapXep=priority` của BE?”**

BE hiện sắp tham số đó chủ yếu theo mức High/Medium/Low rồi mã. Trang Hôm nay cần thêm độ gấp, hạn cụ thể và trạng thái, nên có hàm suy ra thứ tự riêng trong FE. BE vẫn quyết định quyền truy cập, dữ liệu nhiệm vụ, tiến độ và hạn hiệu lực. Nếu cần một thứ tự thống nhất cho nhiều ứng dụng, bước tiếp theo là chuyển chính sách gợi ý thành một endpoint BE riêng.

**“Tại sao không xếp cả nhiệm vụ cha?”**

Tiến độ cha được BE tổng hợp từ các con. Nếu gợi ý cả cha và con sẽ đếm trùng công việc; nhiệm vụ lá là đơn vị có thể bắt tay làm cụ thể.

**“Đã xong hôm nay là gì?”**

Ở đây là số việc **có hạn hôm nay và đã hoàn thành**, không phải mọi việc được đánh dấu xong trong ngày. Nhãn giao diện ghi rõ để không gây nhầm. Một nhiệm vụ hạn tuần sau nhưng hoàn thành hôm nay không nằm trong tỷ lệ này.

**“Gợi ý có bảo đảm kịp mọi hạn hay là lịch tự học tối ưu không?”**

Không. Đây là thứ tự tham khảo, chưa tối ưu theo giờ rảnh, độ khó, thời lượng, phụ thuộc công việc hay khối lượng thực tế. Lập lịch phiên tự học là chức năng khác đã có trong module học tập. Việc quá hạn rất lâu có thể cần điều chỉnh hạn hoặc bỏ việc; gợi ý chỉ báo cần xem lại, không tự sửa dữ liệu.

**“Có ảnh hưởng phần Nhiệm vụ của thành viên khác không?”**

Không chỉnh source hoặc state của phần đó. Hôm nay gọi API đọc và dùng đường dẫn `task`, `semester`, `subject` đã có để mở đúng chi tiết khi người dùng muốn thao tác. Các tiêu chí gợi ý chỉ áp dụng trên Hôm nay.

## Vị trí code và kiểm tra

- `src/pages/Dashboard/Dashboard.tsx`: giao diện, trạng thái trống/lỗi, hộp chi tiết.
- `todayModel.ts`: thứ tự gợi ý, lý do, lọc phạm vi và lịch ngày.
- `todayApi.ts`: đọc/kiểm tra DTO, phân trang và phiên bản.
- `useToday.ts`, `todayCache.ts`: tải độc lập, cập nhật nền và bộ nhớ riêng.
- `today.css`: style có phạm vi riêng của trang.

Chạy `npm.cmd run build`, `npm.cmd test` và `npm.cmd run test:auth:browser -- --today`. Kịch bản trình duyệt dùng HTTP giả lập, kiểm tra thứ tự thực tế, lý do, đổi học kỳ, hạn kế thừa, múi giờ, cache khi quay lại, lỗi từng nguồn, retry, trạng thái trống và xác nhận không có lệnh ghi nhiệm vụ/lịch. Ảnh kiểm tra được lưu tại `.backend-integration/screenshots/today-priorities-desktop.png`.
