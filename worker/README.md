# Backend đồng bộ (Cloudflare Worker + D1) — chưa deploy

`worker/order-api.js` là backend dùng chung cho **Sản phẩm/Tồn kho + Đơn
hàng**, lưu trong Cloudflare D1 (SQLite) — để nhân viên dùng máy/trình duyệt
khác nhau vẫn thấy CHUNG 1 danh sách đơn hàng và tồn kho thật, thay vì mỗi máy
một bản `localStorage` riêng như trước.

**Nguyên liệu, Công thức, Combo, Danh mục, Nhân sự & chấm công, Tài chính**
KHÔNG nằm trong phạm vi này — vẫn lưu `localStorage` từng máy như cũ.

## 1. Yêu cầu trước khi deploy
- Tài khoản Cloudflare (miễn phí đủ dùng cho Workers + D1 ở quy mô nhỏ).
- Node.js đã cài trên máy (dùng để chạy `npx wrangler`).

## 2. Tạo D1 database
```bash
npx wrangler login
npx wrangler d1 create tucaphe-db
```
Lệnh trên trả về 1 `database_id` — copy dán vào file `wrangler.toml` ở thư
mục gốc dự án, thay chỗ `REPLACE_WITH_YOUR_D1_DATABASE_ID`.

## 3. Tạo bảng + nạp dữ liệu mẫu ban đầu
```bash
npx wrangler d1 execute tucaphe-db --remote --file=./worker/schema.sql
npx wrangler d1 execute tucaphe-db --remote --file=./worker/seed.sql
```
`seed.sql` chỉ chạy **1 lần** (nạp đúng 8 sản phẩm demo hiện có) — đừng chạy
lại sau khi đã có dữ liệu thật, sẽ báo lỗi trùng khoá (chủ đích, tránh ghi đè
nhầm dữ liệu thật bằng dữ liệu demo).

## 4. Đặt Admin Token + deploy
```bash
npx wrangler secret put ADMIN_TOKEN
# tự nhập 1 chuỗi bí mật bất kỳ, đây là "mật khẩu API" dùng chung cho mọi
# nhân viên — không phải tài khoản riêng từng người.
npx wrangler deploy
```

## 5. Gắn Worker vào order.tucaphe.vn/api (đã cấu hình sẵn trong wrangler.toml)
Vì DNS của `tucaphe.vn` quản lý trên Cloudflare, `wrangler.toml` đã khai báo
route `order.tucaphe.vn/api/*` trỏ thẳng vào Worker — **cùng domain với
trang bán hàng**, nên không cần sửa `API_BASE_URL` (đang để `/api`, mặc định
đã đúng). Trước khi `wrangler deploy` ở bước 4, kiểm tra trong Cloudflare
Dashboard → DNS:
- Bản ghi `order` (order.tucaphe.vn) phải ở chế độ **Proxied** (biểu tượng
  đám mây cam), không phải "DNS only" (đám mây xám) — Route chỉ hoạt động
  với traffic đi qua Cloudflare. Nếu bản ghi đang là DNS only (thường gặp
  khi trỏ vào GitHub Pages để tránh xung đột chứng chỉ SSL), bật Proxied rồi
  vào SSL/TLS → Overview, chọn chế độ **Full** (không chọn Flexible, để
  tránh vòng lặp redirect với chứng chỉ GitHub Pages).
- Sau khi bật Proxied, kiểm tra lại trang bán hàng vẫn tải bình thường
  (`https://order.tucaphe.vn`) trước khi thử tính năng đặt hàng — bật sai
  chế độ SSL/TLS có thể khiến cả trang web chính bị lỗi tạm thời.

Nếu không muốn đụng vào cấu hình DNS/SSL đang chạy, có thể bỏ qua route này:
xoá đoạn `routes = [...]` trong `wrangler.toml`, sau đó dùng thẳng URL dạng
`https://tucaphe-order-api.<subdomain>.workers.dev` (Wrangler trả về sau khi
deploy) làm giá trị `API_BASE_URL` trong `js/products-data.js` — cách này
không cần đổi gì ở Cloudflare DNS, deploy xong dùng được ngay.

- `js/admin.js`: dù chọn cách nào ở trên, vẫn cần sửa hằng số `ADMIN_TOKEN`
  (đầu file) cho khớp đúng giá trị đã đặt ở bước 4 (client cần biết token
  này để gửi kèm request — xem mục Bảo mật).

## 6. Bảo mật — giới hạn cần biết
- Chỉ có **1 token dùng chung** cho toàn bộ nhân viên (`ADMIN_TOKEN`), không
  phải tài khoản riêng từng người, không có phân quyền, không có nhật ký ai
  đã sửa gì. Đủ để chặn người lạ trên Internet ghi thẳng vào D1, nhưng
  **không phải bảo mật production thật** — giống cách mật khẩu quản trị demo
  hiện tại (`tucaphe2026`) đã được ghi chú trong `admin/index.html`.
- CORS trong `order-api.js` giới hạn theo `allowedOrigin` — đã đặt đúng
  `https://order.tucaphe.vn` (domain thật của trang bán hàng, theo file
  `CNAME` ở gốc repo). Nếu sau này đổi domain, nhớ sửa lại giá trị này.
- Nếu lộ `ADMIN_TOKEN`, đổi lại bằng `npx wrangler secret put ADMIN_TOKEN`
  (ghi đè giá trị cũ) rồi cập nhật lại trong `js/admin.js`.

## 7. Chưa làm ở bản này
- Khu quản trị chưa có ô nhập "Khối lượng/Quy cách" (variants) khi tạo sản
  phẩm cà phê mới — trường này vẫn phải sửa trực tiếp trong D1 hoặc qua
  `PATCH /api/products/:id` thủ công. Thiếu variants không làm sập trang (đã
  có fallback ở `js/product-detail.js`), chỉ là sản phẩm đó sẽ hiện giao
  diện như thiết bị (không có ô chọn khối lượng/quy cách) cho tới khi bổ
  sung variants.
- Chưa có rate-limiting/chống spam đặt hàng.
- Chưa có tài khoản đăng nhập riêng từng nhân viên (chỉ 1 mật khẩu + 1 token
  dùng chung).
- Ghi sổ Xuất nhập tồn khi có đơn hàng chạy SAU bước trừ kho chính (không
  cùng 1 transaction D1) — ở quy mô đơn hàng nhỏ rủi ro lệch rất thấp, nhưng
  nếu Worker lỗi đúng giữa 2 bước này, tồn kho có thể đã trừ mà chưa kịp ghi
  phiếu. Chấp nhận được ở quy mô hiện tại.
