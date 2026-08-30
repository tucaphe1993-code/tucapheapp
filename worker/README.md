# Backend trung gian (Cloudflare Worker) — chưa deploy

File `order-api.js` trong thư mục này là **scaffold**, chưa hoạt động thật. Cần các bước sau để triển khai:

## 1. Yêu cầu trước khi deploy
- Tài khoản Cloudflare (miễn phí đủ dùng cho Workers ở quy mô nhỏ).
- App Lark Base đã tạo (App ID + App Secret) với quyền ghi vào bảng đơn hàng.
- Xác nhận rõ: Base ID, Table ID của bảng sẽ nhận đơn hàng, và tên chính xác từng field — **không tự đoán**.

## 2. Các bước triển khai
```bash
npm install -g wrangler
wrangler login
wrangler init tucaphe-order-api
# copy nội dung order-api.js vào src/index.js của project vừa tạo
wrangler secret put LARK_APP_ID
wrangler secret put LARK_APP_SECRET
wrangler secret put LARK_BASE_ID
wrangler secret put LARK_ORDERS_TABLE_ID
wrangler deploy
```
Sau khi deploy, Wrangler trả về một URL dạng `https://tucaphe-order-api.<subdomain>.workers.dev`.

## 3. Cập nhật frontend
Mở `js/checkout.js`, sửa dòng:
```js
const ORDER_API_URL = "/api/orders";
```
thành URL Worker thật vừa deploy (hoặc gắn route riêng `order.tucaphe.vn/api/orders` trỏ tới Worker qua Cloudflare Routes, nếu muốn giữ cùng domain).

## 4. Quy tắc bảo mật bắt buộc
- **Không** commit App Secret/Access Token vào Git — luôn dùng `wrangler secret put`.
- Worker phải **tự tính lại giá/tổng tiền** dựa trên bảng giá lưu ở Lark Base, không tin tưởng số liệu `total`/`unitPrice` gửi từ frontend (khách có thể sửa qua devtools).
- Giới hạn CORS chỉ cho domain bán hàng thật gọi vào (đã có sẵn trong `order-api.js`, cần xác nhận lại domain chính thức).

## 5. Chưa làm ở scaffold này
- Chưa map field thật vào Lark Base (đang chờ xác nhận cấu trúc Base — xem báo cáo Phase A trước đó).
- Chưa có cơ chế idempotency/chống trùng đơn phía server (hiện chỉ có mã đơn sinh phía client, không đảm bảo an toàn khi có nhiều thiết bị cùng đặt hàng).
- Chưa có rate-limiting/chống spam đặt hàng.
