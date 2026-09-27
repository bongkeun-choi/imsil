import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

export function formatPhone(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (!cleaned) return phone;

  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }
  if (cleaned.length === 10) {
    if (cleaned.startsWith("02")) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "$1-$2-$3");
    }
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  }
  if (cleaned.length === 9) {
    if (cleaned.startsWith("02")) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{4})/, "$1-$2-$3");
    }
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3");
  }
  if (cleaned.length === 8) {
    return cleaned.replace(/(\d{4})(\d{4})/, "$1-$2");
  }
  if (cleaned.length === 7) {
    return cleaned.replace(/(\d{3})(\d{4})/, "$1-$2");
  }
  return phone;
}

