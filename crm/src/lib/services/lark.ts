import { getEnv } from "@/lib/db/client";

/**
 * Lark (Feishu) group custom-bot webhook — the simplest reliable channel
 * for "nhân viên biết có đơn mới": no browser permission prompt, no PWA
 * install required, message just lands in a group chat everyone already
 * has open. Configured via LARK_WEBHOOK_URL (required) and LARK_SECRET
 * (optional — only needed if the bot has "Signature Verification" turned
 * on in Lark's group bot settings).
 */

const FORM_LABEL: Record<string, string> = { HAT: "Hạt", BOT: "Bột" };
const PACKAGING_LABEL: Record<string, string> = { TUI_XANH: "Túi Xanh", TUI_ZIP: "Túi Zip" };

// Lark's signature scheme: HMAC-SHA256 with an EMPTY message, keyed by
// `${timestamp}\n${secret}`. This looks backwards but matches Lark's own
// docs/SDKs exactly.
async function computeSign(timestamp: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${timestamp}\n${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new Uint8Array(0));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function postToLark(payload: Record<string, unknown>): Promise<void> {
  const env = getEnv();
  if (!env.LARK_WEBHOOK_URL) return; // not configured — silently skip

  if (env.LARK_SECRET) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    payload.timestamp = timestamp;
    payload.sign = await computeSign(timestamp, env.LARK_SECRET);
  }

  try {
    const res = await fetch(env.LARK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("Lark webhook failed", res.status, await res.text());
    }
  } catch (err) {
    // Never let a Lark delivery failure break the calling business flow
    // (task assignment must still succeed even if the group ping fails).
    console.error("Lark webhook error", err);
  }
}

export async function sendLarkMessage(text: string): Promise<void> {
  await postToLark({ msg_type: "text", content: { text } });
}

export interface LarkOrderItemSummary {
  sku: string;
  productName: string;
  form: string;
  packaging: string;
  weightGrams: number;
  quantity: number;
}

/**
 * Rich card version of the task-assignment ping — same shape of
 * information as the order confirmation card (Khách hàng/Sản
 * phẩm/Số lượng/...), so it reads the same way the team is already used to.
 */
export async function sendLarkOrderAssignedCard(params: {
  orderCode: string;
  customerName: string;
  employeeName: string;
  phone?: string | null;
  address?: string | null;
  deliveryDate?: string | null;
  note?: string | null;
  items: LarkOrderItemSummary[];
  appUrl?: string;
}): Promise<void> {
  const productLines = params.items
    .map((i) => {
      const weight = i.weightGrams >= 1000 ? `${i.weightGrams / 1000}kg` : `${i.weightGrams}g`;
      return `• ${i.productName} (${FORM_LABEL[i.form] ?? i.form}, ${PACKAGING_LABEL[i.packaging] ?? i.packaging}, ${weight}) — SL: **${i.quantity}** — \`${i.sku}\``;
    })
    .join("\n");

  const contentLines = [
    `**Mã đơn:** ${params.orderCode}`,
    `**Khách hàng:** ${params.customerName}`,
    params.phone ? `**SĐT khách:** ${params.phone}` : null,
    params.address ? `**Địa chỉ:** ${params.address}` : null,
    `**Giao cho:** ${params.employeeName}`,
    params.deliveryDate ? `**Ngày giao:** ${params.deliveryDate}` : null,
    "",
    "**Sản phẩm:**",
    productLines,
    params.note ? `\n**Ghi chú:** ${params.note}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  await postToLark({
    msg_type: "interactive",
    card: {
      header: {
        title: { tag: "plain_text", content: "🔔 Có đơn hàng mới cần đóng gói" },
        template: "orange",
      },
      elements: [
        { tag: "div", text: { tag: "lark_md", content: contentLines } },
        {
          tag: "action",
          actions: [
            {
              tag: "button",
              text: { tag: "plain_text", content: "Mở Tú Cà Phê CRM" },
              type: "primary",
              url: params.appUrl ?? "https://crm.tucaphe.vn",
            },
          ],
        },
      ],
    },
  });
}
