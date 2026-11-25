/**
 * OBJETUNE 타입 정의
 * 모든 타입은 목업 데이터를 위한 것이며 실제 API와는 분리됨
 */

// 음악 트랙
export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // 초 단위
  thumbnail: string; // 이미지 URL (목업)
  platform: 'youtube' | 'soundcloud' | 'spotify' | 'bandcamp';
  url: string; // 플레이리스트용 URL
  isPlayable: boolean;
  addedAt: string; // ISO date string
  // Dynamic Vinyl Label용 아트워크 URL ( 선택적, 플랫폼에 따라 다름 )
  coverArtUrl?: string;
}

// 플랫폼 검색 결과 (YouTube/SoundCloud용 공통 타입)
export interface PlatformSearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // 초 단위
  thumbnail: string;
  platform: 'youtube' | 'soundcloud';
  url: string; // 원본 URL
  embedUrl: string; // IFrame 플레이어용 URL
  publishedAt?: string; // ISO date string
  isPlayable: boolean;
}

// 플레이어 상태
export type PlayerState = 'playing' | 'paused' | 'stopped' | 'loading' | 'error' | 'ended' | 'buffering';

// 플레이어 이벤트
export interface PlayerEvent {
  type: 'play' | 'pause' | 'end' | 'error' | 'state-change';
  data?: any;
}

// 플래티폼 필터
export type PlatformFilter = 'all' | 'youtube' | 'soundcloud' | 'spotify' | 'bandcamp';

// 라이브러리 뷰 상태
export interface LibraryViewState {
  currentView: 'all' | 'playlists' | 'favorites' | 'recently-played';
  searchQuery: string;
  platformFilter: PlatformFilter;
  selectedPlatform: PlatformFilter;
}

// 재생 상태 모델
export type PlaybackState = 'playing' | 'paused' | 'stopped' | 'loading';

// 턴테이블 설정
export interface TurntableSettings {
  dynamicVinylLabel: boolean; // LP 중앙 라벨에 아트워크 표시 여부
}

// LP 회전 관련 상태
export interface VinylState {
  rotation: number; // 회전 각도 (도 단위)
  isRotating: boolean; // 회전 중인지 여부
}

// 플레이리스트
export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackCount: number;
  coverImage: string;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
}

// 사용자 정보
export interface User {
  id: string;
  displayName: string;
  email: string;
  avatar: string;
}

// 앱 모드
export type AppMode = 'shell' | 'library' | 'turntable';

// 검색 결과
export interface SearchResult {
  tracks: Track[];
  playlists: Playlist[];
  totalResults: number;
}

// 현재 재생 중인 트랙 정보
export interface NowPlaying {
  track: Track;
  isPlaying: boolean;
  volume: number;
  progress: number; // 초 단위
  duration: number;
}