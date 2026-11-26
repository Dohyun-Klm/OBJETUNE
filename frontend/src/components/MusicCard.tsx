import React from 'react';
import { Track } from '../types';
import './MusicCard.css';

interface MusicCardProps {
  track: Track;
  onPlay?: (track: Track) => void;
  onClick?: (track: Track) => void;
  onFavoriteToggle?: (track: Track) => void;
  className?: string;
}

export const MusicCard: React.FC<MusicCardProps> = ({
  track,
  onPlay,
  onClick,
  onFavoriteToggle,
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
          {track.isFavorite ? '⭐' : '☆'}
        </button>
        <h3 className="vw-music-card__title">{track.title}</h3>
        <p className="vw-music-card__artist">{track.artist}</p>
        <p className="vw-music-card__album">{track.album}</p>
        <button
          className="vw-music-card__play-btn"
          onClick={handlePlay}
          aria-label={`Play ${track.title}`}
        >
          ▶
        </button>
      </div>
    </div>
  );
};