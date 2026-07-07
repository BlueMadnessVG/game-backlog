import React, { useCallback, useEffect, useState } from 'react';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { GAME_CATEGORY_CONFIG } from '../../../../types/billboard';

import type { GameCategory } from '../../../../types/billboard';
import type { Game } from '@repo/shared';

interface BillboardOverlayProps {
  readonly isVisible: boolean;
  readonly category: GameCategory;
  readonly games: readonly Game[];
  readonly isLoading: boolean;
  readonly onClose: () => void;
}

export const BillboardOverlay: React.FC<BillboardOverlayProps> = ({
  isVisible,
  category,
  games,
  isLoading,
  onClose,
}) => {
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);

  // Keep track of the previous keys to identify when they change
  const [prevCategory, setPrevCategory] = useState<GameCategory>(category);
  const [prevGamesLength, setPrevGamesLength] = useState<number>(games.length);

  // If category or games length changed, reset index right during the render pass
  if (category !== prevCategory || games.length !== prevGamesLength) {
    setPrevCategory(category);
    setPrevGamesLength(games.length);
    setSelectedGameIndex(0);
  }

  const config = GAME_CATEGORY_CONFIG[category];
  const selectedGame = games[selectedGameIndex];

  const handlePrevious = useCallback(() => {
    setSelectedGameIndex((prev) => (prev === 0 ? games.length - 1 : prev - 1));
  }, [games.length]);

  const handleNext = useCallback(() => {
    setSelectedGameIndex((prev) => (prev === games.length - 1 ? 0 : prev + 1));
  }, [games.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, handlePrevious, handleNext, onClose]);

  if (!isVisible || isLoading) {
    return null;
  }

  if (games.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 max-w-md">
          <h2 className="text-2xl font-bold mb-2" style={{ color: config.color }}>
            {config.label}
          </h2>
          <p className="text-slate-300">No games in this category yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-lg overflow-hidden max-w-2xl w-full mx-4">
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{
            backgroundColor: config.color + '20',
            borderBottom: `2px solid ${config.color}`,
          }}
        >
          <h2 className="text-2xl font-bold" style={{ color: config.color }}>
            {config.label}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={24} className="text-slate-400 hover:text-white" />
          </button>
        </div>

        {/* Game Display */}
        {selectedGame && (
          <div className="p-6">
            {/* Game Image */}
            {selectedGame.coverUrl && (
              <img
                src={selectedGame.coverUrl}
                alt={selectedGame.title}
                className="w-full h-80 object-cover rounded-lg mb-4"
              />
            )}

            {/* Game Info */}
            <div className="mb-6">
              <h3 className="text-3xl font-bold mb-2 text-white truncate">{selectedGame.title}</h3>

              {/* Status Badge */}
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="px-3 py-1 rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: config.color }}
                >
                  {config.label}
                </span>
                {selectedGame.playTime !== undefined && (
                  <span className="text-slate-400 text-sm">
                    {selectedGame.playTime > 0 && `${Math.round(selectedGame.playTime / 60)} hrs`}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-slate-300 text-sm line-clamp-3 mb-4">
                {selectedGame.title || 'No description available.'}
              </p>

              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 mb-1">Released</p>
                  <p className="text-white font-semibold">
                    {selectedGame.lastPlayedAt
                      ? new Date(selectedGame.lastPlayedAt).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">Developer</p>
                  <p className="text-white font-semibold truncate">{selectedGame.title || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrevious}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                disabled={games.length <= 1}
                aria-label="Previous game"
              >
                <ChevronLeft size={24} className="text-slate-400 hover:text-white" />
              </button>

              <div className="text-center">
                <p className="text-slate-400 text-sm">
                  {selectedGameIndex + 1} / {games.length}
                </p>
              </div>

              <button
                onClick={handleNext}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                disabled={games.length <= 1}
                aria-label="Next game"
              >
                <ChevronRight size={24} className="text-slate-400 hover:text-white" />
              </button>
            </div>

            {/* Hint */}
            <div className="mt-6 pt-4 border-t border-slate-700 text-center">
              <p className="text-xs text-slate-500">
                Use arrow keys to navigate • Press ESC to close
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
