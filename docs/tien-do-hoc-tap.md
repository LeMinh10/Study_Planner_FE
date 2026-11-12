# Tiến độ học tập

Trang `/statistics` gồm tổng quan nhiệm vụ, tiến độ theo môn học và mức độ đúng hạn. Không có biểu đồ nhiệm vụ hoàn thành theo ngày/tuần.

## Phạm vi và bộ lọc

- Dùng học kỳ đang chọn ở thanh trên cùng; F5 giữ lựa chọn học kỳ theo cơ chế chung đã có.
- Chỉ tính nhiệm vụ thuộc học kỳ này. Việc cá nhân không thuộc học kỳ nào và việc của học kỳ khác không được cộng vào.
- Chỉ có bộ lọc môn học, thống kê toàn bộ học kỳ; đã bỏ hai ô lọc khoảng ngày theo yêu cầu. Nhiệm vụ không có hạn vẫn được tính vào tổng.
- Hạn hiệu lực (`hanHieuLuc`), bao gồm hạn kế thừa từ nhiệm vụ cha, vẫn được dùng để xác định quá hạn và hoàn thành đúng/trễ hạn.
- Đổi học kỳ sẽ đặt lại bộ lọc môn để tránh giữ môn của học kỳ khác. Xóa bộ lọc giữ nguyên học kỳ.

## Cách đếm và công thức

Tính mỗi **nhiệm vụ chính** (`maNhiemVuCha = null`, `chiLa=false`) một lần, cùng đơn vị với danh sách Nhiệm vụ ở chế độ mặc định. Nếu một nhiệm vụ có ba bước nhỏ, tổng vẫn là một nhiệm vụ, không cộng thêm ba bước. Trạng thái, hạn và ngày hoàn thành lấy từ chính nhiệm vụ chính do BE trả về; BE đã tổng hợp tiến độ của nó từ các bước nhỏ.

Trước đây Tiến độ đếm nhiệm vụ chưa chia nhỏ nên một nhiệm vụ có nhiều bước có thể tạo ra tổng khác danh sách nhiệm vụ chính. Đã chuyển sang đếm nhiệm vụ chính để thống nhất.

| Chỉ số | Cách tính |
|---|---|
| Tổng nhiệm vụ | Số nhiệm vụ chính trong phạm vi bộ lọc, gồm cả đã hoàn thành |
| Đã hoàn thành | `trangThai = Completed` |
| Tỷ lệ hoàn thành | Đã hoàn thành / Tổng × 100%, làm tròn số nguyên |
| Đang thực hiện | `trangThai = InProgress` |
| Chưa bắt đầu | `trangThai = NotStarted` |
| Đang quá hạn | Chưa hoàn thành và hạn hiệu lực nhỏ hơn thời điểm hiện tại |
| Hoàn thành đúng hạn | Đã hoàn thành, có cả hạn và ngày hoàn thành, ngày hoàn thành ≤ hạn |
| Hoàn thành trễ hạn | Đã hoàn thành, có cả hạn và ngày hoàn thành, ngày hoàn thành > hạn |
| Tỷ lệ đúng hạn | Đúng hạn / (Đúng hạn + Trễ hạn) × 100%, làm tròn số nguyên |

Đang quá hạn là một phần của nhóm chưa bắt đầu/đang thực hiện, không phải trạng thái cộng thêm vào tổng. Việc đã hoàn thành trễ không được đếm vào đang quá hạn.

Nhiệm vụ đã xong nhưng không có hạn hoặc thiếu ngày hoàn thành vẫn tăng số hoàn thành, nhưng không được đưa vào mẫu số tỷ lệ đúng hạn. Giao diện nêu số bị loại khi có. Không đủ dữ liệu đánh giá đúng hạn thì hiển thị `—`, không tự coi là 0% hoặc 100%.

Ví dụ có 10 việc, 5 việc xong: tỷ lệ hoàn thành là 50%. Trong 5 việc xong có 2 đúng hạn, 1 trễ, 1 không hạn và 1 thiếu ngày hoàn thành: tỷ lệ đúng hạn = 2/3 ≈ 67%.

## Theo môn học

Mỗi môn trong học kỳ có tổng nhiệm vụ, số hoàn thành/tổng, số đang quá hạn và thanh tỷ lệ hoàn thành. Môn chưa có việc vẫn có hàng 0. Nhiệm vụ thuộc học kỳ nhưng chưa gắn môn được đưa vào hàng **Không gắn môn học**, có bộ lọc tương ứng.

Khi API môn học lỗi, hiển thị lỗi và nút thử lại; không kết luận rằng học kỳ không có môn. Tổng quan nhiệm vụ có thể vẫn hiển thị nếu đã tải được nguồn nhiệm vụ.

## Đối chiếu với trang Nhiệm vụ

Hai trang cùng gọi API `/tasks`, nhưng cần đối chiếu cùng phạm vi và trạng thái:

- Trang Tiến độ luôn theo học kỳ đang chọn, có ghi tên học kỳ ngay trên thống kê. Không được suy ra việc cá nhân thuộc học kỳ chỉ từ tổng số. Sáu việc đang hiện trong danh sách mặc định chưa đủ để kết luận toàn bộ tài khoản chỉ có sáu việc, vì danh sách này ẩn việc đã hoàn thành.
- Trang Nhiệm vụ dùng bộ lọc học kỳ/môn trong URL; nếu URL không có bộ lọc, có thể đang xem tất cả học kỳ và việc cá nhân. Học kỳ trên thanh chung không tự bảo đảm danh sách nhiệm vụ đã lọc học kỳ đó.
- BE mặc định ẩn nhiệm vụ đã hoàn thành trong chế độ `all` nếu không chỉ định `trangThai`. Tiến độ lấy đủ ba trạng thái nên tổng có gồm đã xong. Cần cộng số chưa xong và số đã xong ở cùng phạm vi khi so tổng.
- Ngay dưới Tổng nhiệm vụ có tách số chưa xong và đã xong. Hai liên kết **Xem nhiệm vụ chưa xong** và **Xem nhiệm vụ đã hoàn thành** truyền cùng học kỳ/môn sang trang Nhiệm vụ. Liên kết đã xong dùng `view=all&status=Completed` để lấy nhiệm vụ chính, cùng cách đếm với thống kê; `view=completed` của module hiện tại trả việc chưa chia nhỏ nên không dùng để đối chiếu nhiệm vụ chính. Không thêm liên kết khi chỉ lọc nhóm không gắn môn vì trang Nhiệm vụ chưa có bộ lọc tương đương.
- Không sửa trang Nhiệm vụ hoặc thay đổi các bộ lọc của module đó.

### Trường hợp đã xác minh ngày 12/11/2026

Đã kiểm tra nguồn database cấu hình của BE bằng truy vấn chỉ đọc trong transaction `READ ONLY`, không chạy migration, không lưu thay đổi. Không in thông tin kết nối, tài khoản hay mật khẩu. Kết quả của tài khoản khớp danh sách sáu nhiệm vụ chưa xong trong ảnh:

| Phạm vi | Chưa hoàn thành | Đã hoàn thành | Tổng nhiệm vụ chính |
|---|---:|---:|---:|
| Học kỳ 5 | 0 | 4 | 4 |
| Học kỳ 6 | 1 | 1 | 2 |

Năm việc cá nhân chưa xong đều có `MaHocKy = null`, không được cộng vào hai học kỳ. Vì vậy 4 và 2 đến từ lịch sử hoàn thành của từng học kỳ. Kết luận trước đó chỉ dựa vào 4 + 2 = 6 là chưa đủ căn cứ; đã đối chiếu dữ liệu thật trước khi giải thích lại. Không xóa nhiệm vụ đã hoàn thành hoặc đổi phạm vi dữ liệu để ép kết quả thành 0 và 1.

## Nguồn dữ liệu và cập nhật

- `src/statistics/statisticsApi.ts`: đọc API có sẵn, không thêm/sửa backend hoặc module Nhiệm vụ.
- GET `/tasks` riêng cho ba trạng thái `NotStarted`, `InProgress`, `Completed`, với `maHocKy`, `chiLa=false`, `cheDo=all`. Chỉ chấp nhận nhiệm vụ chính, đọc đủ các trang, không chỉ trang đầu và không chỉ nhiệm vụ hoàn thành hôm nay. Không dùng `cheDo=completed` để lấy nhóm đã xong vì BE trả nhiệm vụ chưa chia nhỏ ở chế độ đó.
- Đối chiếu phiên bản dữ liệu giữa các trang/nhóm. Nếu có thay đổi trong lúc đọc, thử tải lại một lần; nếu vẫn thay đổi hoặc dữ liệu không hợp lệ, báo lỗi, không tính trên kết quả thiếu hoặc trộn.
- Đã bỏ yêu cầu đọc hồ sơ lấy múi giờ do không còn lọc ngày. So sánh đúng/trễ hạn bằng thời điểm tuyệt đối từ API. JWT luôn gửi trong Bearer header. Tất cả thao tác của trang là đọc.
- `statisticsModel.ts` lọc và tính số liệu; `useStatistics.ts` quản lý tải, hủy yêu cầu, cache theo phiên/học kỳ và cập nhật khi quay lại tab hoặc nhận sự kiện lưu/đồng bộ. Cache chỉ nằm trong bộ nhớ, dùng tối đa 60 giây khi vào lại trang và vẫn cập nhật từ API.
- Lần đầu đang tải không hiển thị số 0 giả. Nếu tải mới lỗi nhưng còn dữ liệu lần trước, giữ số liệu cũ kèm cảnh báo. Không có dữ liệu thật thì hiển thị số 0 và trạng thái rỗng.
- Tài khoản demo/adapter mock xác thực không có nguồn nhiệm vụ thật: hiển thị lời nhắc dùng tài khoản thật, không dựng số liệu mẫu.

## Kiểm chứng

- 7 kiểm thử trong `tests/statistics.test.mjs` đạt: phạm vi học kỳ/môn, cha có nhiều bước vẫn tính một nhiệm vụ, hoàn thành lịch sử, đúng/trễ/không hạn/thiếu ngày hoàn thành, đọc đủ phân trang, JWT, không ghi dữ liệu, thay đổi phiên bản và dữ liệu lỗi. Có trường hợp 5 việc cá nhân + 1 nhiệm vụ học kỳ và trường hợp bổ sung lịch sử hoàn thành khiến số học kỳ là 4 và 2.
- Chrome `--statistics` kiểm tra cả trang Nhiệm vụ thực tế và Tiến độ với cùng API fixture, gồm nhóm chưa xong/đã xong, lọc môn, đổi học kỳ/F5, cache khi cập nhật thất bại, thử lại, rỗng và lỗi lần đầu. Các kiểm tra trình duyệt dùng dữ liệu mô phỏng tách biệt; việc xác minh số 4 và 2 phía trên dùng truy vấn database chỉ đọc riêng.
- Ảnh desktop `.backend-integration/screenshots/statistics-desktop.png` được cập nhật từ fixture kiểm thử sau thay đổi.
- Không ghi/sửa nhiệm vụ hoặc tài khoản thật. Không sửa `src/hoc-tap` hay backend.
