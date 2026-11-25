/**
 * OBJETUNE Mock 데이터
 * 목업 데이터로서 실제 API 응답과는 별개로 동작합니다.
 */

import { Track, Playlist, NowPlaying } from '../types';

// 목업 음악 트랙
export const mockTracks: Track[] = [
  {
    id: 'track-001',
    title: 'Blue Moon',
    artist: 'Billie Holiday',
    album: 'Lady in Satin',
    duration: 255,
    thumbnail: '🎵',
    platform: 'soundcloud',
    url: 'https://soundcloud.com/example/blue-moon',
    isPlayable: true,
    addedAt: new Date('2024-01-15').toISOString(),
  },
  {
    id: 'track-002',
    title: 'Let It Be',
    artist: 'The Beatles',
    album: 'Abbey Road',
    duration: 243,
    thumbnail: '🎵',
    platform: 'youtube',
    url: 'https://youtube.com/watch?v=example',
    isPlayable: true,
    addedAt: new Date('2024-01-10').toISOString(),
  },
  {
    id: 'track-003',
    title: 'What a Wonderful World',
    artist: 'Louis Armstrong',
    album: 'What a Wonderful World',
    duration: 126,
    thumbnail: '🎵',
    platform: 'spotify',
    url: 'https://spotify.com/track/example',
    isPlayable: true,
    addedAt: new Date('2024-01-05').toISOString(),
  },
  {
    id: 'track-004',
    title: 'Sultans of Swing',
    artist: 'Dire Straits',
    album: 'Brothers in Arms',
    duration: 294,
    thumbnail: '🎵',
    platform: 'youtube',
    url: 'https://youtube.com/watch?v=example2',
    isPlayable: true,
    addedAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'track-005',
    title: 'Dreams',
    artist: 'Fleetwood Mac',
    album: 'Rumours',
    duration: 258,
    thumbnail: '🎵',
    platform: 'bandcamp',
    url: 'https://bandcamp.com/track/example',
    isPlayable: true,
    addedAt: new Date('2023-12-28').toISOString(),
  },
  {
    id: 'track-006',
    title: 'At Last',
    artist: 'Etta James',
    album: 'At Last!',
    duration: 165,
    thumbnail: '🎵',
    platform: 'soundcloud',
    url: 'https://soundcloud.com/example/at-last',
    isPlayable: true,
    addedAt: new Date('2023-12-20').toISOString(),
  },
  {
    id: 'track-007',
    title: 'Hotel California (Live)',
    artist: 'Eagles',
    album: 'Live in America',
    duration: 398,
    thumbnail: '🎵',
    platform: 'youtube',
    url: 'https://youtube.com/watch?v=example3',
    isPlayable: true,
    addedAt: new Date('2023-12-15').toISOString(),
  },
  {
    id: 'track-008',
    title: 'I Want It That Way',
    artist: 'Backstreet Boys',
    album: 'Millennium',
    duration: 217,
    thumbnail: '🎵',
    platform: 'spotify',
    url: 'https://spotify.com/track/example2',
    isPlayable: true,
    addedAt: new Date('2023-12-10').toISOString(),
  },
];

// 목업 플레이리스트
export const mockPlaylists: Playlist[] = [
  {
    id: 'pl-001',
    name: 'Vintage Classics',
    description: '1970년대 빈티지 명곡 모음',
    trackCount: 12,
    coverImage: '🎵',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-20').toISOString(),
    isFavorite: true,
  },
  {
    id: 'pl-002',
    name: 'Jazz Essentials',
    description: '재즈의 정석들',
    trackCount: 8,
    coverImage: '🎷',
    createdAt: new Date('2024-01-05').toISOString(),
    updatedAt: new Date('2024-01-15').toISOString(),
    isFavorite: true,
  },
  {
    id: 'pl-003',
    name: 'Rock Anthems',
    description: '롤 rock의 명곡들',
    trackCount: 15,
    coverImage: '🎸',
    createdAt: new Date('2024-01-10').toISOString(),
    updatedAt: new Date('2024-01-18').toISOString(),
    isFavorite: false,
  },
  {
    id: 'pl-004',
    name: 'Chill Vibes',
    description: '여유로운 감성 음악',
    trackCount: 20,
    coverImage: '🛋️',
    createdAt: new Date('2024-01-12').toISOString(),
    updatedAt: new Date('2024-01-19').toISOString(),
    isFavorite: false,
  },
  {
    id: 'pl-005',
    name: 'Recently Added',
    description: '최근에 추가된 곡들',
    trackCount: 8,
    coverImage: '🆕',
    createdAt: new Date('2024-01-20').toISOString(),
    updatedAt: new Date('2024-01-20').toISOString(),
    isFavorite: false,
  },
];

// 현재 재생 중인 트랙 (목업)
export const mockNowPlaying: NowPlaying = {
  track: mockTracks[0],
  isPlaying: true,
  volume: 75,
  progress: 60,
  duration: mockTracks[0].duration,
};

// 플랫폼 필터 옵션
export const platformFilters = [
  { id: 'all', label: 'All' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'soundcloud', label: 'SoundCloud' },
  { id: 'spotify', label: 'Spotify' },
  { id: 'bandcamp', label: 'BandCamp' },
];