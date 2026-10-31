# Study Planner Frontend

Không gian nhiệm vụ dạng to-do dành cho sinh viên, xây dựng bằng React, TypeScript và Vite. Thiết kế dành cho desktop, chiều rộng tối thiểu 1024px.

Mở ứng dụng sẽ vào trang **Đăng nhập**. Sau đăng nhập, trang **Nhiệm vụ của tôi** có ba kiểu xem **Danh sách · Bảng · Lịch** trên cùng dữ liệu. Sidebar tổ chức các môn như danh sách nhiệm vụ trong học kỳ. Trang Hôm nay, lịch học và tiến độ vẫn truy cập được như các công cụ hỗ trợ.

Các thao tác dưới đây đã có giao diện. Nút vẫn bấm được; thao tác chưa tích hợp API chưa mở hộp thoại, cập nhật dữ liệu hoặc hiển thị thông báo:

- Thêm nhanh ngay trong nhóm trạng thái, cột bảng hoặc ngày trên lịch. Phím `N` mở dòng thêm nhanh; phím `/` chuyển đến tìm kiếm.
- Danh sách cho phép đánh dấu hoàn thành, mở nhiệm vụ con và sửa trực tiếp trạng thái, hạn hoặc độ quan trọng.
- Bảng cho phép kéo thẻ qua cột để đổi trạng thái; ô chọn trạng thái trên thẻ hỗ trợ thao tác bằng bàn phím.
- Kéo nhiệm vụ sang ngày khác trong lịch để đổi hạn; có thể hiện/ẩn giờ học cùng lịch nhiệm vụ.
- Phần chi tiết bên cạnh cho phép sửa trực tiếp mô tả, hạn nộp, môn học, mức quan trọng và thêm nhiệm vụ nhỏ. Chưa cho phép lưu thay đổi.

## Chạy project

```sh
npm install
npm run dev
```

Trên PowerShell nếu `npm.ps1` bị chặn, dùng `npm.cmd` thay cho `npm`.

```sh
npm.cmd run build
npm.cmd test
```

## Các trang theo phiếu đề tài

| Đường dẫn | Giao diện chức năng |
| --- | --- |
| `/` | Chuyển đến đăng nhập, hoặc `/tasks` nếu đã có phiên sinh viên |
| `/?subject=<subjectId>` | Danh sách nhiệm vụ của một môn; giá trị là ID môn học |
| `/?layout=board` | Bảng Cần làm / Đang làm / Đã xong |
| `/?layout=calendar` | Lịch nhiệm vụ, có thể hiện giờ học và kéo để đổi hạn |
| `/today` | Buổi học tiếp theo, nhiệm vụ đến hạn, lịch trong ngày và nhiệm vụ có thể bắt đầu sớm |
| `/login`, `/register` | Giao diện đăng nhập, đăng ký và kiểm tra dữ liệu nhập |
| `/admin` | Đăng nhập quản trị viên |
| `/admin/students` | Danh sách tài khoản sinh viên; yêu cầu phiên đăng nhập quản trị |
| `/profile` | Cập nhật thông tin cá nhân, mã sinh viên, trường, ngành, năm và mục tiêu học tập |
| `/semesters` | Thêm, sửa, xóa và chọn học kỳ |
| `/subjects` | Thẻ môn học với buổi học tiếp theo, nhiệm vụ còn lại và tiến độ; thêm, sửa, xóa môn học |
| `/subjects/:subjectId` | Không gian của từng môn: bài tập, lịch học, nhiệm vụ nhỏ và thông tin môn; thêm bài tập được chọn sẵn đúng môn |
| `/schedule` | Xây dựng thời khóa biểu theo tuần hoặc ngày cụ thể; kiểm tra trùng giờ; xem bảng tuần hoặc danh sách |
| `/tasks` | Cùng không gian nhiệm vụ với `/`; lọc hôm nay, sắp tới, quá hạn và đã xong |
| `/tasks?view=priority` | Gợi ý nhiệm vụ nên làm trước, kèm lý do; không hiển thị bảng điểm ưu tiên |
| `/calendar` | Lịch học và hạn nhiệm vụ theo ngày, tuần, tháng |
| `/notifications` | Đường dẫn cũ, chuyển sang `/tasks`; thông báo được mở bằng chuông trên thanh đầu trang |
| `/statistics` | Tỷ lệ hoàn thành, số nhiệm vụ đang quá hạn, hoàn thành muộn và thống kê theo môn/loại |
| `/priorities` | Đường dẫn cũ, chuyển sang `/tasks?view=priority` |

`/plans` cũ được chuyển hướng sang `/tasks`.

## Khu vực admin

Mã giao diện quản trị nằm riêng trong `src/admin/`. Mở `/admin` và đăng nhập bằng tài khoản tạm `admin@studyplanner.vn`, mật khẩu `123456` để vào `/admin/students`.

Trang quản lý có thống kê tài khoản, tìm kiếm theo tên/email/mã sinh viên, lọc trạng thái và nút đăng xuất. Danh sách khởi tạo trống, chưa có dữ liệu sinh viên hoặc thao tác thêm/sửa/xóa khi chưa tích hợp API. Đăng nhập admin hiện xử lý ở frontend; khi kết nối backend cần xác thực và kiểm tra quyền tại API. Phiên admin được lưu riêng trong `sessionStorage`, tách khỏi phiên sinh viên.

## Phạm vi hiện tại

- Frontend hiện chưa có backend hoặc API. Ứng dụng khởi tạo với danh sách học kỳ, môn học, lịch học, nhiệm vụ và hồ sơ trống.
- Không đọc hoặc ghi dữ liệu nghiệp vụ vào `localStorage`/`sessionStorage`. Chỉ lưu phiên đăng nhập mẫu sinh viên và admin bằng hai khóa riêng trong `sessionStorage`; các bản ghi cũ không được nạp lại.
- Có đăng nhập mẫu sinh viên (`demo@studyplanner.vn` / `123456`) và admin; đăng xuất xóa phiên tương ứng. Đăng ký, lưu hồ sơ, tạo/sửa/xóa dữ liệu và đánh dấu đã đọc chưa thực hiện hành động khi chưa tích hợp backend. Không mở biểu mẫu tạo/sửa hoặc thông báo lưu thành công. Phím tắt thêm nhiệm vụ và kéo thả cũng chưa cập nhật dữ liệu.
- Điều hướng, tìm kiếm, bộ lọc, đổi kiểu xem và chuyển ngày trên lịch vẫn hoạt động.
- Trang tiến độ hiển thị trạng thái chưa có dữ liệu khi chưa có nhiệm vụ.
- Chuông thông báo nằm bên trái ô tìm kiếm, mở popup nhỏ hiển thị nhiệm vụ quá hạn hoặc đến hạn trong 72 giờ. Bấm ngoài popup, nhấn Escape hoặc chuyển trang để đóng; bấm một thông báo để xem nhiệm vụ. Không gửi email, push hay thông báo nền khi ứng dụng đã đóng.
- Nhiệm vụ chưa hoàn thành được chuyển sang hiển thị quá hạn khi qua thời điểm đến hạn, theo múi giờ Việt Nam. Nhiệm vụ đã xong giữ trạng thái hoàn thành, kể cả nộp muộn.
- Hoàn thành tất cả nhiệm vụ con sẽ hoàn thành nhiệm vụ cha. Mở lại một nhiệm vụ con sẽ đưa nhiệm vụ cha về đang làm.
- Các quy tắc nghiệp vụ và hộp thoại được giữ lại để tích hợp backend; hiện tại không cập nhật dữ liệu cục bộ. Dữ liệu phục vụ kiểm thử chỉ nằm trong `tests/fixtures/`, không được nạp vào ứng dụng.

## Cấu trúc chính

- `src/types/planner.ts`: mô hình dữ liệu.
- `src/data/planner.ts`: trạng thái khởi tạo trống và kiểm tra cấu trúc dữ liệu.
- `src/contexts/PlannerContext.tsx`: state dùng chung và chặn thao tác ghi chưa có API.
- `src/admin/`: đăng nhập quản trị, bố cục admin và quản lý tài khoản sinh viên.
- `src/utils/planner.ts`: trạng thái, hạn nộp, lịch, thống kê và quy tắc ưu tiên.
- `src/utils/studentView.ts`: phân nhóm nhiệm vụ và chọn các buổi học tiếp theo theo thời gian thực.
- `src/utils/workspace.ts`: lọc, sắp xếp, thêm nhanh, chuyển trạng thái và đổi hạn trong không gian nhiệm vụ.
- `src/components/StudentTasks.tsx`: danh sách nhiệm vụ có thể thao tác ngay và phần chi tiết nhiệm vụ.
- `src/components/WorkspaceTasks.tsx`, `WorkspaceCalendar.tsx`: các dòng nhiệm vụ, thẻ bảng, biểu mẫu thêm nhanh và lịch trong workspace.
- `src/layouts/AppLayout.tsx`: khung desktop và điều hướng.
- `src/pages/`: các trang chức năng.
- `src/student.css`: bố cục học tập cá nhân, thẻ môn học và danh sách nhiệm vụ.
- `src/workspace.css`: khung ứng dụng và các kiểu xem nhiệm vụ, được nạp sau các style của trang hỗ trợ.
- `tests/planner.test.mjs`: kiểm tra nghiệp vụ và render các trang.

Khi bổ sung backend, nạp dữ liệu từ API và thay luồng cập nhật cục bộ bằng kết quả API đã xác nhận. Chỉ xử lý từng thao tác sau khi endpoint tương ứng được tích hợp, bao gồm xác thực và lưu hồ sơ; không chỉ đổi cờ `canMutate` để mở lại reducer cục bộ.
