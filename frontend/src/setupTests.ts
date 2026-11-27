// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { Track, Playlist } from './types';

// Set NODE_ENV before any imports that check it
(process.env as any).NODE_ENV = 'test';

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

// Test mock data - defined here for tests only
export const mockTracks: Track[] = [
  {
    id: 'track-001',
    platform: 'soundcloud',
    platformId: 'sc-12345',
    title: 'Blue Moon',
    artist: 'Billie Holiday',
    album: 'Lady in Satin',
    duration: 255,
    thumbnail: '🎵',
    url: 'https://soundcloud.com/example/blue-moon',
    embedUrl: 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/12345',
    isPlayable: true,
    addedAt: new Date('2024-01-15').toISOString(),
    isFavorite: false,
  },
  {
    id: 'track-002',
    platform: 'youtube',
    platformId: 'yt-67890',
    title: 'Let It Be',
    artist: 'The Beatles',
    album: 'Abbey Road',
    duration: 243,
    thumbnail: '🎵',
    url: 'https://youtube.com/watch?v=example',
    embedUrl: 'https://www.youtube.com/embed/example',
    isPlayable: true,
    addedAt: new Date('2024-01-10').toISOString(),
    isFavorite: false,
  },
  {
    id: 'track-003',
    platform: 'spotify',
    platformId: 'sp-11111',
    title: 'What a Wonderful World',
    artist: 'Louis Armstrong',
    album: 'What a Wonderful World',
    duration: 126,
    thumbnail: '🎵',
    url: 'https://spotify.com/track/example',
    embedUrl: 'https://open.spotify.com/embed/track/example',
    isPlayable: true,
    addedAt: new Date('2024-01-05').toISOString(),
    isFavorite: true,
  },
];

export const mockPlaylists: Playlist[] = [
  {
    id: 'pl-001',
    name: 'Vintage Classics',
    description: '1970년대 빈티지 명곡 모음',
    trackCount: 12,
    coverImage: '',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-20').toISOString(),
    isFavorite: true,
  },
  {
    id: 'pl-002',
    name: 'Jazz Essentials',
    description: '재즈의 정석들',
    trackCount: 8,
    coverImage: '',
    createdAt: new Date('2024-01-05').toISOString(),
    updatedAt: new Date('2024-01-15').toISOString(),
    isFavorite: true,
  },
];

// Mock @tauri-apps/api/core invoke function
// This is needed because the actual tauriApi.ts implementation calls invoke,
// and the test file's jest.mock for tauriApi needs invoke to return proper data.

declare global {
  interface Window {
    __mockInvokeResponses?: Record<string, any>;
  }
}

// Initialize mock responses on window object
window.__mockInvokeResponses = {
  'get_app_info': {},
};

// Mock invoke function that can be modified at runtime
let mockInvokeResponses = window.__mockInvokeResponses;

jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn((command: string, _args?: any) => {
    return Promise.resolve(mockInvokeResponses[command] || {});
  }),
}));

// Helper function to set mock responses (available globally)
(window as any).__setMockInvokeResponses = (responses: Record<string, any>) => {
  mockInvokeResponses = { ...mockInvokeResponses, ...responses };
  window.__mockInvokeResponses = mockInvokeResponses;
};

// Mock @tauri-apps/api/window
const mockWindow: any = {
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

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});