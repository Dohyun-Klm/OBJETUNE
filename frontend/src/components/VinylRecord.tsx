import React, { useState, useEffect, useRef } from 'react';
import { Track } from '../types';

interface VinylRecordProps {
  track: Track | null;
  isPlaying: boolean;
  coverArtUrl?: string;
  dynamicLabel?: boolean;
  className?: string;
}

export const VinylRecord: React.FC<VinylRecordProps> = ({
  track,
  isPlaying,
  coverArtUrl,
  dynamicLabel = false,
  className = '',
}) => {
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const [failedCoverArt, setFailedCoverArt] = useState<string>();
  const animationRef = useRef<number | null>(null);

  // 회전 애니메이션 처리 (reduced-motion 준수)
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (isPlaying && !prefersReducedMotion) {
      const startTime = performance.now();
      const startingRotation = rotationRef.current;
      const rpm = 33.3; // 레코드 회전 속도 (레코드 표준 33⅓ RPM)
      
      const animate = (currentTime: number) => {
        const elapsed = (currentTime - startTime) / 1000; // 초
        const degrees = (startingRotation + elapsed * rpm * 6) % 360; // RPM을 도/분으로 변환
        rotationRef.current = degrees;
        setRotation(degrees);
        animationRef.current = requestAnimationFrame(animate);
      };
      
      animationRef.current = requestAnimationFrame(animate);
    } else {
      // 일시정지/정지 시 회전 유지 (다음 재생 시 시작)
      setRotation(rotationRef.current);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  const artwork = dynamicLabel && coverArtUrl !== failedCoverArt ? coverArtUrl : undefined;

  return (
    <div 
      className={`vw-vinyl ${className}`}
      style={{ 
        transform: `rotate(${rotation}deg)`
      }}
      role="img"
      aria-label={track ? `${track.title} by ${track.artist}` : 'Turntable'}
      data-playing={isPlaying ? 'true' : 'false'}
      data-testid="vinyl-record"
    >
      {/* LP 라벨 */}
      <div className={`vw-vinyl__label ${artwork ? 'vw-vinyl__label--artwork' : ''}`}>
        {artwork ? (
          <img 
            key={artwork}
            src={artwork}
            onError={() => setFailedCoverArt(artwork)}
            alt={`${track?.title || 'Album'} cover art`}
            className="vw-vinyl__label__artwork-img"
          />
        ) : (
          <div className="vw-vinyl__label__default">
            <div className="vw-vinyl__label__default-text">
              {dynamicLabel && track ? track.title : 'OBJETUNE'}
            </div>
            <div className="vw-vinyl__label__default-text vw-vinyl__label__artist">
              {dynamicLabel && track ? track.artist : (isPlaying ? 'PLAYING' : 'PAUSED')}
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
};
