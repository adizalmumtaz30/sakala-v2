export const SAKALA_LIST_PAGE_SIZES = [10, 20, 30, 40, 50] as const;
export type SakalaListPageSize = (typeof SAKALA_LIST_PAGE_SIZES)[number];

export function normalizePageSize(value: number, total: number) {
  const safeTotal = Math.max(0, total);
  if (!Number.isFinite(value)) return Math.min(10, safeTotal || 10);
  return Math.min(Math.max(1, Math.floor(value)), safeTotal || 1);
}

export function getPageSizeOptions(total: number) {
  const safeTotal = Math.max(0, total);
  if (safeTotal === 0) return [];
  return Array.from(new Set([...SAKALA_LIST_PAGE_SIZES, safeTotal])).filter((n) => n <= safeTotal);
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const safePageSize = normalizePageSize(pageSize, items.length);
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    items: items.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    total: items.length,
    totalPages,
    startIndex: items.length === 0 ? 0 : start + 1,
    endIndex: Math.min(start + safePageSize, items.length),
  };
}

export function toggleAllSelection<T extends string | number>(ids: T[], checked: boolean) {
  return checked ? [...ids] : [];
}
