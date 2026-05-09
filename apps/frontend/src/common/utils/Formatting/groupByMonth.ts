import type { Achievement } from '@repo/shared';

const UNLOCKED_CARD_WIDTH = 200; // px
const LOCKED_CARD_WIDTH = 120; // px
const GAP = 12; // px

interface AchievementGroup {
  label: string;
  achievements: Achievement[];
  trackWidth: number;
}

function getMonthLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function groupByMonth(achievements: Achievement[]): AchievementGroup[] {
  const map = new Map<string, Achievement[]>();

  for (const achievement of achievements) {
    const label = achievement.unlockedAt ? getMonthLabel(achievement.unlockedAt) : 'Locked';

    const existing = map.get(label) ?? [];
    existing.push(achievement);
    map.set(label, existing);
  }

  return Array.from(map.entries()).map(([label, achs]) => {
    const trackWidth = achs.reduce((total, ach) => {
      const cardWidth = ach.achieved ? UNLOCKED_CARD_WIDTH : LOCKED_CARD_WIDTH;
      return total + cardWidth + GAP;
    }, 0);

    return { label, achievements: achs, trackWidth };
  });
}
