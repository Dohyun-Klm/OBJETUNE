import React, { useState, useEffect, useCallback } from 'react';
import './PlaylistPanel.css';
import { Playlist, Track } from '../types';
import { getPlaylists, getPlaylistTracks, addTrackToPlaylist, removeTrackFromPlaylist, deletePlaylist } from '../services/tauriApi';
import { getAllTracks } from '../services/tauriApi';

interface PlaylistPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: 'all' | 'playlists' | 'favorites' | 'recently-played' | 'queue';
  onViewChange: (view: 'all' | 'playlists' | 'favorites' | 'recently-played' | 'queue') => void;
  selectedPlaylistId: string | null;
  onTrackClick?: (track: Track) => void;
  onSoundCloudUrlSubmit?: (url: string) => Promise<void>;
}

// SVG 아이콘 컴포넌트
const Icon: React.FC<{ name: string; className?: string; color?: string }> = ({ name, className = '', color = 'currentColor' }) => {
  const icons: Record<string, React.ReactNode> = {
    close: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
      </svg>
    ),
    playlist: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
      </svg>
    ),
    music: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <path d="M3 9h18" strokeLinecap="round" />
        <path d="M3 13h18" strokeLinecap="round" />
      </svg>
    ),
    arrowUp: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" />
      </svg>
    ),
    arrowDown: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" />
      </svg>
    ),
    play: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <polygon points="6 4 6 20 16 12 6 4" />
      </svg>
    ),
    trash: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <polyline points="3 6 5 6 5 20 19 20" />
        <path d="M19 6l-2 14" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    ),
    soundcloud: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.51 0 10-4.48 10-10S17.51 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    ),
  };

  const IconComponent = icons[name];
  return IconComponent ? (
    <span className={`vw-playlist-panel__icon ${className}`} aria-hidden="true" style={{ color }}>
      {IconComponent}
    </span>
  ) : null;
};

export const PlaylistPanel: React.FC<PlaylistPanelProps> = ({
  isOpen,
  onClose,
  currentView,
  onViewChange,
  selectedPlaylistId,
  onTrackClick,
  onSoundCloudUrlSubmit,
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [soundCloudUrl, setSoundCloudUrl] = useState('');
  const [loadingTracks, setLoadingTracks] = useState(false);

  // 로컬 스토리지에서 플레이리스트 데이터 로드 (모킹용)
  const loadMockPlaylists = () => {
    return [
      { id: '1', name: 'Favorites', description: 'My favorite tracks', trackCount: 0, updatedAt: Date.now(), created_at: Date.now() },
      { id: '2', name: 'Recently Added', description: 'Recently added tracks', trackCount: 0, updatedAt: Date.now(), created_at: Date.now() },
      { id: '3', name: 'Chill Vibes', description: 'Relaxing tracks', trackCount: 0, updatedAt: Date.now(), created_at: Date.now() },
    ];
  };

  // 플레이리스트 및 트랙 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        // Tauri API 확인 후 로드
        const avail = await import('../services/tauriApi').then(m => m.checkTauri?.() ?? true);
        
        if (avail) {
          const [p, t] = await Promise.all([getPlaylists(), getAllTracks()]);
          setPlaylists(p.length > 0 ? p : loadMockPlaylists());
          setAllTracks(t.length > 0 ? t : []);
        } else {
          setPlaylists(loadMockPlaylists());
          setAllTracks([]);
        }
      } catch {
        setPlaylists(loadMockPlaylists());
        setAllTracks([]);
      }
    };
    loadData();
  }, []);

  // 선택된 플레이리스트의 트랙 로드
  useEffect(() => {
    const loadPlaylistTracks = async () => {
      if (!selectedPlaylistId) {
        setPlaylistTracks([]);
        return;
      }

      setLoadingTracks(true);
      try {
        const tracks = await getPlaylistTracks(selectedPlaylistId);
        setPlaylistTracks(tracks);
      } catch {
        // 모의 데이터 사용
        const mockTracks = allTracks.filter(t => (t as any).playlistId === selectedPlaylistId);
        setPlaylistTracks(mockTracks.length > 0 ? mockTracks : allTracks.slice(0, 10));
      } finally {
        setLoadingTracks(false);
      }
    };
    loadPlaylistTracks();
  }, [selectedPlaylistId, allTracks]);

  // 트랙 드래그 핸들러
  const handleDragEnd = async (dragIndex: number, dropIndex: number) => {
    if (!selectedPlaylistId || dropIndex < 0 || dropIndex >= playlistTracks.length) return;

    const tracks = [...playlistTracks];
    const [moved] = tracks.splice(dragIndex, 1);
    tracks.splice(dropIndex, 0, moved);
    setPlaylistTracks(tracks);

    // 순서 변경은 실제로는 별도 API로 구현해야 함
    // 여기서는 로컬 상태만 업데이트
  };

  // SoundCloud URL 제출
  const handleSoundCloudSubmit = async () => {
    if (!soundCloudUrl.trim() || !onSoundCloudUrlSubmit) return;

    try {
      await onSoundCloudUrlSubmit(soundCloudUrl);
      setSoundCloudUrl('');
    } catch (err) {
      console.error('SoundCloud URL 처리 실패:', err);
    }
  };

  // 플레이리스트 삭제
  const handleDeletePlaylist = async (playlistId: string) => {
    if (!window.confirm('Delete this playlist?')) return;
    
    try {
      await deletePlaylist(playlistId);
      setPlaylists(prev => prev.filter(p => p.id !== playlistId));
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  };

  // 트랙 삭제
  const handleRemoveTrack = async (trackId: string) => {
    if (!selectedPlaylistId) return;
    
    try {
      await removeTrackFromPlaylist(selectedPlaylistId, trackId);
      setPlaylistTracks(prev => prev.filter(t => t.id !== trackId));
    } catch (err) {
      console.error('Failed to remove track:', err);
    }
  };

  // 현재 뷰에 맞는 항목 목록 반환
  const getDisplayItems = (): (Track | Playlist)[] => {
    switch (currentView) {
      case 'playlists':
        if (selectedPlaylistId) {
          return playlistTracks;
        }
        return playlists;
      case 'favorites':
        return allTracks.filter(t => t.isFavorite);
      case 'recently-played':
        return [...allTracks].sort((a, b) => 
          new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        );
      default:
        return [];
    }
  };

  const displayItems = getDisplayItems();
  const isPlaylistView = currentView === 'playlists';
  const showTracks = isPlaylistView && selectedPlaylistId;

  if (!isOpen) return null;

  return (
    <div className="vw-playlist-panel" role="dialog" aria-modal="true">
      {/* 헤더 */}
      <div className="vw-playlist-panel__header">
        <h2 className="vw-playlist-panel__title">
          {showTracks ? 'Playlist Tracks' : 'Playlists'}
        </h2>
        <button
          className="vw-playlist-panel__btn vw-playlist-panel__btn--close"
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="close" />
        </button>
      </div>

      {/* 플레이리스트 목록 또는 트랙 목록 */}
      <div className="vw-playlist-panel__content">
        {!showTracks && playlists.map(playlist => (
          <div
            key={playlist.id}
            className={`vw-playlist-item ${selectedPlaylistId === playlist.id ? 'vw-playlist-item--active' : ''}`}
            onClick={() => onViewChange('playlists')}
          >
            <div className="vw-playlist-item__info">
              <Icon name="playlist" className="vw-playlist-item__icon" />
              <div>
                <h3 className="vw-playlist-item__name">{playlist.name}</h3>
                <p className="vw-playlist-item__desc">{playlist.description}</p>
              </div>
            </div>
            <div className="vw-playlist-item__actions">
              <span className="vw-playlist-item__count">{playlist.trackCount} tracks</span>
              <button
                className="vw-playlist-item__delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeletePlaylist(playlist.id);
                }}
                aria-label="Delete playlist"
              >
                <Icon name="trash" />
              </button>
            </div>
          </div>
        ))}

        {/* 트랙 목록 */}
        {showTracks && (
          <div className="vw-playlist-panel__tracks">
            <button
              className="vw-playlist-panel__back-btn"
              onClick={() => onViewChange('playlists')}
              aria-label="Back to playlists"
            >
              <Icon name="arrowUp" />
              Back to Playlists
            </button>

            {loadingTracks ? (
              <div className="vw-playlist-panel__loading">Loading tracks...</div>
            ) : (
              playlistTracks.map((track, index) => (
                <div
                  key={track.id}
                  className="vw-playlist-panel__track-item"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', index.toString());
                  }}
                  onClick={() => onTrackClick?.(track)}
                >
                  <div className="vw-playlist-panel__track-info">
                    <Icon name="music" className="vw-playlist-panel__track-icon" />
                    <div className="vw-playlist-panel__track-details">
                      <h4 className="vw-playlist-panel__track-title">{track.title}</h4>
                      <p className="vw-playlist-panel__track-artist">{track.artist}</p>
                    </div>
                  </div>
                  <button
                    className="vw-playlist-panel__remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTrack(track.id);
                    }}
                    aria-label="Remove track"
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* SoundCloud URL 추가 폼 */}
      <div className="vw-playlist-panel__footer">
        <div className="vw-playlist-panel__soundcloud-form">
          <Icon name="soundcloud" className="vw-playlist-panel__soundcloud-icon" color="#ff5500" />
          <input
            type="text"
            className="vw-playlist-panel__url-input"
            placeholder="SoundCloud track URL"
            value={soundCloudUrl}
            onChange={(e) => setSoundCloudUrl(e.target.value)}
          />
          <button
            className="vw-playlist-panel__add-btn"
            onClick={handleSoundCloudSubmit}
            disabled={loadingTracks || !soundCloudUrl.trim()}
          >
            <Icon name="play" />
          </button>
        </div>
      </div>
    </div>
  );
};