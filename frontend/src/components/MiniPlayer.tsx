import React from 'react';
import { NowPlaying } from '../types';
import './MiniPlayer.css';
import { PlaybackIcon, PlaybackProgress } from './PlaybackControls';

interface MiniPlayerProps {
  nowPlaying: NowPlaying;
  onPlayPause: () => void;
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
  onStop: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  nowPlaying, onPlayPause, onNext, onPrevious, position, duration, onSeek, onStop,
}) => {
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
      <PlaybackProgress key={track.id} position={position} duration={duration} onSeek={onSeek} />
      <div className="vw-mini-player__controls" role="group" aria-label="재생 제어">
        <button type="button" className="vw-mini-player__btn" onClick={onPrevious} disabled={!onPrevious} aria-label="이전 곡" title="이전 곡">
          <PlaybackIcon name="previous" />
        </button>
        <button type="button" className="vw-mini-player__play" onClick={onPlayPause} disabled={!track.id} aria-label={playLabel} title={playLabel}>
          <PlaybackIcon name={isPlaying ? 'pause' : 'play'} />
        </button>
        <button type="button" className="vw-mini-player__btn" onClick={onStop} disabled={!track.id} aria-label="정지" title="정지">
          <PlaybackIcon name="stop" />
        </button>
        <button type="button" className="vw-mini-player__btn" onClick={onNext} disabled={!onNext} aria-label="다음 곡" title="다음 곡">
          <PlaybackIcon name="next" />
        </button>
      </div>
    </div>
  );
};
