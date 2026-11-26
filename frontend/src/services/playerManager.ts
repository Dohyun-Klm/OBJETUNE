/**
 * Player Manager
 * YouTube IFrame Player API 및 SoundCloud Widget API를 추상화하고
 * 통합된 재생 상태를 관리합니다.
 */

import { 
  Platform, 
  PlatformSearchResult, 
  PlayerState,
  Track,
  NowPlaying 
} from '../types';

// 이벤트 페이스
interface EventCallback {
  (data: any): void;
}

interface EventSubscription {
  unsubscribe: () => void;
}

// Player Manager 인터페이스
export interface PlayerManagerInterface {
  load(track: Track): Promise<void>;
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
  private youtubeApiLoaded: boolean = false;
  private soundcloudApiLoaded: boolean = false;

  // 셔플/반복 상태
  private shuffle: boolean = false;
  private repeat: 'off' | 'one' | 'all' = 'off';

  /**
   * 현재 트랙 로드 및 플랫폼 어댑터 전환
   */
  async load(track: Track): Promise<void> {
    try {
      this.isLoading = true;
      this.error = null;
      
      // 기존 플레이어 정리
      this.destroy();
      
      this.currentTrack = track;
      this.isBuffering = true;
      
      if (track.platform === 'youtube') {
        await this.loadYouTube(track);
      } else if (track.platform === 'soundcloud') {
        await this.loadSoundCloud(track);
      }
      
      this.isBuffering = false;
      this.notify('load', { track });
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
    
    return new Promise((resolve, reject) => {
      try {
        const container = document.getElementById('youtube-player-container');
        if (container) {
          container.innerHTML = '';
        }
        
        const videoId = track.platformId || track.id.split('-').pop() || track.id;
        this.youtubePlayer = new (window as any).YT.Player('youtube-player-container', {
          videoId,
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: () => {
              this.notify('ready', { track: this.currentTrack });
              resolve();
            },
            onStateChange: (event: any) => this.handleYouTubeStateChange(event),
            onError: (event: any) => this.handleYouTubeError(event),
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * SoundCloud Widget 로드
   */
  private async loadSoundCloud(track: Track): Promise<void> {
    if (!this.soundcloudApiLoaded) {
      await this.ensureSoundCloudAPI();
    }
    
    return new Promise((resolve, reject) => {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '0';
        iframe.style.display = 'none';
        iframe.src = track.embedUrl || track.url!;
        
        document.body.appendChild(iframe);
        this.soundcloudWidget = (window as any).SC?.Widget(iframe);
        
        if (this.soundcloudWidget) {
          this.soundcloudWidget.bind((window as any).SC.Widget.Events.READY, () => {
            this.notify('ready', { track: this.currentTrack });
            resolve();
          });
          
          this.soundcloudWidget.bind((window as any).SC.Widget.Events.Play, () => {
            this.isPlaying = true;
            this.notify('play', { state: 'playing' });
          });
          
          this.soundcloudWidget.bind((window as any).SC.Widget.Events.Pause, () => {
            this.isPlaying = false;
            this.notify('pause', { state: 'paused' });
          });
          
          this.soundcloudWidget.bind((window as any).SC.Widget.Events.Finish, () => {
            this.isPlaying = false;
            this.notify('end', { state: 'stopped' });
          });
          
          this.soundcloudWidget.bind((window as any).SC.Widget.Events.Error, (e: any) => {
            this.error = e.message || 'SoundCloud 재생 오류';
            this.notify('error', { message: this.error });
          });
        } else {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * YouTube API 스크립트 로드
   */
  private ensureYouTubeAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).YT) {
        this.youtubeApiLoaded = true;
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onload = () => {
        this.youtubeApiLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('YouTube IFrame API 로드 실패'));
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
      script.src = 'https://w.soundcloud.com/player/widget.js';
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
        break;
      case 2: // paused
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
      this.isPlaying = true;
      this.notify('play', { state: 'playing' });
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
      this.isPlaying = false;
      this.notify('pause', { state: 'paused' });
    } else if (this.currentTrack.platform === 'soundcloud' && this.soundcloudWidget) {
      this.soundcloudWidget.pause();
      this.isPlaying = false;
      this.notify('pause', { state: 'paused' });
    }
  }

  // 정지
  async stop(): Promise<void> {
    if (!this.currentTrack) return;
    
    if (this.currentTrack.platform === 'youtube' && this.youtubePlayer) {
      this.youtubePlayer.stopVideo();
      this.isPlaying = false;
    } else if (this.currentTrack.platform === 'soundcloud' && this.soundcloudWidget) {
      this.soundcloudWidget.stop();
      this.isPlaying = false;
    }
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
    if (this.currentTrack?.platform === 'youtube' && this.youtubePlayer) {
      this.youtubePlayer.seekTo(time, true);
      this.currentTime = time;
    } else if (this.currentTrack?.platform === 'soundcloud' && this.soundcloudWidget) {
      this.soundcloudWidget.seekTo(time * 1000, true);
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
    if (this.currentTrack?.platform === 'youtube' && this.youtubePlayer) {
      return this.youtubePlayer.getCurrentTime() || 0;
    } else if (this.currentTrack?.platform === 'soundcloud' && this.soundcloudWidget) {
      return this.soundcloudWidget.getCurrentPosition() / 1000 || 0;
    }
    return this.currentTime;
  }

  // 길이 가져오기
  async getDuration(): Promise<number> {
    if (this.currentTrack?.platform === 'youtube' && this.youtubePlayer) {
      return this.youtubePlayer.getDuration() || 0;
    } else if (this.currentTrack?.platform === 'soundcloud' && this.soundcloudWidget) {
      return this.soundcloudWidget.getDuration() / 1000 || 0;
    }
    return this.duration;
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
      this.soundcloudWidget.destroy();
      this.soundcloudWidget = null;
    }
    
    // iframe 제거
    const iframe = document.querySelector('iframe[src*="soundcloud.com"]');
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
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
    return this.currentTime;
  }

  // 현재 길이
  getDurationSync(): number {
    return this.duration;
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