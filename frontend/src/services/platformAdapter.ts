/**
 * Platform Adapter Service
 * YouTube IFrame Player API 및 SoundCloud Widget API 추상화
 */

export type Platform = 'youtube' | 'soundcloud';

export interface PlatformSearchResult {
  id: string;
  videoId?: string;  // YouTube 전용
  title: string;
  artist: string;
  album: string;
  duration: number;
  thumbnail: string;
  platform: Platform;
  url: string;
  embedUrl: string;
  publishedAt?: string;
  isPlayable: boolean;
}

export type PlayerState = 'stopped' | 'playing' | 'paused' | 'buffering' | 'loading' | 'error' | 'ended';

// 이벤트 페이스
interface EventCallback {
  (data: any): void;
}

interface EventSubscription {
  unsubscribe: () => void;
}

// 플랫폼 어댑터 인터페이스
export interface PlatformAdapter {
  search(query: string, limit?: number): Promise<PlatformSearchResult[]>;
  load(track: PlatformSearchResult): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  getState(): Promise<PlayerState>;
  setVolume(volume: number): Promise<void>;
  getDuration(): Promise<number>;
  getCurrentTime(): Promise<number>;
  seekTo(time: number): Promise<void>;
  destroy(): void;
  on(event: string, callback: EventCallback): EventSubscription;
}

// YouTube 어댑터
class YouTubeAdapter implements PlatformAdapter {
  private player: any = null;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private isAPILoaded = false;

  async search(query: string, limit: number = 10): Promise<PlatformSearchResult[]> {
    try {
      const response = await fetch(`/api/v1/youtube/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'YouTube 검색 실패');
      }
      
      const data = await response.json();
      
      return data.results.map((item: any) => ({
        id: item.videoId || item.id,
        title: item.title,
        artist: item.channelTitle,
        album: '',
        duration: item.duration_seconds || 0,
        thumbnail: item.thumbnail,
        platform: 'youtube' as Platform,
        url: item.video_url || `https://www.youtube.com/watch?v=${item.videoId}`,
        embedUrl: `https://www.youtube.com/embed/${item.videoId}`,
        publishedAt: item.published_at,
        isPlayable: true,
      }));
    } catch (error) {
      console.error('YouTube 검색 오류:', error);
      throw error;
    }
  }

  async load(track: PlatformSearchResult): Promise<void> {
    // YouTube IFrame Player API를 통해 로드
    await this.ensureAPI();
    return new Promise((resolve, reject) => {
      try {
        this.destroy();
        this.createPlayer(track.videoId || track.id);
        this.waitForReady().then(resolve).catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private ensureAPI(): Promise<void> {
    if (this.isAPILoaded) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      if ((window as any).YT) {
        this.isAPILoaded = true;
        resolve();
      } else {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.onload = () => {
          this.isAPILoaded = true;
          resolve();
        };
        script.onerror = () => reject(new Error('YouTube IFrame API 로드 실패'));
        document.head.appendChild(script);
      }
    });
  }

  private createPlayer(videoId: string): void {
    const container = document.getElementById('youtube-player-container');
    if (container) {
      container.innerHTML = '';
    }

    this.player = new (window as any).YT.Player('youtube-player-container', {
      videoId,
      playerVars: {
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady: () => this.notify('ready'),
        onStateChange: (event: any) => this.handleStateChange(event),
        onError: (event: any) => this.handleError(event),
      }
    });
  }

  private waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      if (this.player && this.player.getPlayerState() !== undefined) {
        resolve();
      } else {
        const check = () => {
          if (this.player) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      }
    });
  }

  private handleStateChange(event: any): void {
    const state = event.data;
    let playerState: PlayerState = 'stopped';
    
    switch (state) {
      case 1: playerState = 'playing'; break;
      case 2: playerState = 'paused'; break;
      case 3: playerState = 'buffering'; break;
      case 5: playerState = 'playing'; break;
      case -1: playerState = 'stopped'; break;
    }
    
    this.notify(state === 1 ? 'play' : state === 2 ? 'pause' : state === 0 ? 'end' : 'stateChange', { state: playerState });
  }

  private handleError(event: any): void {
    const playerState: PlayerState = 'error';
    this.notify('error', { 
      message: `YouTube 재생 오류: ${event.data}`,
      state: playerState 
    });
  }

  async play(): Promise<void> {
    if (this.player) {
      this.player.playVideo();
    }
  }

  async pause(): Promise<void> {
    if (this.player) {
      this.player.pauseVideo();
    }
  }

  async stop(): Promise<void> {
    if (this.player) {
      this.player.stopVideo();
    }
  }

  async getState(): Promise<PlayerState> {
    if (!this.player) return 'stopped';
    
    const state = this.player.getPlayerState();
    if (state === 1) return 'playing';
    if (state === 2) return 'paused';
    if (state === 3 || state === 5) return 'buffering';
    if (state === -1 || state === 0) return 'stopped';
    return 'stopped';
  }

  async setVolume(volume: number): Promise<void> {
    if (this.player) {
      this.player.setVolume(volume);
    }
  }

  async getDuration(): Promise<number> {
    if (this.player) {
      return this.player.getDuration() || 0;
    }
    return 0;
  }

  async getCurrentTime(): Promise<number> {
    if (this.player) {
      return this.player.getCurrentTime() || 0;
    }
    return 0;
  }

  async seekTo(time: number): Promise<void> {
    if (this.player) {
      this.player.seekTo(time, true);
    }
  }

  destroy(): void {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
  }

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

  protected notify(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => callback(data));
  }
}

// SoundCloud 어댑터
class SoundCloudAdapter implements PlatformAdapter {
  private iframe: HTMLIFrameElement | null = null;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private widget: any = null;

  async search(query: string, limit: number = 10): Promise<PlatformSearchResult[]> {
    // SoundCloud 검색은 API 키 문제로 비활성화됨
    // 대신 URL 입력 방식으로 재생 지원
    const error = new Error('SoundCloud 검색은 artist pro 구독이 필요합니다. 트랙 URL을 직접 입력해주세요.');
    (error as any).code = 'SEARCH_NOT_SUPPORTED';
    throw error;
  }

  async load(track: PlatformSearchResult): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.destroy();
        
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '0';
        iframe.style.display = 'none';
        iframe.src = track.embedUrl || track.embedUrl;
        
        document.body.appendChild(iframe);
        this.iframe = iframe;
        
        this.widget = (window as any).SC?.Widget(iframe);
        
        if (this.widget) {
          this.widget.bind((window as any).SC.Widget.Events.READY, () => {
            this.notify('ready');
            resolve();
          });
          
          this.widget.bind((window as any).SC.Widget.Events.Play, (e: any) => {
            this.notify('play', { state: 'playing' });
          });
          
          this.widget.bind((window as any).SC.Widget.Events.Pause, (e: any) => {
            this.notify('pause', { state: 'paused' });
          });
          
          this.widget.bind((window as any).SC.Widget.Events.Finish, (e: any) => {
            this.notify('end', { state: 'stopped' });
          });
          
          this.widget.bind((window as any).SC.Widget.Events.Error, (e: any) => {
            this.notify('error', { message: e.message || 'SoundCloud 재생 오류' });
          });
        } else {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  async play(): Promise<void> {
    if (this.widget) {
      this.widget.play();
    }
  }

  async pause(): Promise<void> {
    if (this.widget) {
      this.widget.pause();
    }
  }

  async stop(): Promise<void> {
    if (this.widget) {
      this.widget.stop();
    }
  }

  async getState(): Promise<PlayerState> {
    if (!this.widget) return 'stopped';
    
    const mode = this.widget.getCurrentState();
    if (mode === 1) return 'playing';
    if (mode === 2) return 'paused';
    if (mode === 3) return 'buffering';
    return 'stopped';
  }

  async setVolume(volume: number): Promise<void> {
    if (this.widget) {
      this.widget.setVolume(volume * 100);
    }
  }

  async getDuration(): Promise<number> {
    if (this.widget) {
      return this.widget.getDuration() / 1000 || 0;
    }
    return 0;
  }

  async getCurrentTime(): Promise<number> {
    if (this.widget) {
      return this.widget.getCurrentPosition() / 1000 || 0;
    }
    return 0;
  }

  async seekTo(time: number): Promise<void> {
    if (this.widget) {
      this.widget.seekTo(time * 1000, true);
    }
  }

  destroy(): void {
    if (this.widget) {
      this.widget.destroy();
      this.widget = null;
    }
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
      this.iframe = null;
    }
  }

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

  protected notify(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => callback(data));
  }
}

// Platform Manager - 단일 어댑터 관리
class PlatformManager {
  private currentAdapter: PlatformAdapter | null = null;
  private currentPlatform: Platform | null = null;

  switchPlatform(platform: Platform, track?: PlatformSearchResult): void {
    if (platform === 'youtube') {
      this.currentAdapter = new YouTubeAdapter();
    } else if (platform === 'soundcloud') {
      this.currentAdapter = new SoundCloudAdapter();
    }
    this.currentPlatform = platform;
    
    if (track && this.currentAdapter) {
      this.currentAdapter.load(track).catch(console.error);
    }
  }

  getCurrentAdapter(): PlatformAdapter | null {
    return this.currentAdapter;
  }

  getCurrentPlatform(): Platform | null {
    return this.currentPlatform;
  }

  async search(query: string, limit?: number): Promise<PlatformSearchResult[]> {
    if (this.currentAdapter) {
      return this.currentAdapter.search(query, limit);
    }
    return [];
  }

  // 이벤트 위임
  on(event: string, callback: EventCallback): EventSubscription {
    if (this.currentAdapter) {
      const subscription = this.currentAdapter.on(event, callback);
      return subscription;
    }
    
    return {
      unsubscribe: () => {}
    };
  }

  destroy(): void {
    if (this.currentAdapter) {
      this.currentAdapter.destroy();
    }
    this.currentAdapter = null;
    this.currentPlatform = null;
  }
}

// 싱글톤 인스턴스
export const platformManager = new PlatformManager();

// 어댑터 인스턴스 export (App.tsx용)
export const youtubeAdapter = new YouTubeAdapter();
export const soundCloudAdapter = new SoundCloudAdapter();

// YouTube API 스크립트 로드 함수
export async function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).YT) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('YouTube IFrame API 로드 실패'));
    document.head.appendChild(script);
  });
}

// SoundCloud Widget API 스크립트 로드 함수
export async function loadSoundCloudAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).SC) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://w.soundcloud.com/player/widget.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('SoundCloud Widget API 로드 실패'));
    document.head.appendChild(script);
  });
}

// SoundCloud URL 유효성 검사
export function validateSoundCloudUrl(url: string): { isValid: boolean; error?: string } {
  const trimmedUrl = url.trim();
  
  if (!trimmedUrl) {
    return { isValid: false, error: 'URL을 입력해주세요' };
  }
  
  // SoundCloud URL 정규식
  const soundcloudRegex = /^https?:\/\/(?:www\.)?soundcloud\.com\/[^/?#]+\/[^/?#]+/i;
  
  if (!soundcloudRegex.test(trimmedUrl)) {
    return { 
      isValid: false, 
      error: '유효하지 않은 SoundCloud URL입니다. 예: https://soundcloud.com/artist/track-name' 
    };
  }
  
  return { isValid: true };
}

// SoundCloud 트랙 URL에서 track 정보 조회
export async function fetchSoundCloudTrackByUrl(url: string): Promise<PlatformSearchResult> {
  // 프론트엔드에서 직접 SoundCloud Widget URL 생성
  // Artist Pro 구독 없이도 Widget으로 재생 가능
  const trimmedUrl = url.trim();
  
  // URL에서 artist/track 추출
  const trackName = trimmedUrl.split('/').pop()?.replace(/[-_]/g, ' ') || 'SoundCloud Track';
  
  // SoundCloud Widget URL 생성
  const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(trimmedUrl)}`;
  
  // artist 추출 (URL에서)
  const urlParts = trimmedUrl.split('/');
  const artistIndex = urlParts.indexOf('soundcloud.com') + 1;
  const artist = urlParts[artistIndex] || 'Unknown';
  
  return {
    id: Date.now().toString(), // 고유 ID
    title: trackName,
    artist,
    album: '',
    duration: 0, // Widget만 사용, 실제 duration은 API에서 못 가져옴
    thumbnail: `https://w.soundcloud.com/community/theme/icons/brand/sounds.png`, // SoundCloud 기본 썸네일
    platform: 'soundcloud',
    url: trimmedUrl,
    embedUrl,
    isPlayable: true,
  };
}