import React, { useState, useEffect, useRef } from 'react';
import { Track } from '../types';

interface VinylRecordProps {
  track: Track | null;
  isPlaying: boolean;
  coverArtUrl?: string;
  className?: string;
}

export const VinylRecord: React.FC<VinylRecordProps> = ({
  track,
  isPlaying,
  coverArtUrl,
  className = '',
}) => {
  const [rotation, setRotation] = useState(0);
  const [displayedCoverArt, setDisplayedCoverArt] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const animationRef = useRef<number | null>(null);

  // coverArtUrl 로드 처리
  useEffect(() => {
    if (coverArtUrl && !imageError) {
      const img = new Image();
      img.onload = () => {
        setDisplayedCoverArt(coverArtUrl);
        setImageError(false);
      };
      img.onerror = () => {
        setDisplayedCoverArt(null);
        setImageError(true);
      };
      img.src = coverArtUrl;
    } else {
      setDisplayedCoverArt(null);
    }
  }, [coverArtUrl, imageError]);

  // 회전 애니메이션 처리 (reduced-motion 준수)
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (isPlaying && !prefersReducedMotion) {
      const startTime = performance.now();
      const rpm = 33.3; // 레코드 회전 속도 (레코드 표준 33⅓ RPM)
      
      const animate = (currentTime: number) => {
        const elapsed = (currentTime - startTime) / 1000; // 초
        const degrees = (elapsed * rpm * 6) % 360; // RPM을 도/분으로 변환
        setRotation(degrees);
        animationRef.current = requestAnimationFrame(animate);
      };
      
      animationRef.current = requestAnimationFrame(animate);
    } else {
      // 일시정지/정지 시 회전 유지 (다음 재생 시 시작)
      setRotation(prev => prev);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  // 테스트용: mockData에서 coverArtUrl이 없으므로 기본 라벨 표시
  const hasCoverArt = displayedCoverArt && !imageError;

  return (
    <div 
      className={`vw-vinyl ${className}`}
      style={{ 
        animationPlayState: isPlaying ? 'running' : 'paused',
        transform: `rotate(${rotation}deg)`
      }}
      role="img"
      aria-label={track ? `${track.title} by ${track.artist}` : 'Turntable'}
      data-playing={isPlaying ? 'true' : 'false'}
      data-testid="vinyl-record"
    >
      {/* LP 라벨 */}
      <div className={`vw-vinyl__label ${hasCoverArt ? 'vw-vinyl__label--artwork' : ''}`}>
        {hasCoverArt ? (
          <img 
            src={displayedCoverArt!} 
            alt={`${track?.title || 'Album'} cover art`}
            className="vw-vinyl__label__artwork-img"
          />
        ) : (
          <div className="vw-vinyl__label__default">
            <div className="vw-vinyl__label__default-text">OBJETUNE</div>
            <div className="vw-vinyl__label__default-text" style={{ fontSize: '8px', opacity: 0.7 }}>
              {isPlaying ? 'PLAYING' : 'PAUSED'}
            </div>
          </div>
        )}
      </div>
      
      {/* 레코드 스크류 (LP 질감 표현) */}
      <div className="vw-vinyl__groove" />
    </div>
  );
};