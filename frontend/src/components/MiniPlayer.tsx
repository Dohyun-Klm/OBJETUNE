import React from 'react';
import { NowPlaying } from '../types';
import './MiniPlayer.css';

interface MiniPlayerProps {
  nowPlaying: NowPlaying;
  onPlayPause: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ nowPlaying, onPlayPause, onNext, onPrevious }) => {
  const { track, isPlaying } = nowPlaying;
  const playLabel = isPlaying ? '일시정지' : '재생';

  return (
    <div className="vw-mini-player" role="region" aria-label="Mini player">
      <div
        className="vw-mini-player__cover"
        style={{ backgroundImage: track.thumbnail && !track.thumbnail.startsWith('🎵') ? `url("${track.thumbnail}")` : undefined }}
      />
      <div className="vw-mini-player__info">
        <p className="vw-mini-player__title">{track.title || '선택한 곡 없음'}</p>
        <p className="vw-mini-player__artist">{track.artist}</p>
      </div>
      <div className="vw-mini-player__controls" role="group" aria-label="재생 제어">
        <button type="button" className="vw-mini-player__btn" onClick={onPrevious} disabled={!onPrevious} title="이전 곡">이전</button>
        <button type="button" className="vw-mini-player__play" onClick={onPlayPause} disabled={!track.id} title={playLabel}>{playLabel}</button>
        <button type="button" className="vw-mini-player__btn" onClick={onNext} disabled={!onNext} title="다음 곡">다음</button>
      </div>
    </div>
  );
};
