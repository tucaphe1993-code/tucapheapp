// =====================================================================
// CLOUDFLARE WORKER — API trung gian nhận đơn hàng từ web và ghi vào Lark Base.
//
// ⚠️ CHƯA ĐƯỢC DEPLOY. Đây là mã nguồn scaffold — xem worker/README.md để
// biết cách triển khai thật. KHÔNG đặt App Secret/Access Token trực tiếp
// trong file này; luôn đọc từ Worker Secrets (env), không commit secret
// lên Git.
//
// Luồng: Web (checkout.js) --POST--> Worker (file này) --gọi Lark Open API--> Lark Base
// =====================================================================

export default {
  async fetch(request, env) {
    // Chỉ chấp nhận POST /api/orders
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/api/orders") {
      return new Response("Not found", { status: 404 });
    }

    // CORS: chỉ cho phép domain web thật gọi vào (thay bằng domain chính thức)
    const allowedOrigin = "https://order.tucaphe.vn"; // TODO: xác nhận lại domain bán hàng thật sẽ dùng
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    let order;
    try {
      order = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Body không hợp lệ" }), { status: 400, headers: corsHeaders });
    }

    // ===== VALIDATION TỐI THIỂU PHÍA SERVER (không tin dữ liệu giá từ frontend) =====
    // TODO khi triển khai thật: tính lại đơn giá/tổng tiền ở ĐÂY dựa trên bảng giá
    // lưu trong Lark Base (KHÔNG dùng thẳng order.total gửi từ frontend), để tránh
    // khách sửa giá qua devtools trước khi gửi request.
    if (!order.customerName || !order.customerPhone || !order.address || !Array.isArray(order.lines) || !order.lines.length) {
      return new Response(JSON.stringify({ error: "Thiếu dữ liệu bắt buộc" }), { status: 400, headers: corsHeaders });
    }

    // ===== GỌI LARK OPEN API (scaffold — CHƯA điền field/table ID thật) =====
    // TODO: điền đúng App ID/App Secret (lấy từ env.LARK_APP_ID / env.LARK_APP_SECRET,
    // KHÔNG hard-code ở đây), đúng Base ID + Table ID cho "01 – NHẬT KÝ BÁN HÀNG"
    // hoặc bảng ĐƠN HÀNG/CHI TIẾT ĐƠN HÀNG tương ứng — cần xác nhận với chủ Base
    // trước khi map field, KHÔNG tự đoán tên field.
    //
    // const tenantToken = await getLarkTenantAccessToken(env.LARK_APP_ID, env.LARK_APP_SECRET);
    // const larkRes = await fetch(`https://open.larksuite.com/open-apis/bitable/v1/apps/${env.LARK_BASE_ID}/tables/${env.LARK_ORDERS_TABLE_ID}/records`, {
    //   method: "POST",
    //   headers: { Authorization: `Bearer ${tenantToken}`, "Content-Type": "application/json" },
    //   body: JSON.stringify({ fields: mapOrderToLarkFields(order) }),
    // });

    return new Response(
      JSON.stringify({ error: "Chưa cấu hình kết nối Lark Base thật trong Worker này." }),
      { status: 501, headers: corsHeaders }
    );
  },
};
