import React from 'react';
import { NowPlaying } from '../types';
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

// SVG 아이콘 컴포넌트
const Icon: React.FC<{ name: string; className?: string; size?: number }> = ({ name, className = '', size = 16 }) => {
  const icons: Record<string, React.ReactNode> = {
    shuffle: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h10" strokeLinecap="round" />
        <path d="M12 2a5 5 0 0 1 5 5v5" strokeLinecap="round" />
        <path d="M12 14a5 5 0 0 1-5-5v-5" strokeLinecap="round" />
      </svg>
    ),
    prev: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <polygon points="12 4 4 12 12 20" />
        <path d="M12 4v16" />
      </svg>
    ),
    next: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <polygon points="12 4 20 12 12 20 4 12" />
        <path d="M12 4v16" />
      </svg>
    ),
    play: (
      <svg width={size + 4} height={size + 4} viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12l8-6-8-6z" strokeLinecap="round" />
      </svg>
    ),
    pause: (
      <svg width={size + 4} height={size + 4} viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
      </svg>
    ),
    repeat: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <path d="M4 4v5h5" strokeLinecap="round" />
        <path d="M20 20v-5h-5" strokeLinecap="round" />
        <path d="M4 9a9 9 0 0 1 9-9v5" strokeLinecap="round" />
        <path d="M15 9a9 9 0 0 0 9 9v-5" strokeLinecap="round" />
      </svg>
    ),
    queue: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <path d="M3 9h18" strokeLinecap="round" />
      </svg>
    ),
  };

  const IconComponent = icons[name];
  return IconComponent ? (
    <span className={`vw-mini-player__icon ${className}`} aria-hidden="true">
      {IconComponent}
    </span>
  ) : null;
};

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
  const isPlaying = nowPlaying.isPlaying;

  return (
    <div 
      className={`vw-mini-player ${className}`}
      role="region" 
      aria-label="Mini player"
    >
      <div 
        className="vw-mini-player__cover"
        style={{ 
          backgroundImage: nowPlaying.track.thumbnail && !nowPlaying.track.thumbnail.startsWith('🎵') 
            ? `url("${nowPlaying.track.thumbnail}")` 
            : undefined 
        }}
      />
      
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
          <Icon name="shuffle" />
        </button>
        
        <button
          className="vw-mini-player__btn vw-mini-player__previous"
          onClick={onPrevious}
          aria-label="Previous track"
        >
          <Icon name="prev" />
        </button>
        
        <button
          className={`vw-mini-player__play ${isPlaying ? 'vw-mini-player__play--playing' : ''}`}
          onClick={onPlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Icon name="pause" size={20} /> : <Icon name="play" size={20} />}
        </button>
        
        <button
          className="vw-mini-player__btn vw-mini-player__next"
          onClick={onNext}
          aria-label="Next track"
        >
          <Icon name="next" />
        </button>

        <button
          className={`vw-mini-player__btn vw-mini-player__repeat ${repeat !== 'off' ? 'vw-mini-player__btn--active' : ''}`}
          onClick={onRepeatToggle}
          aria-label={`Repeat: ${repeat === 'off' ? 'off' : repeat === 'one' ? 'one' : 'all'}`}
          aria-pressed={repeat !== 'off'}
        >
          <Icon name="repeat" />
        </button>

        {onQueueToggle && (
          <button
            className="vw-mini-player__btn vw-mini-player__queue"
            onClick={onQueueToggle}
            aria-label="Open queue"
          >
            <Icon name="queue" />
          </button>
        )}
      </div>
    </div>
  );
};
