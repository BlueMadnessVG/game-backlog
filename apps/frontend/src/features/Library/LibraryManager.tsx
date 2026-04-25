import GameCard from './components/GameCard/GameCard';
import LibraryGrid from './components/LibraryGrid/LibraryGrid';
import { LibraryEmptyState } from './components/ui/LibraryEmptyState/LibraryEmptyState';
import LibrarySkeleton from './components/ui/LibrarySkeleton/LibrarySkeleton';
import { useLibrary } from './hooks/useLibrary.hook';

function LibraryManager() {
  const { games, isLoading /* , refetch  */ } = useLibrary();

  if (isLoading) return <LibrarySkeleton />;

  if (!games?.length) return <LibraryEmptyState />;

  return (
    <div>
      <LibraryGrid>
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </LibraryGrid>
    </div>
  );
}

export default LibraryManager;
