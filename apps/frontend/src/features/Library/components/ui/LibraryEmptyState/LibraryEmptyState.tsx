import styles from './css/LibraryEmptyState.module.css';
import assistant from '../../../css/LibraryAssistant.module.css';
import { LIBRARY_SCRIPT } from '../../../utils/libraryAssistant';

import { AssistantAnchor } from '@/common/components/layout/Assistant';

/** Shown when the library has no games: the assistant cube takes the icon's spot. */
export function LibraryEmptyState() {
  return (
    <div className={styles.container}>
      <AssistantAnchor id="library-empty" className={assistant.empty} {...LIBRARY_SCRIPT.empty} />
      <p className={styles.title}>No games in your library</p>
      <p className={styles.description}>Games you add to your Steam library will appear here.</p>
    </div>
  );
}
