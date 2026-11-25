import React, { useState, useEffect } from 'react';
import './App.css';
import './styles/vintage-walnut.css';
import { Sidebar } from './components/Sidebar';
import { SearchBar } from './components/SearchBar';
import { MusicCard } from './components/MusicCard';
import { MiniPlayer } from './components/MiniPlayer';
import { EmptyState } from './components/EmptyState';
import { Loading } from './components/Loading';
import { Track, Playlist, AppMode, PlatformFilter } from './types';
import { mockTracks, mockPlaylists, mockNowPlaying } from './data/mockData';
import { invoke } from '@tauri-apps/api/core';

// Tauri API 호출을 위한 타입 정의
interface AppInfo {
  name: string;
  version: string;
  mode: string;
}

function App() {
  // 앱 상태
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [currentMode, setCurrentMode] = useState<AppMode>('shell');
  
  // 라이브러리 뷰 상태
  const [currentView, setCurrentView] = useState<'all' | 'playlists' | 'favorites' | 'recently-played'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  
  // 로딩 및 오류 상태
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // 현재 재생 상태 (목업)
  const [nowPlaying, setNowPlaying] = useState(mockNowPlaying);

  // Tauri API 확인 및 초기 데이터 로드
  useEffect(() => {
    const loadAppData = async () => {
      try {
        // Tauri 환경 확인
        if ((window as any).__TAURI_INTEGRATION__) {
          const info = await invoke<AppInfo>('get_app_info');
          setAppInfo(info);
          const mode = await invoke<string>('get_current_mode');
          setCurrentMode(mode as AppMode);
        } else {
          // 개발 모드: 모의 데이터
          setAppInfo({
            name: 'OBJETUNE',
            version: '0.1.0',
            mode: 'shell',
          });
          setCurrentMode('shell');
        }
      } catch (err) {
        console.error('Failed to load app data:', err);
        setError('앱 정보를 로드하는 중 오류가 발생했습니다.');
        // 오류 시 모의 데이터 사용
        setAppInfo({
          name: 'OBJETUNE',
          version: '0.1.0',
          mode: 'shell',
        });
        setCurrentMode('shell');
      }
    };
    loadAppData();
  }, []);

  // 필터링된 트랙 목록 (목업)
  const filteredTracks: Track[] = mockTracks.filter(track => {
    const matchesSearch = track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          track.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          track.album.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPlatform = platformFilter === 'all' || track.platform === platformFilter;
    
    return matchesSearch && matchesPlatform;
  });

  // 현재 뷰에 맞는 트랙/플레이리스트
  const getDisplayItems = (): (Track | Playlist)[] => {
    switch (currentView) {
      case 'playlists':
        return mockPlaylists;
      case 'favorites':
        return [...mockTracks.filter(t => mockPlaylists.some(p => p.isFavorite && p.id === t.id))];
      case 'recently-played':
        return mockTracks.sort((a, b) => 
          new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        );
      default:
        return filteredTracks;
    }
  };

  const displayItems = getDisplayItems();
  const isPlaylistView = currentView === 'playlists';

  // 트랙 재생 핸들러 (목업)
  const handlePlatformFilter = (platform: PlatformFilter) => {
    setPlatformFilter(platform);
  };
  const handlePlay = (track: Track) => {
    setNowPlaying({
      ...mockNowPlaying,
      track,
      isPlaying: true,
    });
  };

  // 트랙 클릭 핸들러
  const handleTrackClick = (track: Track) => {
    // 목업: 단순히 nowPlaying 업데이트
    setNowPlaying(prev => ({
      ...prev,
      track,
      isPlaying: true,
    }));
  };

  // 재생/일시정지 토글
  const handlePlayPause = () => {
    setNowPlaying(prev => ({
      ...prev,
      isPlaying: !prev.isPlaying,
    }));
  };

  // 다음 트랙
  const handleNext = () => {
    const currentIndex = mockTracks.findIndex(t => t.id === nowPlaying.track.id);
    const nextIndex = (currentIndex + 1) % mockTracks.length;
    setNowPlaying(prev => ({
      ...prev,
      track: mockTracks[nextIndex],
      isPlaying: true,
      progress: 0,
    }));
  };

  // 이전 트랙
  const handlePrevious = () => {
    const currentIndex = mockTracks.findIndex(t => t.id === nowPlaying.track.id);
    const prevIndex = (currentIndex - 1 + mockTracks.length) % mockTracks.length;
    setNowPlaying(prev => ({
      ...prev,
      track: mockTracks[prevIndex],
      isPlaying: true,
      progress: 0,
    }));
  };

  return (
    <div className="vw-root">
      {/* 사이드바 */}
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView}
      />
      
      {/* 메인 컨텐츠 */}
      <div className="vw-main">
        {/* 검색 바 */}
        <SearchBar
          value={searchQuery}
          onSearch={setSearchQuery}
          platformFilter={platformFilter}
          onPlatformFilter={handlePlatformFilter}
        />
        
        {/* 컨텐츠 영역 */}
        <main className="vw-content" role="main">
          <div className="vw-content__header">
            <h1 className="vw-content__title">
              {currentView === 'all' && 'Library'}
              {currentView === 'playlists' && 'Playlists'}
              {currentView === 'favorites' && 'Favorites'}
              {currentView === 'recently-played' && 'Recently Played'}
            </h1>
          </div>
          
          {/* 로딩 중 */}
          {isLoading && <Loading message="Loading music library..." />}
          
          {/* 오류 상태 */}
          {error && !isLoading && (
            <div className="vw-error" role="alert">
              <p>{error}</p>
            </div>
          )}
          
          {/* 빈 상태 */}
          {!isLoading && !error && displayItems.length === 0 && (
            <EmptyState
              title="No music found"
              description="Try adjusting your search or filter criteria"
            />
          )}
          
          {/* 결과 목록 */}
          {!isLoading && !error && displayItems.length > 0 && (
            <div className="vw-library-grid">
              {displayItems.map((item) => {
                if (isPlaylistView) {
                  const playlist = item as Playlist;
                  return (
                    <div
                      key={playlist.id}
                      className="vw-music-card vw-music-card--playlist"
                      role="button"
                      tabIndex={0}
                      aria-label={playlist.name}
                    >
                      <div className="vw-music-card__image" />
                      <div className="vw-music-card__info">
                        <h3 className="vw-music-card__title">{playlist.name}</h3>
                        <p className="vw-music-card__artist">{playlist.description}</p>
                        <p className="vw-music-card__album">{playlist.trackCount} tracks • {new Date(playlist.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  );
                }
                
                const track = item as Track;
                return (
                  <MusicCard
                    key={track.id}
                    track={track}
                    onPlay={handlePlay}
                    onClick={handleTrackClick}
                  />
                );
              })}
            </div>
          )}
        </main>
        
        {/* 미니 플레이어 */}
        <MiniPlayer
          nowPlaying={nowPlaying}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />
      </div>
    </div>
  );
}

export default App;