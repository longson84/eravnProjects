# Implementation Plan: Sync Logs & Retry Mechanism

Tài liệu này mô tả chi tiết kế hoạch triển khai tính năng **Sync Logs** (Lịch sử đồng bộ) và cơ chế **Retry** thông minh, dựa trên yêu cầu và phản hồi mới nhất.

## 1. Kiến trúc Backend (Google Apps Script)

### 1.1. Separation of Concerns
Tách logic xử lý Log ra khỏi Core Sync Logic để đảm bảo code gọn gàng, dễ bảo trì.

*   **File hiện tại**: `gas/SyncService.gs` (Chứa logic chạy sync).
*   **File mới**: `gas/SyncLogService.gs` (Chuyên trách đọc/ghi/truy vấn Log).

### 1.2. Các hàm API cần triển khai (`SyncLogService.gs`)

1.  **`getSyncLogs(filters)`**:
    *   **Input**: `filters { days: number, status?: string, search?: string }`
    *   **Logic**:
        *   Truy vấn Firestore (collection `sync_sessions`).
        *   Áp dụng filter ngày (dựa vào `timestamp`).
        *   Áp dụng filter status/search (nếu có).
        *   **QUAN TRỌNG**: Chỉ trả về thông tin tổng quan (Session Level), **không** trả về mảng `logs` (file details) để giảm payload.
        *   Flatten dữ liệu: Mỗi Project trong Session sẽ được tách thành 1 dòng riêng biệt (`SyncLogEntry`).

2.  **`getSyncLogDetails(sessionId, projectId)`**:
    *   **Input**: `sessionId`, `projectId`.
    *   **Logic**:
        *   Truy vấn Firestore lấy document session cụ thể.
        *   Trả về mảng `logs` (chi tiết file) của đúng `projectId` đó.

3.  **`retrySyncProject(sessionId, projectId)`**:
    *   **Input**: `sessionId` (phiên bị lỗi), `projectId`.
    *   **Logic**:
        *   Tìm session cũ trong DB.
        *   Kiểm tra: Nếu đã retry rồi (`retried: true`) -> Từ chối (hoặc trả về link session mới).
        *   Update session cũ: Đặt `retried: true` và lưu `retrySessionId`.
        *   Gọi lại hàm `syncProject_` (từ `SyncService`) để chạy sync ngay lập tức cho project đó.
        *   Tạo session mới với `triggeredBy: 'retry'`, `retryOf: sessionId`.

## 2. Kiến trúc Frontend (React)

### 2.1. Hooks (`src/hooks/useSyncLogs.ts`)
Tách logic data fetching ra khỏi UI component. Sử dụng `React Query` để quản lý state.

*   **`useSyncLogs(filters)`**:
    *   Sử dụng `useQuery`.
    *   Dependencies: `[filters.days, filters.status, filters.search]`.
    *   Tự động refetch khi filter thay đổi.

*   **`useSyncLogDetails(sessionId, projectId)`**:
    *   Sử dụng `useQuery`.
    *   `enabled`: Chỉ bật khi user click mở rộng row.

*   **`useRetrySync()`**:
    *   Sử dụng `useMutation`.
    *   `onSuccess`: Invalidate query `syncLogs` để list tự cập nhật trạng thái (session cũ hiện "Đã retry", session mới xuất hiện).

### 2.2. UI Component (`src/pages/SyncLogsPage.tsx`)

*   **Filter Bar (Cập nhật)**:
    *   **Time Range**: Thay Dropdown bằng **Radio Group / Segmented Control** (1 ngày | 3 ngày | 7 ngày | Tất cả).
    *   **Status**: Dropdown (Tất cả, Thành công, Lỗi).
    *   **Search**: Input text.

*   **Log Table**:
    *   Hiển thị danh sách `SyncLogEntry`.
    *   **Expandable Row**: Click vào row để hiện bảng chi tiết file (Lazy load).
    *   **Retry Button**:
        *   Chỉ hiện khi `status === 'error'`.
        *   Disable nếu `retried === true`.
        *   Hiển thị tooltip/text: "Đã retry ở phiên #RunID_Mới".

## 3. Quy trình thực hiện (Step-by-Step)

### Phase 1: Backend Implementation
1.  Tạo file `gas/SyncLogService.gs`.
2.  Chuyển các hàm đọc log từ `SyncService.gs` sang (nếu có).
3.  Implement `getSyncLogs`, `getSyncLogDetails`, `retrySyncProject`.
4.  Expose các hàm này ra `global` trong `main.js` (hoặc file entry point) để Frontend gọi được.

### Phase 2: Frontend Service & Hooks
1.  Cập nhật `src/services/gasService.ts`: Thêm định nghĩa hàm mới (và mock data tương ứng để test).
2.  Tạo `src/hooks/useSyncLogs.ts`: Viết các hooks React Query.

### Phase 3: Frontend UI Refactoring
1.  Refactor `SyncLogsPage.tsx` để sử dụng hooks mới.
2.  Sửa lại giao diện Filter (chuyển sang dạng nút bấm ngang).
3.  Tích hợp logic Retry & hiển thị liên kết Session cũ/mới.

## 4. Data Structure Updates (Confirm)

**SyncSession (Firestore Document)**
```typescript
interface SyncSession {
  id: string;
  // ... fields cũ
  retried?: boolean;        // Đánh dấu đã được retry chưa
  retrySessionId?: string;  // ID của session mới được sinh ra từ việc retry
  retryOf?: string;         // ID của session gốc (nếu session này là kết quả của việc retry)
}
```

Kế hoạch này đảm bảo tính nhất quán, hiệu năng (lazy load) và trải nghiệm người dùng tốt (retry trace).