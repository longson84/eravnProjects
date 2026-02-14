# Kế hoạch triển khai Soft Delete cho Dự án (Projects)

## 1. Mục tiêu
Thay thế tính năng xóa cứng (Hard Delete) bằng xóa mềm (Soft Delete) để:
- Tránh lỗi timeout của Google Apps Script khi xóa lượng lớn dữ liệu (logs).
- Bảo toàn lịch sử đồng bộ (audit trail).
- Giữ nguyên trạng thái `status` (active/paused) để dễ dàng khôi phục sau này.

## 2. Giải pháp kỹ thuật
Sử dụng một trường mới `isDeleted` (boolean) để đánh dấu trạng thái xóa, tách biệt hoàn toàn với trường `status` hiện tại.

### Cấu trúc dữ liệu thay đổi
- **Collection:** `projects`
- **Field mới:** `isDeleted` (boolean)
- **Field mới:** `deletedAt` (timestamp, optional) - Thời điểm xóa.

## 3. Các bước thực hiện (Implementation Steps)

### Bước 1: Backend - FirestoreRepository.gs
- **Update Mapping:**
    - `docToProject_`: Map thêm `isDeleted` và `deletedAt`.
    - `projectToDoc_`: Map thêm `isDeleted` và `deletedAt`.
- **Update `deleteProject(projectId)`:**
    - Chuyển từ `DELETE` request sang `PATCH` request.
    - Update fields: `isDeleted = true`, `deletedAt = currentTimestamp`.

### Bước 2: Backend - ProjectService.gs
- **Update `getAllProjects()`:**
    - Filter danh sách trả về: Chỉ lấy các project có `!isDeleted`.
- **Update `deleteProject(projectId)`:**
    - Gọi Repo để soft delete.
    - Xóa `Heartbeat` trong `PropertiesService` (Hard delete cái này vì nó là realtime status, không cần lưu sử).

### Bước 3: Backend - SyncService.gs
- **Update `syncAllProjects()`:**
    - Bổ sung điều kiện lọc: `&& !project.isDeleted`.

### Bước 4: Frontend (Optional/Verification)
- Kiểm tra logic hiển thị danh sách dự án. Đảm bảo frontend không hiển thị các dự án đã có flag `isDeleted` (mặc dù backend đã lọc, nhưng frontend cũng nên biết về field này để type-safety).

## 4. Kiểm thử (Verification Plan)
1. Tạo một dự án mới.
2. Chạy sync thử để có log.
3. Thực hiện xóa dự án.
4. Kiểm tra Firestore: Document project vẫn còn, field `isDeleted` = `true`.
5. Kiểm tra Danh sách dự án trên Web: Dự án đã biến mất.
6. Kiểm tra Sync Job: Job chạy tiếp theo không sync dự án đã xóa.
