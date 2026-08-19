export const SAKALA_LONG_TEXT_MAX_LINES = 2;

export function previewLongText(value: string, maxChars = 120) {
  const text = value.trim();
  if (text.length <= maxChars) return { preview: text, truncated: false };
  const boundary = text.slice(0, maxChars).lastIndexOf(" ");
  const end = boundary > Math.floor(maxChars * 0.6) ? boundary : maxChars;
  return { preview: `${text.slice(0, end).trim()}…`, truncated: true };
}
