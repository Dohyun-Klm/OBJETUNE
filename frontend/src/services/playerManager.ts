/**
 * Player Manager
 * YouTube IFrame Player API 및 SoundCloud Widget API를 추상화하고
 * 통합된 재생 상태를 관리합니다.
 */

import { 
  Platform, 
  PlayerState,
  Track
} from '../types';

// 이벤트 페이스
interface EventCallback {
  (data: any): void;
}

interface EventSubscription {
  unsubscribe: () => void;
}

interface SoundCloudSound {
  title?: string;
  artwork_url?: string | null;
  duration?: number;
  user?: { username?: string };
}

// Player Manager 인터페이스
export interface PlayerManagerInterface {
  load(track: Track): Promise<Track>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  getState(): Promise<PlayerState>;
  setVolume(volume: number): Promise<void>;
  getDuration(): Promise<number>;
  getCurrentTime(): Promise<number>;
  seekTo(time: number): Promise<void>;
  mute(muted: boolean): Promise<void>;
  destroy(): void;
  on(event: string, callback: EventCallback): EventSubscription;
  getPlayerState(): PlayerState;
}

class PlayerManager implements PlayerManagerInterface {
  private currentTrack: Track | null = null;
  private platform: Platform | null = null;
  private isPlaying: boolean = false;
  private isBuffering: boolean = false;
  private currentTime: number = 0;
  private duration: number = 0;
  private volume: number = 100;
  private isMuted: boolean = false;
  private error: string | null = null;
  private isLoading: boolean = false;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private youtubePlayer: any = null;
  private soundcloudWidget: any = null;
  private soundcloudFrame: HTMLIFrameElement | null = null;
  private youtubeApiLoaded: boolean = false;
  private soundcloudApiLoaded: boolean = false;

  // 셔플/반복 상태
  private shuffle: boolean = false;
  private repeat: 'off' | 'one' | 'all' = 'off';

  /**
   * 현재 트랙 로드 및 플랫폼 어댑터 전환
   */
  async load(track: Track): Promise<Track> {
    try {
      this.isLoading = true;
      this.error = null;
      
      // 기존 플레이어 정리
      this.destroy();
      
      this.currentTrack = track;
      this.currentTime = 0;
      this.duration = track.duration || 0;
      this.isBuffering = true;
      
      if (track.platform === 'youtube') {
        await this.loadYouTube(track);
      } else if (track.platform === 'soundcloud') {
        this.currentTrack = await this.loadSoundCloud(track);
      }
      
      this.isBuffering = false;
      this.notify('load', { track: this.currentTrack });
      return this.currentTrack;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to load track';
      this.isBuffering = false;
      this.isLoading = false;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * YouTube IFrame Player 로드
   */
  private async loadYouTube(track: Track): Promise<void> {
    if (!this.youtubeApiLoaded) {
      await this.ensureYouTubeAPI();
    }
    
    let readyTimeout: number | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        const container = document.getElementById('youtube-player-container');
        if (!container) {
          reject(new Error('YouTube 플레이어를 표시할 공간을 찾지 못했습니다.'));
          return;
        }
        const mount = document.createElement('div');
        mount.id = 'youtube-player-mount';
        container.replaceChildren(mount);
        readyTimeout = window.setTimeout(() => reject(new Error('YouTube 플레이어를 불러오는 데 시간이 너무 오래 걸렸습니다.')), 15000);
        
        const videoId = track.platformId || track.id.split('-').pop() || track.id;
        this.youtubePlayer = new window.YT.Player(mount.id, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: {
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              this.notify('ready', { track: this.currentTrack });
              resolve();
            },
            onStateChange: (event: any) => this.handleYouTubeStateChange(event),
            onError: (event) => {
              this.handleYouTubeError(event);
              reject(new Error(this.error || 'YouTube 재생 오류'));
            },
            onAutoplayBlocked: () => this.handleYouTubeStateChange({ data: 2 }),
          }
        });
      });
    } finally {
      window.clearTimeout(readyTimeout);
    }
  }

  /**
   * SoundCloud Widget 로드
   */
  private async loadSoundCloud(track: Track): Promise<Track> {
    if (!this.soundcloudApiLoaded) {
      await this.ensureSoundCloudAPI();
    }
    
    let timeout: number | undefined;
    try {
      return await new Promise<Track>((resolve, reject) => {
        timeout = window.setTimeout(() => reject(new Error('SoundCloud 트랙 정보를 가져오는 데 시간이 너무 오래 걸렸습니다.')), 15000);
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '0';
        iframe.style.display = 'none';
        iframe.allow = 'autoplay';
        iframe.src = track.embedUrl || track.url!;
        
        document.body.appendChild(iframe);
        this.soundcloudFrame = iframe;
        this.soundcloudWidget = (window as any).SC?.Widget(iframe);
        
        if (this.soundcloudWidget) {
          const widget = this.soundcloudWidget;
          const events = (window as any).SC.Widget.Events;
          const readDuration = () => widget.getDuration((milliseconds: number) => {
            if (this.soundcloudWidget === widget && Number.isFinite(milliseconds) && milliseconds > 0) {
              this.duration = milliseconds / 1000;
            }
          });
          const updatePosition = ({ currentPosition, relativePosition }: { currentPosition: number; relativePosition?: number }) => {
            if (this.soundcloudWidget !== widget || !Number.isFinite(currentPosition)) return;
            this.currentTime = currentPosition / 1000;
            if (!this.duration && relativePosition && relativePosition > 0) {
              this.duration = this.currentTime / relativePosition;
            }
          };
          widget.bind(events.PLAY_PROGRESS, updatePosition);
          if (events.SEEK) widget.bind(events.SEEK, updatePosition);
          widget.bind(events.READY, () => {
            widget.getCurrentSound((sound: SoundCloudSound | null) => {
              if (this.soundcloudWidget !== widget) return;
              const title = sound?.title?.trim();
              if (!title) {
                reject(new Error('SoundCloud에서 재생할 수 있는 공개 트랙을 찾지 못했습니다.'));
                return;
              }
              const artwork = sound?.artwork_url || track.coverArtUrl || track.thumbnail;
              const milliseconds = sound?.duration;
              if (typeof milliseconds === 'number' && Number.isFinite(milliseconds) && milliseconds > 0) {
                this.duration = milliseconds / 1000;
              }
              const loadedTrack = {
                ...track,
                title,
                artist: sound?.user?.username?.trim() || track.artist,
                thumbnail: artwork,
                coverArtUrl: artwork || undefined,
                duration: Math.round(this.duration),
              };
              this.notify('ready', { track: loadedTrack });
              resolve(loadedTrack);
            });
          });
          
          widget.bind(events.PLAY, () => {
            readDuration();
            this.isPlaying = true;
            this.notify('play', { state: 'playing' });
          });
          
          widget.bind(events.PAUSE, () => {
            this.isPlaying = false;
            this.notify('pause', { state: 'paused' });
          });
          
          widget.bind(events.FINISH, () => {
            this.isPlaying = false;
            this.notify('end', { state: 'stopped' });
          });
          
          widget.bind(events.ERROR, (e?: { message?: string }) => {
            this.error = e?.message || 'SoundCloud에서 이 트랙을 불러오거나 재생할 수 없습니다.';
            this.notify('error', { message: this.error });
            reject(new Error(this.error));
          });
        } else {
          reject(new Error('SoundCloud Widget을 불러오지 못했습니다.'));
        }
      });
    } catch (error) {
      // A newer load may already own the player.
      if (this.currentTrack === track) this.destroy();
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  /**
   * YouTube API 스크립트 로드
   */
  private ensureYouTubeAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window.YT?.Player === 'function') {
        this.youtubeApiLoaded = true;
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      const previous = window.onYouTubeIframeAPIReady;
      const restore = () => {
        window.clearTimeout(timeout);
        window.onYouTubeIframeAPIReady = previous;
      };
      const fail = () => {
        restore();
        script.remove();
        reject(new Error('YouTube IFrame API 로드 실패'));
      };
      const timeout = window.setTimeout(fail, 15000);
      window.onYouTubeIframeAPIReady = () => {
        restore();
        this.youtubeApiLoaded = true;
        resolve();
        previous?.();
      };
      script.onerror = fail;
      document.head.appendChild(script);
    });
  }

  /**
   * SoundCloud Widget API 스크립트 로드
   */
  private ensureSoundCloudAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).SC) {
        this.soundcloudApiLoaded = true;
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://w.soundcloud.com/player/api.js';
      script.onload = () => {
        this.soundcloudApiLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('SoundCloud Widget API 로드 실패'));
      document.head.appendChild(script);
    });
  }

  /**
   * YouTube 상태 변경 처리
   */
  private handleYouTubeStateChange(event: any): void {
    const state = event.data;
    
    switch (state) {
      case 1: // playing
        this.isBuffering = false;
        this.isPlaying = true;
        this.notify('play', { state: 'playing' });
        break;
      case 2: // paused
        this.isBuffering = false;
        this.isPlaying = false;
        this.notify('pause', { state: 'paused' });
        break;
      case 3: // buffering
        this.isBuffering = true;
        break;
      case 5: // video cued
        this.isBuffering = true;
        break;
      case 0: // ended
        this.isPlaying = false;
        this.duration = 0;
        this.currentTime = 0;
        this.notify('end', { state: 'ended' });
        return;
    }
    
    // 현재 시간 및 길이 업데이트
    if (this.youtubePlayer) {
      this.currentTime = this.youtubePlayer.getCurrentTime() || 0;
      this.duration = this.youtubePlayer.getDuration() || 0;
    }
    
    this.notify('stateChange', { 
      state: state === 1 ? 'playing' : state === 2 ? 'paused' : 'buffering' 
    });
  }

  /**
   * YouTube 에러 처리
   */
  private handleYouTubeError(event: any): void {
    this.error = `YouTube 재생 오류: ${event.data}`;
    this.isBuffering = false;
    this.notify('error', { message: this.error });
  }

  // 재생
  async play(): Promise<void> {
    if (!this.currentTrack) return;
    
    if (this.currentTrack.platform === 'youtube' && this.youtubePlayer) {
      this.youtubePlayer.playVideo();
    } else if (this.currentTrack.platform === 'soundcloud' && this.soundcloudWidget) {
      this.soundcloudWidget.play();
      this.isPlaying = true;
      this.notify('play', { state: 'playing' });
    }
  }

  // 일시정지
  async pause(): Promise<void> {
    if (!this.currentTrack) return;
    
    if (this.currentTrack.platform === 'youtube' && this.youtubePlayer) {
      this.youtubePlayer.pauseVideo();
    } else if (this.currentTrack.platform === 'soundcloud' && this.soundcloudWidget) {
      this.soundcloudWidget.pause();
      this.isPlaying = false;
      this.notify('pause', { state: 'paused' });
    }
  }

  // 정지
  async stop(): Promise<void> {
    await this.pause();
    await this.seekTo(0);
    this.isPlaying = false;
  }

  // 볼륨 설정 (0-100)
  async setVolume(volume: number): Promise<void> {
    this.volume = Math.max(0, Math.min(100, volume));
    
    if (this.currentTrack?.platform === 'youtube' && this.youtubePlayer) {
      this.youtubePlayer.setVolume(this.volume);
    } else if (this.currentTrack?.platform === 'soundcloud' && this.soundcloudWidget) {
      this.soundcloudWidget.setVolume(this.volume * 100);
    }
    
    this.notify('volumeChange', { volume: this.volume });
  }

  // 음소거 토글
  async mute(muted: boolean): Promise<void> {
    this.isMuted = muted;
    
    if (this.currentTrack?.platform === 'youtube' && this.youtubePlayer) {
      if (muted) {
        this.youtubePlayer.mute();
      } else {
        this.youtubePlayer.unMute();
      }
    } else if (this.currentTrack?.platform === 'soundcloud' && this.soundcloudWidget) {
      if (muted) {
        this.soundcloudWidget.mute();
      } else {
        this.soundcloudWidget.unmute();
      }
    }
    
    this.notify('muteChange', { muted: this.isMuted });
  }

  // seekTo
  async seekTo(time: number): Promise<void> {
    if (!Number.isFinite(time)) return;
    const duration = this.getDurationSync();
    time = Math.max(0, duration > 0 ? Math.min(duration, time) : time);
    if (this.currentTrack?.platform === 'youtube' && this.youtubePlayer) {
      this.youtubePlayer.seekTo(time, true);
      this.currentTime = time;
    } else if (this.currentTrack?.platform === 'soundcloud' && this.soundcloudWidget) {
      this.soundcloudWidget.seekTo(Math.round(time * 1000));
      this.currentTime = time;
    }
    
    this.notify('seek', { currentTime: time });
  }

  // 상태 가져오기 (Promise)
  async getState(): Promise<PlayerState> {
    if (!this.currentTrack) {
      return {
        currentTrack: null,
        platform: null,
        isPlaying: false,
        isBuffering: false,
        currentTime: 0,
        duration: 0,
        volume: this.volume,
        isMuted: this.isMuted,
        error: null,
        isLoading: false,
      };
    }
    
    // YouTube에서는 실시간 상태 조회
    if (this.currentTrack.platform === 'youtube' && this.youtubePlayer) {
      const ytState = this.youtubePlayer.getPlayerState();
      return this.buildState(this.youTubeStateToPlayerState(ytState));
    }
    
    // SoundCloud에서는 현재 상태 반환
    if (this.currentTrack.platform === 'soundcloud' && this.soundcloudWidget) {
      const scState = this.soundcloudWidget.getCurrentState();
      return this.buildState(this.soundCloudStateToPlayerState(scState));
    }
    
    return this.buildState();
  }

  // 현재 시간 가져오기
  async getCurrentTime(): Promise<number> {
    return this.getCurrentTimeSync();
  }

  // 길이 가져오기
  async getDuration(): Promise<number> {
    return this.getDurationSync();
  }

  // 현재 위치의 PlayerState 반환
  getPlayerState(): PlayerState {
    return this.buildState();
  }

  /**
   * 현재 상태를 PlayerState 객체로 변환
   */
  private buildState(playingState?: 'playing' | 'paused' | 'buffering' | 'stopped' | 'ended'): PlayerState {
    return {
      currentTrack: this.currentTrack,
      platform: this.platform,
      isPlaying: playingState === 'playing' ? true : this.isPlaying,
      isBuffering: playingState === 'buffering' ? true : this.isBuffering,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      isMuted: this.isMuted,
      error: this.error,
      isLoading: this.isLoading,
    };
  }

  /**
   * YouTube 상태를 PlayerState로 변환
   */
  private youTubeStateToPlayerState(ytState: number): 'playing' | 'paused' | 'buffering' | 'stopped' | 'ended' {
    switch (ytState) {
      case 1: return 'playing';
      case 2: return 'paused';
      case 3: return 'buffering';
      case 5: return 'buffering';
      case -1: return 'stopped';
      case 0: return 'ended';
      default: return 'stopped';
    }
  }

  /**
   * SoundCloud 상태를 PlayerState로 변환
   */
  private soundCloudStateToPlayerState(scState: number): 'playing' | 'paused' | 'buffering' | 'stopped' {
    switch (scState) {
      case 1: return 'playing';
      case 2: return 'paused';
      case 3: return 'buffering';
      default: return 'stopped';
    }
  }

  // 플레이어 파괴
  destroy(): void {
    if (this.youtubePlayer) {
      this.youtubePlayer.destroy();
      this.youtubePlayer = null;
    }
    
    if (this.soundcloudWidget) {
      this.soundcloudWidget.destroy?.();
      this.soundcloudWidget = null;
    }
    
    // iframe 제거
    this.soundcloudFrame?.remove();
    this.soundcloudFrame = null;
  }

  // 이벤트 구독
  on(event: string, callback: EventCallback): EventSubscription {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
    
    return {
      unsubscribe: () => {
        const listeners = this.eventListeners.get(event) || [];
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  // 이벤트 알림
  protected notify(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => callback(data));
  }

  // 현재 트랙 가져오기
  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  // 현재 플랫폼 가져오기
  getCurrentPlatform(): Platform | null {
    return this.platform;
  }

  // 현재 진행 시간
  getCurrentTimeSync(): number {
    return this.youtubePlayer?.getCurrentTime?.() ?? this.currentTime;
  }

  // 현재 길이
  getDurationSync(): number {
    return this.youtubePlayer?.getDuration?.() || this.duration;
  }

  // 현재 볼륨
  getVolume(): number {
    return this.volume;
  }

  // 현재 오류
  getError(): string | null {
    return this.error;
  }

  // 셔플 모드
  getShuffle(): boolean {
    return this.shuffle;
  }

  setShuffle(enabled: boolean): void {
    this.shuffle = enabled;
    this.notify('shuffleChange', { shuffle: this.shuffle });
  }

  toggleShuffle(): boolean {
    this.shuffle = !this.shuffle;
    this.notify('shuffleChange', { shuffle: this.shuffle });
    return this.shuffle;
  }

  // 반복 모드
  getRepeat(): 'off' | 'one' | 'all' {
    return this.repeat;
  }

  setRepeat(mode: 'off' | 'one' | 'all'): void {
    this.repeat = mode;
    this.notify('repeatChange', { repeat: this.repeat });
  }

  cycleRepeat(): 'off' | 'one' | 'all' {
    const modes: Array<'off' | 'one' | 'all'> = ['off', 'one', 'all'];
    const currentIndex = modes.indexOf(this.repeat);
    this.repeat = modes[(currentIndex + 1) % modes.length];
    this.notify('repeatChange', { repeat: this.repeat });
    return this.repeat;
  }
}

// 싱글톤 인스턴스
export const playerManager = new PlayerManager();
