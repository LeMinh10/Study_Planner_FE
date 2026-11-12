# Study Planner Frontend

Không gian nhiệm vụ dạng to-do dành cho sinh viên, xây dựng bằng React, TypeScript và Vite. Thiết kế dành cho desktop, chiều rộng tối thiểu 1024px.

Mở ứng dụng sẽ vào trang **Đăng nhập**. Sau khi sinh viên đăng nhập, ứng dụng mở trang **Hôm nay**, cũng là mục đầu tiên trên sidebar. Trang **Nhiệm vụ** có ba kiểu xem **Danh sách · Bảng · Lịch** trên cùng dữ liệu. Sidebar tổ chức các môn như danh sách nhiệm vụ trong học kỳ; lịch học và tiến độ truy cập được như các công cụ hỗ trợ.

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

Mặc định `npm run dev` gọi backend thật tại `http://localhost:5059` qua proxy `/api/v1`. Các luồng tài khoản/hồ sơ/admin dùng dữ liệu PostgreSQL của backend. Frontend không chứa chuỗi kết nối Neon và không kết nối trực tiếp database. Phiên JWT được lưu trong `sessionStorage`; dữ liệu tài khoản giả lập chỉ được dùng khi chủ động bật mock.

Sao chép `.env.example` thành `.env.local`, giữ `VITE_USE_MOCK_API=false`, `VITE_ENABLE_DEMO_AUTH=false`, `VITE_API_BASE_URL=/api/v1` và đặt `API_PROXY_TARGET` thành địa chỉ BE rồi khởi động lại Vite. Vite sẽ chuyển tiếp `/api/v1/...` sang BE, mặc định tại `http://localhost:5059`. Lỗi BE không tự chuyển sang dữ liệu giả lập. Nếu gọi URL BE trực tiếp thay vì proxy, BE cần cho phép CORS từ FE.

Bản build mặc định dùng API thật. Nếu cần build để trình bày khi chưa có BE, đặt `VITE_USE_MOCK_API=true` trước khi build. Khi triển khai với BE, cấu hình reverse proxy cho `/api` hoặc đặt `VITE_API_BASE_URL` tới gốc API thật; proxy development của Vite không nằm trong thư mục `dist`.

Trên PowerShell nếu `npm.ps1` bị chặn, dùng `npm.cmd` thay cho `npm`.

Backend cần chạy trước frontend. Với bản backend đang có trên máy, có thể chạy lệnh sau từ terminal tại thư mục frontend:

```powershell
dotnet run --project D:\study-planner-datn\backend\StudyPlanner.Api --launch-profile http
```

Nếu chỉ muốn xem dữ liệu mẫu khi không chạy backend, đặt `VITE_USE_MOCK_API=true` rồi khởi động lại Vite. Cấu hình này chỉ bật giả lập cục bộ; dữ liệu mẫu không được lưu sang Neon. Giao diện sidebar và các trang học tập vẫn giữ nguyên.

```sh
npm.cmd run build
npm.cmd test
```

Chạy `npm.cmd run test:backend` khi backend đang chạy để kiểm tra Swagger, validation và xác thực qua proxy thật. Mặc định lệnh này chỉ đọc/kiểm tra dữ liệu không hợp lệ. Nếu đặt biến môi trường `TEST_ADMIN_EMAIL` và `TEST_ADMIN_PASSWORD` bằng tài khoản admin hiện có, lệnh sẽ kiểm tra thêm đăng ký, đăng nhập email/MSSV, sửa hồ sơ, đổi mật khẩu và kích hoạt/vô hiệu hóa một tài khoản kiểm thử riêng; tài khoản được dọn trong `finally`. Không đưa các thông tin đăng nhập này vào source hoặc commit. `npm.cmd run test:auth:browser` kiểm tra giao diện với HTTP giả lập và bộ mock cục bộ, không ghi dữ liệu vào backend thật.

## Các trang theo phiếu đề tài

| Đường dẫn | Giao diện chức năng |
| --- | --- |
| `/` | Chuyển đến đăng nhập, hoặc `/today` nếu đã có phiên sinh viên |
| `/tasks?subject=<subjectId>` | Danh sách nhiệm vụ của một môn; giá trị là ID môn học |
| `/tasks?layout=board` | Bảng Cần làm / Đang làm / Đã xong |
| `/tasks?layout=calendar` | Lịch nhiệm vụ, có thể hiện giờ học và kéo để đổi hạn |
| `/today` | Tổng quan trong ngày, gợi ý ưu tiên tự động, nhiệm vụ theo hạn và lịch lớp/sự kiện/tự học |
| `/login`, `/register` | Đăng nhập chung cho sinh viên/admin; đăng ký tài khoản sinh viên |
| `/admin` | Chuyển vào quản lý nếu là admin; chưa đăng nhập thì về `/login` |
| `/admin/overview` | Thống kê sinh viên, năm sinh viên mới đăng ký và quy tắc ưu tiên đang áp dụng |
| `/admin/students` | Danh sách tài khoản có tìm kiếm, lọc trạng thái, phân trang và kích hoạt/vô hiệu hóa; yêu cầu phiên quản trị |
| `/admin/students/:studentId` | Chi tiết tài khoản theo mã người dùng: thông tin sinh viên, vai trò, trạng thái, ngày tạo/cập nhật; có nút đổi trạng thái và quay lại danh sách |
| `/admin/priority-rules` | Quản lý phiên bản quy tắc: chỉnh tiêu chí/thứ tự, lưu, áp dụng và xóa bản chưa dùng |
| `/profile` | Xem hồ sơ; cập nhật họ tên, MSSV, trường, lớp, ngành học và đổi mật khẩu; email chỉ đọc |
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

Mã giao diện quản trị nằm riêng trong `src/admin/`. Sinh viên và admin cùng đăng nhập tại `/login`. FE gọi đăng nhập rồi xác minh JWT bằng `/users/me`; tài khoản có vai trò `Admin` vào `/admin/overview`, tài khoản `Student` vào `/today`. Không chọn vai trò trên form hoặc suy ra quyền từ email. Vai trò `Student`/`Admin` trong response được ánh xạ sang `sinhvien`/`admin` ở FE. BE tiếp tục xác thực và kiểm tra quyền tại từng endpoint.

Đã bỏ trang đăng nhập admin riêng. Các đường dẫn `/admin` cũ vẫn đi qua kiểm tra phiên/quyền. Đăng xuất admin quay về `/login`; mở lại `/login` khi đã có phiên hợp lệ sẽ chuyển về trang tương ứng với vai trò. Sinh viên không truy cập được khu vực quản trị.

Trang quản lý gọi API để tải danh sách, tìm theo tên/email/MSSV, lọc trạng thái và phân trang. Danh sách bao gồm tài khoản `Student` và `Admin`, có cột vai trò. Mặc định hiển thị 20 tài khoản/trang; có thể chọn 5, 10, 20, 50 hoặc 100. Bộ lọc và số trang được giữ trong URL khi mở chi tiết rồi quay lại. Có trạng thái đang tải, lỗi và thử lại; không hiển thị danh sách trống khi yêu cầu tải dữ liệu chưa hoàn tất.

Trong chế độ giả lập, đăng ký, đăng nhập, hồ sơ và quản trị dùng chung dữ liệu tài khoản. Sinh viên vừa đăng ký sẽ xuất hiện trong danh sách quản lý. Nút kích hoạt/vô hiệu hóa có ở danh sách và trang chi tiết, chỉ cập nhật giao diện sau khi API xác nhận thành công. Vô hiệu hóa chặn đăng nhập và thu hồi mọi token đang có của tài khoản; kích hoạt lại cho phép đăng nhập mới, không khôi phục token cũ. Trạng thái được giữ khi tải lại trang. Mỗi tab có một phiên đăng nhập và chỉ truy cập khu vực phù hợp với vai trò.

Sidebar gồm **Tổng quan**, **Tài khoản sinh viên** và **Quy tắc ưu tiên**. [Tổng quan](docs/tong-quan-admin.md) hiển thị thống kê Student, năm sinh viên mới và quy tắc đang dùng; bốn thẻ thống kê chỉ hiển thị số liệu. Trang Quy tắc ưu tiên quản lý cấu hình dùng chung cho gợi ý Hôm nay; xem [cách dùng, thuật toán và API](docs/quy-tac-uu-tien-admin.md).

Với backend thật, vô hiệu hóa phát sự kiện SSE đến các phiên đang mở để tự chuyển sinh viên về Đăng nhập và hiển thị thông báo tài khoản bị khóa. Không cần thao tác/F5. Khi mất kết nối, ứng dụng kiểm tra lại và tự kết nối lại; xem [luồng khóa tài khoản và giới hạn](docs/khoa-tai-khoan.md). Khởi động lại BE sau khi cập nhật để nạp endpoint SSE mới.

| API quản trị (sau gốc `/api/v1`) | Dữ liệu gửi/nhận |
| --- | --- |
| `GET /admin/overview` | Bearer token admin; thống kê Student và năm sinh viên mới nhất, không phụ thuộc phân trang |
| `GET /admin/users` | Bearer token admin; query tùy chọn `TuKhoa`, `Trang` (từ 1, mặc định 1), `KichThuocTrang` (1–100, mặc định 20), `DangHoatDong`, `VaiTro` (`Student`/`Admin`), `TaoTu`, `TaoDen` (thời điểm có múi giờ); trả 200 với `{ danhSach, trang, kichThuocTrang, tongSo }` |
| `GET /admin/users/{id}` | Mã người dùng là số nguyên dương; trả 200 và hồ sơ tài khoản tương ứng |
| `PATCH /admin/users/{id}/activate` | Không cần body; trả 200 với `{ thongBao: "Kích hoạt tài khoản thành công.", dangHoatDong: true }` |
| `PATCH /admin/users/{id}/deactivate` | Không cần body; trả 200 với `{ thongBao: "Vô hiệu hóa tài khoản thành công.", dangHoatDong: false }` |

Admin dùng chung `POST /auth/login` với sinh viên, gửi `{ taiKhoan, matKhau }`. Các trang quản trị gọi những endpoint trên với Bearer token; đã kiểm thử danh sách, chi tiết và trạng thái bằng backend thật đang chạy trên máy.

## Tích hợp tài khoản và hồ sơ

FE thực hiện các luồng đăng ký, đăng nhập, xem/sửa hồ sơ và đổi mật khẩu theo code backend đã pull và Swagger đang chạy. Tên trường gửi/nhận dùng DTO tiếng Việt bên dưới; trong giao diện vẫn ánh xạ sang mô hình `Profile` dùng chung. Bộ giả lập trả trạng thái và dữ liệu theo cùng hợp đồng để thử đầy đủ luồng khi chưa có BE.

Các tài khoản dưới đây chỉ có trong bộ giả lập khi đặt `VITE_USE_MOCK_API=true`. Khi dùng API thật, đăng nhập bằng tài khoản có trong database backend; tài khoản giả lập không được gửi sang Neon hay tự vượt qua bước xác thực. Mặc định đăng nhập demo không JWT cũng bị tắt (`VITE_ENABLE_DEMO_AUTH=false`).

| Loại tài khoản | Email | MSSV | Mật khẩu ban đầu |
| --- | --- | --- | --- |
| Sinh viên | `demo@studyplanner.vn` | `SVDEMO001` | `123456` |
| Quản trị | `admin@studyplanner.vn` | — | `123456` |
| Quản trị | `admin@caothang.edu.vn` | — | `0306231303` |
| Lê Công Minh (đang hoạt động) | `0306231307@caothang.edu.vn` | `0306231307` | `123456` |
| Trần Hồng Kỳ (đã khóa) | `0306231303@caothang.edu.vn` | `0306231303` | `123456` |

Sinh viên và quản trị cùng đăng nhập tại `/login`, hệ thống chuyển trang theo vai trò tài khoản. Tài khoản sinh viên có sẵn tên trường Cao đẳng Kỹ Thuật Cao Thắng, lớp CDTH23WEBC và ngành Công nghệ thông tin; có thể sửa hồ sơ và đổi mật khẩu. Mật khẩu mới tiếp tục có hiệu lực khi tải lại trang. Có thể đăng ký tài khoản mới với đầy đủ bảy trường bắt buộc, rồi đăng nhập bằng email hoặc MSSV vừa đăng ký.

Lê Công Minh và Trần Hồng Kỳ cùng trường Cao đẳng Kỹ Thuật Cao Thắng, lớp CDTH23WEBC và ngành Công nghệ thông tin. Tài khoản Kỳ cần được admin kích hoạt trước khi đăng nhập. Khi nâng cấp từ dữ liệu giả lập cũ, ứng dụng chỉ bổ sung các tài khoản mẫu còn thiếu một lần; không ghi đè hồ sơ, mật khẩu hay trạng thái đã lưu. Email/MSSV đã có không được đăng ký trùng.

| API mặc định (sau gốc `/api/v1`) | Dữ liệu gửi/nhận |
| --- | --- |
| `POST /auth/register` | Gửi `{ email, hoTen, matKhau, maSoSinhVien, tenTruong, tenLop, nganhHoc }`; trả 201 và hồ sơ sinh viên, sau đó chuyển sang đăng nhập |
| `POST /auth/login` | Gửi `{ taiKhoan, matKhau }`, email hoặc MSSV trong `taiKhoan`; trả 200 với `{ tokenTruyCap, loaiToken, hetHanLuc, nguoiDung }` |
| `GET /users/me` | Bearer token; trả 200 với `{ ma, email, hoTen, maSoSinhVien, tenTruong, tenLop, nganhHoc, vaiTro, dangHoatDong, muiGio, nhacTruocGio, ngayTao, ngayCapNhat }` |
| `PATCH /users/me` | Chỉ gửi `{ hoTen, maSoSinhVien, tenTruong, tenLop, nganhHoc }`; trả 200 với hồ sơ đã sửa, FE gọi GET lại để xác nhận dữ liệu lưu |
| `POST /users/me/change-password` | Gửi `{ matKhauHienTai, matKhauMoi }`; BE và giả lập trả 200 kèm `thongBao`, FE xóa phiên và yêu cầu đăng nhập lại bằng mật khẩu mới |

Đường dẫn có thể thay bằng các biến `VITE_AUTH_*_PATH` trong `.env.example`. Method và ánh xạ DTO nằm trong `src/api/auth.ts`. Trường `hetHanLuc` là thời điểm ISO; FE lấy hạn sớm hơn giữa trường này và claim `exp`. Backend hiện trả HTTP 200 kèm `thongBao` khi đổi mật khẩu; FE vẫn chấp nhận 204 để tương thích. Nhập sai mật khẩu hiện tại được BE trả 401, nên FE kết thúc phiên và yêu cầu đăng nhập lại.

- Email/MSSV trùng, sai mật khẩu, tài khoản vô hiệu hóa và lỗi validation được hiển thị từ phản hồi (`thongBao`, `message`, `detail` hoặc `errors`); không báo thành công khi API lỗi.
- Đăng ký bắt buộc họ tên, email, mật khẩu, MSSV, trường, lớp và ngành. Giá trị trống hoặc chỉ có khoảng trắng không được chấp nhận; mật khẩu mới có độ dài 8–128 ký tự và cần nhập lại chính xác. MSSV giữ dạng chuỗi, bao gồm số 0 đầu.
- Email trong hồ sơ chỉ đọc; MSSV được phép sửa theo backend và giữ nguyên số 0 đầu. Khi sửa hồ sơ, chỉ họ tên bắt buộc; MSSV, trường, lớp và ngành có thể để trống và gửi `null`. FE không gửi email, vai trò hoặc trạng thái trong cập nhật hồ sơ. Đăng ký vẫn bắt buộc đủ bảy trường. Giới hạn: họ tên/trường/lớp/ngành 200 ký tự, email 320, MSSV 50.
- Phiên đăng nhập chỉ lưu token và hạn phiên trong `sessionStorage`. Khi tải lại trang, phải gọi `/users/me` thành công mới mở nội dung được bảo vệ. Bộ giả lập lưu tài khoản, mật khẩu dẫn xuất bằng PBKDF2 và các phiên token tại khóa `studyplanner.mock-auth.v1` trong `localStorage`; không lưu mật khẩu thô. Xóa khóa này để khởi tạo lại dữ liệu và mật khẩu mẫu ban đầu.
- Token hết hạn, API trả 401, hoặc trả mã `ACCOUNT_DISABLED`, `ACCOUNT_INACTIVE`, `USER_DISABLED` sẽ xóa phiên. Đổi mật khẩu thành công xóa mọi token cũ của tài khoản trong bộ giả lập; mật khẩu cũ không đăng nhập được nữa.
- Token giả lập chỉ có ý nghĩa với dữ liệu trình duyệt này, không phải JWT được BE thật ký. Khi nối BE, xác thực, băm mật khẩu và thu hồi JWT phải do BE thực hiện.
- Có kiểm thử hợp đồng bằng HTTP giả lập, kiểm thử trình duyệt và kiểm thử API backend thật qua proxy Vite. Lượt kiểm thử thật tạo một tài khoản riêng, kiểm tra toàn bộ luồng tài khoản/admin rồi xóa chính tài khoản đó; không thay đổi tài khoản người dùng đang có.

## Trang Hôm nay

Trang Hôm nay đọc API nhiệm vụ lá và lịch tổng hợp của bản BE đã merge. Hệ thống tự gợi ý thứ tự dựa trên độ gấp của hạn, mức quan trọng và trạng thái. Giao diện chỉ hiển thị thông tin cần thao tác; giải thích thuật toán nằm trong tài liệu riêng. Trang có bộ nhớ riêng trong phiên và cập nhật nền khi quay lại. Các thao tác chỉnh sửa tiếp tục mở đúng chi tiết tại trang Nhiệm vụ hiện có; phần Hôm nay không ghi API nhiệm vụ/lịch hay thay đổi source của module học tập.

Xem [giải thích thuật toán, luồng dữ liệu và câu hỏi phản biện](docs/hom-nay-va-uu-tien.md). Kiểm tra riêng bằng `npm.cmd run test:auth:browser -- --today`.

## Thông báo

Chuông đọc hộp thư BE của tài khoản, nhắc nhiệm vụ sắp đến hạn/quá hạn, có số chưa đọc, Tất cả/Chưa đọc, phân trang và Đọc tất cả. Trạng thái đọc lưu tại BE nên F5 vẫn giữ. Bấm thông báo mở đúng nhiệm vụ/môn/học kỳ. Xem [quy tắc, API, cách chạy và kiểm thử](docs/thong-bao.md). Khởi động lại BE sau khi cập nhật để nạp API và worker mới.

## Tiến độ học tập

Trang `/statistics` đọc dữ liệu nhiệm vụ thật theo học kỳ đang chọn: tổng quan hoàn thành/đang làm/quá hạn, tiến độ từng môn và tỷ lệ hoàn thành đúng hạn. Có lọc môn, thống kê toàn bộ học kỳ; không có biểu đồ theo ngày/tuần. Mỗi nhiệm vụ chính được tính một lần, không cộng thêm các bước nhỏ. Tổng gồm cả đã hoàn thành, có tách số chưa xong/đã xong và liên kết đối chiếu từng nhóm trong cùng học kỳ/môn. Xem [cách tính và kiểm thử](docs/tien-do-hoc-tap.md).

## Phạm vi hiện tại

- Tài khoản, hồ sơ và quản trị người dùng chạy được với dữ liệu giả lập, hoặc gọi BE khi tắt giả lập. Học kỳ và môn học tải qua `/semesters`, `/semesters/{id}/courses` và `/courses/{id}`, dùng JWT và phân trang BE. Nhiệm vụ/lịch học vẫn chờ tích hợp API.
- Không đọc hoặc ghi bản ghi học tập vào `localStorage`/`sessionStorage`; các bản ghi cũ không được nạp lại. Riêng ID học kỳ đang chọn được giữ trong `sessionStorage` theo tài khoản để F5 không đổi học kỳ; chỉ khôi phục nếu ID vẫn thuộc danh sách API trả về.
- Đăng ký, đăng nhập, cập nhật hồ sơ và đổi mật khẩu dùng phản hồi API. Tạo/sửa/xóa học kỳ/môn chỉ bật sau khi tải API hợp lệ; lưu theo ID BE trả về. Xóa phải tải `deletion-preview`, hiển thị số lịch bị xóa và số nhiệm vụ giữ lại/bỏ liên kết; DELETE chấp nhận 204 không body. Đánh dấu đã đọc thông báo dùng API hộp thư riêng, không thay đổi nhiệm vụ/lịch.
- Điều hướng, tìm kiếm, bộ lọc, đổi kiểu xem và chuyển ngày trên lịch vẫn hoạt động.
- Trang tiến độ hiển thị trạng thái chưa có dữ liệu khi chưa có nhiệm vụ.
- Chuông thông báo nằm bên trái ô tìm kiếm, mở hộp thư nhắc hạn/quá hạn theo giờ nhắc của nhiệm vụ hoặc tài khoản. Bấm ngoài popup, nhấn Escape hoặc chuyển trang để đóng. BE có worker kiểm tra mỗi phút; FE đọc lại khi đang mở ứng dụng. Chưa gửi email/browser push.
- Nhiệm vụ chưa hoàn thành được chuyển sang hiển thị quá hạn khi qua thời điểm đến hạn, theo múi giờ Việt Nam. Nhiệm vụ đã xong giữ trạng thái hoàn thành, kể cả nộp muộn.
- Hoàn thành tất cả nhiệm vụ con sẽ hoàn thành nhiệm vụ cha. Mở lại một nhiệm vụ con sẽ đưa nhiệm vụ cha về đang làm.
- Các quy tắc nghiệp vụ và hộp thoại được giữ lại để tích hợp backend; hiện tại không cập nhật dữ liệu cục bộ. Dữ liệu phục vụ kiểm thử chỉ nằm trong `tests/fixtures/`, không được nạp vào ứng dụng.

## Cấu trúc chính

- `src/types/planner.ts`: mô hình dữ liệu.
- `src/data/planner.ts`: trạng thái khởi tạo trống và kiểm tra cấu trúc dữ liệu.
- `src/contexts/PlannerContext.tsx`: state dùng chung và chặn thao tác ghi chưa có API.
- `src/contexts/AuthProvider.tsx`: phiên JWT, xác minh hồ sơ, đổi mật khẩu và đăng xuất.
- `src/api/`: HTTP client, cấu hình endpoint và ánh xạ dữ liệu tài khoản.
- `src/api/mockAuth.ts`: bộ giả lập theo Swagger v1, dữ liệu dùng chung cho auth/hồ sơ/admin, phân trang và thu hồi token sau đổi mật khẩu hoặc vô hiệu hóa.
- `src/api/admin.ts`, `src/types/admin.ts`: gọi API quản trị và ánh xạ hồ sơ/phân trang từ DTO tiếng Việt.
- `src/auth/`: đọc hạn JWT, lưu phiên và kiểm tra đầu vào.
- `src/admin/`: bố cục admin, kiểm tra quyền và quản lý tài khoản sinh viên; dùng chung trang đăng nhập tại `src/pages/Auth/`.
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
- `tests/auth.test.mjs`, `tests/mock-auth.test.mjs`, `tests/admin-users.test.mjs`: kiểm tra hợp đồng API, dữ liệu giả lập, phân quyền quản trị, phân trang và thu hồi token cũ.
- `tests/browser-auth.mjs`: kiểm tra cả chế độ API qua HTTP giả lập và chế độ dữ liệu trình duyệt không có BE; chạy `npm run test:auth:browser`.
- `tests/auth.test.mjs`: kiểm tra luồng API auth bằng phản hồi giả lập.
- `tests/browser-auth.mjs`: kiểm tra biểu mẫu, khôi phục phiên, phân quyền, đổi mật khẩu/đăng xuất và hết hạn JWT trên Chrome/Edge headless với API giả lập. Chạy `npm run test:auth:browser`; đặt `CHROME_PATH` nếu trình duyệt nằm ngoài vị trí mặc định.

Khi bổ sung API học tập, nạp dữ liệu và cập nhật bằng kết quả API đã xác nhận; không chỉ đổi cờ `canMutate` để mở lại reducer cục bộ. Cờ này chỉ chặn thao tác học tập, không chặn các chức năng tài khoản/hồ sơ đã có API riêng.

### Trang các môn học

`/subjects` có bộ chọn học kỳ, số môn/tổng tín chỉ, tìm theo tên/mã môn/giảng viên, sắp xếp và chuyển kiểu thẻ/danh sách. Có thể thêm học kỳ đầu tiên ngay tại trang. Các nút thêm môn ở danh sách, trạng thái trống và sidebar mở trang riêng `/subjects/new?semester={id}`. Trang mới tự chọn học kỳ tương ứng, giữ dữ liệu khi lưu lỗi và quay về danh sách đúng học kỳ sau khi tạo thành công. Thao tác sửa môn tiếp tục dùng hộp thoại. Màu nhận diện được chọn bằng swatch; form sửa giữ cố định học kỳ. Xóa vẫn lấy ảnh hưởng từ BE trước khi xác nhận, giữ form/hộp thoại khi API thất bại. Trang có trạng thái đang tải, lỗi/thử lại và dữ liệu trống; không hiển thị số liệu nhiệm vụ/lịch chưa được tích hợp.

Kiểm tra tương tác riêng trang này: `npm run test:auth:browser -- --subjects`. Kịch bản dùng dữ liệu kiểm thử trong trình duyệt, không ghi BE thật; kiểm tra cả desktop và điện thoại, lưu ảnh tại `.backend-integration/screenshots/`. Trang thêm môn được kiểm tra qua các nút điều hướng, đường dẫn trực tiếp, chọn học kỳ, hủy, lưu lỗi/thành công và trường hợp chưa có học kỳ; ảnh xem trước là `subject-create-page.png` và `subject-create-page-mobile.png` trong thư mục ảnh.

### Một không gian làm việc cho mỗi môn

Các liên kết môn từ sidebar, thẻ môn và lịch/tổng quan cùng mở `/tasks?subject={id}`. Đường dẫn `/subjects/{id}` cũ chuyển hướng bằng `replace`, giữ bộ lọc và kiểu xem trong query. Trang nhiệm vụ có nút “Thông tin môn” mở panel bên phải; panel đọc chi tiết qua API và cho sửa/xóa theo quyền ghi hiện có. Việc mở/đóng panel giữ kiểu xem, bộ lọc và nội dung tìm kiếm.

Link tới môn ở học kỳ khác tự chọn đúng học kỳ. Khi chủ động đổi học kỳ từ thanh trên cùng, bộ lọc môn được bỏ nếu không thuộc kỳ mới. Mã môn không tồn tại có thông báo riêng, không hiển thị nhầm toàn bộ nhiệm vụ. Xóa thành công trong panel quay về danh sách môn; vẫn lấy deletion-preview trước khi xác nhận và giữ nhiệm vụ theo hợp đồng BE. API nhiệm vụ/lịch tiếp tục chờ tích hợp.

Kịch bản `npm run test:auth:browser -- --subjects` cũng kiểm tra panel sửa/xóa, retry lỗi chi tiết/preview, giữ bộ lọc, link cũ, link khác học kỳ và đổi kỳ chủ động. Ảnh panel dùng dữ liệu kiểm thử: `.backend-integration/screenshots/subject-workspace-panel.png`.

Danh sách “Môn học trong kỳ” ở sidebar có thể thu gọn/mở rộng bằng nút mũi tên. Khi mở, toàn bộ môn học được hiển thị theo chiều dài tự nhiên, không có vùng cuộn riêng bên trong danh sách. Khi thu gọn, toàn bộ danh sách và nút thêm môn được ẩn; tên học kỳ vẫn hiển thị. Trạng thái thu gọn được giữ khi chuyển trang trong ứng dụng. Kịch bản trình duyệt `--subjects` kiểm tra thêm trường hợp 100 môn và sidebar ở màn hình cao 720px.
