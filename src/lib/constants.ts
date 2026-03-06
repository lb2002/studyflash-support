export const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  WAITING_ON_CUSTOMER: "bg-purple-100 text-purple-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
  AUTO_CLOSED: "bg-gray-100 text-gray-800",
};

export const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-blue-100 text-blue-800",
  LOW: "bg-gray-100 text-gray-800",
};

export const LANG_FLAGS: Record<string, string> = {
  de: "\u{1F1E9}\u{1F1EA}",
  nl: "\u{1F1F3}\u{1F1F1}",
  fr: "\u{1F1EB}\u{1F1F7}",
  en: "\u{1F1EC}\u{1F1E7}",
};

export const LANG_LABELS: Record<string, string> = {
  de: "German",
  nl: "Dutch",
  fr: "French",
  en: "English",
  it: "Italian",
  es: "Spanish",
  pt: "Portuguese",
};

export function formatCategory(cat: string | null) {
  if (!cat) return "Uncategorized";
  return cat
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
