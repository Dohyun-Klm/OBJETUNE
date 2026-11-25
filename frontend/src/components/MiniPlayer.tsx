import React from 'react';
import { NowPlaying } from '../types';
import './MiniPlayer.css';

interface MiniPlayerProps {
  nowPlaying: NowPlaying | null;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  className?: string;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  nowPlaying,
  onPlayPause,
  onNext,
  onPrevious,
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className={`vw-mini-player ${className}`} role="region" aria-label="Mini player">
      <div className="vw-mini-player__cover" />
      
      <div className="vw-mini-player__info">
        <p className="vw-mini-player__title">{nowPlaying.track.title}</p>
        <p className="vw-mini-player__artist">{nowPlaying.track.artist}</p>
      </div>

      <div className="vw-mini-player__controls">
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
      </div>
    </div>
  );
};