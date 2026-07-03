interface PlatformIconProps {
  platform: string;
  className?: string;
}

export function PlatformIcon({ platform, className }: PlatformIconProps) {
  const key = platform.toLowerCase();

  switch (key) {
    case 'steam':
      return (
        <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="8" r="7" opacity="0.15" />
          <circle cx="10.4" cy="5.6" r="1.6" />
          <path d="M2.6 9.8 6 11.2a2.1 2.1 0 0 1 3.9-.9l3.1-2.2a2.9 2.9 0 1 1-.4 1.9l-2.9 2.1a1.9 1.9 0 0 1-3.6-.4L2.6 9.8Z" />
        </svg>
      );
    case 'xbox':
      return (
        <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
          <path
            d="M2.9 4.4C1.7 5.7 1 7.4 1 9.3 1 13 4.1 16 8 16s7-3 7-6.7c0-1.9-.7-3.6-1.9-4.9-.7.5-2 1.9-3.4 3.9 1 1.3 2 3.3 3 4.4a6.9 6.9 0 0 1-9.4 0c1-1.1 2-3.1 3-4.7C5 6.2 3.7 4.9 3 4.4Z"
            opacity="0.85"
          />
          <path d="M8 2.4c1.2 0 2.3.4 3.1 1.1a8.6 8.6 0 0 0-6.2 0A4.9 4.9 0 0 1 8 2.4Z" />
        </svg>
      );
    case 'playstation':
      return (
        <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
          <path d="M6.4 1.2v12.6l2.2.7V3.5c0-.4.2-.6.5-.5.4.1.5.5.5.9v5.6c1.3.6 2.3.1 2.3-1.6 0-1.7-.6-2.5-2.3-3.1A38 38 0 0 0 6.4 1.2Z" />
          <path d="M9.3 12.7 13.2 11.4c.5-.2.6-.5.1-.6a1.6 1.6 0 0 0-1-.1l-3 1v2Z" opacity="0.7" />
          <path
            d="M1.2 13c-.5-.3-.5-.7 0-.9l4.2-1.5v1.5L2.7 13.2a2.1 2.1 0 0 1-1.5-.2Z"
            opacity="0.7"
          />
        </svg>
      );
    case 'switch':
    case 'nintendo':
      return (
        <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
          <rect x="1" y="1" width="6" height="14" rx="2.5" opacity="0.85" />
          <rect x="9" y="1" width="6" height="14" rx="2.5" />
          <circle cx="4" cy="12.3" r="1" fill="#0a0a0f" />
          <circle cx="12" cy="4" r="1" fill="#0a0a0f" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
          <rect x="1" y="4" width="14" height="8" rx="2" opacity="0.8" />
          <circle cx="5" cy="8" r="1.1" fill="#0a0a0f" />
          <circle cx="11" cy="8" r="1.1" fill="#0a0a0f" />
        </svg>
      );
  }
}
