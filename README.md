# Study Planner Frontend

Không gian nhiệm vụ dạng to-do dành cho sinh viên, xây dựng bằng React, TypeScript và Vite. Thiết kế dành cho desktop, chiều rộng tối thiểu 1024px.

Mở ứng dụng sẽ vào trang **Đăng nhập**. Sau khi sinh viên đăng nhập, ứng dụng mở trang **Hôm nay**, cũng là mục đầu tiên trên sidebar. Trang **Nhiệm vụ của tôi** có ba kiểu xem **Danh sách · Bảng · Lịch** trên cùng dữ liệu. Sidebar tổ chức các môn như danh sách nhiệm vụ trong học kỳ; lịch học và tiến độ truy cập được như các công cụ hỗ trợ.

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

Mặc định `npm run dev` dùng bộ giả lập tài khoản/hồ sơ chạy trong trình duyệt, không cần BE. Có thể đăng ký, đăng nhập bằng email hoặc MSSV, sửa hồ sơ, tải lại trang và đổi mật khẩu. Dữ liệu tài khoản được lưu riêng trong `localStorage`; phiên đang đăng nhập lưu trong `sessionStorage`.

Để dùng BE thật sau này, sao chép `.env.example` thành `.env.local`, đặt `VITE_USE_MOCK_API=false`, giữ `VITE_API_BASE_URL=/api/v1` và đổi `API_PROXY_TARGET` thành địa chỉ BE rồi khởi động lại Vite. Vite sẽ chuyển tiếp `/api/v1/...` sang BE, mặc định tại `http://localhost:5059`. Lỗi BE không tự chuyển sang dữ liệu giả lập. Nếu gọi URL BE trực tiếp thay vì proxy, BE cần cho phép CORS từ FE.

Bản build mặc định dùng API thật. Nếu cần build để trình bày khi chưa có BE, đặt `VITE_USE_MOCK_API=true` trước khi build. Khi triển khai với BE, cấu hình reverse proxy cho `/api` hoặc đặt `VITE_API_BASE_URL` tới gốc API thật; proxy development của Vite không nằm trong thư mục `dist`.

Trên PowerShell nếu `npm.ps1` bị chặn, dùng `npm.cmd` thay cho `npm`.

```sh
npm.cmd run build
npm.cmd test
```

## Các trang theo phiếu đề tài

| Đường dẫn | Giao diện chức năng |
| --- | --- |
| `/` | Chuyển đến đăng nhập, hoặc `/today` nếu đã có phiên sinh viên |
| `/tasks?subject=<subjectId>` | Danh sách nhiệm vụ của một môn; giá trị là ID môn học |
| `/tasks?layout=board` | Bảng Cần làm / Đang làm / Đã xong |
| `/tasks?layout=calendar` | Lịch nhiệm vụ, có thể hiện giờ học và kéo để đổi hạn |
| `/today` | Buổi học tiếp theo, nhiệm vụ đến hạn, lịch trong ngày và nhiệm vụ có thể bắt đầu sớm |
| `/login`, `/register` | Giao diện đăng nhập, đăng ký và kiểm tra dữ liệu nhập |
| `/admin` | Đăng nhập quản trị viên |
| `/admin/overview` | Tổng quan admin; hiện chỉ có mục trên sidebar, nội dung trang để trống |
| `/admin/students` | Danh sách tài khoản sinh viên; nút xem chi tiết mở trang riêng; yêu cầu phiên đăng nhập quản trị |
| `/admin/students/:studentId` | Chi tiết sinh viên: họ tên, email, mã sinh viên, trường, lớp, trạng thái và ngày tạo; có liên kết quay lại danh sách |
| `/admin/priority-rules` | Quy tắc ưu tiên; nằm dưới Tài khoản sinh viên trên sidebar, nội dung hiện để trống |
| `/profile` | Xem hồ sơ; cập nhật họ tên, trường, lớp, ngành học và đổi mật khẩu; email/MSSV chỉ đọc |
| `/semesters` | Thêm, sửa, xóa và chọn học kỳ |
| `/subjects` | Thẻ môn học với buổi học tiếp theo, nhiệm vụ còn lại và tiến độ; thêm, sửa, xóa môn học |
| `/subjects/:subjectId` | Không gian của từng môn: bài tập, lịch học, nhiệm vụ nhỏ và thông tin môn; thêm bài tập được chọn sẵn đúng môn |
| `/schedule` | Xây dựng thời khóa biểu theo tuần hoặc ngày cụ thể; kiểm tra trùng giờ; xem bảng tuần hoặc danh sách |
| `/tasks` | Không gian nhiệm vụ với các kiểu xem Danh sách/Bảng/Lịch; lọc hôm nay, sắp tới, quá hạn và đã xong |
| `/tasks?view=priority` | Gợi ý nhiệm vụ nên làm trước, kèm lý do; không hiển thị bảng điểm ưu tiên |
| `/calendar` | Lịch học và hạn nhiệm vụ theo ngày, tuần, tháng |
| `/notifications` | Đường dẫn cũ, chuyển sang `/tasks`; thông báo được mở bằng chuông trên thanh đầu trang |
| `/statistics` | Tỷ lệ hoàn thành, số nhiệm vụ đang quá hạn, hoàn thành muộn và thống kê theo môn/loại |
| `/priorities` | Đường dẫn cũ, chuyển sang `/tasks?view=priority` |

`/plans` cũ được chuyển hướng sang `/tasks`.

## Khu vực admin

Mã giao diện quản trị nằm riêng trong `src/admin/`. Mở `/admin` và đăng nhập bằng tài khoản quản trị để vào `/admin/students`. Vai trò `Student`/`Admin` trong response được ánh xạ sang `sinhvien`/`admin` ở FE. Khi tắt giả lập, BE phải xác thực và kiểm tra quyền tại từng endpoint.

Trang quản lý có danh sách tài khoản, tìm kiếm theo tên/email/mã sinh viên, lọc trạng thái và nút đăng xuất. Trong chế độ giả lập, danh sách có hai bản ghi sinh viên để xem giao diện và thử bộ lọc; danh sách này tách khỏi bộ tài khoản dùng để đăng nhập. Với phiên BE, danh sách vẫn trống vì API quản lý sinh viên chưa nằm trong phạm vi tích hợp auth. Mỗi tab có một phiên đăng nhập và chỉ truy cập khu vực phù hợp với vai trò.

## Tích hợp tài khoản và hồ sơ

FE thực hiện các luồng đăng ký, đăng nhập, xem/sửa hồ sơ và đổi mật khẩu theo ảnh Swagger được cung cấp. Tên trường gửi/nhận dùng DTO tiếng Việt bên dưới; trong giao diện vẫn ánh xạ sang mô hình `Profile` dùng chung. Bộ giả lập trả trạng thái và dữ liệu theo cùng hợp đồng để thử đầy đủ luồng khi chưa có BE.

Tài khoản có sẵn khi khởi tạo bộ giả lập:

| Loại tài khoản | Email | MSSV | Mật khẩu ban đầu |
| --- | --- | --- | --- |
| Sinh viên | `demo@studyplanner.vn` | `SVDEMO001` | `123456` |
| Quản trị | `admin@studyplanner.vn` | — | `123456` |

Sinh viên đăng nhập tại `/login`, quản trị tại `/admin`. Tài khoản sinh viên có sẵn tên trường Cao đẳng Kỹ Thuật Cao Thắng, lớp CDTH23WEBC và ngành Công nghệ thông tin; có thể sửa hồ sơ và đổi mật khẩu. Mật khẩu mới tiếp tục có hiệu lực khi tải lại trang. Có thể đăng ký tài khoản mới với đầy đủ bảy trường bắt buộc, rồi đăng nhập bằng email hoặc MSSV vừa đăng ký.

Danh sách quản lý của admin hiển thị Lê Công Minh (`0306231307`, đang hoạt động) và Trần Hồng Kỳ (`0306231303`, đã khóa). Hai bản ghi chỉ phục vụ giao diện quản lý; chưa có API danh sách tài khoản để nối với đăng ký. Có thể đăng ký các email/MSSV này trong bộ giả lập nếu muốn dùng chính thông tin đó để thử luồng tài khoản.

| API mặc định (sau gốc `/api/v1`) | Dữ liệu gửi/nhận |
| --- | --- |
| `POST /auth/register` | Gửi `{ email, hoTen, matKhau, maSinhVien, tenTruong, tenLop, nganhHoc }`; trả 201 và hồ sơ sinh viên, sau đó chuyển sang đăng nhập |
| `POST /auth/login` | Gửi `{ taiKhoan, matKhau }`, email hoặc MSSV trong `taiKhoan`; trả 200 với `{ tokenTruyCap, loaiToken, hetHanLuc, nguoiDung }` |
| `GET /users/me` | Bearer token; trả 200 với `{ ma, email, hoTen, maSinhVien, tenTruong, tenLop, nganhHoc, vaiTro, dangHoatDong, muiGio, nhacTruocGio, ngayTao, ngayCapNhat }` |
| `PATCH /users/me` | Chỉ gửi `{ hoTen, tenTruong, tenLop, nganhHoc }`; trả 200 với hồ sơ đã sửa, FE gọi GET lại để xác nhận dữ liệu lưu |
| `POST /users/me/change-password` | Gửi `{ matKhauHienTai, matKhauMoi }`; giả lập trả 204, xóa phiên và yêu cầu đăng nhập lại bằng mật khẩu mới |

Đường dẫn có thể thay bằng các biến `VITE_AUTH_*_PATH` trong `.env.example`. Method và ánh xạ DTO nằm trong `src/api/auth.ts`. Trường `hetHanLuc` là thời điểm ISO; FE lấy hạn sớm hơn giữa trường này và claim `exp`. Ảnh đổi mật khẩu có cả mô tả 204 và phản hồi 200 kèm `thongBao`; FE chấp nhận cả hai trường hợp thành công.

- Email/MSSV trùng, sai mật khẩu, tài khoản vô hiệu hóa và lỗi validation được hiển thị từ phản hồi (`thongBao`, `message`, `detail` hoặc `errors`); không báo thành công khi API lỗi.
- Đăng ký bắt buộc họ tên, email, mật khẩu, MSSV, trường, lớp và ngành. Giá trị trống hoặc chỉ có khoảng trắng không được chấp nhận; mật khẩu mới có độ dài 6–128 ký tự và cần nhập lại chính xác. MSSV giữ dạng chuỗi, bao gồm số 0 đầu.
- Email và MSSV trong hồ sơ chỉ đọc. FE không gửi trường vai trò/trạng thái trong đăng ký hoặc cập nhật hồ sơ.
- Phiên đăng nhập chỉ lưu token và hạn phiên trong `sessionStorage`. Khi tải lại trang, phải gọi `/users/me` thành công mới mở nội dung được bảo vệ. Bộ giả lập lưu tài khoản, mật khẩu dẫn xuất bằng PBKDF2 và các phiên token tại khóa `studyplanner.mock-auth.v1` trong `localStorage`; không lưu mật khẩu thô. Xóa khóa này để khởi tạo lại dữ liệu và mật khẩu mẫu ban đầu.
- Token hết hạn, API trả 401, hoặc trả mã `ACCOUNT_DISABLED`, `ACCOUNT_INACTIVE`, `USER_DISABLED` sẽ xóa phiên. Đổi mật khẩu thành công xóa mọi token cũ của tài khoản trong bộ giả lập; mật khẩu cũ không đăng nhập được nữa.
- Token giả lập chỉ có ý nghĩa với dữ liệu trình duyệt này, không phải JWT được BE thật ký. Khi nối BE, xác thực, băm mật khẩu và thu hồi JWT phải do BE thực hiện.
- Có kiểm thử hợp đồng Swagger bằng HTTP giả lập và kiểm thử trình duyệt chạy bộ giả lập thực tế; chưa kiểm thử với BE thật.

## Phạm vi hiện tại

- Tài khoản và hồ sơ chạy được với dữ liệu giả lập, hoặc gọi BE khi tắt giả lập. Danh sách học kỳ, môn học, lịch học và nhiệm vụ vẫn khởi tạo trống, chờ tích hợp API nghiệp vụ.
- Không đọc hoặc ghi dữ liệu học tập vào `localStorage`/`sessionStorage`; các bản ghi cũ không được nạp lại.
- Đăng ký, đăng nhập, cập nhật hồ sơ và đổi mật khẩu dùng phản hồi API. Các thao tác tạo/sửa/xóa dữ liệu học tập và đánh dấu đã đọc chưa cập nhật dữ liệu khi chưa có endpoint tương ứng. Phím tắt thêm nhiệm vụ và kéo thả cũng chưa cập nhật dữ liệu.
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
- `src/contexts/AuthProvider.tsx`: phiên JWT, xác minh hồ sơ, đổi mật khẩu và đăng xuất.
- `src/api/`: HTTP client, cấu hình endpoint và ánh xạ dữ liệu tài khoản.
- `src/api/mockAuth.ts`: bộ giả lập theo Swagger v1, lưu tài khoản/hồ sơ và thu hồi token sau đổi mật khẩu.
- `src/auth/`: đọc hạn JWT, lưu phiên và kiểm tra đầu vào.
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
- `tests/auth.test.mjs`, `tests/mock-auth.test.mjs`: kiểm tra hợp đồng API, dữ liệu giả lập và thu hồi token cũ.
- `tests/browser-auth.mjs`: kiểm tra cả chế độ API qua HTTP giả lập và chế độ dữ liệu trình duyệt không có BE; chạy `npm run test:auth:browser`.
- `tests/auth.test.mjs`: kiểm tra luồng API auth bằng phản hồi giả lập.
- `tests/browser-auth.mjs`: kiểm tra biểu mẫu, khôi phục phiên, phân quyền, đổi mật khẩu/đăng xuất và hết hạn JWT trên Chrome/Edge headless với API giả lập. Chạy `npm run test:auth:browser`; đặt `CHROME_PATH` nếu trình duyệt nằm ngoài vị trí mặc định.

Khi bổ sung API học tập, nạp dữ liệu và cập nhật bằng kết quả API đã xác nhận; không chỉ đổi cờ `canMutate` để mở lại reducer cục bộ. Cờ này chỉ chặn thao tác học tập, không chặn các chức năng tài khoản/hồ sơ đã có API riêng.
