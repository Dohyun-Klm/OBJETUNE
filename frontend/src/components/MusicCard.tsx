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
const Icon: React.FC<{ name: string; className?: string; size?: number; isFavorite?: boolean }> = ({ name, className = '', size = 14, isFavorite = false }) => {
  const icons: Record<string, React.ReactNode> = {
    favorite: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={2} stroke="currentColor">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
      </svg>
    ),
    play: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor">
        <path d="m8 5 12 7-12 7Z" fill="currentColor" strokeLinejoin="round" />
      </svg>
    ),
    add: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor">
        <line x1="12" y1="7" x2="12" y2="17" />
        <line x1="3" y1="12" x2="21" y2="12" />
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
      <div 
        className="vw-music-card__image"
        style={{ backgroundImage: track.thumbnail && !track.thumbnail.startsWith('🎵') ? `url("${track.thumbnail}")` : undefined }}
      />
      <div className="vw-music-card__info">
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
          {onFavoriteToggle && (
            <button
              className="vw-music-card__favorite-btn"
              onClick={handleFavorite}
              aria-label="즐겨찾기"
              aria-pressed={track.isFavorite}
              title={track.isFavorite ? '즐겨찾기에서 제거' : '즐겨찾기에 추가'}
            >
              <Icon name="favorite" size={14} isFavorite={track.isFavorite} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
