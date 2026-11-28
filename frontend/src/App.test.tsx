import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { setMockData } from './services/tauriApi';
import { mockTracks, mockPlaylists } from './setupTests';

// IMPORTANT: Import App AFTER all jest.mock calls
import App from './App';

describe('App', () => {
  beforeEach(() => {
    // window.__TAURI_INTEGRATION__ 모킹
    (window as any).__TAURI_INTEGRATION__ = true;
    
    // Set up mock data for tauriApi
    setMockData(mockTracks, mockPlaylists);
    
    // Mock localStorage
    const localStorageMock = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: jest.fn((key: string) => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; }),
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    
    // Mock matchMedia
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the main title', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByRole('heading', { name: /library/i })).toBeInTheDocument();
  });

  it('renders search bar', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByLabelText('Search music')).toBeInTheDocument();
    const platform = screen.getByRole('switch', { name: 'SoundCloud 모드' });
    expect(platform).not.toBeChecked();
    fireEvent.click(platform);
    expect(platform).toBeChecked();
    expect(screen.getByPlaceholderText('SoundCloud는 트랙 URL을 입력하여 재생할 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add SoundCloud track' })).toBeInTheDocument();
  });

  it('removes the old sidebar navigation', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
    expect(screen.queryByText(/playlists|favorites|recently played/i)).not.toBeInTheDocument();
  });

  it('renders tracks in library view', async () => {
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => {
      expect(screen.getAllByText('Blue Moon').length).toBeGreaterThan(0);
    });
  });

  it('renders mini player', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByRole('region', { name: 'Mini player' })).toBeInTheDocument();
  });

  it('keeps the same mode buttons in the header across both views', async () => {
    await act(async () => {
      render(<App />);
    });
    const lp = screen.getByRole('button', { name: 'LP' });
    const library = screen.getByRole('button', { name: '라이브러리' });
    fireEvent.click(lp);
    expect(await screen.findByRole('region', { name: 'Turntable' })).toBeInTheDocument();
    expect(lp).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(library);
    expect(await screen.findByRole('heading', { name: 'Library' })).toBeInTheDocument();
    expect(library).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters tracks by search query', async () => {
    await act(async () => {
      render(<App />);
    });
    await act(async () => {
      const searchInput = screen.getByLabelText('Search music');
      fireEvent.change(searchInput, { target: { value: 'Blue' } });
    });
    await waitFor(() => {
      const blueMoonElements = screen.getAllByText('Blue Moon');
      expect(blueMoonElements.length).toBeGreaterThan(0);
    });
  });

  it('shows empty state when no results', async () => {
    await act(async () => {
      render(<App />);
    });
    const searchInput = screen.getByLabelText('Search music');
    fireEvent.change(searchInput, { target: { value: 'nonexistent-song-xyz' } });
    await waitFor(() => {
      expect(screen.getByText(/No music found/)).toBeInTheDocument();
    });
  });

  it('shows queued tracks from the bottom button and keeps the queue across modes', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Blue Moon to queue' }));
    fireEvent.click(screen.getByRole('button', { name: '대기열 1' }));
    expect(screen.getByRole('region', { name: '현재 재생목록' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'LP' }));
    expect(await screen.findByRole('region', { name: 'Turntable' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Blue Moon 대기열에서 제거' }));
    expect(screen.getByText('대기 중인 곡이 없습니다.')).toBeInTheDocument();
  });
});
