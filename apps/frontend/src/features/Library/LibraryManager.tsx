import LibraryGrid from './components/LibraryGrid/LibraryGrid';
import { LibraryEmptyState } from './components/ui/LibraryEmptyState/LibraryEmptyState';
import LibrarySkeleton from './components/ui/LibrarySkeleton/LibrarySkeleton';
import assistant from './css/LibraryAssistant.module.css';
import { LIBRARY_SCRIPT } from './utils/libraryAssistant';

import { useLibraryGames } from '@/api/library/library.queries';
import { AssistantAnchor } from '@/common/components/layout/Assistant';

function LibraryManager() {
  const { games, isLoading } = useLibraryGames();

  if (isLoading) {
    return (
      <>
        {/* The cube waits in the corner, thinking, while the library loads. */}
        <AssistantAnchor
          id="library-loading"
          className={assistant.corner}
          {...LIBRARY_SCRIPT.loading}
        />
        <LibrarySkeleton />
      </>
    );
  }

  if (!games?.length) return <LibraryEmptyState />;

  return (
    <div>
      <LibraryGrid games={games} />
    </div>
  );
}

export default LibraryManager;
