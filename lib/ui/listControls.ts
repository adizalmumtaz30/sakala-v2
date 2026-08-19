export const SAKALA_LIST_PAGE_SIZES = [10, 20, 30, 40, 50] as const;
export type SakalaListPageSize = (typeof SAKALA_LIST_PAGE_SIZES)[number];

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const safePageSize = SAKALA_LIST_PAGE_SIZES.includes(pageSize as SakalaListPageSize) ? pageSize : 10;
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

export function toggleAllSelection<T extends string | number>(
  ids: T[],
  checked: boolean,
) {
  return checked ? [...ids] : [];
}
