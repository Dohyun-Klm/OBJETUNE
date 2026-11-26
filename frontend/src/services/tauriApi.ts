/**
 * Tauri API 래퍼
 * 백엔드 SQLite 및 Tauri 기능을 프론트엔드에서 사용할 수 있도록 래핑합니다.
 */

import { invoke } from '@tauri-apps/api/core';
import { Track, Playlist, NowPlaying } from '../types';

// Tauri API 사용 가능 여부
let isTauriAvailable: boolean | null = null;

export async function checkTauri(): Promise<boolean> {
  if (isTauriAvailable === null) {
    isTauriAvailable = !!(window as any).__TAURI_INTEGRATION__;
  }
  return isTauriAvailable;
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