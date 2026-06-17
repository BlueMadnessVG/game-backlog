type GameStatus = "backlog" | "in-progress" | "completed" | "retired";

const COMPLETED_PLAYTIME_MINUTES = 10 * 60; // 10 hours
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

  // 1. Completed always wins — no time-based rule can override it
  if (completionPercentage >= 100) return "completed";
  if (!hasAchievements && playTimeMinutes >= COMPLETED_PLAYTIME_MINUTES)
    return "completed";

  // 2. Never played at all → backlog immediately, skip time checks
  if (!lastPlayedAt) return "backlog";

  // 3. Time-based — only reached if not completed and has been played
  const daysSince =
    (Date.now() - lastPlayedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince <= IN_PROGRESS_DAYS) return "in-progress";
  if (daysSince >= RETIRED_DAYS) return "retired";

  // 4. Played, but not recently enough for in-progress or old enough for retired
  return "backlog";
}
