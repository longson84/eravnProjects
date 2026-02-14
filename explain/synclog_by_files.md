# Tài liệu kỹ thuật: Cơ chế Log chi tiết và Retry Sync theo File

## 1. Tổng quan
Tài liệu này mô tả chi tiết kỹ thuật về việc cải tiến hệ thống log đồng bộ, bao gồm việc theo dõi số lượng file thất bại, tách biệt với file thành công, và cơ chế retry thông minh chỉ xử lý các file bị lỗi.

## 2. Thay đổi về Cấu trúc dữ liệu (Data Structures)

### 2.1. Sync Session (Firestore `syncSessions` collection)
Cập nhật schema của `SyncSession` để lưu trữ thông tin chi tiết hơn về kết quả đồng bộ.

| Field | Type | Description |
|-------|------|-------------|
| `filesCount` | Number | Số lượng file đồng bộ **thành công**. |
| `failedFilesCount` | Number | **(Mới)** Số lượng file đồng bộ **thất bại**. |
| `retried` | Boolean | Đánh dấu session này đã được retry hay chưa. |
| `retriedBy` | String | **(Mới)** ID của session (Run ID) đã thực hiện việc retry cho session này. |
| `retryOf` | String | ID của session gốc mà session này đang retry lại. |

### 2.2. Frontend Log Entry (`SyncLogEntry` type)
Cập nhật interface TypeScript để phản ánh các trường mới từ backend.

```typescript
export interface SyncLogEntry {
    // ... existing fields
    filesCount: number;       // Số file thành công
    failedCount?: number;     // Số file lỗi (Mới)
    retriedBy?: string;       // Run ID của phiên retry (Mới)
    // ...
}
```

## 3. Logic Xử lý (Backend Implementation)

### 3.1. Theo dõi File thất bại (Failed Files Tracking)
Trong quá trình đồng bộ (`SyncService.gs`), hệ thống sử dụng biến đếm riêng biệt:

- Khi một file copy thành công: `session.filesCount++`
- Khi gặp lỗi (exception) trong quá trình xử lý file:
  - Log lỗi chi tiết vào `fileLogs`.
  - Tăng biến đếm `session.failedFilesCount++`.
  - Session status được đánh dấu là `warning` hoặc `error` tùy mức độ.

### 3.2. Cơ chế Retry Thông minh (Smart Retry)
Khi người dùng kích hoạt Retry từ giao diện:

1.  **Thu thập File Lỗi:**
    - Hệ thống query `fileLogs` của session cũ.
    - Lọc ra các file có `status == 'error'`.
    - Lấy `fileId` từ `sourceLink` hoặc metadata đã lưu.

2.  **Thực thi Retry:**
    - Khởi tạo một Sync Session **mới** (Run ID mới).
    - Truyền danh sách `retryFileIds` vào `SyncService`.
    - Service chỉ lặp qua danh sách file này để xử lý, bỏ qua bước quét folder (scan) toàn bộ dự án -> Tăng tốc độ và giảm tài nguyên.

3.  **Liên kết Session (Session Linking):**
    - **Session Mới (Retry Session):** Lưu trường `retryOf = OldSessionID`.
    - **Session Cũ (Failed Session):** Cập nhật trường `retried = true` và `retriedBy = NewRunID`.

## 4. Hiển thị trên Giao diện (Frontend UI)

### 4.1. Bảng Log (SyncLogsPage)
Cập nhật bảng hiển thị với các cột mới:

- **Retry ID:** Hiển thị Run ID của phiên retry (nếu có). Giúp người dùng dễ dàng trace từ phiên lỗi sang phiên sửa lỗi.
- **Files Synced:** Chỉ hiển thị số lượng file thành công (màu xanh).
- **Errors:** Hiển thị số lượng file thất bại (màu đỏ).

### 4.2. Luồng UX
1.  User thấy một session có `Errors > 0`.
2.  Bấm nút **Retry**.
3.  Hệ thống chạy retry ngầm.
4.  Khi hoàn tất (hoặc reload), session cũ sẽ hiện thị **Retry ID** trỏ tới session mới.
5.  Session mới hiện thị kết quả của việc retry các file lỗi đó.

## 5. Kết luận
Việc tách biệt `filesCount` và `failedFilesCount` cùng với cơ chế liên kết session hai chiều (`retryOf` <-> `retriedBy`) giúp quản trị viên có cái nhìn chính xác hơn về hiệu suất đồng bộ và dễ dàng xử lý các sự cố cục bộ mà không cần chạy lại toàn bộ quy trình sync nặng nề.
