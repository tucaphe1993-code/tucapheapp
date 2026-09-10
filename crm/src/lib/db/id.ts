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

/** Sequential-looking human order code: DH-YYMMDD-XXXX (XXXX = random base36) */
export function buildOrderCode(): string {
  const d = new Date();
  const y = String(d.getUTCFullYear()).slice(2);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `DH-${y}${m}${day}-${rand}`;
}
