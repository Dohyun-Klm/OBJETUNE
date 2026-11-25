import React from 'react';
import { VinylRecord } from './VinylRecord';
import { NowPlaying, PlaybackState } from '../types';

interface TurntableProps {
  nowPlaying: NowPlaying | null;
  playbackState: PlaybackState;
  onPlayPause: () => void;
  showPlayButton?: boolean;
  className?: string;
}

export const Turntable: React.FC<TurntableProps> = ({
  nowPlaying,
  playbackState,
  onPlayPause,
  showPlayButton = true,
  className = '',
}) => {
  const isPlaying = playbackState === 'playing';
  
  // LP가 재生 중인지에 따라 스핀 여부 결정
  const shouldSpin = isPlaying && nowPlaying !== null;

  return (
    <div className={`vw-turntable-container ${className}`} role="region" aria-label="Turntable">
      <div className="vw-turntable">
        {/* 턴테이블 본체 - 월넛 우드 질감 */}
        <div className="vw-turntable__body">
          {/* LP 원판 */}
          <VinylRecord 
            track={nowPlaying?.track || null}
            isPlaying={shouldSpin}
            coverArtUrl={nowPlaying?.track?.coverArtUrl}
          />
          
          {/* 톤암 */}
          <div className="vw-tonearm" data-testid="tonearm">
            <div className="vw-tonearm__pivot" aria-hidden="true" data-testid="tonearm-pivot" />
            <div className="vw-tonearm__head" aria-hidden="true" data-testid="tonearm-head" />
          </div>
          
          {/* HP (Hunting Lamp) 조명 효과 */}
          <div className="vw-hp-light" aria-hidden="true" data-testid="hp-light" />
        </div>
        
        {/* 재생/일시정지 버튼 */}
        {showPlayButton && (
          <button
            className={`vw-turntable__play-btn ${isPlaying ? 'vw-turntable__play-btn--playing' : ''}`}
            onClick={onPlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
        )}
      </div>
    </div>
  );
};