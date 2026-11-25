import React, { useState, useEffect } from 'react';
import './App.css';
import './styles/vintage-walnut.css';
import './components/Turntable.css';
import './components/VinylRecord.css';
import './components/Settings.css';
import { Sidebar } from './components/Sidebar';
import { SearchBar } from './components/SearchBar';
import { MusicCard } from './components/MusicCard';
import { MiniPlayer } from './components/MiniPlayer';
import { EmptyState } from './components/EmptyState';
import { Settings } from './components/Settings';
import { Turntable } from './components/Turntable';
import { 
  Track, 
  Playlist, 
  AppMode, 
  PlatformFilter, 
  TurntableSettings, 
  PlaybackState
} from './types';
import { 
  mockTracks, 
  mockPlaylists, 
  mockNowPlaying
} from './data/mockData';
import { 
  platformManager, 
  loadYouTubeAPI, 
  loadSoundCloudAPI,
  PlatformSearchResult
} from './services/platformAdapter';
import { invoke } from '@tauri-apps/api/core';

// 목업용 Track을 PlatformSearchResult로 변환
function mockToPlatformResult(track: Track): PlatformSearchResult {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    thumbnail: track.thumbnail,
    platform: track.platform === 'youtube' ? 'youtube' : 'soundcloud',
    url: track.url,
    embedUrl: track.url,
    publishedAt: undefined,
    isPlayable: true,
  };
}

function App() {
  // 앱 상태
  const [currentMode, setCurrentMode] = useState<AppMode>('shell');
  
  // 라이브러리 뷰 상태
  const [currentView, setCurrentView] = useState<'all' | 'playlists' | 'favorites' | 'recently-played'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  
  // 로딩 및 오류 상태
  const [error, setError] = useState<string | null>(null);
  
  // 현재 재생 상태 (목업)
  const [nowPlaying, setNowPlaying] = useState(mockNowPlaying);
  
  // 턴테이블 모드 재생 상태
  const [turntablePlaybackState, setTurntablePlaybackState] = useState<PlaybackState>('stopped');

  // Tauri API 확인 및 초기 데이터 로드
  useEffect(() => {
    const loadAppData = async () => {
      try {
        // Tauri 환경 확인
        if ((window as any).__TAURI_INTEGRATION__) {
          const mode = await invoke<string>('get_current_mode');
          setCurrentMode(mode as AppMode);
        } else {
          // 개발 모드: 모의 데이터
          setCurrentMode('shell');
        }
      } catch (err) {
        console.error('Failed to load app data:', err);
        setError('앱 정보를 로드하는 중 오류가 발생했습니다.');
        // 오류 시 모의 데이터 사용
        setCurrentMode('shell');
      }
    };
    loadAppData();
    
    // 로컬스토리지에서 턴테이블 설정 로드
    try {
      const savedSettings = localStorage.getItem('turntable-settings');
      if (savedSettings) {
        setTurntableSettings(JSON.parse(savedSettings));
      }
    } catch {
      // 로드 실패 시 기본값 사용
    }
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
  const isTurntableMode = currentMode === 'turntable';

  // 플랫폼 API 로드
  useEffect(() => {
    const loadAPIs = async () => {
      try {
        // YouTube API 로드
        await loadYouTubeAPI();
        // SoundCloud API 로드
        await loadSoundCloudAPI();
      } catch (err) {
        console.error('플러그인 로드 실패:', err);
      }
    };
    loadAPIs();
  }, []);

  // 플랫폼 어댑터 이벤트 구독
  useEffect(() => {
    const subscriptions: Array<() => void> = [];
    
    subscriptions.push(platformManager.on('play', (event) => {
    }).unsubscribe);

    subscriptions.push(platformManager.on('pause', (event) => {
    }).unsubscribe);

    subscriptions.push(platformManager.on('end', (event) => {
    }).unsubscribe);

    subscriptions.push(platformManager.on('error', (event) => {
      const errMsg = (event as any)?.message || '재생 오류가 발생했습니다';
      setError(errMsg);
    }).unsubscribe);

    return () => {
      subscriptions.forEach(unsub => unsub());
    };
  }, []);

  // 플랫폼 필터 핸들러
  const handlePlatformFilter = (platform: PlatformFilter) => {
    setPlatformFilter(platform);
  };

  // 트랙 재생 핸들러 (목업 -> 실제 어댑터 연동)
  const handlePlay = async (track: Track) => {
    try {
      const platformTrack = mockToPlatformResult(track);
      
      // 플랫폼 어댑터로 전환 및 로드
      await platformManager.switchPlatform(platformTrack.platform, platformTrack);
      
      setNowPlaying({
        ...mockNowPlaying,
        track,
        isPlaying: true,
      });
      setTurntablePlaybackState('playing');
    } catch (err) {
      const message = err instanceof Error ? err.message : '재생 중 오류가 발생했습니다';
      setError(message);
    }
  };

  // 트랙 클릭 핸들러
  const handleTrackClick = async (track: Track) => {
    try {
      const platformTrack = mockToPlatformResult(track);
      
      // 이미 로드된 플레이어가 있다면 정지하고 새로 로드
      await platformManager.switchPlatform(platformTrack.platform, platformTrack);
      
      setNowPlaying(prev => ({
        ...prev,
        track,
        isPlaying: true,
      }));
      setTurntablePlaybackState('playing');
    } catch (err) {
      const message = err instanceof Error ? err.message : '트랙 클릭 중 오류가 발생했습니다';
      setError(message);
    }
  };

  // 재생/일시정지 토글
  const handlePlayPause = async () => {
    try {
      const adapter = platformManager.getCurrentAdapter();
      if (!adapter) {
        // 모의 동작
        const newState = nowPlaying.isPlaying ? 'stopped' : 'playing';
        setNowPlaying(prev => ({
          ...prev,
          isPlaying: !prev.isPlaying,
        }));
        setTurntablePlaybackState(newState);
        return;
      }

      const state = await adapter.getState();
      
      if (state === 'playing' || state === 'paused') {
        await adapter.pause();
        setTurntablePlaybackState(prev => 
          prev === 'playing' ? 'paused' : 'playing'
        );
        setNowPlaying(prev => ({
          ...prev,
          isPlaying: !prev.isPlaying,
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '재생 제어 중 오류가 발생했습니다';
      setError(message);
    }
  };

  // 다음 트랙
  const handleNext = () => {
    const currentIndex = mockTracks.findIndex(t => t.id === nowPlaying.track.id);
    const nextIndex = (currentIndex + 1) % mockTracks.length;
    
    // 목업 트랙 재생
    const nextTrack = mockTracks[nextIndex];
    handleTrackClick(nextTrack);
    
    setNowPlaying(prev => ({
      ...prev,
      track: nextTrack,
      isPlaying: true,
      progress: 0,
    }));
    setTurntablePlaybackState('playing');
  };

  // 이전 트랙
  const handlePrevious = () => {
    const currentIndex = mockTracks.findIndex(t => t.id === nowPlaying.track.id);
    const prevIndex = (currentIndex - 1 + mockTracks.length) % mockTracks.length;
    
    // 목업 트랙 재생
    const prevTrack = mockTracks[prevIndex];
    handleTrackClick(prevTrack);
    
    setNowPlaying(prev => ({
      ...prev,
      track: prevTrack,
      isPlaying: true,
      progress: 0,
    }));
    setTurntablePlaybackState('playing');
  };

  // 턴테이블 설정 토글
  const [turntableSettings, setTurntableSettings] = useState<TurntableSettings>({
    dynamicVinylLabel: false,
  });

  const handleToggleDynamicVinylLabel = () => {
    const newSettings = { ...turntableSettings, dynamicVinylLabel: !turntableSettings.dynamicVinylLabel };
    setTurntableSettings(newSettings);
    localStorage.setItem('turntable-settings', JSON.stringify(newSettings));
  };

  // 컴포넌트 언마운트 시 플레이어 정리
  useEffect(() => {
    return () => {
      platformManager.destroy();
    };
  }, []);

  return (
    <div className="vw-root">
      {/* 사이드바 */}
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView}
        currentMode={currentMode}
        onModeChange={(mode) => setCurrentMode(mode)}
      />
      
      {/* 메인 컨텐츠 */}
      <div className="vw-main">
        {/* 턴테이블 모드 뷰 */}
        {isTurntableMode && (
          <div className="vw-turntable-container">
            <Turntable
              nowPlaying={nowPlaying}
              playbackState={turntablePlaybackState}
              onPlayPause={handlePlayPause}
              showPlayButton={false}
              className="vw-turntable--mode"
            />
            <Settings
              settings={turntableSettings}
              onToggleDynamicVinylLabel={handleToggleDynamicVinylLabel}
              className="vw-turntable-settings"
            />
          </div>
        )}
        
        {/* 라이브러리 모드 뷰 */}
        {!isTurntableMode && (
          <>
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
              
              {/* 오류 상태 */}
              {error && (
                <div className="vw-error" role="alert">
                  <p>{error}</p>
                </div>
              )}
              
              {/* 빈 상태 */}
              {!error && displayItems.length === 0 && (
                <EmptyState
                  title="No music found"
                  description="Try adjusting your search or filter criteria"
                />
              )}
              
              {/* 결과 목록 */}
              {!error && displayItems.length > 0 && (
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
          </>
        )}
      </div>
    </div>
  );
}

export default App;