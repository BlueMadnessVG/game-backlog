/* import { useRef } from 'react'; */

import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';

import AchievementTimeline from './components/AchievementTimeline/AchievementTimeline';
import { useAchievementTimeline } from './components/AchievementTimeline/hooks/useAchievementTimeline';
import styles from './css/GameDetails.module.css';

import { steamService } from '@/api/steam/steam.service';

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
      <AchievementTimeline gameId={id} />
    </div>
  );
}

export default GameDetailManager;
