import LibraryGrid from './components/LibraryGrid/LibraryGrid';
import { LibraryEmptyState } from './components/ui/LibraryEmptyState/LibraryEmptyState';
import LibrarySkeleton from './components/ui/LibrarySkeleton/LibrarySkeleton';

import { useLibraryGames } from '@/api/library/library.queries';

function LibraryManager() {
  const { games, isLoading } = useLibraryGames();

  if (isLoading) return <LibrarySkeleton />;

  if (!games?.length) return <LibraryEmptyState />;

  return (
    <div>
      <LibraryGrid games={games} />
    </div>
  );
}

export default LibraryManager;
