export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

const FORM_CODE: Record<string, string> = { HAT: "H", BOT: "B" };
const PACKAGING_CODE: Record<string, string> = {
  TUI_XANH: "XANH",
  TUI_ZIP: "ZIP",
};

/** Weight suffix: 250 -> "250", 500 -> "500", 1000 -> "1KG", 2000 -> "2KG" */
export function weightSuffix(weightGrams: number): string {
  if (weightGrams % 1000 === 0) {
    return `${weightGrams / 1000}KG`;
  }
  return String(weightGrams);
}

export function buildSkuFromCode(
  productCode: string,
  form: "HAT" | "BOT",
  packaging: "TUI_XANH" | "TUI_ZIP",
  weightGrams: number
): string {
  return [
    productCode.toUpperCase(),
    FORM_CODE[form],
    PACKAGING_CODE[packaging],
    weightSuffix(weightGrams),
  ].join("-");
}

/**
 * Simple sequential order code (DH-0001, DH-0002, ...) drawn from the
 * `order_sequence` single-row counter via an atomic UPDATE...RETURNING —
 * safe under concurrent order creation, no collision retries needed.
 */
export async function nextOrderCode(db: D1Database): Promise<string> {
  const row = await db
    .prepare(
      `UPDATE order_sequence SET next_value = next_value + 1 WHERE id = 1
       RETURNING next_value - 1 AS n`
    )
    .first<{ n: number }>();
  return `DH-${String(row!.n).padStart(4, "0")}`;
}

/** Sequential "Số biên bản" (BB-0001, BB-0002, ...) — same atomic-counter pattern as nextOrderCode. */
export async function nextProtocolCode(db: D1Database): Promise<string> {
  const row = await db
    .prepare(
      `UPDATE protocol_sequence SET next_value = next_value + 1 WHERE id = 1
       RETURNING next_value - 1 AS n`
    )
    .first<{ n: number }>();
  return `BB-${String(row!.n).padStart(4, "0")}`;
}
