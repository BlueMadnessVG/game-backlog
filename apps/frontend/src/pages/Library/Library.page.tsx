import { LibraryProvider } from '@/features/Library/context/LibraryProvider.context';
import LibraryManager from '@/features/Library/LibraryManager';

function Library() {
  return (
    <LibraryProvider>
      <LibraryManager />
    </LibraryProvider>
  );
}

export default Library;
