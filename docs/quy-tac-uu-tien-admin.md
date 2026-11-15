# Admin quản lý quy tắc ưu tiên

Trang `/admin/priority-rules` quản lý cấu hình dùng cho gợi ý Hôm nay của tất cả sinh viên. Quy tắc được lưu tại BE trong bảng `quy_tac_uu_tien` đã có, không tạo migration mới.

## Thao tác

1. Đặt tên, bật/tắt tiêu chí phụ bằng công tắc và kéo tay nắm sáu chấm để đổi thứ tự. Có thể dùng nút lên/xuống thay cho kéo thả.
2. Bấm **Lưu quy tắc**. Bước này chưa thay đổi quy tắc đang áp dụng.
3. Trong **Quy tắc đã lưu**, bấm **Áp dụng** và xác nhận để dùng cho Hôm nay.

Giao diện đã bỏ khung xem thử và các đoạn giải thích dài; quy tắc chi tiết được giữ trong tài liệu này.

Thông tin phiên bản được ẩn trên cả Tổng quan và trang Quy tắc, bao gồm nhãn, bảng, nút và thông báo. BE vẫn lưu phiên bản nội bộ để quản lý các bản cấu hình và kiểm tra xung đột khi áp dụng.

Tiêu chí được tắt hiển thị màu nhạt và không có số thứ tự ưu tiên. Hạn hoàn thành có nhãn khóa “Bắt buộc”. Tay nắm hỗ trợ bàn phím: Space/Enter để chọn hoặc hoàn tất, phím lên/xuống để di chuyển, Escape để hủy thay đổi trong lượt đó. Đổi thứ tự chưa tự lưu hoặc áp dụng.

**Chỉnh sửa** lấy cấu hình cũ vào form và lưu thành phiên bản mới, không ghi đè bản cũ. Có thể áp dụng lại một phiên bản cũ để quay về cách xếp trước đó. **Dùng mặc định** chỉ điền lại form; vẫn phải lưu và áp dụng. Chỉ xóa được phiên bản không đang dùng.

## Quy tắc sắp xếp

Luôn chia ba nhóm theo thứ tự: quá hạn → có hạn chưa quá → chưa có hạn. Trong mỗi nhóm, xét các tiêu chí được bật theo thứ tự admin đặt. Nếu vẫn bằng nhau, mã nhiệm vụ tăng dần giữ kết quả ổn định.

| Tiêu chí | Cách so sánh |
| --- | --- |
| Hạn hoàn thành | Hạn hiệu lực sớm hơn trước; bắt buộc có trong cấu hình |
| Mức quan trọng | Cao → Trung bình → Thấp; có thể bỏ chọn |
| Đang thực hiện | Đang thực hiện trước Chưa bắt đầu; có thể bỏ chọn |

Mặc định là **Hạn hoàn thành → Mức quan trọng → Đang thực hiện → Mã**. Khi chưa có phiên bản được áp dụng, BE trả cấu hình mặc định với mã/phiên bản 0; không tự ghi một bản vào database.

Ví dụ: cùng chưa quá hạn, A hạn 17:00 mức Trung bình, B hạn 22:00 mức Cao. Mặc định A trước B. Nếu admin đưa Mức quan trọng lên trước Hạn hoàn thành và áp dụng, B trước A. Việc đã quá hạn vẫn ở nhóm đầu, việc chưa có hạn vẫn ở nhóm cuối.

Các mốc 6/24/72/168 giờ trong `todayModel.ts` còn dùng để mô tả độ gấp; không đứng trước cấu hình admin trong phép so sánh. Chỉ lấy nhiệm vụ lá chưa hoàn thành, giữ phạm vi học kỳ đang chọn và việc cá nhân. Không sửa hạn, mức quan trọng hay trạng thái nguồn của nhiệm vụ.

## API và tính nhất quán

| Quyền | Endpoint | Nội dung |
| --- | --- | --- |
| Đã xác thực | `GET /api/v1/priority-rules/active` | Cấu hình đang áp dụng |
| Admin | `GET /api/v1/admin/priority-rules?trang=1&kichThuocTrang=20` | Danh sách phiên bản |
| Admin | `POST /api/v1/admin/priority-rules` | Tạo bản chưa áp dụng với `ten`, `cauHinh` |
| Admin | `POST /api/v1/admin/priority-rules/{id}/activate` | Áp dụng với `phienBanDangDung` vừa đọc |
| Admin | `DELETE /api/v1/admin/priority-rules/{id}` | Xóa bản không đang dùng |

Cấu hình có schema xác định, không nhận mã thực thi hoặc tiêu chí tùy ý:

```json
{"phienBanSchema":1,"tieuChi":["Deadline","Importance","InProgress"]}
```

BE kiểm tra tên dài 1–200 ký tự, schema 1, tiêu chí hợp lệ, không trùng và luôn có Deadline. JWT xác định quyền; sinh viên chỉ đọc cấu hình đang áp dụng. Config đã lưu không hợp lệ sẽ báo lỗi, không âm thầm coi là mặc định.

Tạo/áp dụng/xóa chạy trong giao dịch với advisory lock toàn bộ cấu hình. Unique index bảo đảm chỉ có một dòng đang dùng. Khi hai admin cùng áp dụng từ một bản cũ, yêu cầu tới sau nhận 409 nếu bản đang dùng đã khác. UI giữ nội dung form và cho tải lại; không tự ghi đè. Phiên bản được cấp từ identity sequence hiện có nên không tái dùng số đã xóa. Không thay đổi phiên bản dữ liệu nhiệm vụ/lịch của sinh viên.

Hôm nay tải cấu hình khi mở/quay lại/làm mới và mỗi phút khi tab hiện. Bản đã xác nhận được nhớ trong bộ nhớ theo phiên đăng nhập. Nếu lần đầu không tải được config thì chưa hiển thị gợi ý theo một mặc định đoán trước; nhiệm vụ và lịch vẫn được tải độc lập. Nếu đã có bản cũ trong bộ nhớ, có thể hiển thị kèm lỗi cập nhật. Đây là tải định kỳ, chưa có push thời gian thực.

## Đường dẫn code và phạm vi

- FE: `src/admin/AdminPriorityRulesPage.tsx`, `src/priority/`, `src/api/priorityRules.ts`, `src/pages/Dashboard/todayModel.ts` và `useToday.ts`.
- BE: Application/UuTien kiểm tra cấu hình; Infrastructure/UuTien quản lý lưu/áp dụng; hai controller QuyTacUuTien/QuyTacDangDung và đăng ký service trong Program.
- Có hỗ trợ chế độ mock khi bật chủ động; cấu hình giả lập nằm trong database trình duyệt của bộ mock, không dùng thay cho cấu hình BE thật.
- Áp dụng cho gợi ý Hôm nay; bộ lọc ưu tiên của trang Nhiệm vụ và thuật toán phân bổ giờ BE giữ phạm vi riêng. Chưa có nhật ký người thao tác từng lần áp dụng; bảng hiện có lưu phiên bản, tên, thời điểm tạo và trạng thái đang dùng.

Khởi động lại BE sau khi cập nhật để nạp API mới. BE được làm trên nhánh `feat/quy-tac-uu-tien`; không tự commit/push.

## Kiểm chứng

- `npm.cmd test`: kiểm tra hợp đồng API, cấu hình hợp lệ/sai, thứ tự thay đổi theo cấu hình, không đổi nhiệm vụ nguồn, phạm vi quyền và lưu cấu hình mock.
- `npm.cmd run test:auth:browser -- --priority-rules`: giao diện gọn, lưu/áp dụng/xóa, hủy xác nhận, lỗi ghi giữ form, F5, xung đột giữa admin, phân trang, gợi ý Hôm nay dùng config và lỗi tải không giả vờ mặc định.
- `npm.cmd run test:auth:browser -- --today`: quy tắc mặc định và các chức năng Hôm nay hiện có.
- `npm.cmd run test:auth:browser`: hồi quy đăng nhập chung và admin.
- BE: `dotnet run --project backend/tests/StudyPlanner.PriorityChecks/StudyPlanner.PriorityChecks.csproj`; phần PostgreSQL/HTTP cần `STUDYPLANNER_TEST_POSTGRES` trỏ tới database quản trị `postgres` trên localhost biệt lập. Kiểm thử tự tạo database tên ngẫu nhiên và dọn sau chạy, không đọc cấu hình DB ứng dụng.
