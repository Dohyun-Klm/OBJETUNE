import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import './styles/vintage-walnut.css';
import './components/Turntable.css';
import './components/VinylRecord.css';
import { SearchBar } from './components/SearchBar';
import { MusicCard } from './components/MusicCard';
import { MiniPlayer } from './components/MiniPlayer';
import { EmptyState } from './components/EmptyState';
import { Settings } from './components/Settings';
import { Turntable } from './components/Turntable';
import { PlaybackIcon } from './components/PlaybackControls';
import {
  Track,
  AppMode,
  PlatformFilter,
  TurntableSettings,
  PlaybackState,
  NowPlaying,
} from './types';
import { loadSoundCloudAPI } from './services/platformAdapter';
import { setMode as setTauriMode } from './services/tauriApi';
import { playerManager } from './services/playerManager';
import {
  createTrack,
  getAllTracks,
  setSetting,
  checkTauri,
  getCurrentMode,
  registerMediaShortcuts,
  unregisterMediaShortcuts
} from './services/tauriApi';
import { searchYouTubeTracks } from './services/tauriApi';
import type { YouTubeSearchMode } from './services/tauriApi';

// Tauri API는 동적으로 가져오기 (테스트 환경에서 모킹 가능)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tauriWindow = typeof window !== 'undefined' && (window as any).__TAURI_INTEGRATION__
  ? require('@tauri-apps/api/window')
  : null;

function App() {
  // 앱 상태
  const [currentMode, setCurrentMode] = useState<AppMode>('shell');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [youtubeMode, setYouTubeMode] = useState<YouTubeSearchMode>('music');
  const [youtubeResults, setYouTubeResults] = useState<Track[] | null>(null);
  const youtubeSearchRequest = useRef(0);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('youtube');

  // 로딩 및 오류 상태
  const [error, setError] = useState<string | null>(null);
  const [showYouTubePlayer, setShowYouTubePlayer] = useState(false);

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


  // 턴테이블 설정
  const [turntableSettings, setTurntableSettings] = useState<TurntableSettings>({
    dynamicVinylLabel: false,
  });

  // 큐 패널 상태
  const [queuePanelOpen, setQueuePanelOpen] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);

  // Tauri API 확인 및 초기 데이터 로드
  useEffect(() => {
    const loadAppData = async () => {
      try {
        // Tauri 환경 확인
        if (await checkTauri()) {
          const mode = await getCurrentMode();
          setCurrentMode(mode);

          setLocalTracks(await getAllTracks());
        } else {
          // 개발 모드: 빈 상태
          setCurrentMode('shell');
          setLocalTracks([]);
        }
      } catch (err) {
        console.error('Failed to load app data:', err);
        setError('앱 정보를 로드하는 중 오류가 발생했습니다.');
        // 오류 시 빈 상태 사용
        setCurrentMode('shell');
        setLocalTracks([]);
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
  const filteredTracks: Track[] = youtubeResults ?? localTracks.filter(track => {
    const matchesSearch = track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          track.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          track.album.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const isTurntableMode = currentMode === 'turntable';
  const turntableTrack = nowPlaying.track;
  const [timeline, setTimeline] = useState<{ track: Track; position: number; duration: number } | null>(null);
  const seekGraceUntil = useRef(0);
  const position = timeline?.track === turntableTrack ? timeline.position : 0;
  const duration = timeline?.track === turntableTrack ? timeline.duration : nowPlaying.duration;

  useEffect(() => {
    if (!turntableTrack.id || turntablePlaybackState === 'stopped') return;

    const updatePosition = () => {
      if (playerManager.getCurrentTrack()?.id !== turntableTrack.id || Date.now() < seekGraceUntil.current) return;
      const elapsed = playerManager.getCurrentTimeSync();
      const duration = playerManager.getDurationSync();
      if (Number.isFinite(elapsed) && Number.isFinite(duration) && duration > 0) {
        setTimeline(previous => previous?.track === turntableTrack && previous.position === elapsed && previous.duration === duration
          ? previous : { track: turntableTrack, position: elapsed, duration });
      }
    };

    updatePosition();
    const timer = window.setInterval(updatePosition, turntablePlaybackState === 'playing' ? 250 : 500);
    return () => window.clearInterval(timer);
  }, [turntableTrack, turntablePlaybackState]);

  // 플랫폼 API 로드
  useEffect(() => {
    const loadAPIs = async () => {
      try {
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
      setNowPlaying(prev => ({ ...prev, isPlaying: true }));
    });
    if (playSub && typeof playSub.unsubscribe === 'function') {
      subscriptions.push(playSub.unsubscribe);
    }

    const pauseSub = playerManager.on('pause', (event) => {
      setTurntablePlaybackState(prev => prev === 'stopped' ? prev : 'paused');
      setNowPlaying(prev => ({ ...prev, isPlaying: false }));
    });
    if (pauseSub && typeof pauseSub.unsubscribe === 'function') {
      subscriptions.push(pauseSub.unsubscribe);
    }

    const endSub = playerManager.on('end', (event) => {
      setTurntablePlaybackState('stopped');
      setNowPlaying(prev => ({ ...prev, isPlaying: false }));
    });
    if (endSub && typeof endSub.unsubscribe === 'function') {
      subscriptions.push(endSub.unsubscribe);
    }

    const errorSub = playerManager.on('error', (event) => {
      const errMsg = (event as any)?.message || '재생 오류가 발생했습니다';
      setError(errMsg);
      setTurntablePlaybackState('stopped');
      setNowPlaying(prev => ({ ...prev, isPlaying: false }));
    });
    if (errorSub && typeof errorSub.unsubscribe === 'function') {
      subscriptions.push(errorSub.unsubscribe);
    }

    return () => {
      subscriptions.forEach(unsub => unsub());
    };
  }, []);

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

  const playTrack = useCallback(async (track: Track, saveNewTrack = false) => {
    const playerTrackId = playerManager.getCurrentTrack()?.id;
    setError(null);
    setShowYouTubePlayer(track.platform === 'youtube');
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
    }

    setNowPlaying(prev => ({
      ...prev,
      track: loadedTrack,
      isPlaying: false,
      progress: 0,
      duration: loadedTrack.duration,
    }));
    setTurntablePlaybackState('paused');
    seekGraceUntil.current = 0;
    setTimeline(null);
    await playerManager.play();
    setQueue(prev => {
      const existing = prev.findIndex(item => item.id === loadedTrack.id);
      if (existing >= 0) return prev.map(item => item.id === loadedTrack.id ? loadedTrack : item);
      const insertion = prev.findIndex(item => item.id === playerTrackId) + 1;
      return [...prev.slice(0, insertion), loadedTrack, ...prev.slice(insertion)];
    });
  }, []);

  const handlePlay = useCallback(async (track: Track) => {
    try {
      await playTrack(track);
    } catch (err) {
      setError(err instanceof Error ? err.message : '재생 중 오류가 발생했습니다');
    }
  }, [playTrack]);

  // YouTube 실제 검색 핸들러
  const handleYouTubeSearch = async (query: string) => {
    if (!query.trim()) return;
    const request = ++youtubeSearchRequest.current;
    setError(null);
    setYouTubeResults([]);
    try {
      const results = await searchYouTubeTracks(query, 10, youtubeMode);
      if (request !== youtubeSearchRequest.current) return;
      setYouTubeResults(results);
      if (results.length === 0) {
        setError('검색 결과가 없습니다.');
      }
    } catch (err: any) {
      if (request === youtubeSearchRequest.current) setError(err.message || '검색 중 오류가 발생했습니다');
    }
  };

  const clearYouTubeResults = () => {
    youtubeSearchRequest.current += 1;
    setYouTubeResults(null);
    setError(null);
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

  // 재생/일시정지 토글
  const handlePlayPause = async () => {
    try {
      if (!nowPlaying.track.id) return;
      if (nowPlaying.isPlaying) {
        await playerManager.pause();
      } else {
        await playerManager.play();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '재생 제어 중 오류가 발생했습니다';
      setError(message);
    }
  };

  const handleSeek = async (seconds: number) => {
    if (!turntableTrack.id || duration <= 0 || !Number.isFinite(seconds)) return;
    const target = Math.max(0, Math.min(seconds, duration));
    try {
      await playerManager.seekTo(target);
      seekGraceUntil.current = Date.now() + 450;
      setTimeline({ track: turntableTrack, position: target, duration });
    } catch {
      setError('재생 위치를 이동하지 못했습니다.');
    }
  };

  const handleStop = async () => {
    try {
      await playerManager.stop();
      setNowPlaying(prev => ({ ...prev, isPlaying: false }));
      setTurntablePlaybackState('stopped');
      setTimeline({ track: turntableTrack, position: 0, duration });
    } catch {
      setError('재생을 정지하지 못했습니다.');
    }
  };

  const currentQueueIndex = queue.findIndex(track => track.id === nowPlaying.track.id);
  const upcoming = queue.slice(currentQueueIndex + 1);
  const previousTrack = queue[currentQueueIndex - 1];
  const nextTrack = upcoming[0];
  const handleNext = useCallback(() => {
    if (nextTrack) void handlePlay(nextTrack);
  }, [nextTrack, handlePlay]);

  useEffect(() => {
    const end = playerManager.on('end', handleNext);
    return () => end.unsubscribe();
  }, [handleNext]);

  const handleAddToQueue = (track: Track) => {
    setQueue(prev => prev.some(item => item.id === track.id) ? prev : [...prev, track]);
  };
  // 턴테이블 설정 토글
  const handleToggleDynamicVinylLabel = () => {
    const newSettings = { ...turntableSettings, dynamicVinylLabel: !turntableSettings.dynamicVinylLabel };
    setTurntableSettings(newSettings);
    localStorage.setItem('turntable-settings', JSON.stringify(newSettings));

    // Tauri에도 저장
    setSetting('dynamicVinylLabel', String(!turntableSettings.dynamicVinylLabel));
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
      {/* SoundCloud Player Container (위젯용) */}
      <div id="soundcloud-player-container" style={{ position: 'absolute', width: '100%', height: '0', visibility: 'hidden' }} />

      {/* 메인 컨텐츠 */}
      <div className="vw-main">
        <header className="vw-turntable-toolbar">
          <span className="vw-turntable-toolbar__brand">OBJETUNE</span>
          {isTurntableMode && (
            <details className="vw-turntable-toolbar__settings">
              <summary aria-label="Turntable settings">설정</summary>
              <Settings
                settings={turntableSettings}
                onToggleDynamicVinylLabel={handleToggleDynamicVinylLabel}
                className="vw-turntable-settings"
              />
            </details>
          )}
          <div className="vw-mode-switch" role="group" aria-label="화면 모드">
            <button type="button" aria-pressed={!isTurntableMode} onClick={() => handleModeChange('library')}>
              라이브러리
            </button>
            <button type="button" aria-pressed={isTurntableMode} onClick={() => handleModeChange('turntable')}>
              LP
            </button>
          </div>
        </header>
        <div className={`vw-playback-workspace${showYouTubePlayer ? ' vw-playback-workspace--video' : ''}`}>
          <aside className="vw-youtube-dock" hidden={!showYouTubePlayer} aria-label="YouTube 공식 플레이어">
            <div id="youtube-player-container" />
            {error && isTurntableMode && <p className="vw-youtube-dock__error" role="alert">{error}</p>}
          </aside>
          <div className="vw-playback-screen">
            {isTurntableMode && (
              <Turntable
                  nowPlaying={nowPlaying}
                  playbackState={turntablePlaybackState}
                  progress={duration > 0 ? position / duration : 0}
                  position={position}
                  duration={duration}
                  onSeek={handleSeek}
                  onStop={handleStop}
                  onPlayPause={handlePlayPause}
                  onPrevious={previousTrack ? () => handlePlay(previousTrack) : undefined}
                  onNext={nextTrack ? handleNext : undefined}
                  dynamicLabel={turntableSettings.dynamicVinylLabel}
                  className="vw-turntable--mode"
                />
            )}

            {/* 라이브러리 모드 뷰 */}
            {!isTurntableMode && (
              <>
                {/* 검색 바 */}
                <SearchBar
                  value={searchQuery}
                  onSearch={(query) => {
                    setSearchQuery(query);
                    clearYouTubeResults();
                  }}
                  platformFilter={platformFilter}
                  onPlatformFilter={(platform) => {
                    setPlatformFilter(platform);
                    setSearchQuery('');
                    clearYouTubeResults();
                  }}
                  youtubeMode={youtubeMode}
                  onYouTubeModeChange={(mode) => {
                    setYouTubeMode(mode);
                    clearYouTubeResults();
                  }}
                  onYouTubeSearch={handleYouTubeSearch}
                  onSoundCloudUrlSubmit={handleSoundCloudUrlSubmit}
                />

                {/* 컨텐츠 영역 */}
                <main className="vw-content" role="main">
                  <div className="vw-content__header">
                    <h1 className="vw-content__title">Library</h1>
                  </div>

                  {/* 오류 상태 */}
                  {error && (
                    <div className="vw-error" role="alert">
                      <p>{error}</p>
                    </div>
                  )}

                  {/* 빈 상태 */}
                  {!error && filteredTracks.length === 0 && (
                    <EmptyState
                      title="No music found"
                      description="Try adjusting your search or filter criteria"
                    />
                  )}

                  {/* 결과 목록 */}
                  {filteredTracks.length > 0 && (
                    <div className="vw-library-grid">
                      {filteredTracks.map(track => (
                        <MusicCard
                          key={track.id}
                          track={track}
                          onPlay={handlePlay}
                          onClick={handlePlay}
                          onAddToQueue={handleAddToQueue}
                        />
                      ))}
                    </div>
                  )}
                </main>

                {/* 미니 플레이어 */}
                <MiniPlayer
                  nowPlaying={nowPlaying}
                  position={position}
                  duration={duration}
                  onSeek={handleSeek}
                  onStop={handleStop}
                  onPlayPause={handlePlayPause}
                  onNext={nextTrack ? handleNext : undefined}
                  onPrevious={previousTrack ? () => handlePlay(previousTrack) : undefined}
                />
              </>
            )}
          </div>
        </div>
        <div className="vw-session-queue">
          {queuePanelOpen && (
            <section id="session-queue" className="vw-session-queue__panel" aria-label="현재 재생목록">
              <h2>현재 재생목록</h2>
              {nowPlaying.track.id && <p>현재 곡 · {nowPlaying.track.title}</p>}
              {upcoming.length === 0 ? <p>대기 중인 곡이 없습니다.</p> : (
                <ol>
                  {upcoming.map(track => (
                    <li key={track.id}>
                      <button type="button" onClick={() => handlePlay(track)}>{track.title}</button>
                      <button type="button" aria-label={`${track.title} 대기열에서 제거`} onClick={() =>
                        setQueue(prev => prev.filter(item => item.id !== track.id))
                      }>×</button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
          <button type="button" className="vw-session-queue__toggle" aria-expanded={queuePanelOpen} aria-controls={queuePanelOpen ? 'session-queue' : undefined}
            aria-label={`대기열${upcoming.length ? ` ${upcoming.length}` : ''}`} title={queuePanelOpen ? '대기열 닫기' : '대기열 열기'}
            onClick={() => setQueuePanelOpen(prev => !prev)}>
            <PlaybackIcon name="queue" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
