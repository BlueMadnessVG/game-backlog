import { HeroScene } from './components/canvas/HeroScene';
import styles from './css/HeroPageManager.module.css';

export function HeroPage() {
  return (
    <div className={styles.heroPage}>
      {/* 3D Scene — fixed behind everything */}
      <HeroScene />

      {/* Scrollable editorial content */}
      {/*       <div className={styles.contentOverlay}>
        <section className={`${styles.section} ${styles.sectionCentered}`}>
          <div className={`${styles.container} ${styles.containerNarrow}`}>
            <p className={styles.label}>Unified Gaming Library</p>
            <h1 className={`${styles.headline} ${styles.headlineLarge}`}>
              Your games are
              <br />
              <span className={styles.headlineMuted}>everywhere.</span>
              <br />
              Your progress is
              <br />
              <span className={styles.headlineAccent}>nowhere.</span>
            </h1>
            <p className={`${styles.body} ${styles.bodyCentered}`}>
              Xbox. PlayStation. Steam. Three platforms. One fragmented collection. Until now.
            </p>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionLeft}`}>
          <div className={styles.container}>
            <p className={styles.label}>01. The Shell</p>
            <h2 className={styles.headline}>
              Every game you own,
              <br />
              <span className={styles.headlineItalic}>deconstructed.</span>
            </h2>
            <p className={styles.body}>
              We pull from every platform you play on. Not a list. A collection. Your library,
              reassembled as a single, unified body of work.
            </p>
            <div className={styles.platformGrid}>
              <div className={styles.platformItem}>
                <span className={styles.platformName}>Steam</span>
                Library & Achievements
              </div>
              <div className={styles.platformItem}>
                <span className={styles.platformName}>PlayStation</span>
                Trophies & Progress
              </div>
              <div className={styles.platformItem}>
                <span className={styles.platformName}>Xbox</span>
                Gamerscore & History
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionRight}`}>
          <div className={`${styles.container} ${styles.containerNarrow}`}>
            <p className={styles.label}>02. The Core</p>
            <h2 className={styles.headline}>
              Completion.
              <br />
              Not just collection.
            </h2>
            <p className={styles.body}>
              Track what you've finished. Hunt what you haven't. See your true completion percentage
              across every platform — not just the ones with the best marketing.
            </p>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionCentered}`}>
          <div className={`${styles.container} ${styles.containerNarrow}`}>
            <h2 className={styles.headline}>
              Connect your platforms.
              <br />
              <span className={styles.headlineAccent}>See your library.</span>
            </h2>
            <div className={styles.ctaButtons}>
              <button type="button" className={styles.btnPrimary}>
                Get Started
              </button>
              <button type="button" className={styles.btnSecondary}>
                Learn More
              </button>
            </div>
            <p className={styles.footerNote}>No data sold. No ads. Just your games.</p>
          </div>
        </section>
      </div> */}
    </div>
  );
}

export default HeroPage;
