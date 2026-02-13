# Chiến lược Refactoring: Migrating to React Query

## 1. Bối cảnh (Context)
Hiện tại, trong dự án đang tồn tại hai cách tiếp cận để lấy dữ liệu (data fetching):
1.  **Legacy Approach (`src/context/AppContext.tsx`, `ProjectsPage.tsx`, v.v.)**: Sử dụng `useEffect` để gọi API và `useState` (hoặc `useReducer`) để lưu trữ dữ liệu, trạng thái loading và error.
2.  **Modern Approach (`src/pages/DashboardPage.tsx`)**: Sử dụng thư viện `@tanstack/react-query` (cụ thể là hook `useQuery`).

**Câu hỏi đặt ra**: Tại sao lại có sự không nhất quán này? Có nên chuyển đổi toàn bộ sang `React Query` không?

## 2. Concept: Server State vs. Client State
Để hiểu tại sao nên dùng React Query, chúng ta cần phân biệt hai loại state:

*   **Client State**: Trạng thái giao diện, chỉ tồn tại trên trình duyệt người dùng (ví dụ: trạng thái mở/đóng modal, nội dung input form đang gõ, theme sáng/tối). `useState` và `Context API` làm rất tốt việc này.
*   **Server State**: Dữ liệu được lưu trữ trên server (Google Apps Script - GAS), chúng ta chỉ "mượn" về để hiển thị. Dữ liệu này:
    *   Được quản lý từ xa.
    *   Cần các API bất đồng bộ (async) để lấy về/cập nhật.
    *   Có thể bị thay đổi bởi người khác (outdated).
    *   Cần quản lý việc caching, deduplicating request, và cập nhật ngầm.

**Vấn đề của cách cũ (`useEffect` + `useState`)**:
Chúng ta đang cố gắng quản lý **Server State** bằng các công cụ dành cho **Client State**. Điều này dẫn đến việc phải viết lại rất nhiều code lặp (boilerplate) để xử lý:
*   Loading state (`isLoading`).
*   Error handling (`isError`, `error`).
*   Race conditions (request sau về trước request đầu).
*   Caching (không có sẵn, mỗi lần mount component là gọi lại API).

**Giải pháp (`React Query`)**:
Nó là một thư viện chuyên dụng để quản lý **Server State**. Nó tự động xử lý caching, đồng bộ hóa, refetching, và cung cấp các trạng thái loading/error chuẩn hóa.

## 3. Tại sao nên Refactor (Lợi ích)
1.  **Giảm code thừa**: Xóa bỏ hàng loạt `useEffect`, `useState` loading/error thủ công trong `AppContext` và các Pages.
2.  **Hiệu năng tốt hơn**:
    *   Dữ liệu được cache: Chuyển trang qua lại không cần load lại từ đầu nếu data còn mới.
    *   Refetch on focus: Tự động cập nhật data khi người dùng quay lại tab.
3.  **Trải nghiệm người dùng (UX) mượt mà**: Hiển thị dữ liệu cũ (stale) ngay lập tức trong khi đang tải dữ liệu mới ngầm (stale-while-revalidate).
4.  **Dễ mở rộng**: Thêm tính năng như phân trang (pagination), tải thêm (infinite scroll) dễ dàng hơn nhiều.

## 4. Kế hoạch triển khai (Implementation Plan)
Chúng ta không cần (và không nên) đập đi xây lại toàn bộ ngay lập tức. Chiến lược là **Incremental Migration** (Chuyển đổi từng phần).

### Giai đoạn 1: Pilot (Đã hoàn thành)
*   Áp dụng `React Query` cho module mới hoàn toàn là **Dashboard**.
*   Mục đích: Thiết lập môi trường (`QueryClientProvider`), làm quen với cú pháp, kiểm chứng hiệu quả mà không ảnh hưởng code cũ.

### Giai đoạn 2: Migrating Projects (Ưu tiên cao)
Dữ liệu `Projects` đang được load trong `AppContext`. Đây là nơi nặng nề nhất.
1.  Tạo custom hook `useProjects` sử dụng `useQuery` để fetch danh sách dự án.
2.  Tạo custom hook `useCreateProject`, `useUpdateProject`, `useDeleteProject` sử dụng `useMutation`.
3.  Thay thế việc gọi `gasService.getProjects()` trong `AppContext` bằng `useProjects`.
4.  Cập nhật `ProjectsPage.tsx` để dùng trực tiếp các hooks này thay vì thông qua Global Context.

### Giai đoạn 3: Migrating Settings & Logs (Ưu tiên thấp)
*   Tương tự như Projects, chuyển các hàm `getSettings`, `getSyncLogs` sang dạng hook: `useSettings`, `useSyncLogs`.

### Giai đoạn 4: Cleanup AppContext
*   Sau khi data fetching đã chuyển hết sang React Query, `AppContext` sẽ chỉ còn giữ nhiệm vụ quản lý **Client State** thực sự (như Theme, User Preferences, Sidebar state).
*   `AppState` sẽ gọn nhẹ hơn rất nhiều.

## 5. Kết luận
Việc Dashboard dùng `useQuery` trong khi phần còn lại dùng `useEffect` là chủ đích của việc áp dụng công nghệ mới vào tính năng mới (an toàn). Chúng ta sẽ từ từ refactor các phần cũ theo lộ trình trên để đảm bảo tính ổn định của ứng dụng.