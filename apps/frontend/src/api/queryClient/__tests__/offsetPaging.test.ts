import { describe, expect, it } from 'vitest';

import { flattenPages, nextOffset, type OffsetPage } from '../offsetPaging';

const page = (data: number[], total: number, limit: number, offset: number): OffsetPage<number> => ({
  data,
  meta: { total, limit, offset },
});

describe('nextOffset', () => {
  it.each([
    ['first of several pages', page([1], 120, 50, 0), 50],
    ['middle page', page([1], 120, 50, 50), 100],
    ['last partial page', page([1], 120, 50, 100), undefined],
    ['exactly full last page', page([1], 100, 50, 50), undefined],
    ['single short page', page([1], 3, 50, 0), undefined],
    ['empty result', page([], 0, 50, 0), undefined],
  ] as const)('%s → %s', (_label, lastPage, expected) => {
    expect(nextOffset(lastPage)).toBe(expected);
  });
});

describe('flattenPages', () => {
  it('returns [] before any data has loaded', () => {
    expect(flattenPages<number>(undefined)).toEqual([]);
  });

  it('concatenates pages in order', () => {
    const data = {
      pages: [page([1, 2], 5, 2, 0), page([3, 4], 5, 2, 2), page([5], 5, 2, 4)],
      pageParams: [0, 2, 4],
    };
    expect(flattenPages(data)).toEqual([1, 2, 3, 4, 5]);
  });
});
