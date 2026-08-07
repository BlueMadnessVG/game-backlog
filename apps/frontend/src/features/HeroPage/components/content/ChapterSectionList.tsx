import { ChapterSection } from './ChapterSection';
import styles from './css/ChapterSectionList.module.css';
import { SECTIONS } from '../../utils/sections';

/**
 * Mounts every deep-dive chapter in document order inside the page's
 * `contentBelow` region. Each section carries its own `data-chapter` marker
 * that `useChapterMeasurement` reads to drive the global scroll model.
 */
export function ChapterSectionList() {
  return (
    <div className={styles.list}>
      {SECTIONS.map((chapter) => (
        <ChapterSection key={chapter.id} chapter={chapter} />
      ))}
    </div>
  );
}

export default ChapterSectionList;
