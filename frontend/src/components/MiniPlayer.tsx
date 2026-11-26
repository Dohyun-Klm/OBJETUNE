import React from 'react';
import { NowPlaying } from '../types';
import { playerManager } from '../services/playerManager';
import './MiniPlayer.css';

interface MiniPlayerProps {
  nowPlaying: NowPlaying | null;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShuffleToggle?: () => void;
  onRepeatToggle?: () => void;
  onQueueToggle?: () => void;
  className?: string;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  nowPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  onShuffleToggle,
  onRepeatToggle,
  onQueueToggle,
  className = '',
}) => {
  if (!nowPlaying) {
    return (
      <div className={`vw-mini-player ${className}`} role="region" aria-label="Mini player">
        <div className="vw-mini-player__placeholder">
          <span>Objetune 미니 플레이어</span>
        </div>
      </div>
    );
  }

  const shuffle = nowPlaying.shuffle ?? false;
  const repeat = nowPlaying.repeat ?? 'off';

  return (
    <div className={`vw-mini-player ${className}`} role="region" aria-label="Mini player">
      <div className="vw-mini-player__cover" />
      
      <div className="vw-mini-player__info">
        <p className="vw-mini-player__title">{nowPlaying.track.title}</p>
        <p className="vw-mini-player__artist">{nowPlaying.track.artist}</p>
      </div>

      <div className="vw-mini-player__controls">
        <button
          className={`vw-mini-player__btn vw-mini-player__shuffle ${shuffle ? 'vw-mini-player__btn--active' : ''}`}
          onClick={onShuffleToggle}
          aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
          aria-pressed={shuffle}
        >
          🔀
        </button>
        
        <button
          className="vw-mini-player__btn vw-mini-player__previous"
          onClick={onPrevious}
          aria-label="Previous track"
        >
          ⏮️
        </button>
        
        <button
          className="vw-mini-player__play"
          onClick={onPlayPause}
          aria-label={nowPlaying.isPlaying ? 'Pause' : 'Play'}
        >
          {nowPlaying.isPlaying ? '❚❚' : '▶'}
        </button>
        
        <button
          className="vw-mini-player__btn vw-mini-player__next"
          onClick={onNext}
          aria-label="Next track"
        >
          ⏭️
        </button>

        <button
          className={`vw-mini-player__btn vw-mini-player__repeat ${repeat !== 'off' ? 'vw-mini-player__btn--active' : ''}`}
          onClick={onRepeatToggle}
          aria-label={`Repeat: ${repeat === 'off' ? 'off' : repeat === 'one' ? 'one' : 'all'}`}
          aria-pressed={repeat !== 'off'}
        >
          {repeat === 'one' ? '🔂' : repeat === 'all' ? '🔁' : '🔁'}
        </button>

        {onQueueToggle && (
          <button
            className="vw-mini-player__btn vw-mini-player__queue"
            onClick={onQueueToggle}
            aria-label="Open queue"
          >
            📋
          </button>
        )}
      </div>
    </div>
  );
};