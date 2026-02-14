



**Hệ thống đồng bộ dữ liệu đa dự án và giám sát thông minh**

## 1. BỐI CẢNH & MỤC TIÊU

Công ty vận hành trên nền tảng Google Workspace, quản lý dữ liệu từ đối tác qua Google Drive.

- **Nguồn (Source):** Folder đối tác share link.
- **Đích (Destination):** Folder nội bộ công ty.
- **Mục tiêu:** Tự động hóa việc copy file mới dựa trên thời gian cập nhật, quản lý tập trung qua UI và thông báo qua Google Chat.

## 2. CHI TIẾT TECH STACK

### 2.1. Frontend (Management UI)

- **Framework:** React.js (phiên bản mới nhất)
- **UI Library:** [shadcn/ui](https://ui.shadcn.com/ "null") (Dựa trên Radix UI và Tailwind CSS cho các thành phần accessible, tái sử dụng cao).
- **Styling:** Tailwind CSS (đảm bảo Mobile Responsive & Dark mode ready).
- **Icons:** Lucide React.
- **Charts:** Recharts (vẽ biểu đồ hiệu suất phiên chạy và dung lượng).
- **State Management:** React Hooks (UseContext hoặc UseReducer cho global settings).
- **Communication:** `google.script.run` (để gọi hàm server-side từ UI).
- **View Modes:** Hỗ trợ chuyển đổi linh hoạt giữa dạng lưới (Card Grid) và dạng bảng (Detail List) cho danh sách dự án.

### 2.2. Backend & Engine (Execution Layer)

- **Runtime:** Google Apps Script (GAS).
- **Drive API:** Advanced Drive Service v3 (hiệu suất cao hơn DriveApp mặc định).
- **Auth:** OAuth2 (tận dụng quyền của user đang vận hành Web App).

### 2.3. Database & Storage (Persistence Layer)

- **Database:** Firebase Firestore.
    - **Cấu hình:** Lưu trữ tại `/artifacts/{appId}/public/data/`.
    - **Đặc điểm:** NoSQL, hỗ trợ Real-time listeners, hiệu năng truy vấn cao.
- **Cache & Heartbeat:** Google Apps Script `PropertiesService`.
    - **Mục tiêu:** Lưu trữ trạng thái "Heartbeat" (tình trạng sức khỏe) của hệ thống mà không tiêu tốn quota ghi của Firestore.
    - **Dữ liệu:** Lưu mốc thời gian cuối cùng hệ thống thực hiện kiểm tra (Check-in) cho từng dự án.

## 3. TIÊU CHUẨN KIẾN TRÚC (CLEAN ARCHITECTURE)

Yêu cầu mã nguồn phải tuân thủ việc tách biệt các lớp (Separation of Concerns):

### 3.1. Đối với Google Apps Script (Server-side)

Mặc dù môi trường GAS là các tệp phẳng, code phải được tổ chức theo module:

- **Repository Layer:** Chuyên trách giao tiếp với Firestore (CRUD cho Projects, Settings, Sessions).
- **Service Layer (Core Logic):** Chứa thuật toán Sync, xử lý đệ quy, logic kiểm tra thời gian (Cutoff) và xử lý lỗi.
- **API/Controller Layer:** Các hàm `doGet()` và các hàm public được gọi từ UI qua `google.script.run`.
- **Infrastructure Layer:** Các hàm tiện ích gửi Webhook Google Chat, xử lý Drive API.

### 3.2. Đối với React (Client-side)

- **Component-based:** Tách biệt UI thành các component nhỏ (ProjectCard, SettingForm, LogTable) sử dụng hệ thống shadcn/ui.
- **Service Pattern:** Tách các lệnh gọi `google.script.run` vào các file service riêng, không viết trực tiếp trong Component.

## 4. CƠ CHẾ VẬN HÀNH & THUẬT TOÁN

### 4.1. Thuật toán Time-Snapshot Sync

- **Cơ chế Sync Start Date (Ngày bắt đầu đồng bộ):**
    - Mỗi dự án có thêm thuộc tính `syncStartDate`.
    - Điều kiện lọc file: `(modifiedTime >= MAX(last_sync_timestamp, syncStartDate) OR createdTime >= MAX(last_sync_timestamp, syncStartDate))`.
    - **Mục đích:** Bỏ qua các file cũ đã tồn tại trước ngày quy định (hữu ích khi folder đích đã được copy thủ công từ trước).
    - **Mặc định:** Nếu `syncStartDate` không được thiết lập, coi như sync toàn bộ lịch sử.

- Sử dụng Query: `(modifiedTime > last_sync_timestamp OR createdTime > last_sync_timestamp) AND 'source_id' in parents`.
- **Recursive Scan:** Duyệt từng tầng thư mục. Nếu thư mục con có file thay đổi, hệ thống tạo thư mục tương ứng tại Đích trước khi copy.
- **Xử lý trùng lặp file (File Versioning):**
    - Khi copy file mới từ Source sang Destination, nếu phát hiện file cùng tên đã tồn tại:
    - **Không ghi đè (Overwrite)** và **Không xóa (Delete)** file cũ.
    - File mới sẽ được đổi tên kèm timestamp suffix để bảo tồn lịch sử.
    - Định dạng đổi tên: `OriginalName_vYYMMDDHHmm.ext` (Ví dụ: `BaoCao_v2602141358.pdf`).
    - Logic này áp dụng khi `source_modified_time > destination_modified_time`. Nếu file nguồn cũ hơn hoặc bằng file đích, bỏ qua không copy.

### 4.2. Quản lý Hàng đợi & Timeout

- **Queue:** Sắp xếp dự án theo `last_sync_timestamp` ASC.
- **Cutoff logic:** Kiểm tra thời gian sau mỗi lần xử lý 1 file. Nếu `currentTime - startTime > sync_cutoff_seconds`, thực hiện ngắt an toàn (Safe Exit).

#### 5.1. Sync Session (Firestore - Meaningful Events)

- Lưu vết khi có sự thay đổi thực tế: `id`, `project_id`, `run_id`, `timestamp`, `execution_duration_seconds`, `status` (Success/Interrupted/Error), `files_count`.

#### 5.2. Heartbeat (PropertiesService - Health Check)

- Lưu vết mọi lần chạy kể cả không có file: `last_check_timestamp`, `last_status`.
- **Mục đích:** Đảm bảo UI hiển thị trạng thái "Vừa kiểm tra" mà không tốn Quota Write Firestore.

### 5.2. File Log (Child)

- `file_name`, `source_link`, `dest_link`, `source_path`, `created_date`, `modified_date`.

## 6. CÁC YÊU CẦU KỸ THUẬT KHÁC (TECHNICAL REQUIREMENTS)

### 6.1. Độ tin cậy (Resilience)

- **Error Handling:** Sử dụng `try-catch` bọc ngoài mỗi dự án. Lỗi của một dự án không được làm chết toàn bộ tiến trình chạy của các dự án khác trong hàng đợi.
- **Retry Logic:** 
    - Áp dụng cho các lệnh gọi Drive API nếu gặp lỗi 429 (Too many requests).
    - Áp dụng `exponentialBackoff` cho `firestoreRequest_` để xử lý giới hạn băng thông và lỗi tạm thời của Firebase REST API.

### 6.2. Hiệu năng (Performance)

- **Batching:** Hạn chế ghi vào Firestore từng dòng một. Gom log file vào mảng và ghi theo Batch sau khi hoàn thành mỗi dự án. 
    - **Tối ưu:** Sử dụng `BATCH_SIZE` lên đến 450-500 items/request để tối ưu hóa quota `UrlFetchApp`.
- **Query Optimization:** Chỉ lấy các trường (fields) cần thiết từ Drive API để giảm payload (ví dụ: `id, name, mimeType, modifiedTime`).
- **REST API Correction:** Đảm bảo các lệnh `:runQuery` và `:batchWrite` sử dụng phương thức `POST` theo chuẩn Firestore REST API.

### 6.3. Bảo mật (Security)

- **Principle of Least Privilege:** Script chỉ yêu cầu các Scope cần thiết (`drive.file`, `forms`, `script.external_request`).
- **Data Validation:** UI phải validate định dạng Link/ID folder trước khi lưu xuống Database.

### 6.4. Quản lý xóa dự án (Soft Delete)

- **Cơ chế:**
    - Sử dụng field `isDeleted` (boolean) riêng biệt, tách biệt với `status`.
    - `deleteProject` API thực hiện chuyển `isDeleted` = `true` và lưu `deletedAt`.
    - `getAllProjects` mặc định lọc bỏ các dự án có `isDeleted` = `true`.
- **Mục đích:**
    - Tránh lỗi Timeout của Google Apps Script khi phải xóa lượng lớn Sync Logs liên quan (Hard Delete).
    - Bảo toàn lịch sử đồng bộ (Audit Trail) để đối soát sau này.
    - Dễ dàng khôi phục dự án nếu xóa nhầm (chỉ cần set `isDeleted` = `false`).

### 6.5. Khả năng bảo trì (Maintainability)

- **Code Style:** Đặt tên biến/hàm theo kiểu camelCase, có comment giải thích cho các logic phức tạp.
- **Documentation:** Luôn cập nhật SSoT (Single Source of Truth) này khi có thay đổi về logic.

## 7. BÁO CÁO & THÔNG BÁO

- **Webhook Integration:** Gửi thông báo JSON tới Google Chat Webhook.
- **Executive Dashboard:** Tích hợp trực tiếp vào UI React, lấy dữ liệu từ Firestore để vẽ biểu đồ thống kê.
- 
## 8. DASHBOARD

Chi tiết trong [Dashboard Trae](./dashboard_trae.md)
Dashboard mang lại một overview để kiểm soát quá trình.

Để đảm bảo tính scaling, cần thiết kế để dashboard được lắp ghép từ nhiều component tính toán, thống kê. Trong phần này sẽ liệt kê ra một số component quan trọng đầu tiên. Trong tương lai, chúng ta có thể bổ sung

### Tổng số dự án

Card này thể hiện tổng số dự án, và bao nhiêu dự án đang bật sync

### Tiến độ sync

Card này thể hiện
- Số file và dung lượng được sync hôm nay
- Số file và dung lượng được sync trong 7 ngày qua
- Số dự án được sync trong hôm nay
- Số dự án được sync trong  7 ngày qua
- Tổng thời lượng sync hôm nay
- Tổng thời lượng sync trong  7 ngày qua
- Số phiên sync hôm nay
- Số phiên sync trong  7 ngày qua


### Biểu đồ sync

Card này vẽ một cái biểu đồ line, thể hiện timeline trong 10 ngày vừa qua, biểu diễn mỗi ngày sync bao nhiêu file và bao nhiêu thời gian
### Dự án sync gần đây

 Card này thể hiện từng dòng, mỗi dòng là một dự án được đồng bộ gần đây, với tên dự án, thời gian, và status thành công hay thất bại hay lỗi. 

Lưu ý rằng, một phiên đồng bộ có thể sync nhiều dự án. Chúng ta biểu diễn một dự án một dòng.

## 9. Sync Logs

Chi tiêt [Sync Log](./synclog_trae.md)


Giao diện này thể hiện danh sách các dự án được sync.

Lưu ý rằng, một sync session sẽ có thể cover nhiều dự án. Nhưng khi thể hiện, chúng ta thể hiện theo các dự án
Chúng ta sắp xếp theo thời gian chạy, cái gần nhất để trên cùng

Ở thanh ngang đầu tiên chúng ta cho phép tìm kiếm nhanh theo tên dự án hoặc runid
Item thứ hai là theo trạng thái (như hiện tại đang implement)
Phần thứ ba là một dãy các ô chọn 1 ngày, 3 ngày, 7 ngày, 10 ngày, tất cả (để thể hiện những session chạy trong khoảng thời gian 1, 3, 7, 10 ngày gần nhất hoặc tất cả). mặc định là 1 ngày, và mặc định là chỉ load cái 1 ngày. User sẽ có thể chọn cái khác

Mỗi lnaf thay đổi các filter này, các số thống kê ở trên (số phiên, số lượng file đã sync, tổng dung lượng đã sync, thời gian tủng bình phải được cập nhật tương ứng)

Bảng log sẽ gồm 2 phần (như hiện tại đang implement): phần trên là theo các dự án, phần dưới là chi tiết, khi bấm vào một dự án sẽ thể hiện chi tiết log của dự án đó trong session đó


- Tên dự án
- Run ID - đây chính là sync session
- Thời gian chạy
- Số file mới được copy
- Dung lượng được copy
- Tổng thời gian
- Trạng thái
- Button Retry (nếu như trạng thái là Lỗi)

Khi chúng ta bấm vào mỗi dự án, ở bảng bên dưới sẽ thể hiện chi tiết từng file được sync của dự án đó, trong session đó với các thông tin sau
- Tên file
- Dung lượng
- Folder gốc
- Trạng thái

Ở mỗi phần mà trạng thái bị lỗi, Button Retry sẽ active, khi user bấm vào đây, hệ thống sẽ tiến hành sync lại, với duy nhất dự án này. 

Khi sync xong, session mới sẽ được tạo mới như một session độc lập chứ không ghi đè vào session cũ, nghĩa là session cũ vẫn phải ở trạng thái Lỗi để lưu lại lịch sử.

Session mới có thể vẫn là một trạng thái Lỗi, hoặc là trạng thái thành công.

Tuy nhiên, button retry chỉ active cho phép đúng 1 lần. Nghĩa là nếu một session bị lỗi ở dự án đó, chúng ta được retry một lần, nếu vẫn lỗi thì lỗi ở session vừa chạy mới được tạo mới, nếu chúng ta muốn retry, phải retry từ session mới, không được retry ở session cũ nữa