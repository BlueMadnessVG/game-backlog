import type { InfiniteData } from '@tanstack/react-query';

/**
 * Offset pagination for the backend's `{ data, meta: { total, limit, offset } }`
 * pages, shared by every infinite query.
 */
export interface OffsetPage<T> {
  data: T[];
  meta: { total: number; limit: number; offset: number };
}

/** The next page's offset, or `undefined` once the last page is loaded. */
export function nextOffset<T>(lastPage: OffsetPage<T>): number | undefined {
  const { total, limit, offset } = lastPage.meta;
  const next = offset + limit;
  return next < total ? next : undefined;
}

/** All loaded pages as one list, in page order. */
export function flattenPages<T>(data: InfiniteData<OffsetPage<T>> | undefined): T[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}
