/**
 * SoundCloud Widget API 타입 정의
 * 공식 문서: https://developers.soundcloud.com/docs/api/reference/#widget-api
 */

declare global {
  interface Window {
    SC: typeof SC;
  }

  namespace SC {
    // 워지 이벤트
    interface WidgetEvents {
      READY: 'ready';
      PLAY: 'play';
      PAUSE: 'pause';
      FINISH: 'finish';
      QUEUE_FINISH: 'queue-finish';
      BUFFERING: 'buffering';
      PROGRESS: 'progress';
      ERROR: 'error';
      ID: 'id';
    }

    // 워지 옵션
    interface WidgetOptions {
      auto_play?: boolean;
      background?: boolean;
      color?: string;
      related?: boolean;
      show_artwork?: boolean;
      show_comments?: boolean;
      show_profile?: boolean;
      show_related?: boolean;
      show_teaser?: boolean;
      show_user?: boolean;
      show_waveform?: boolean;
      start_track?: number;
      visual?: boolean;
      callbacks?: Record<string, (arg: any) => void>;
    }

    // 워지 타겟트
    interface WidgetTargets {
      TRACK: string;
      PLAYLIST: string;
    }

    // 워지 이벤트 구조
    interface WidgetEventData {
      currentPosition: number;
      duration: number;
      seekableRange?: [number, number];
      loadedTime?: number;
      index?: number;
      message?: string;
      errorCode?: number;
      errorMessage?: string;
      id?: number;
      title?: string;
    }

    // SoundCloud Widget 인터페이스
    interface Widget {
      // 재생 제어
      play(): void;
      pause(): void;
      toggle(): void;
      stop(): void;
      seekTo(seconds: number): void;
      jumpToProgress(percent: number): void;

      // 상태 조회
      getCurrentState(): number;
      getVolume(): number;
      getDuration(): number;
      getCurrentPosition(): number;
      getVolumeLimits(): [number, number];

      // 볼륨 제어
      setVolume(volume: number): void;
      mute(): void;
      unMute(): void;
      isMuted(): boolean;

      // 이벤트 바인딩
      bind(event: keyof WidgetEvents, callback: (arg: WidgetEventData) => void): void;
      unbind(event: keyof WidgetEvents, callback: (arg: WidgetEventData) => void): void;
      setVolumeLimits(min: number, max: number): void;

      // 파괴
      destroy(): void;
    }

    // Widget 팩토리 함수
    function Widget(iframe: HTMLIFrameElement): Widget;

    // 정적 속성
    const Events: WidgetEvents;
    const Options: WidgetOptions;
    const Targets: WidgetTargets;
  }
}

export {};