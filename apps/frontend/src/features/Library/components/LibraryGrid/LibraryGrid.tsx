import { useLibraryVirtualGrid } from './hooks/LibraryVirtualGrid';
import { useLibrary } from '../../hooks/useLibrary.hook';
import GameCard from '../GameCard/GameCard';
import LibrarySkeleton from '../ui/LibrarySkeleton/LibraryGameCardSkeleton';

import type { Game } from '@repo/shared';

interface LibraryGridProps {
  games: Game[];
}

function LibraryGrid({ games }: LibraryGridProps) {
  'use no memo';

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = useLibrary();

  const { scrollRef, virtualizer, COLUMNS } = useLibraryVirtualGrid({
    totalItems: games.length,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    fetchNextPage,
  });

  return (
    <div ref={scrollRef} style={{ height: '100vh', overflowY: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * COLUMNS;
          const rowGames = games.slice(startIndex, startIndex + COLUMNS);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: virtualRow.start,
                left: 0,
                right: 0,
                display: 'grid',
                gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
                gap: '1.5rem',
                padding: '0 1.5rem',
              }}
            >
              {rowGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          );
        })}

        {isFetchingNextPage && (
          <div
            style={{
              position: 'absolute',
              top: virtualizer.getTotalSize(),
              left: 0,
              right: 0,
              padding: '1.5rem',
              display: 'grid',
              gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
              gap: '1.5rem',
            }}
          >
            <LibrarySkeleton />
          </div>
        )}
      </div>
    </div>
  );
}

export default LibraryGrid;
