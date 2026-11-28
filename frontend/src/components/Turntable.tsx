import React from 'react';
import { VinylRecord } from './VinylRecord';
import { NowPlaying, PlaybackState } from '../types';
import { PlaybackIcon, PlaybackProgress } from './PlaybackControls';
import { Tonearm } from './Tonearm';

interface TurntableProps {
  nowPlaying: NowPlaying | null;
  playbackState: PlaybackState;
  progress?: number;
  position?: number;
  duration?: number;
  onSeek?: (seconds: number) => void;
  onStop?: () => void;
  onPlayPause: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  showPlayButton?: boolean;
  dynamicLabel?: boolean;
  className?: string;
}

export const Turntable: React.FC<TurntableProps> = ({
  nowPlaying,
  playbackState,
  progress = 0,
  position = 0,
  duration = 0,
  onSeek,
  onStop,
  onPlayPause,
  onPrevious,
  onNext,
  showPlayButton = true,
  dynamicLabel = false,
  className = '',
}) => {
  const isPlaying = playbackState === 'playing';
  const shouldSpin = isPlaying && nowPlaying !== null;
  const hasTrack = Boolean(nowPlaying?.track?.id && nowPlaying.track.title);
  const track = nowPlaying?.track;
  const artwork = track?.coverArtUrl || track?.thumbnail;
  const groovePosition = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const isTracking = hasTrack && (isPlaying || playbackState === 'paused');
  const tonearmAngle = isTracking ? 27 * groovePosition : -12;

  return (
    <section className={`vw-turntable-container ${className}`} aria-label="Turntable">
      <div className="vw-player-screen__art">
        <div className="vw-player-screen__sleeve" aria-hidden="true">
          {artwork && !artwork.startsWith('🎵') && (
            <img key={artwork} src={artwork} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />
          )}
        </div>
        <div className="vw-turntable" data-playback-state={playbackState}>
          <div className="vw-turntable__body">
            <VinylRecord
              track={nowPlaying?.track || null}
              isPlaying={shouldSpin}
              coverArtUrl={dynamicLabel ? nowPlaying?.track?.coverArtUrl : undefined}
              dynamicLabel={dynamicLabel}
            />
            <Tonearm angle={tonearmAngle} />
            <div className="vw-hp-light" aria-hidden="true" data-testid="hp-light" />
          </div>
        </div>
      </div>

      <div className="vw-player-screen__details">
        <header className="vw-player-screen__metadata" aria-live="polite">
          <p className="vw-player-screen__eyebrow">NOW SPINNING</p>
          <h1 className="vw-player-screen__title">{track?.title || 'Choose a record'}</h1>
          <p className="vw-player-screen__artist">{track?.artist || 'Select a track from your Library'}</p>
        </header>
        {onSeek && <PlaybackProgress key={track?.id} position={position} duration={duration} onSeek={onSeek} />}
        <div className="vw-player-controls" role="group" aria-label="Playback controls">
          {onPrevious && (
            <button
              className="vw-player-controls__secondary"
              type="button"
              onClick={onPrevious}
              disabled={!hasTrack}
              aria-label="Previous track"
              title="이전 곡"
            >
              <PlaybackIcon name="previous" />
            </button>
          )}
          {showPlayButton && (
            <button
              className="vw-player-controls__primary"
              type="button"
              onClick={onPlayPause}
              disabled={!hasTrack}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              title={isPlaying ? '일시정지' : '재생'}
            >
              <PlaybackIcon name={isPlaying ? 'pause' : 'play'} />
            </button>
          )}
          {onStop && (
            <button className="vw-player-controls__secondary" type="button" onClick={onStop}
              disabled={!hasTrack} aria-label="Stop" title="정지">
              <PlaybackIcon name="stop" />
            </button>
          )}
          {onNext && (
            <button
              className="vw-player-controls__secondary"
              type="button"
              onClick={onNext}
              disabled={!hasTrack}
              aria-label="Next track"
              title="다음 곡"
            >
              <PlaybackIcon name="next" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
