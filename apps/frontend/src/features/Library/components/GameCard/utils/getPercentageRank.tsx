export type PercentageRank = 'platinum' | 'gold' | 'silver' | 'bronze';

export function getPercentageRank(percentage: number): PercentageRank {
  if (percentage >= 100) return 'platinum';
  if (percentage >= 80) return 'gold';
  if (percentage >= 50) return 'silver';
  return 'bronze';
}
