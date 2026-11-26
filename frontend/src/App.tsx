import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import './styles/vintage-walnut.css';
import './components/Turntable.css';
import './components/VinylRecord.css';
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
  PlaybackState,
  NowPlaying
} from './types';
import { 
  mockTracks, 
  mockPlaylists, 
  mockNowPlaying
} from './data/mockData';
import { 
  loadYouTubeAPI, 
  loadSoundCloudAPI,
  validateSoundCloudUrl,
  fetchSoundCloudTrackByUrl,
  PlatformSearchResult
} from './services/platformAdapter';
import { playerManager } from './services/playerManager';
import { 
  createTrack,
  createPlaylist,
  getPlaylists,
  getAllTracks,
  getFavorites,
  getHistory,
  addFavorite,
  removeFavorite,
  addToHistory,
  getSetting,
  setSetting,
  getQueue,
  checkTauri,
} from './services/tauriApi';
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
    embedUrl: track.embedUrl,
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
  
  // 현재 재생 상태
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(mockNowPlaying);
  
  // 턴테이블 모드 재생 상태
  const [turntablePlaybackState, setTurntablePlaybackState] = useState<PlaybackState>('stopped');

  // 로컬 트랙 및 플레이리스트
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [localPlaylists, setLocalPlaylists] = useState<Playlist[]>([]);

  // 턴테이블 설정
  const [turntableSettings, setTurntableSettings] = useState<TurntableSettings>({
    dynamicVinylLabel: false,
  });

  // Tauri API 확인 및 초기 데이터 로드
  useEffect(() => {
    const loadAppData = async () => {
      try {
        // Tauri 환경 확인
        if (await checkTauri()) {
          const mode = await invoke<string>('get_current_mode');
          setCurrentMode(mode as AppMode);
          
          // 로컬 데이터 로드
          const [tracks, playlists] = await Promise.all([
            getAllTracks(),
            getPlaylists()
          ]);
          
          setLocalTracks(tracks.length > 0 ? tracks : mockTracks);
          setLocalPlaylists(playlists.length > 0 ? playlists : mockPlaylists);
        } else {
          // 개발 모드: 모의 데이터
          setCurrentMode('shell');
          setLocalTracks(mockTracks);
          setLocalPlaylists(mockPlaylists);
        }
      } catch (err) {
        console.error('Failed to load app data:', err);
        setError('앱 정보를 로드하는 중 오류가 발생했습니다.');
        // 오류 시 모의 데이터 사용
        setCurrentMode('shell');
        setLocalTracks(mockTracks);
        setLocalPlaylists(mockPlaylists);
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

  // 필터링된 트랙 목록
  const filteredTracks: Track[] = localTracks.filter(track => {
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
        return localPlaylists;
      case 'favorites':
        return localTracks.filter(t => localTracks.some(t2 => t2.isFavorite && t2.id === t.id));
      case 'recently-played':
        return [...localTracks].sort((a, b) => 
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

  // PlayerManager 상태 구독
  useEffect(() => {
    const subscriptions: Array<() => void> = [];
    
    subscriptions.push(playerManager.on('play', (event) => {
      setTurntablePlaybackState('playing');
    }).unsubscribe);

    subscriptions.push(playerManager.on('pause', (event) => {
      setTurntablePlaybackState('paused');
    }).unsubscribe);

    subscriptions.push(playerManager.on('end', (event) => {
      setTurntablePlaybackState('stopped');
    }).unsubscribe);

    subscriptions.push(playerManager.on('error', (event) => {
      const errMsg = (event as any)?.message || '재생 오류가 발생했습니다';
      setError(errMsg);
    }).unsubscribe);

    return () => {
      subscriptions.forEach(unsub => unsub());
    };
  }, []);

  // 트랙 재생 핸들러
  const handlePlay = async (track: Track) => {
    try {
      await playerManager.load(track);
      await playerManager.play();
      
      setNowPlaying({
        ...mockNowPlaying,
        track,
        isPlaying: true,
      });
      setTurntablePlaybackState('playing');

      // 히스토리 추가
      await addToHistory(track.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : '재생 중 오류가 발생했습니다';
      setError(message);
    }
  };

  // SoundCloud URL에서 추가된 트랙 처리
  const handleSoundCloudTrackAdded = async (track: PlatformSearchResult) => {
    try {
      // Tauri DB에 저장
      const savedTrack = await createTrack({
        platform: track.platform,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        thumbnail: track.thumbnail,
        url: track.url,
        embedUrl: track.embedUrl,
        coverArtUrl: track.thumbnail,
        addedAt: new Date().toISOString(),
        isFavorite: false,
      });

      if (savedTrack) {
        setLocalTracks(prev => [...prev, savedTrack]);
      }

      // 플레이어 로드 및 재생
      await playerManager.load(savedTrack || {
        ...track,
        isPlayable: true,
        addedAt: new Date().toISOString(),
      } as Track);
      
      await playerManager.play();
      
      setNowPlaying(prev => ({
        ...prev,
        track: savedTrack || { ...track } as Track,
        isPlaying: true,
      }));
      setTurntablePlaybackState('playing');

      setError('트랙이 추가되었습니다.');
      setTimeout(() => setError(null), 2000);
    } catch (err: any) {
      setError(err.message || '트랙 추가 중 오류가 발생했습니다');
    }
  };

  // 트랙 클릭 핸들러
  const handleTrackClick = async (track: Track) => {
    try {
      await playerManager.load(track);
      await playerManager.play();
      
      setNowPlaying(prev => ({
        ...prev,
        track,
        isPlaying: true,
      }));
      setTurntablePlaybackState('playing');

      // 히스토리 추가
      await addToHistory(track.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : '트랙 클릭 중 오류가 발생했습니다';
      setError(message);
    }
  };

  // 재생/일시정지 토글
  const handlePlayPause = async () => {
    try {
      if (nowPlaying.isPlaying) {
        await playerManager.pause();
        setTurntablePlaybackState('paused');
      } else {
        if (nowPlaying.track) {
          await playerManager.play();
          setTurntablePlaybackState('playing');
        }
      }
      
      setNowPlaying(prev => ({
        ...prev,
        isPlaying: !prev.isPlaying,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '재생 제어 중 오류가 발생했습니다';
      setError(message);
    }
  };

  // 다음 트랙
  const handleNext = () => {
    const currentIndex = localTracks.findIndex(t => t.id === nowPlaying.track.id);
    if (currentIndex === -1) return;
    
    const nextIndex = (currentIndex + 1) % localTracks.length;
    const nextTrack = localTracks[nextIndex];
    handleTrackClick(nextTrack);
  };

  // 이전 트랙
  const handlePrevious = () => {
    const currentIndex = localTracks.findIndex(t => t.id === nowPlaying.track.id);
    if (currentIndex === -1) return;
    
    const prevIndex = (currentIndex - 1 + localTracks.length) % localTracks.length;
    const prevTrack = localTracks[prevIndex];
    handleTrackClick(prevTrack);
  };

  // 즐겨찾기 토글
  const handleFavoriteToggle = async (track: Track) => {
    const trackId = track.id;
    const isFavorited = track.isFavorite;
    
    let success = false;
    if (isFavorited) {
      success = await removeFavorite(trackId);
    } else {
      success = await addFavorite(trackId);
    }
    
    if (success) {
      setLocalTracks(prev => prev.map(t => 
        t.id === trackId ? { ...t, isFavorite: !t.isFavorite } : t
      ));
    }
  };

  // 턴테이블 설정 토글
  const handleToggleDynamicVinylLabel = () => {
    const newSettings = { ...turntableSettings, dynamicVinylLabel: !turntableSettings.dynamicVinylLabel };
    setTurntableSettings(newSettings);
    localStorage.setItem('turntable-settings', JSON.stringify(newSettings));
    
    // Tauri에도 저장
    setSetting('dynamicVinylLabel', String(!turntableSettings.dynamicVinylLabel));
  };

  // 컴포넌트 언마운트 시 플레이어 정리
  useEffect(() => {
    return () => {
      playerManager.destroy();
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
      
      {/* SoundCloud Player Container (숨겨진 위젯용) */}
      <div id="soundcloud-player-container" style={{ display: 'none', width: '100%', height: '0' }} />
      
      {/* YouTube Player Container */}
      <div id="youtube-player-container" style={{ display: 'none', width: '100%', height: '0' }} />
      
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
              onPlatformFilter={setPlatformFilter}
              onSoundCloudTrackAdded={handleSoundCloudTrackAdded}
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
                        onFavoriteToggle={handleFavoriteToggle}
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