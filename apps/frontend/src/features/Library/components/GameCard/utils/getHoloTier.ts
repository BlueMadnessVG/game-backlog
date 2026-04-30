import { type HoloStyle } from 'holo-card';

export function getHoloTier(percentage: number): HoloStyle {
  if (percentage === 100) return 'Shiny';
  if (percentage >= 80) return 'Glittery';
  if (percentage >= 60) return 'Vibrant';
  if (percentage >= 40) return 'Radiant';
  if (percentage >= 20) return 'Normal';
  return 'Disable';
}
