interface CompletionRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

const RING_START_ANGLE_DEG = -90;

export function CompletionRing({ percentage, size = 28, strokeWidth = 3 }: CompletionRingProps) {
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clampedPercentage / 100);
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--surface-highest)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(${RING_START_ANGLE_DEG} ${center} ${center})`}
      />
    </svg>
  );
}
