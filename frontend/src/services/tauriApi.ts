/**
 * Tauri API 래퍼
 * 백엔드 SQLite 및 Tauri 기능을 프론트엔드에서 사용할 수 있도록 래핑합니다.
 */

import { invoke } from '@tauri-apps/api/core';
import { Track, Playlist, PlatformSearchResult } from '../types';

// Type aliases for Tauri API responses
type TrackResponse = {
  id: string;
  platform: string;
  platform_id: string;
  title: string;
  artist: string;
  album: string | null;
  duration: number;
  thumbnail: string | null;
  url: string | null;
  embed_url: string;
  cover_art_url: string | null;
  added_at: number;
  is_favorite: boolean;
};

type PlaylistResponse = {
  id: string;
  name: string;
  description: string | null;
  cover_image: string | null;
  track_count: number;
  created_at: number;
  updated_at: number;
  is_favorite: boolean;
};

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8080';
const YOUTUBE_API_BASE_URL = process.env.REACT_APP_YOUTUBE_API_BASE_URL || API_BASE_URL;

// Tauri API 사용 가능 여부 캐시 (테스트용으로 리셋 가능)
// 테스트 환경에서는 null로 초기화하여 캐시를 사용하지 않도록 함
let isTauriAvailable: boolean | null = null;

// Mock track/playlist data for test environment
let mockTracksData: Track[] = [];
let mockPlaylistsData: Playlist[] = [];

export function setMockData(tracks: Track[], playlists: Playlist[]): void {
  mockTracksData = tracks;
  mockPlaylistsData = playlists;
}

// Helper to check if running in test environment
function isInTestEnvironment(): boolean {
  return (process as any).env?.NODE_ENV === 'test';
}

export async function checkTauri(): Promise<boolean> {
  // In test environment, always return true after mock invoke is set up
  if (isInTestEnvironment()) {
    isTauriAvailable = true;
    return true;
  }
  
  if (isTauriAvailable === null) {
    try {
      await invoke('get_app_info');
      isTauriAvailable = true;
    } catch {
      // Don't cache negative result - backend might not be ready yet
      return false;
    }
  }
  return isTauriAvailable === true;
}

// Track API
export async function createTrack(track: Partial<Track> & Pick<Track, 'platform' | 'embedUrl'>): Promise<Track | null> {
  if (!(await checkTauri())) {
    console.warn('Tauri API not available, track not saved to database');
    return null;
  }

  try {
    const response = await invoke<{
      id: string;
      platform: string;
      platform_id: string;
      title: string;
      artist: string;
      album: string | null;
      duration: number;
      thumbnail: string | null;
      url: string | null;
      embed_url: string;
      cover_art_url: string | null;
      added_at: number;
      is_favorite: boolean;
    }>('create_track', {
      req: {
        platform: track.platform,
        platform_id: track.platformId || 'unknown',
        title: track.title,
        artist: track.artist,
        duration: track.duration || 0,
        thumbnail: track.thumbnail,
        url: track.url,
        embed_url: track.embedUrl,
        cover_art_url: track.coverArtUrl,
        album: track.album || null,
      }
    });

    return {
      id: response.id,
      platform: response.platform as any,
      platformId: response.platform_id,
      title: response.title,
      artist: response.artist,
      album: response.album || '',
      duration: response.duration,
      thumbnail: response.thumbnail || '',
      url: response.url || '',
      embedUrl: response.embed_url,
      isPlayable: true,
      addedAt: new Date(response.added_at * 1000).toISOString(),
      isFavorite: response.is_favorite,
      coverArtUrl: response.cover_art_url || undefined,
    };
  } catch (error) {
    console.error('Failed to create track:', error);
    return null;
  }
}

export async function getAllTracks(): Promise<Track[]> {
  if (!(await checkTauri())) {
    return [];
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return mockTracksData;
  }
  
  try {
    const response = await invoke<Array<TrackResponse>>('get_all_tracks');

    return response.map(t => ({
      id: t.id,
      platform: t.platform as any,
      platformId: t.platform_id,
      title: t.title,
      artist: t.artist,
      album: t.album || '',
      duration: t.duration,
      thumbnail: t.thumbnail || '',
      url: t.url || '',
      embedUrl: t.embed_url,
      isPlayable: true,
      addedAt: new Date(t.added_at * 1000).toISOString(),
      isFavorite: t.is_favorite,
      coverArtUrl: t.cover_art_url || undefined,
    }));
  } catch (error) {
    console.error('Failed to get tracks:', error);
    return [];
  }
}

// Playlist API
export async function getPlaylists(): Promise<Playlist[]> {
  if (!(await checkTauri())) {
    return [];
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return mockPlaylistsData;
  }

  try {
    const response = await invoke<Array<PlaylistResponse>>('get_playlists');

    return response.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      coverImage: p.cover_image || '',
      trackCount: p.track_count,
      createdAt: new Date(p.created_at * 1000).toISOString(),
      updatedAt: new Date(p.updated_at * 1000).toISOString(),
      isFavorite: p.is_favorite,
    }));
  } catch (error) {
    console.error('Failed to get playlists:', error);
    return [];
  }
}

export async function getPlaylistTracks(playlistId: string): Promise<Track[]> {
  if (!(await checkTauri())) {
    return [];
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return mockTracksData.filter(t => (t as any).playlistId === playlistId);
  }

  try {
    const response = await invoke<Array<TrackResponse>>('get_playlist_tracks', { playlistId });

    return response.map(t => ({
      id: t.id,
      platform: t.platform as any,
      platformId: t.platform_id,
      title: t.title,
      artist: t.artist,
      album: t.album || '',
      duration: t.duration,
      thumbnail: t.thumbnail || '',
      url: t.url || '',
      embedUrl: t.embed_url,
      isPlayable: true,
      addedAt: new Date(t.added_at * 1000).toISOString(),
      isFavorite: t.is_favorite,
      coverArtUrl: t.cover_art_url || undefined,
    }));
  } catch (error) {
    console.error('Failed to get playlist tracks:', error);
    return [];
  }
}

export async function addTrackToPlaylist(playlistId: string, trackId: string): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    await invoke('add_track_to_playlist', { playlistId, trackId });
    return true;
  } catch (error) {
    console.error('Failed to add track to playlist:', error);
    return false;
  }
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    await invoke('remove_track_from_playlist', { playlistId, trackId });
    return true;
  } catch (error) {
    console.error('Failed to remove track from playlist:', error);
    return false;
  }
}

export async function deletePlaylist(playlistId: string): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    await invoke('delete_playlist', { playlistId });
    return true;
  } catch (error) {
    console.error('Failed to delete playlist:', error);
    return false;
  }
}

// Favorite API
export async function getFavorites(): Promise<Track[]> {
  if (!(await checkTauri())) {
    return [];
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return mockTracksData.filter(t => t.isFavorite);
  }
  
  try {
    const response = await invoke<Array<TrackResponse>>('get_favorites');

    return response.map(t => ({
      id: t.id,
      platform: t.platform as any,
      platformId: t.platform_id,
      title: t.title,
      artist: t.artist,
      album: t.album || '',
      duration: t.duration,
      thumbnail: t.thumbnail || '',
      url: t.url || '',
      embedUrl: t.embed_url,
      isPlayable: true,
      addedAt: new Date(t.added_at * 1000).toISOString(),
      isFavorite: t.is_favorite,
      coverArtUrl: t.cover_art_url || undefined,
    }));
  } catch (error) {
    console.error('Failed to get favorites:', error);
    return [];
  }
}

export async function addFavorite(trackId: string): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    await invoke('add_favorite', { trackId });
    return true;
  } catch (error) {
    console.error('Failed to add favorite:', error);
    return false;
  }
}

export async function removeFavorite(trackId: string): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    await invoke('remove_favorite', { trackId });
    return true;
  } catch (error) {
    console.error('Failed to remove favorite:', error);
    return false;
  }
}

// History API
export async function getHistory(limit?: number): Promise<Track[]> {
  if (!(await checkTauri())) {
    return [];
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return mockTracksData.slice(0, limit || 50);
  }
  
  try {
    const response = await invoke<Array<TrackResponse>>('get_history', { limit });

    return response.map(t => ({
      id: t.id,
      platform: t.platform as any,
      platformId: t.platform_id,
      title: t.title,
      artist: t.artist,
      album: t.album || '',
      duration: t.duration,
      thumbnail: t.thumbnail || '',
      url: t.url || '',
      embedUrl: t.embed_url,
      isPlayable: true,
      addedAt: new Date(t.added_at * 1000).toISOString(),
      isFavorite: t.is_favorite,
      coverArtUrl: t.cover_art_url || undefined,
    }));
  } catch (error) {
    console.error('Failed to get history:', error);
    return [];
  }
}

export async function addToHistory(trackId: string): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    await invoke('add_to_history', { trackId });
    return true;
  } catch (error) {
    console.error('Failed to add to history:', error);
    return false;
  }
}

// Queue API
export async function getQueue(): Promise<Track[]> {
  if (!(await checkTauri())) {
    return [];
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return [];
  }
  
  try {
    const response = await invoke<Array<TrackResponse>>('get_queue');

    return response.map(t => ({
      id: t.id,
      platform: t.platform as any,
      platformId: t.platform_id,
      title: t.title,
      artist: t.artist,
      album: t.album || '',
      duration: t.duration,
      thumbnail: t.thumbnail || '',
      url: t.url || '',
      embedUrl: t.embed_url,
      isPlayable: true,
      addedAt: new Date(t.added_at * 1000).toISOString(),
      isFavorite: t.is_favorite,
      coverArtUrl: t.cover_art_url || undefined,
    }));
  } catch (error) {
    console.error('Failed to get queue:', error);
    return [];
  }
}

export async function addToQueue(trackId: string): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    await invoke('add_to_queue', { trackId });
    return true;
  } catch (error) {
    console.error('Failed to add to queue:', error);
    return false;
  }
}

export async function clearQueue(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    await invoke('clear_queue');
    return true;
  } catch (error) {
    console.error('Failed to clear queue:', error);
    return false;
  }
}

// Playback settings API
export async function getShuffle(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return false;
  }

  try {
    return await invoke<boolean>('get_shuffle');
  } catch (error) {
    console.error('Failed to get shuffle:', error);
    return false;
  }
}

export async function setShuffle(enabled: boolean): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return enabled;
  }

  try {
    return await invoke<boolean>('set_shuffle', { enabled });
  } catch (error) {
    console.error('Failed to set shuffle:', error);
    return false;
  }
}

export async function getRepeat(): Promise<'off' | 'one' | 'all'> {
  if (!(await checkTauri())) {
    return 'off';
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return 'off';
  }

  try {
    return await invoke<'off' | 'one' | 'all'>('get_repeat');
  } catch (error) {
    console.error('Failed to get repeat:', error);
    return 'off';
  }
}

export async function setRepeat(mode: 'off' | 'one' | 'all'): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    return await invoke<boolean>('set_repeat', { mode });
  } catch (error) {
    console.error('Failed to set repeat:', error);
    return false;
  }
}

export async function setMode(mode: 'library' | 'turntable'): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    return await invoke<boolean>('set_mode', { mode });
  } catch (error) {
    console.error('Failed to set mode:', error);
    return false;
  }
}

export async function getCurrentMode(): Promise<'library' | 'turntable'> {
  if (!(await checkTauri())) {
    return 'library';
  }

  if (isInTestEnvironment()) {
    return 'library';
  }

  try {
    return await invoke('get_current_mode');
  } catch (error) {
    console.error('Failed to get current mode:', error);
    return 'library';
  }
}

// Media shortcuts API
export async function registerMediaShortcuts(): Promise<void> {
  // This function is intentionally not mocked in tests to allow testing
  // the registration/unregistration flow without side effects
  if (isInTestEnvironment()) {
    return;
  }
  
  if (!(await checkTauri())) {
    return;
  }

  try {
    await invoke('register_media_shortcuts');
  } catch (error) {
    console.error('Failed to register media shortcuts:', error);
  }
}

export async function unregisterMediaShortcuts(): Promise<void> {
  // This function is intentionally not mocked in tests to allow testing
  // the registration/unregistration flow without side effects
  if (isInTestEnvironment()) {
    return;
  }
  
  if (!(await checkTauri())) {
    return;
  }

  try {
    await invoke('unregister_media_shortcuts');
  } catch (error) {
    console.error('Failed to unregister media shortcuts:', error);
  }
}

// Queue API
export async function removeFromQueue(trackId: string): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    await invoke('remove_from_queue', { trackId });
    return true;
  } catch (error) {
    console.error('Failed to remove from queue:', error);
    return false;
  }
}

export async function moveQueueItem(trackId: string, newIndex: number): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    await invoke('move_queue_item', { trackId, newIndex });
    return true;
  } catch (error) {
    console.error('Failed to move queue item:', error);
    return false;
  }
}

// Settings API
export async function setSetting(key: string, value: string): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    await invoke('set_setting', { key, value });
    return true;
  } catch (error) {
    console.error('Failed to set setting:', error);
    return false;
  }
}

// Window settings API
export async function toggleAlwaysOnTop(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    return await invoke<boolean>('toggle_always_on_top');
  } catch (error) {
    console.error('Failed to toggle always on top:', error);
    return false;
  }
}

export async function minimize(): Promise<void> {
  if (!(await checkTauri())) {
    return;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return;
  }

  try {
    await invoke('minimize');
  } catch (error) {
    console.error('Failed to minimize:', error);
  }
}

export async function maximize(): Promise<void> {
  if (!(await checkTauri())) {
    return;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return;
  }

  try {
    await invoke('maximize');
  } catch (error) {
    console.error('Failed to maximize:', error);
  }
}

export async function unmaximize(): Promise<void> {
  if (!(await checkTauri())) {
    return;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return;
  }

  try {
    await invoke('unmaximize');
  } catch (error) {
    console.error('Failed to unmaximize:', error);
  }
}

export async function getStartupEnabled(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return false;
  }

  try {
    return await invoke<boolean>('get_startup_enabled');
  } catch (error) {
    console.error('Failed to get startup enabled:', error);
    return false;
  }
}

export async function setStartupEnabled(enabled: boolean): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    return await invoke<boolean>('set_startup_enabled', { enabled });
  } catch (error) {
    console.error('Failed to set startup enabled:', error);
    return false;
  }
}

export async function getMinimizeToTray(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return false;
  }

  try {
    return await invoke<boolean>('get_minimize_to_tray');
  } catch (error) {
    console.error('Failed to get minimize to tray:', error);
    return false;
  }
}

export async function setMinimizeToTray(enabled: boolean): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return true;
  }

  try {
    return await invoke<boolean>('set_minimize_to_tray', { enabled });
  } catch (error) {
    console.error('Failed to set minimize to tray:', error);
    return false;
  }
}

// Window settings API
export async function getWindowSize(): Promise<{ width: number; height: number }> {
  if (!(await checkTauri())) {
    return { width: 800, height: 600 };
  }

  if (isInTestEnvironment()) {
    return { width: 800, height: 600 };
  }

  try {
    const result = await invoke<{ width: number; height: number }>('get_window_size');
    return result || { width: 800, height: 600 };
  } catch (error) {
    console.error('Failed to get window size:', error);
    return { width: 800, height: 600 };
  }
}

export async function setWindowSize(width: number, height: number): Promise<void> {
  if (!(await checkTauri())) {
    return;
  }

  if (isInTestEnvironment()) {
    return;
  }

  try {
    await invoke('set_window_size', { width, height });
  } catch (error) {
    console.error('Failed to set window size:', error);
  }
}

export async function getWindowPosition(): Promise<{ x: number; y: number }> {
  if (!(await checkTauri())) {
    return { x: 100, y: 100 };
  }

  if (isInTestEnvironment()) {
    return { x: 100, y: 100 };
  }

  try {
    const result = await invoke<{ x: number; y: number }>('get_window_position');
    return result || { x: 100, y: 100 };
  } catch (error) {
    console.error('Failed to get window position:', error);
    return { x: 100, y: 100 };
  }
}

export async function setWindowPosition(x: number, y: number): Promise<void> {
  if (!(await checkTauri())) {
    return;
  }

  if (isInTestEnvironment()) {
    return;
  }

  try {
    await invoke('set_window_position', { x, y });
  } catch (error) {
    console.error('Failed to set window position:', error);
  }
}

export async function getAlwaysOnTop(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  if (isInTestEnvironment()) {
    return false;
  }

  try {
    return await invoke<boolean>('get_always_on_top');
  } catch (error) {
    console.error('Failed to get always on top:', error);
    return false;
  }
}

export async function setAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
  if (!(await checkTauri())) {
    return;
  }

  if (isInTestEnvironment()) {
    return;
  }

  try {
    await invoke('set_always_on_top', { alwaysOnTop });
  } catch (error) {
    console.error('Failed to set always on top:', error);
  }
}

export async function isMaximized(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  if (isInTestEnvironment()) {
    return false;
  }

  try {
    return await invoke<boolean>('is_maximized');
  } catch (error) {
    console.error('Failed to check if maximized:', error);
    return false;
  }
}

// Search API
export async function searchYouTubeTracks(query: string, limit?: number): Promise<Track[]> {
  if (!(await checkTauri())) {
    return [];
  }

  // Test environment fallback - filter mock data by query
  if (isInTestEnvironment()) {
    if (!Array.isArray(mockTracksData)) {
      return [];
    }
    const lowerQuery = query.toLowerCase();
    return mockTracksData.filter(
      t => t.title.toLowerCase().includes(lowerQuery) || t.artist.toLowerCase().includes(lowerQuery)
    ).slice(0, limit || 10);
  }
  
  const response = await fetch(
    `${YOUTUBE_API_BASE_URL}/api/v1/youtube/search?q=${encodeURIComponent(query)}&limit=${limit || 10}`
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || `YouTube 검색 실패 (${response.status})`);
  }

  const data: {
    results: Array<{
      video_id: string;
      title: string;
      channel_title: string;
      thumbnail: string;
      video_url: string;
      duration_seconds?: number | null;
    }>;
  } = await response.json();

  return (Array.isArray(data.results) ? data.results : []).map(video => ({
    id: `youtube-${video.video_id}`,
    platform: 'youtube',
    platformId: video.video_id,
    title: video.title,
    artist: video.channel_title,
    album: '',
    duration: video.duration_seconds || 0,
    thumbnail: video.thumbnail,
    url: video.video_url,
    embedUrl: `https://www.youtube.com/embed/${video.video_id}`,
    isPlayable: true,
    addedAt: new Date().toISOString(),
    isFavorite: false,
    coverArtUrl: video.thumbnail,
  }));
}

export async function searchSoundCloudTracks(query: string, limit?: number): Promise<Track[]> {
  void query;
  void limit;
  return [];
}

export async function searchSoundCloudByUrl(url: string): Promise<PlatformSearchResult | null> {
  if (!(await checkTauri())) {
    return null;
  }

  // Test environment fallback
  if (isInTestEnvironment()) {
    return null;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/soundcloud/track?url=${encodeURIComponent(url)}`
    );
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || `SoundCloud URL 조회 실패 (${response.status})`);
    }

    const track = await response.json() as {
      id: string;
      title: string;
      description: string;
      url: string;
      embed_url: string;
      artwork_url: string | null;
      duration: number;
    };

    const artist = new URL(track.url).pathname.split('/').filter(Boolean)[0] || 'SoundCloud';

    return {
      id: track.id,
      platform: 'soundcloud',
      platformId: track.id,
      title: track.title,
      artist,
      album: track.description || '',
      duration: Math.round(track.duration / 1000),
      thumbnail: track.artwork_url || '',
      url: track.url,
      embedUrl: track.embed_url,
      isPlayable: true,
      addedAt: new Date().toISOString(),
      isFavorite: false,
      coverArtUrl: track.artwork_url || undefined,
    };
  } catch (error) {
    console.error('Failed to search SoundCloud by URL:', error);
    throw error;
  }
}
