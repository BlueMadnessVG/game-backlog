type GameStatus = "backlog" | "in-progress" | "completed" | "retired";

const COMPLETED_PLAYTIME_MINUTES = 10 * 60;
const IN_PROGRESS_DAYS = 30;
const RETIRED_DAYS = 365;

export function deriveGameStatus(opts: {
  completionPercentage: number;
  hasAchievements: boolean;
  playTimeMinutes: number;
  lastPlayedAt: Date | null;
}): GameStatus {
  const {
    completionPercentage,
    hasAchievements,
    playTimeMinutes,
    lastPlayedAt,
  } = opts;

  if (completionPercentage >= 100) return "completed";
  if (!hasAchievements && playTimeMinutes >= COMPLETED_PLAYTIME_MINUTES)
    return "completed";

  if (!lastPlayedAt) return "backlog";

  const daysSince =
    (Date.now() - lastPlayedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince <= IN_PROGRESS_DAYS) return "in-progress";
  if (daysSince >= RETIRED_DAYS) return "retired";

  return "backlog";
}
