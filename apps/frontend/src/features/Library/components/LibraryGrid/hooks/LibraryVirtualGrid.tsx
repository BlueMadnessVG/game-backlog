import { useEffect, useRef, useState } from 'react';

import { useVirtualizer } from '@tanstack/react-virtual';

import { getColumnCount } from '../utils/getColumnCount';

const CARD_GAP = 24;
const ROW_GAP = 20;

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
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const COLUMNS = getColumnCount({
    containerWidth,
    gap: CARD_GAP,
  });

  const rowCount = Math.ceil(totalItems / COLUMNS);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 320 + ROW_GAP,
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
