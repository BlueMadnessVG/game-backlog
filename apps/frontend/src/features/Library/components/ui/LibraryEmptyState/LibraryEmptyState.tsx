import styles from './css/LibraryEmptyState.module.css';
import assistant from '../../../css/LibraryAssistant.module.css';
import { LIBRARY_SCRIPT } from '../../../utils/libraryAssistant';

import { AssistantAnchor } from '@/common/components/layout/Assistant';
import { getApiErrorMessage } from '@/common/utils/ApiError/getApiErrorMessage';

interface LibraryEmptyStateProps {
  /** When set, the library failed to load rather than being empty. */
  error?: Error | null;
  onRetry?: () => void;
}

/** Shown when the library has no games (or failed to load): the assistant cube takes the icon's spot. */
export function LibraryEmptyState({ error, onRetry }: LibraryEmptyStateProps = {}) {
  if (error) {
    return (
      <div className={styles.container} role="alert">
        <AssistantAnchor id="library-empty" className={assistant.empty} {...LIBRARY_SCRIPT.empty} />
        <p className={styles.title}>Couldn't load your library</p>
        <p className={styles.description}>
          {getApiErrorMessage(error, 'Check your connection and try again.')}
        </p>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <AssistantAnchor id="library-empty" className={assistant.empty} {...LIBRARY_SCRIPT.empty} />
      <p className={styles.title}>No games in your library</p>
      <p className={styles.description}>Games you add to your Steam library will appear here.</p>
    </div>
  );
}
