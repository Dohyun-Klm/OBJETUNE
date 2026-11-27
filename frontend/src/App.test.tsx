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
    expect(screen.getByRole('button', { name: 'Switch to SoundCloud' })).toBeInTheDocument();
  });

  it('renders navigation items', async () => {
    await act(async () => {
      render(<App />);
    });
    const libraryElements = screen.getAllByText('Library');
    expect(libraryElements.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Playlists').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Favorites').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Recently Played').length).toBeGreaterThan(0);
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

  it('changes view when navigation item is clicked', async () => {
    await act(async () => {
      render(<App />);
    });
    const playlistsLink = screen.getByRole('link', { name: /playlists/i });
    fireEvent.click(playlistsLink);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /playlists/i })).toBeInTheDocument();
    });
    expect(screen.getByText('Vintage Classics')).toBeInTheDocument();
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

  it('renders playlists', async () => {
    await act(async () => {
      render(<App />);
    });
    // Click on Playlists tab first
    const playlistsLink = screen.getByRole('link', { name: /playlists/i });
    fireEvent.click(playlistsLink);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /playlists/i })).toBeInTheDocument();
    });
    expect(screen.getByText('Vintage Classics')).toBeInTheDocument();
  });
});