import React from 'react';

import { Zap } from 'lucide-react';

import { GAME_CATEGORY_CONFIG } from '../../../../types/billboard';

import type { GameCategory } from '../../../../types/billboard';

interface InteractionPromptProps {
  readonly isVisible: boolean;
  readonly category: GameCategory;
  readonly gameCount: number;
}

export const InteractionPrompt: React.FC<InteractionPromptProps> = ({
  isVisible,
  category,
  gameCount,
}) => {
  if (!isVisible || gameCount === 0) {
    return null;
  }

  const config = GAME_CATEGORY_CONFIG[category];

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div
        className="flex items-center gap-3 px-6 py-3 rounded-full border-2 backdrop-blur-sm"
        style={{
          backgroundColor: config.color + '15',
          borderColor: config.color,
          color: config.color,
        }}
      >
        <Zap size={20} className="animate-pulse" />
        <span className="font-semibold text-sm">Press E or Enter to interact</span>
      </div>
      <div className="text-center mt-2 text-xs text-slate-400">
        {config.label} • {gameCount} {gameCount === 1 ? 'game' : 'games'}
      </div>
    </div>
  );
};
