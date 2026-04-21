import { LibraryProvider } from '@/features/Library/context/LibraryProvider.context';
import LibraryManager from '@/features/Library/LibraryManager';

function Library() {
  return (
    <div>
      <LibraryProvider>
        <LibraryManager />
      </LibraryProvider>
    </div>
  );
}

export default Library;
