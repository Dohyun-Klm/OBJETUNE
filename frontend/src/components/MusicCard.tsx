import React from 'react';
import { Track } from '../types';
import './MusicCard.css';

interface MusicCardProps {
  track: Track;
  onPlay?: (track: Track) => void;
  onClick?: (track: Track) => void;
  onFavoriteToggle?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  className?: string;
}

// SVG 아이콘 컴포넌트
const Icon: React.FC<{ name: string; className?: string; size?: number; fill?: boolean; isFavorite?: boolean }> = ({ name, className = '', size = 14, fill = false, isFavorite = false }) => {
  const icons: Record<string, React.ReactNode> = {
    favorite: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={fill ? 0 : 2} stroke="currentColor">
        <path d="M12 21s-5-4-5-11a5 5 0 0 1 10 0c0 7-5 11-5 11z" />
      </svg>
    ),
    play: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12l8-6-8-6z" strokeLinecap="round" />
      </svg>
    ),
    add: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="7" x2="12" y2="17" />
        <line x1="7" y1="12" x2="17" y2="12" />
      </svg>
    ),
  };

  const IconComponent = icons[name];
  return IconComponent ? (
    <span className={`vw-card__icon ${className}`} aria-hidden="true">
      {IconComponent}
    </span>
  ) : null;
};

export const MusicCard: React.FC<MusicCardProps> = ({
  track,
  onPlay,
  onClick,
  onFavoriteToggle,
  onAddToQueue,
  className = '',
}) => {
  const handleClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.vw-music-card__info')) {
      onClick?.(track);
    }
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay?.(track);
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFavoriteToggle) {
      onFavoriteToggle(track);
    }
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToQueue?.(track);
  };

  return (
    <div 
      className={`vw-music-card ${className}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={track.title}
    >
      <div className="vw-music-card__image" />
      <div className="vw-music-card__info">
        <button
          className={`vw-music-card__favorite-btn ${track.isFavorite ? 'vw-music-card__favorite-btn--active' : ''}`}
          onClick={handleFavorite}
          aria-label={track.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          title={track.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Icon name="favorite" size={14} fill={true} isFavorite={track.isFavorite} />
        </button>
        <h3 className="vw-music-card__title">{track.title}</h3>
        <p className="vw-music-card__artist">{track.artist}</p>
        <p className="vw-music-card__album">{track.album}</p>
        <div className="vw-music-card__actions">
          <button
            className="vw-music-card__play-btn"
            onClick={handlePlay}
            aria-label={`Play ${track.title}`}
          >
            <Icon name="play" size={16} />
          </button>
          {onAddToQueue && (
            <button
              className="vw-music-card__queue-btn"
              onClick={handleAddToQueue}
              aria-label={`Add ${track.title} to queue`}
              title="Add to queue"
            >
              <Icon name="add" size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};