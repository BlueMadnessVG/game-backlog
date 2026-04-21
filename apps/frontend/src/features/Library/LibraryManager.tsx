import { LibraryEmptyState } from './components/ui/LibraryEmptyState/LibraryEmptyState';
import LibrarySkeleton from './components/ui/LibrarySkeleton/LibrarySkeleton';
import { useLibrary } from './hooks/useLibrary.hook';

function LibraryManager() {
  const { games, isLoading /* , refetch  */ } = useLibrary();

  if (isLoading) return <LibrarySkeleton />;

  if (!games?.length) <LibraryEmptyState />;

  return <div>nothing for the moment</div>;
}

export default LibraryManager;
