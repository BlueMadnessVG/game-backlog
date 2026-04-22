import React from 'react';

function MirrorMaskDefinition() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        {/* We use objectBoundingBox so the mask scales with the div */}
        <mask
          id="mirror-portal-mask"
          maskUnits="objectBoundingBox"
          maskContentUnits="objectBoundingBox"
        >
          {/* 1. The visible part: White covers the whole area (0 to 1) */}
          <rect width="1" height="1" fill="white" />

          {/* 2. The "Hole": Must be Black and use values between 0 and 1 */}
          {/* This ellipse is centered (0.5) and is 30% wide (0.15 radius) */}
          <ellipse cx="0.5" cy="0.45" rx="0.15" ry="0.25" fill="black" />

          {/* Note: If you use a <path>, its points must also be between 0 and 1 
              (e.g., M 0.5 0.2 Q 0.6 0.3 ...) which is hard to write manually. 
              It's easier to use basic shapes or scale a path. */}
        </mask>
      </defs>
    </svg>
  );
}

export default MirrorMaskDefinition;
