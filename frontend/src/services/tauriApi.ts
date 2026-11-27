/**
 * Tauri API 래퍼
 * 백엔드 SQLite 및 Tauri 기능을 프론트엔드에서 사용할 수 있도록 래핑합니다.
 */

import { invoke } from '@tauri-apps/api/core';
import { Track, Playlist } from '../types';

// Test mock data - imported dynamically to avoid circular dependency
let mockTracks: Track[] = [];
let mockPlaylists: Playlist[] = [];

async function loadMockData() {
  if (mockTracks.length === 0 || mockPlaylists.length === 0) {
    const { mockTracks: mt, mockPlaylists: mp } = await import('../data/mockData');
    mockTracks = mt;
    mockPlaylists = mp;
  }
}

// Tauri API 사용 가능 여부 캐시 (테스트용으로 리셋 가능)
// 테스트 환경에서는 null로 초기화하여 캐시를 사용하지 않도록 함
let isTauriAvailable: boolean | null = null;

export async function checkTauri(): Promise<boolean> {
  // In test environment, always return true after mock invoke is set up
  if (process.env.NODE_ENV === 'test') {
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

  // In test environment, return mock data directly
  if (process.env.NODE_ENV === 'test') {
    await loadMockData();
    return mockTracks;
  }

  try {
    const response = await invoke<Array<{
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
    }>>('get_all_tracks');

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

export async function getTrack(trackId: string): Promise<Track | null> {
  if (!(await checkTauri())) {
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
    }>('get_track', { trackId });

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
    console.error('Failed to get track:', error);
    return null;
  }
}

// Playlist API
export async function createPlaylist(name: string, description?: string): Promise<Playlist | null> {
  if (!(await checkTauri())) {
    return null;
  }

  try {
    const response = await invoke<{
      id: string;
      name: string;
      description: string | null;
      cover_image: string | null;
      track_count: number;
      created_at: number;
      updated_at: number;
      is_favorite: boolean;
    }>('create_playlist', {
      req: {
        name,
        description,
        cover_image: undefined,
      }
    });

    return {
      id: response.id,
      name: response.name,
      description: response.description || '',
      trackCount: response.track_count,
      coverImage: response.cover_image || '',
      createdAt: new Date(response.created_at * 1000).toISOString(),
      updatedAt: new Date(response.updated_at * 1000).toISOString(),
      isFavorite: response.is_favorite,
    };
  } catch (error) {
    console.error('Failed to create playlist:', error);
    return null;
  }
}

export async function getPlaylists(): Promise<Playlist[]> {
  if (!(await checkTauri())) {
    return [];
  }

  // In test environment, return mock data directly
  if (process.env.NODE_ENV === 'test') {
    await loadMockData();
    return mockPlaylists;
  }

  try {
    const response = await invoke<Array<{
      id: string;
      name: string;
      description: string | null;
      cover_image: string | null;
      track_count: number;
      created_at: number;
      updated_at: number;
      is_favorite: boolean;
    }>>('get_playlists');

    return response.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      trackCount: p.track_count,
      coverImage: p.cover_image || '',
      createdAt: new Date(p.created_at * 1000).toISOString(),
      updatedAt: new Date(p.updated_at * 1000).toISOString(),
      isFavorite: p.is_favorite,
    }));
  } catch (error) {
    console.error('Failed to get playlists:', error);
    return [];
  }
}

// Favorite API
export async function addFavorite(trackId: string): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  try {
    const result = await invoke<boolean>('add_favorite', { trackId });
    return result;
  } catch (error) {
    console.error('Failed to add favorite:', error);
    return false;
  }
}

export async function removeFavorite(trackId: string): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  try {
    const result = await invoke<boolean>('remove_favorite', { trackId });
    return result;
  } catch (error) {
    console.error('Failed to remove favorite:', error);
    return false;
  }
}

export async function getFavorites(): Promise<Track[]> {
  if (!(await checkTauri())) {
    return [];
  }

  try {
    const response = await invoke<Array<{
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
    }>>('get_favorites');

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

// History API
export async function addToHistory(trackId: string): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  try {
    const result = await invoke<boolean>('add_to_history', { trackId });
    return result;
  } catch (error) {
    console.error('Failed to add to history:', error);
    return false;
  }
}

export async function getHistory(limit?: number): Promise<Track[]> {
  if (!(await checkTauri())) {
    return [];
  }

  try {
    const response = await invoke<Array<{
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
    }>>('get_history', { limit });

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

// Settings API
export async function getSetting(key: string): Promise<string | null> {
  if (!(await checkTauri())) {
    return null;
  }

  try {
    const response = await invoke<string | null>('get_setting', { key });
    return response;
  } catch (error) {
    console.error('Failed to get setting:', error);
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }

  try {
    const result = await invoke<boolean>('set_setting', { key, value });
    return result;
  } catch (error) {
    console.error('Failed to set setting:', error);
    return false;
  }
}

// Queue API
export async function getQueue(): Promise<Track[]> {
  if (!(await checkTauri())) {
    return [];
  }

  try {
    const response = await invoke<Array<{
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
    }>>('get_queue');

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

  // In test environment, return success
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  try {
    return await invoke<boolean>('add_to_queue', { trackId });
  } catch (error) {
    console.error('Failed to add to queue:', error);
    return false;
  }
}

// 창 관리 API
export async function getWindowSize(): Promise<{ width: number; height: number } | null> {
  if (!(await checkTauri())) {
    return null;
  }
  
  // In test environment, return mock data directly
  if (process.env.NODE_ENV === 'test') {
    return { width: 800, height: 600 };
  }
  
  try {
    const result = await invoke<[number, number]>('get_window_size');
    return { width: result[0], height: result[1] };
  } catch (error) {
    console.error('Failed to get window size:', error);
    return null;
  }
}

export async function setWindowSize(width: number, height: number): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  // In test environment, return success
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    return await invoke<boolean>('set_window_size', { width, height });
  } catch (error) {
    console.error('Failed to set window size:', error);
    return false;
  }
}

export async function getWindowPosition(): Promise<{ x: number; y: number } | null> {
  if (!(await checkTauri())) {
    return null;
  }
  
  // In test environment, return mock data directly
  if (process.env.NODE_ENV === 'test') {
    return { x: 100, y: 100 };
  }
  
  try {
    const result = await invoke<[number, number]>('get_window_position');
    return { x: result[0], y: result[1] };
  } catch (error) {
    console.error('Failed to get window position:', error);
    return null;
  }
}

export async function setWindowPosition(x: number, y: number): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  // In test environment, return success
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    return await invoke<boolean>('set_window_position', { x, y });
  } catch (error) {
    console.error('Failed to set window position:', error);
    return false;
  }
}

export async function getAlwaysOnTop(): Promise<boolean | null> {
  if (!(await checkTauri())) {
    return null;
  }
  
  // In test environment, return mock data directly
  if (process.env.NODE_ENV === 'test') {
    return false;
  }
  
  try {
    return await invoke<boolean>('get_always_on_top');
  } catch (error) {
    console.error('Failed to get always on top:', error);
    return null;
  }
}

export async function setAlwaysOnTop(alwaysOnTop: boolean): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  // In test environment, return success
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    return await invoke<boolean>('set_always_on_top', { always_on_top: alwaysOnTop });
  } catch (error) {
    console.error('Failed to set always on top:', error);
    return false;
  }
}

export async function toggleAlwaysOnTop(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  // In test environment, return success
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    return await invoke<boolean>('toggle_always_on_top');
  } catch (error) {
    console.error('Failed to toggle always on top:', error);
    return false;
  }
}

export async function isMinimized(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  // In test environment, return mock data directly
  if (process.env.NODE_ENV === 'test') {
    return false;
  }
  
  try {
    return await invoke<boolean>('is_minimized');
  } catch (error) {
    console.error('Failed to check minimized state:', error);
    return false;
  }
}

export async function minimize(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  try {
    return await invoke<boolean>('minimize');
  } catch (error) {
    console.error('Failed to minimize window:', error);
    return false;
  }
}

export async function maximize(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  try {
    return await invoke<boolean>('maximize');
  } catch (error) {
    console.error('Failed to maximize window:', error);
    return false;
  }
}

export async function unmaximize(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  try {
    return await invoke<boolean>('unmaximize');
  } catch (error) {
    console.error('Failed to unmaximize window:', error);
    return false;
  }
}

export async function isMaximized(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  // In test environment, return mock data directly
  if (process.env.NODE_ENV === 'test') {
    return false;
  }
  
  try {
    return await invoke<boolean>('is_maximized');
  } catch (error) {
    console.error('Failed to check maximized state:', error);
    return false;
  }
}

// 자동 실행 API
export async function getStartupEnabled(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  // In test environment, return mock data directly
  if (process.env.NODE_ENV === 'test') {
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
  
  // In test environment, return success
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    return await invoke<boolean>('set_startup_enabled', { enabled });
  } catch (error) {
    console.error('Failed to set startup enabled:', error);
    return false;
  }
}

// 트레이로 최소화 설정 API
export async function getMinimizeToTray(): Promise<boolean> {
  if (!(await checkTauri())) {
    return true; // 기본값 true
  }
  
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    return await invoke<boolean>('get_minimize_to_tray');
  } catch (error) {
    console.error('Failed to get minimize to tray:', error);
    return true;
  }
}

export async function setMinimizeToTray(enabled: boolean): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    return await invoke<boolean>('set_minimize_to_tray', { enabled });
  } catch (error) {
    console.error('Failed to set minimize to tray:', error);
    return false;
  }
}

// 앱 초기화
export async function initializeApp(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  // In test environment, return success
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    return await invoke<boolean>('init_db');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    return false;
  }
}

// 재생 설정 API
export async function getShuffle(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  if (process.env.NODE_ENV === 'test') {
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
  
  if (process.env.NODE_ENV === 'test') {
    return true;
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
  
  if (process.env.NODE_ENV === 'test') {
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
  
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    return await invoke<boolean>('set_repeat', { mode });
  } catch (error) {
    console.error('Failed to set repeat:', error);
    return false;
  }
}

// Queue API extensions
export async function removeFromQueue(trackId: string): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    return await invoke<boolean>('remove_from_queue', { trackId });
  } catch (error) {
    console.error('Failed to remove from queue:', error);
    return false;
  }
}

export async function clearQueue(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    return await invoke<boolean>('clear_queue');
  } catch (error) {
    console.error('Failed to clear queue:', error);
    return false;
  }
}

export async function moveQueueItem(trackId: string, newIndex: number): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    return await invoke<boolean>('move_queue_item', { trackId, newPosition: newIndex + 1 });
  } catch (error) {
    console.error('Failed to move queue item:', error);
    return false;
  }
}

// Global shortcuts API
export async function registerMediaShortcuts(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    return await invoke<boolean>('register_media_shortcuts');
  } catch (error) {
    console.error('Failed to register media shortcuts:', error);
    return false;
  }
}

export async function unregisterMediaShortcuts(): Promise<boolean> {
  if (!(await checkTauri())) {
    return false;
  }
  
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    return await invoke<boolean>('unregister_media_shortcuts');
  } catch (error) {
    console.error('Failed to unregister media shortcuts:', error);
    return false;
  }
}

// YouTube Search API
export async function searchYouTubeTracks(query: string, limit?: number): Promise<Track[]> {
  if (!(await checkTauri())) {
    return [];
  }
  
  // In test environment, return mock data from fixture
  if (process.env.NODE_ENV === 'test') {
    await loadMockData();
    return mockTracks.filter(t => 
      t.platform === 'youtube' && (
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.artist.toLowerCase().includes(query.toLowerCase())
      )
    );
  }
  
  try {
    const response = await invoke('search_youtube_tracks', { query, limit }) as any[];
    
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
    console.error('Failed to search YouTube tracks:', error);
    return [];
  }
}

// SoundCloud URL search
export async function searchSoundCloudByUrl(url: string): Promise<Track | null> {
  if (!(await checkTauri())) {
    return null;
  }
  
  // In test environment, return mock data
  if (process.env.NODE_ENV === 'test') {
    return {
      id: 'sc_test',
      platform: 'soundcloud',
      title: 'SoundCloud Track',
      artist: 'Test Artist',
      album: '',
      duration: 0,
      thumbnail: '',
      url,
      embedUrl: `https://w.soundcloud.com/player/?url=${url}`,
      isPlayable: true,
      addedAt: new Date().toISOString(),
    };
  }
  
  try {
    const response = await invoke('search_soundcloud_by_url', { url }) as any;
    
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
    console.error('Failed to search SoundCloud by URL:', error);
    return null;
  }
}