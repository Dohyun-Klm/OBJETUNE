import React, { useRef, useState } from 'react';
import './PlaybackControls.css';

const paths = {
  previous: 'M6 5h2v14H6zM18 5 8 12l10 7z',
  next: 'M16 5h2v14h-2zM6 5l10 7-10 7z',
  play: 'M7 4v16l13-8z',
  pause: 'M7 5h3v14H7zM14 5h3v14h-3z',
  stop: 'M6 6h12v12H6z',
  queue: 'M3 5h18v2H3zM3 11h12v2H3zM3 17h12v2H3zM17 12v8l5-4z',
};

export function PlaybackIcon({ name }: { name: keyof typeof paths }) {
  return <svg className="vw-playback-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function formatTime(seconds: number) {
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60);
  const remainder = String(whole % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes % 60).padStart(2, '0')}:${remainder}` : `${minutes}:${remainder}`;
}

export function PlaybackProgress({ position, duration, onSeek }: {
  position: number;
  duration: number;
  onSeek?: (seconds: number) => void;
}) {
  const pointer = useRef<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const end = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const current = Number.isFinite(position) ? Math.min(end, Math.max(0, position)) : 0;
  const time = Math.min(end, preview ?? current);

  const clearPreview = () => {
    pointer.current = null;
    setPreview(null);
  };

  return (
    <div className="vw-playback-progress">
      <span aria-hidden="true">{formatTime(time)}</span>
      <input
        type="range"
        min={0}
        max={end || 1}
        step="0.1"
        value={time}
        disabled={!end || !onSeek}
        aria-label="재생 위치"
        aria-valuetext={`${formatTime(time)} / ${formatTime(end)}`}
        onPointerDown={(event) => {
          pointer.current = event.pointerId;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerUp={(event) => {
          if (pointer.current === event.pointerId) onSeek?.(event.currentTarget.valueAsNumber);
          clearPreview();
        }}
        onPointerCancel={clearPreview}
        onLostPointerCapture={clearPreview}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (pointer.current === null) onSeek?.(next);
          else setPreview(next);
        }}
      />
      <span aria-hidden="true">{formatTime(end)}</span>
    </div>
  );
}
