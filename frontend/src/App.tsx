import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import './styles/vintage-walnut.css';
import './components/Turntable.css';
import './components/VinylRecord.css';
import { Sidebar } from './components/Sidebar';
import { SearchBar } from './components/SearchBar';
import { MusicCard } from './components/MusicCard';
import { MiniPlayer } from './components/MiniPlayer';
import { QueuePanel } from './components/QueuePanel';
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
  NowPlaying,
  CurrentView,
} from './types';
import {
  loadYouTubeAPI, 
  loadSoundCloudAPI
} from './services/platformAdapter';
import { setMode as setTauriMode } from './services/tauriApi';
import { playerManager } from './services/playerManager';
import {
  createTrack,
  getPlaylists,
  getAllTracks,
  getFavorites,
  getHistory,
  addFavorite,
  removeFavorite,
  addToHistory,
  addToQueue,
  getQueue,
  setSetting,
  checkTauri,
  getWindowSize,
  setWindowSize,
  getWindowPosition,
  setWindowPosition,
  getAlwaysOnTop,
  setAlwaysOnTop,
  isMaximized,
  getShuffle,
  setShuffle,
  getRepeat,
  setRepeat,
  getCurrentMode,
  registerMediaShortcuts,
  unregisterMediaShortcuts
} from './services/tauriApi';
import { searchYouTubeTracks } from './services/tauriApi';

// Tauri API는 동적으로 가져오기 (테스트 환경에서 모킹 가능)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tauriWindow = typeof window !== 'undefined' && (window as any).__TAURI_INTEGRATION__
  ? require('@tauri-apps/api/window')
  : null;

function App() {
  // 앱 상태
  const [currentMode, setCurrentMode] = useState<AppMode>('shell');
  
  // 라이브러리 뷰 상태
  const [currentView, setCurrentView] = useState<CurrentView>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('youtube');
  
  // 로딩 및 오류 상태
  const [error, setError] = useState<string | null>(null);
  
  // 현재 재생 상태 - 빈 상태에서 시작
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>({
    track: {
      id: '',
      platform: 'youtube',
      title: '',
      artist: '',
      album: '',
      duration: 0,
      thumbnail: '',
      url: '',
      embedUrl: '',
      isPlayable: true,
      addedAt: new Date().toISOString(),
    },
    isPlaying: false,
    volume: 75,
    progress: 0,
    duration: 0,
    shuffle: false,
    repeat: 'off',
  });
  
  // 턴테이블 모드 재생 상태
  const [turntablePlaybackState, setTurntablePlaybackState] = useState<PlaybackState>('stopped');

  // 로컬 트랙 및 플레이리스트
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [localPlaylists, setLocalPlaylists] = useState<Playlist[]>([]);
  
  // API 데이터: 즐겨찾기 및 최근 재생 기록
  const [favoritesData, setFavoritesData] = useState<Track[]>([]);
  const [historyData, setHistoryData] = useState<Track[]>([]);

  // 턴테이블 설정
  const [turntableSettings, setTurntableSettings] = useState<TurntableSettings>({
    dynamicVinylLabel: false,
  });

  // 큐 패널 상태
  const [queuePanelOpen, setQueuePanelOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [queue, setQueue] = useState<Track[]>([]);

  // Tauri API 확인 및 초기 데이터 로드
  useEffect(() => {
    const loadAppData = async () => {
      try {
        // Tauri 환경 확인
        if (await checkTauri()) {
          const mode = await getCurrentMode();
          setCurrentMode(mode);
          
          // 로컬 데이터 로드 (트랙, 플레이리스트, 즐겨찾기, 히스토리 동시 로드)
          const [tracks, playlists, favorites, history] = await Promise.all([
            getAllTracks(),
            getPlaylists(),
            getFavorites(),
            getHistory(100)
          ]);
          
          setLocalTracks(tracks.length > 0 ? tracks : []);
          setLocalPlaylists(playlists.length > 0 ? playlists : []);
          setFavoritesData(favorites);
          setHistoryData(history);
          
          // 재생 설정 로드 (셔플/반복)
          const [shuffle, repeat] = await Promise.all([
            getShuffle(),
            getRepeat()
          ]);
          setNowPlaying(prev => ({ ...prev, shuffle, repeat }));
        } else {
          // 개발 모드: 빈 상태
          setCurrentMode('shell');
          setLocalTracks([]);
          setLocalPlaylists([]);
        }
      } catch (err) {
        console.error('Failed to load app data:', err);
        setError('앱 정보를 로드하는 중 오류가 발생했습니다.');
        // 오류 시 빈 상태 사용
        setCurrentMode('shell');
        setLocalTracks([]);
        setLocalPlaylists([]);
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
    
    // 글로벌 미디어 단축키 등록
    const shortcutsPromise = registerMediaShortcuts();
    if (shortcutsPromise && typeof shortcutsPromise.catch === 'function') {
      shortcutsPromise.catch(err => {
        console.error('Failed to register media shortcuts:', err);
      });
    }
    
    return () => {
      const unregPromise = unregisterMediaShortcuts();
      if (unregPromise && typeof unregPromise.catch === 'function') {
        unregPromise.catch(err => {
          console.error('Failed to unregister media shortcuts:', err);
        });
      }
    };
  }, []);

  // 필터링된 트랙 목록
  const filteredTracks: Track[] = localTracks.filter(track => {
    const matchesSearch = track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          track.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          track.album.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  // 현재 뷰에 맞는 트랙/플레이리스트
  const getDisplayItems = (): (Track | Playlist)[] => {
    switch (currentView) {
      case 'playlists':
        return localPlaylists;
      case 'favorites':
        // API 데이터 사용: getFavorites()로 가져온 즐겨찾기 목록
        if (favoritesData.length > 0) {
          return favoritesData.map(favTrack => {
            // 로컬 트랙의 추가 정보 보완 (플랫폼 필터, 검색 결과 등)
            const localTrack = localTracks.find(t => t.id === favTrack.id);
            return localTrack ? { ...favTrack, ...localTrack } : favTrack;
          });
        }
        return localTracks.filter(t => t.isFavorite);
      case 'recently-played':
        // API 데이터 사용: getHistory()로 가져온 재생 기록
        if (historyData.length > 0) {
          // 히스토리에서 중복 제거 (최신순으로 정렬)
          const uniqueTracks: Track[] = [];
          const seenIds = new Set<string>();
          for (const track of historyData) {
            if (!seenIds.has(track.id)) {
              seenIds.add(track.id);
              uniqueTracks.push(track);
            }
          }
          return uniqueTracks;
        }
        // 히스토리가 없으면 로컬 트랙의 addedAt 기준 정렬
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
  const turntableTrack = nowPlaying.track;
  const [tonearmPosition, setTonearmPosition] = useState<{ track: Track; progress: number } | null>(null);

  useEffect(() => {
    if (!isTurntableMode || !turntableTrack.id || turntablePlaybackState === 'stopped') {
      setTonearmPosition(null);
      return;
    }

    const updatePosition = () => {
      if (playerManager.getCurrentTrack()?.id !== turntableTrack.id) return;
      const elapsed = playerManager.getCurrentTimeSync();
      const duration = playerManager.getDurationSync();
      if (Number.isFinite(elapsed) && Number.isFinite(duration) && duration > 0) {
        setTonearmPosition({ track: turntableTrack, progress: elapsed / duration });
      }
    };

    updatePosition();
    if (turntablePlaybackState !== 'playing') return;
    const timer = window.setInterval(updatePosition, 250);
    return () => window.clearInterval(timer);
  }, [isTurntableMode, turntableTrack, turntablePlaybackState]);

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
    
    const playSub = playerManager.on('play', (event) => {
      setTurntablePlaybackState('playing');
    });
    if (playSub && typeof playSub.unsubscribe === 'function') {
      subscriptions.push(playSub.unsubscribe);
    }

    const pauseSub = playerManager.on('pause', (event) => {
      setTurntablePlaybackState('paused');
    });
    if (pauseSub && typeof pauseSub.unsubscribe === 'function') {
      subscriptions.push(pauseSub.unsubscribe);
    }

    const endSub = playerManager.on('end', (event) => {
      setTurntablePlaybackState('stopped');
    });
    if (endSub && typeof endSub.unsubscribe === 'function') {
      subscriptions.push(endSub.unsubscribe);
    }

    const errorSub = playerManager.on('error', (event) => {
      const errMsg = (event as any)?.message || '재생 오류가 발생했습니다';
      setError(errMsg);
      setTurntablePlaybackState('stopped');
    });
    if (errorSub && typeof errorSub.unsubscribe === 'function') {
      subscriptions.push(errorSub.unsubscribe);
    }

    return () => {
      subscriptions.forEach(unsub => unsub());
    };
  }, []);

  // Tauri 창 상태 복원
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!tauriWindow || !(window as any).__TAURI_INTEGRATION__) return;  // Tauri가 아니면 건너뛰기
    
    const initWindow = async () => {
      await restoreWindowState();
    };
    initWindow();
    
    // 창 resize/move 이벤트 구독 (Tauri 2)
    // Tauri 2에서는 Window API를 통해 이벤트 구독
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const win = tauriWindow.getCurrentWindow();
    /* eslint-enable @typescript-eslint/no-unused-vars */
    
    // 창 상태 변경 감지 및 저장
    const handleWindowStateChange = async () => {
      await saveWindowState();
    };
    
    win.onResized(handleWindowStateChange);
    win.onMoved(handleWindowStateChange);
    
    return () => {
      // 이벤트 구독 해제는 자동으로 처리됨
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Tauri 모드 변경 이벤트 리스너
  useEffect(() => {
    if (!tauriWindow || !(window as any).__TAURI_INTEGRATION__) return;

    const handleModeChange = (_event: any, mode: string) => {
      if (mode === 'library' || mode === 'turntable') {
        setCurrentMode(mode);
      }
    };

    if (tauriWindow && typeof tauriWindow.on === 'function') {
      tauriWindow.on('mode_change', handleModeChange);
    }

    return () => {
      // 이벤트 구독 해제는 자동으로 처리됨
    };
  }, []);

  const playTrack = async (track: Track, saveNewTrack = false) => {
    const loadedTrack = await playerManager.load(track);
    const metadataChanged = track.title !== loadedTrack.title || track.artist !== loadedTrack.artist
      || track.thumbnail !== loadedTrack.thumbnail || track.coverArtUrl !== loadedTrack.coverArtUrl
      || track.duration !== loadedTrack.duration;

    if (loadedTrack.platform === 'soundcloud' && (saveNewTrack || metadataChanged)) {
      const saved = await createTrack(loadedTrack);
      if (!saved) throw new Error('SoundCloud 트랙을 라이브러리에 저장하지 못했습니다.');
      setLocalTracks(prev => prev.some(item => item.id === loadedTrack.id)
        ? prev.map(item => item.id === loadedTrack.id ? { ...loadedTrack, isFavorite: item.isFavorite } : item)
        : [...prev, loadedTrack]);
      setFavoritesData(prev => prev.map(item => item.id === loadedTrack.id ? { ...loadedTrack, isFavorite: true } : item));
      setHistoryData(prev => prev.map(item => item.id === loadedTrack.id ? { ...loadedTrack, isFavorite: item.isFavorite } : item));
    }

    await playerManager.play();
    setNowPlaying(prev => ({
      ...prev,
      track: loadedTrack,
      isPlaying: true,
      progress: 0,
      duration: loadedTrack.duration,
    }));
    setTurntablePlaybackState('playing');
    await addToHistory(loadedTrack.id);
  };

  const handlePlay = async (track: Track) => {
    try {
      await playTrack(track);
    } catch (err) {
      setError(err instanceof Error ? err.message : '재생 중 오류가 발생했습니다');
    }
  };

  // YouTube 실제 검색 핸들러
  const handleYouTubeSearch = async (query: string) => {
    if (!query.trim()) return;
    
    try {
      const results = await searchYouTubeTracks(query, 10);
      
      // 검색 결과를 트랙으로 변환하여 로컬 트랙에 추가하거나 표시
      for (const result of results) {
        // 기존 트랙에 존재하는지 확인
        const exists = localTracks.some(t => t.id === result.id);
        if (!exists) {
          setLocalTracks(prev => [...prev, result]);
        }
      }
      
      if (results.length === 0) {
        setError('검색 결과가 없습니다.');
      }
    } catch (err: any) {
      setError(err.message || '검색 중 오류가 발생했습니다');
    }
  };

  const handleSoundCloudUrlSubmit = async (url: string) => {
    const trackUrl = new URL(url);
    const platformId = trackUrl.hostname.replace(/^www\./, '') + trackUrl.pathname.replace(/\/+$/, '');
    const existingTrack = localTracks.find(track => {
      if (track.platform !== 'soundcloud') return false;
      try {
        const savedUrl = new URL(track.url);
        return savedUrl.hostname.replace(/^www\./, '') + savedUrl.pathname.replace(/\/+$/, '') === platformId;
      } catch {
        return false;
      }
    });

    setError(null);
    await playTrack(existingTrack ?? {
      id: `soundcloud-${platformId}`,
      platform: 'soundcloud',
      platformId,
      title: '',
      artist: 'SoundCloud',
      album: '',
      duration: 0,
      thumbnail: '',
      url: trackUrl.href,
      embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl.href)}`,
      isPlayable: true,
      addedAt: new Date().toISOString(),
    }, !existingTrack);
  };

  // 창 위치/크기 복원 (Tauri Window API)
  const restoreWindowState = useCallback(async () => {
    if (!tauriWindow || !(window as any).__TAURI_INTEGRATION__) return;  // Tauri가 아니면 건너뛰기
    
    try {
      // 저장된 크기/위치 복원 시도
      const savedSize = await getWindowSize();
      const savedPos = await getWindowPosition();
      const isCurrentlyMaximized = await isMaximized();
      
      if (savedSize && savedPos && !isCurrentlyMaximized) {
        // 화면 경계 내로 보정
        const screenWidth = (window as any).screenWidth ?? 2560;
        const screenHeight = (window as any).screenHeight ?? 1440;
        
        const clampedWidth = Math.min(Math.max(savedSize.width, 400), screenWidth);
        const clampedHeight = Math.min(Math.max(savedSize.height, 300), screenHeight);
        const clampedX = Math.max(0, Math.min(savedPos.x, screenWidth - clampedWidth));
        const clampedY = Math.max(0, Math.min(savedPos.y, screenHeight - clampedHeight));
        
        await setWindowSize(clampedWidth, clampedHeight);
        await setWindowPosition(clampedX, clampedY);
      }
      
      // always-on-top 복원
      const savedAOT = await getAlwaysOnTop();
      if (savedAOT !== null) {
        await setAlwaysOnTop(savedAOT);
      }
    } catch (err) {
      console.error('Window state restore failed:', err);
    }
  }, []);

  // 창 상태 저장 (resize/move 이벤트에서 호출)
  const saveWindowState = useCallback(async () => {
    if (!tauriWindow || !(window as any).__TAURI_INTEGRATION__) return;  // Tauri가 아니면 건너뛰기
    
    try {
      const win = tauriWindow.getCurrentWindow();
      const state = win.getState();
      
      await setWindowSize(state.size.width, state.size.height);
      await setWindowPosition(state.position.x, state.position.y);
    } catch (err) {
      console.error('Window state save failed:', err);
    }
  }, []);

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
    handlePlay(nextTrack);
  };

  // 이전 트랙
  const handlePrevious = () => {
    const currentIndex = localTracks.findIndex(t => t.id === nowPlaying.track.id);
    if (currentIndex === -1) return;
    
    const prevIndex = (currentIndex - 1 + localTracks.length) % localTracks.length;
    const prevTrack = localTracks[prevIndex];
    handlePlay(prevTrack);
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
      // 로컬 트랙 업데이트
      setLocalTracks(prev => prev.map(t => 
        t.id === trackId ? { ...t, isFavorite: !t.isFavorite } : t
      ));
      // API에서 직접 즐겨찾기 목록 새로고침
      const updatedFavorites = await getFavorites();
      setFavoritesData(updatedFavorites);
    }
  };

  // 큐에 트랙 추가
  const handleAddToQueue = async (track: Track) => {
    const success = await addToQueue(track.id);
    if (success) {
      // 큐 패널 새로고침
      const updatedQueue = await getQueue();
      setQueue(updatedQueue);
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

  // 셔플 토글
  const handleShuffleToggle = async () => {
    const newShuffle = playerManager.toggleShuffle();
    await setShuffle(newShuffle);
    setNowPlaying(prev => ({ ...prev, shuffle: newShuffle }));
  };

  // 반복 모드 토글
  const handleRepeatToggle = async () => {
    const newRepeat = playerManager.cycleRepeat();
    await setRepeat(newRepeat);
    setNowPlaying(prev => ({ ...prev, repeat: newRepeat }));
  };

  // 턴테이블 모드 핸들러
  const handleModeChange = async (mode: 'library' | 'turntable') => {
    try {
      const success = await setTauriMode(mode);
      if (success) {
        setCurrentMode(mode);
      } else {
        console.error('Failed to change mode:', mode);
      }
    } catch (err) {
      console.error('Error changing mode:', err);
    }
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
      {!isTurntableMode && (
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          currentMode={currentMode}
          onModeChange={handleModeChange}
          queueLength={queue.length}
        />
      )}
      
      {/* SoundCloud Player Container (위젯용) */}
      <div id="soundcloud-player-container" style={{ position: 'absolute', width: '100%', height: '0', visibility: 'hidden' }} />
      
      {/* YouTube Player Container */}
      <div id="youtube-player-container" style={{ position: 'absolute', width: '100%', height: '0', visibility: 'hidden' }} />
      
      {/* 메인 컨텐츠 */}
      <div className={`vw-main${isTurntableMode ? ' vw-main--turntable' : ''}`}>
        {/* 턴테이블 모드 뷰 */}
        {isTurntableMode && (
          <>
            <header className="vw-turntable-toolbar">
              <span className="vw-turntable-toolbar__brand">OBJETUNE</span>
              <button type="button" onClick={() => handleModeChange('library')}>
                Library
              </button>
              <details className="vw-turntable-toolbar__settings">
                <summary aria-label="Turntable settings">Settings</summary>
                <Settings
                  settings={turntableSettings}
                  onToggleDynamicVinylLabel={handleToggleDynamicVinylLabel}
                  className="vw-turntable-settings"
                />
              </details>
            </header>
            <Turntable
              nowPlaying={nowPlaying}
              playbackState={turntablePlaybackState}
              progress={tonearmPosition?.track === turntableTrack ? tonearmPosition.progress : 0}
              onPlayPause={handlePlayPause}
              onPrevious={handlePrevious}
              onNext={handleNext}
              dynamicLabel={turntableSettings.dynamicVinylLabel}
              className="vw-turntable--mode"
            />
          </>
        )}
        
        {/* 라이브러리 모드 뷰 */}
        {!isTurntableMode && (
          <>
            {/* 검색 바 */}
            <SearchBar
              value={searchQuery}
              onSearch={setSearchQuery}
              platformFilter={platformFilter}
              onPlatformFilter={(platform) => {
                setPlatformFilter(platform);
                setSearchQuery('');
                setError(null);
              }}
              onYouTubeSearch={handleYouTubeSearch}
              onSoundCloudUrlSubmit={handleSoundCloudUrlSubmit}
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
              {displayItems.length > 0 && (
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
                        onClick={handlePlay}
                        onFavoriteToggle={handleFavoriteToggle}
                        onAddToQueue={handleAddToQueue}
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
              onShuffleToggle={handleShuffleToggle}
              onRepeatToggle={handleRepeatToggle}
              onQueueToggle={() => setQueuePanelOpen(true)}
            />

            {/* 큐 패널 */}
            <QueuePanel
              isOpen={queuePanelOpen}
              onClose={() => setQueuePanelOpen(false)}
              nowPlaying={nowPlaying.track}
              onPlayTrack={handlePlay}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
