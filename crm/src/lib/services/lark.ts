import { getEnv } from "@/lib/db/client";

/**
 * Lark (Feishu) group custom-bot webhook — the simplest reliable channel
 * for "nhân viên biết có đơn mới": no browser permission prompt, no PWA
 * install required, message just lands in a group chat everyone already
 * has open. Configured via LARK_WEBHOOK_URL (required) and LARK_SECRET
 * (optional — only needed if the bot has "Signature Verification" turned
 * on in Lark's group bot settings).
 */

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

export async function sendLarkMessage(text: string): Promise<void> {
  const env = getEnv();
  if (!env.LARK_WEBHOOK_URL) return; // not configured — silently skip

  const payload: Record<string, unknown> = {
    msg_type: "text",
    content: { text },
  };

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
