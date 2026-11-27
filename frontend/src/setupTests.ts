// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Set NODE_ENV before any imports that check it
process.env.NODE_ENV = 'test';

// Mock matchMedia for reduced-motion support in tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock Tauri APIs for tests
Object.defineProperty(window, '__TAURI_INTEGRATION__', {
  writable: true,
  value: true,
});

// Mock window.screenWidth and window.screenHeight for tests
Object.defineProperty(window, 'screenWidth', {
  writable: true,
  value: 2560,
});
Object.defineProperty(window, 'screenHeight', {
  writable: true,
  value: 1440,
});

// Import mock data from actual file to ensure consistency
import { mockTracks, mockPlaylists } from './data/mockData'; // eslint-disable-line import/first

// Create mock invoke function
const mockInvoke = jest.fn().mockImplementation((command: string, args?: any) => {
  // checkTauri() calls get_app_info
  if (command === 'get_app_info') {
    return Promise.resolve({ name: 'OBJETUNE', version: '0.1.0', mode: 'library' });
  }
  // getAllTracks() - return mock data in the format Tauri API would return
  if (command === 'get_all_tracks') {
    return Promise.resolve(mockTracks.map(t => ({
      id: t.id,
      platform: t.platform,
      platform_id: t.platformId,
      title: t.title,
      artist: t.artist,
      album: t.album || null,
      duration: t.duration,
      thumbnail: t.thumbnail || null,
      url: t.url || null,
      embed_url: t.embedUrl,
      cover_art_url: t.coverArtUrl || null,
      added_at: t.addedAt ? Math.floor(new Date(t.addedAt).getTime() / 1000) : 0,
      is_favorite: t.isFavorite || false,
    })));
  }
  // getPlaylists() - return mock data in the format Tauri API would return
  if (command === 'get_playlists') {
    return Promise.resolve(mockPlaylists.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || null,
      cover_image: p.coverImage || null,
      track_count: p.trackCount,
      created_at: p.createdAt ? Math.floor(new Date(p.createdAt).getTime() / 1000) : 0,
      updated_at: p.updatedAt ? Math.floor(new Date(p.updatedAt).getTime() / 1000) : 0,
      is_favorite: p.isFavorite || false,
    })));
  }
  // Other API calls
  if (command === 'get_current_mode') {
    return Promise.resolve('library');
  }
  if (command === 'get_all_favorites') {
    return Promise.resolve([]);
  }
  if (command === 'get_favorites') {
    return Promise.resolve(mockTracks.filter(t => t.isFavorite).map(t => ({
      id: t.id,
      platform: t.platform,
      platform_id: t.platformId,
      title: t.title,
      artist: t.artist,
      album: t.album || null,
      duration: t.duration,
      thumbnail: t.thumbnail || null,
      url: t.url || null,
      embed_url: t.embedUrl,
      cover_art_url: t.coverArtUrl || null,
      added_at: t.addedAt ? Math.floor(new Date(t.addedAt).getTime() / 1000) : 0,
      is_favorite: t.isFavorite || false,
    })));
  }
  if (command === 'get_history') {
    return Promise.resolve([]);
  }
  if (command === 'get_queue') {
    return Promise.resolve([]);
  }
  if (command === 'get_settings') {
    return Promise.resolve({});
  }
  if (command === 'get_window_size') {
    return Promise.resolve([800, 600]);
  }
  if (command === 'get_window_position') {
    return Promise.resolve([100, 100]);
  }
  if (command === 'get_always_on_top') {
    return Promise.resolve(false);
  }
  if (command === 'get_startup_enabled') {
    return Promise.resolve(false);
  }
  if (command === 'is_maximized') {
    return Promise.resolve(false);
  }
  // Default: return empty object
  return Promise.resolve({});
});

// Mock @tauri-apps/api/core
jest.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

// Expose mockInvoke for tests that need to inspect calls
(global as any).mockInvokeImpl = mockInvoke;

// Mock @tauri-apps/api/window
const mockWindow = {
  onResized: jest.fn(),
  onMoved: jest.fn(),
  getState: jest.fn(() => ({
    size: { width: 800, height: 600 },
    position: { x: 100, y: 100 },
  })),
  getCurrentWindow: jest.fn(() => mockWindow),
};

jest.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => mockWindow,
}));