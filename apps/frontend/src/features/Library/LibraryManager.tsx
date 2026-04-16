import { useLibrary } from './hooks/useLibrary.hook';

function LibraryManager() {
  const { games, isLoading /* , refetch  */ } = useLibrary();

  if (isLoading) return <> isLoading </>;

  if (isLoading && !games) {
    return <div className="p-8 text-center text-zinc-500">Scanning sector for games...</div>;
  }

  if (!games || games.length === 0) {
    return <> no games </>;
  }

  return <div>nothing for the moment</div>;
}

export default LibraryManager;
