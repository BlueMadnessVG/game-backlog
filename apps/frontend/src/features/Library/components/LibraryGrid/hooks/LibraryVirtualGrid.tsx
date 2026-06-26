import { useEffect, useRef } from 'react';

import { useVirtualizer } from '@tanstack/react-virtual';

const CARD_HEIGHT = 320;
const COLUMNS = 6;
const GAP = 20;

interface UseLibraryVirtualGridOptions {
  totalItems: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export function useLibraryVirtualGrid({
  totalItems,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: UseLibraryVirtualGridOptions) {
  'use no memo';

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowCount = Math.ceil(totalItems / COLUMNS);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_HEIGHT + GAP,
    measureElement: (el) => (el as HTMLElement)?.offsetHeight ?? 0,
    overscan: 2,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];

  useEffect(() => {
    if (!lastItem) return;

    const isLastRowVisible = lastItem.index >= rowCount - 1;

    if (isLastRowVisible && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastItem?.index, rowCount, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { scrollRef, virtualizer, COLUMNS };
}
