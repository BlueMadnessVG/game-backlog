/* import { useRef } from 'react'; */

import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';

/* import AchievementTimeline from './components/AchievementTimeline/AchievementTimeline';
 */ import { useAchievementTimeline } from './components/AchievementTimeline/hooks/useAchievementTimeline';
/* import { MapCanvas } from './components/GameDetailsCanvas/GameDetailsCanvas';
 *//* import GameDetailsHero from './components/GameDetailsHero/GameDetailsHero';
 */ import { Stage } from './components/TryGame/components/3d/Stage';
import styles from './css/GameDetails.module.css';

import { steamService } from '@/api/steam/steam.service';

/* const MOCK_GAME: Game = {
  id: 'c8129963-079c-40e4-9c5d-91412ab591f8',
  externalId: '1091500',
  title: 'Cyberpunk 2077',
  platform: 'steam',
  status: 'in-progress',
  iconUrl:
    'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/capsule_sm_120.jpg',
  coverUrl:
    'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/library_600x900.jpg',
  bannerUrl:
    'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/library_hero.jpg',
  playTime: 142,
  completionPercentage: 67,
  lastPlayedAt: '2025-04-28T21:30:00.000Z',
  addedAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2025-04-28T21:30:00.000Z',
}; */

function GameDetailManager() {
  /*   const scrollTrackRef = useRef<HTMLDivElement>(null!);
   */
  const { id } = useParams({ from: '/games/$id' });

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', id],
    queryFn: ({ signal }) => steamService.getGameById(id, signal),
    enabled: !!id,
  });

  const { isLoading: achievementsLoading } = useAchievementTimeline({
    gameId: id,
  });

  if (isLoading || achievementsLoading) return null;
  if (!game) return null;

  return (
    <div className={styles.page_root}>
      {/*       <MapCanvas achievements={achievements} />
       */}

      <Stage />

      {/*       <div className={styles.content_root}>
        <section className={styles.hero_panel}>
          <GameDetailsHero game={game} scrollRef={scrollTrackRef} />
        </section>

        <div ref={scrollTrackRef} className={styles.scroll_track}>
          {/* AchievementTimeline, Stats etc go here as panels */}
      {/*          <AchievementTimeline gameId={id} />
        </div>
      </div> */}
    </div>
  );
}

export default GameDetailManager;
