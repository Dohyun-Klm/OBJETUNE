import React from 'react';
import { VinylRecord } from './VinylRecord';
import { NowPlaying, PlaybackState } from '../types';

interface TurntableProps {
  nowPlaying: NowPlaying | null;
  playbackState: PlaybackState;
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
            <div className="vw-tonearm" data-testid="tonearm" aria-hidden="true">
              <div className="vw-tonearm__pivot" data-testid="tonearm-pivot" />
              <div className="vw-tonearm__head" data-testid="tonearm-head" />
            </div>
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
        <div className="vw-player-controls" role="group" aria-label="Playback controls">
          {onPrevious && (
            <button
              className="vw-player-controls__secondary"
              type="button"
              onClick={onPrevious}
              disabled={!hasTrack}
              aria-label="Previous track"
            >
              ‹‹
            </button>
          )}
          {showPlayButton && (
            <button
              className="vw-player-controls__primary"
              type="button"
              onClick={onPlayPause}
              disabled={!hasTrack}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? 'Ⅱ' : '▶'}
            </button>
          )}
          {onNext && (
            <button
              className="vw-player-controls__secondary"
              type="button"
              onClick={onNext}
              disabled={!hasTrack}
              aria-label="Next track"
            >
              ››
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
