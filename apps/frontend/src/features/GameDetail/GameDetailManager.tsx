import GameDetailsCanvas from './components/GameDetailsCanvas/GameDetailsCanvas';
import styles from './css/GameDetails.module.css';

function GameDetailManager() {
  return (
    <div className={styles.page_root}>
      <GameDetailsCanvas />

      {/* Page content — sits on top of the canvas */}
      <div className={styles.content_root}>
        {/* Hero panel — sticky */}
        <section className={styles.hero_panel}>{/* GameDetailHero goes here */}</section>

        {/* Horizontal scroll track */}
        <div className={styles.scroll_track}>
          {/* AchievementTimeline, Stats etc go here as panels */}
        </div>
      </div>
    </div>
  );
}

export default GameDetailManager;
