export const formatPlayTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes}M`;
  const hours = (minutes / 60).toFixed(1);
  return `${hours}H`;
};
