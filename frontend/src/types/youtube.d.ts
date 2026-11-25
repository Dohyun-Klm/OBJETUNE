/**
 * YouTube IFrame Player API 타입 정의
 * 공식 문서: https://developers.google.com/youtube/iframe_api_reference
 */

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, options: YT.PlayerOptions) => YT.Player;
    };
  }

  namespace YT {
    // 플레이어 상태
    enum PlayerState {
      UNSTARTED = -1,
      ENDING = 0,
      PLAYING = 1,
      PAUSED = 2,
      BUFFERING = 3,
      CUED = 5,
    }

    // 플레이어 옵션
    interface PlayerOptions {
      videoId: string;
      playerVars?: PlayerVars;
      events?: PlayerEvents;
      width?: number | string;
      height?: number | string;
      container?: HTMLElement;
    }

    // 플레이어 변수
    interface PlayerVars {
      autoPlay?: number;
      controls?: number;
      disableKeyboard?: number;
      fs?: number;
      hl?: string;
      iv_load_policy?: number;
      modestbranding?: number;
      playsinline?: number;
      rel?: number;
      start?: number;
    }

    // 플레이어 이벤트
    interface PlayerEvents {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: StateChangeEvent) => void;
      onError?: (event: ErrorEvent) => void;
    }

    // 기본 플레이어 이벤트
    interface PlayerEvent {
      type: 'onReady' | 'onStateChange' | 'onError' | string;
      target: Player;
      data?: any;
    }

    // 상태 변경 이벤트
    interface StateChangeEvent extends PlayerEvent {
      data: number;
    }

    // 오류 이벤트
    interface ErrorEvent extends PlayerEvent {
      data: number;
    }

    // YouTube 플레이어 인스턴스
    interface Player {
      // 재생 제어
      playVideo(): void;
      pauseVideo(): void;
      stopVideo(): void;
      seekTo(seconds: number, allowSeekAhead: boolean): void;

      // 상태 조회
      getPlayerState(): number;
      getCurrentTime(): number;
      getDuration(): number;

      // 볼륨 제어
      mute(): void;
      unMute(): void;
      isMuted(): boolean;
      setVolume(volume: number): void;
      getVolume(): number;

      // 품질 설정
      setPlaybackQuality(suggestedQuality: string): void;
      getPlaybackQuality(): string;
      setBenchmark(benchmark: boolean): void;

      // 로드
      loadVideoById(videoId: string): void;
      loadVideoById(videoId: string, startSeconds: number): void;
      cueVideoById(videoId: string): void;
      cueVideoById(videoId: string, startSeconds: number): void;
      cueVideoByUrl(url: string): void;

      // 화면
      getIframe(): HTMLIFrameElement | null;
      getAvailablePlaybackRates(): number[];

      // 이벤트 바인딩
      addEventListener(event: string, listener: Function): void;
      removeEventListener(event: string, listener: Function): void;

      // 파괴
      destroy(): void;
    }
  }
}

export {};