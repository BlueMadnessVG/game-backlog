import styles from './css/LibraryGrid.module.css';
import { useLibraryVirtualGrid } from './hooks/LibraryVirtualGrid';
import assistant from '../../css/LibraryAssistant.module.css';
import { LIBRARY_SCRIPT } from '../../utils/libraryAssistant';
import GameCard from '../GameCard/GameCard';
import { LibraryHeader } from '../LibraryHeader/LibraryHeader';
import LibrarySkeleton from '../ui/LibrarySkeleton/LibraryGameCardSkeleton';

import type { Game } from '@repo/shared';

import { useLibraryGames } from '@/api/library/library.queries';
import { AssistantAnchor } from '@/common/components/layout/Assistant';

interface LibraryGridProps {
  games: Game[];
}

function LibraryGrid({ games }: LibraryGridProps) {
  'use no memo';

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = useLibraryGames();

  const { scrollRef, virtualizer, COLUMNS } = useLibraryVirtualGrid({
    totalItems: games.length,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    fetchNextPage,
  });

  return (
    <div ref={scrollRef} className={styles.library_grid_container}>
      <div className={styles.library_stats_wrapper}>
        <LibraryHeader />
      </div>
      <div className={styles.library_title_row}>
        <h1 className={styles.library_header}>LIBRARY DATABASE</h1>
        {/* The cube sits beside the title while it is on screen… */}
        <AssistantAnchor
          id="library-header"
          className={assistant.header}
          margin="0px"
          {...LIBRARY_SCRIPT.header}
        />
      </div>
      {/* …and drops to a small corner dock once the title scrolls away. */}
      <AssistantAnchor
        id="library-corner"
        className={assistant.corner}
        {...LIBRARY_SCRIPT.corner}
      />

      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * COLUMNS;
          const rowGames = games.slice(startIndex, startIndex + COLUMNS);

          return (
            <div
              key={virtualRow.key}
              ref={(el) => virtualizer.measureElement(el)}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 'auto',
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
                gap: '1.5rem',
                padding: '0 1.5rem 1.5rem 1.5rem',
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
