import React, { useState, useEffect, useCallback } from 'react';
import { Track } from '../types';
import { getQueue, removeFromQueue, clearQueue, moveQueueItem, addToQueue } from '../services/tauriApi';
import './QueuePanel.css';

interface QueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
  nowPlaying: Track | null;
  onPlayTrack: (track: Track) => void;
  className?: string;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  isOpen,
  onClose,
  nowPlaying,
  onPlayTrack,
  className = '',
}) => {
  const [queue, setQueue] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const tracks = await getQueue();
      setQueue(tracks);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadQueue();
    }
  }, [isOpen, loadQueue]);

  const handleRemove = async (trackId: string) => {
    const success = await removeFromQueue(trackId);
    if (success) {
      setQueue(prev => prev.filter(t => t.id !== trackId));
    }
  };

  const handleClear = async () => {
    const success = await clearQueue();
    if (success) {
      setQueue([]);
    }
  };

  const handleMove = async (trackId: string, newIndex: number) => {
    // queue position is 1-based in backend
    const success = await moveQueueItem(trackId, newIndex + 1);
    if (success) {
      loadQueue();
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceIndex !== targetIndex) {
      const trackId = queue[sourceIndex].id;
      handleMove(trackId, targetIndex);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`vw-queue-panel ${className}`} role="region" aria-label="Queue">
      <div className="vw-queue-panel__header">
        <h3 className="vw-queue-panel__title">Up Next ({queue.length})</h3>
        <div className="vw-queue-panel__actions">
          {queue.length > 0 && (
            <button
              className="vw-queue-panel__btn vw-queue-panel__btn--clear"
              onClick={handleClear}
              aria-label="Clear queue"
            >
              Clear
            </button>
          )}
          <button
            className="vw-queue-panel__btn vw-queue-panel__btn--close"
            onClick={onClose}
            aria-label="Close queue"
          >
            ✕
          </button>
        </div>
      </div>

      {loading ? (
        <div className="vw-queue-panel__loading">Loading queue...</div>
      ) : queue.length === 0 ? (
        <div className="vw-queue-panel__empty">
          <p>Queue is empty</p>
          <p className="vw-queue-panel__hint">Add tracks to build your queue</p>
        </div>
      ) : (
        <ul className="vw-queue-panel__list" role="list">
          {queue.map((track, index) => (
            <li
              key={track.id}
              className={`vw-queue-panel__item ${nowPlaying?.id === track.id ? 'vw-queue-panel__item--playing' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
            >
              <div className="vw-queue-panel__item-number">{index + 1}</div>
              <div className="vw-queue-panel__item-info">
                <p className="vw-queue-panel__item-title">{track.title}</p>
                <p className="vw-queue-panel__item-artist">{track.artist}</p>
              </div>
              <button
                className="vw-queue-panel__item-play"
                onClick={() => onPlayTrack(track)}
                aria-label={nowPlaying?.id === track.id ? 'Pause' : 'Play'}
              >
                {nowPlaying?.id === track.id ? '❚❚' : '▶'}
              </button>
              <button
                className="vw-queue-panel__item-remove"
                onClick={() => handleRemove(track.id)}
                aria-label="Remove from queue"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};