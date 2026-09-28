import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

// Hiển thị KG lẻ gọn (3.5kg, không phải 3.500000kg) nhưng vẫn giữ số
// nguyên khi không có phần thập phân (20kg, không phải 20.0kg).
export function formatKg(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(amount) + "kg";
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDate(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

const DIGIT_WORDS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const GROUP_UNITS = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

function readGroup(n: number, forceHundred: boolean): string {
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const units = n % 10;
  const parts: string[] = [];
  if (hundreds > 0) {
    parts.push(`${DIGIT_WORDS[hundreds]} trăm`);
  } else if (forceHundred) {
    parts.push("không trăm");
  }
  if (tens === 0) {
    if (units > 0) {
      parts.push(hundreds > 0 || forceHundred ? `linh ${DIGIT_WORDS[units]}` : DIGIT_WORDS[units]);
    }
  } else if (tens === 1) {
    parts.push(units === 0 ? "mười" : units === 5 ? "mười lăm" : `mười ${DIGIT_WORDS[units]}`);
  } else {
    let tensWord = `${DIGIT_WORDS[tens]} mươi`;
    if (units === 1) tensWord += " mốt";
    else if (units === 5) tensWord += " lăm";
    else if (units > 0) tensWord += ` ${DIGIT_WORDS[units]}`;
    parts.push(tensWord);
  }
  return parts.join(" ");
}

// Đọc số tiền bằng chữ kiểu chứng từ kế toán VN ("Một triệu không trăm
// linh năm nghìn đồng") — dùng cho dòng "Bằng chữ" trên phiếu thu/cọc.
export function numberToVietnameseWords(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return "Không đồng";

  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.unshift(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const words = groups
    .map((group, idx) => {
      if (group === 0) return null;
      const groupIndexFromRight = groups.length - 1 - idx;
      const groupWords = readGroup(group, idx > 0);
      const unit = GROUP_UNITS[groupIndexFromRight] ?? "";
      return unit ? `${groupWords} ${unit}` : groupWords;
    })
    .filter((w): w is string => w !== null)
    .join(" ");

  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalized} đồng`;
}
