import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

// Tauri API 모킹
const mockInvoke = jest.fn();
jest.mock('@tauri-apps/api/core', () => ({
  invoke: () => mockInvoke(),
}));

describe('App', () => {
  beforeEach(() => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'get_app_info') {
        return Promise.resolve({
          name: 'OBJETUNE',
          version: '0.1.0',
          mode: 'library',
        });
      }
      if (command === 'get_current_mode') {
        return Promise.resolve('library');
      }
      return Promise.resolve({});
    });
    // window.__TAURI_INTEGRATION__ 모킹
    (window as any).__TAURI_INTEGRATION__ = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the main title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /library/i })).toBeInTheDocument();
  });

  it('renders search bar', () => {
    render(<App />);
    expect(screen.getByLabelText('Search music')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by platform')).toBeInTheDocument();
  });

  it('renders navigation items', () => {
    render(<App />);
    // Library는 여러 곳에 있으므로 getAllByText 사용
    const libraryElements = screen.getAllByText('Library');
    expect(libraryElements.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Playlists').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Favorites').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Recently Played').length).toBeGreaterThan(0);
  });

  it('renders tracks in library view', () => {
    render(<App />);
    // Mock 데이터에 있는 트랙 제목들이 렌더링되어야 함
    expect(screen.getAllByText('Blue Moon').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Let It Be').length).toBeGreaterThan(0);
  });

  it('renders mini player', () => {
    render(<App />);
    expect(screen.getByRole('region', { name: 'Mini player' })).toBeInTheDocument();
  });

  it('changes view when navigation item is clicked', () => {
    render(<App />);
    const playlistsLink = screen.getByRole('link', { name: /playlists/i });
    fireEvent.click(playlistsLink);
    expect(screen.getByRole('heading', { name: /playlists/i })).toBeInTheDocument();
    // 플레이리스트 뷰에서는 플레이리스트 이름이 표시됨
    expect(screen.getByText('Vintage Classics')).toBeInTheDocument();
  });

  it('filters tracks by search query', () => {
    render(<App />);
    const searchInput = screen.getByLabelText('Search music');
    fireEvent.change(searchInput, { target: { value: 'Blue' } });
    // 검색 결과에 맞는 트랙만 표시됨
    const blueMoonElements = screen.getAllByText('Blue Moon');
    expect(blueMoonElements.length).toBeGreaterThan(0);
  });

  it('shows empty state when no results', () => {
    render(<App />);
    const searchInput = screen.getByLabelText('Search music');
    fireEvent.change(searchInput, { target: { value: 'nonexistent-song-xyz' } });
    expect(screen.getByText('No music found')).toBeInTheDocument();
  });

  it('loads app info on mount', () => {
    render(<App />);
    // Tauri API가 호출되었는지 확인
    expect(mockInvoke).toHaveBeenCalled();
  });
});

// 모의 데이터 테스트
describe('Mock Data', () => {
  it('mock data has expected tracks', () => {
    // 이 테스트는 컴파일이 잘되고 mockData가 올바르게 export되었는지 확인
    const { mockTracks } = require('./data/mockData');
    expect(Array.isArray(mockTracks)).toBe(true);
    expect(mockTracks.length).toBeGreaterThan(0);
  });

  it('mock data has expected playlists', () => {
    const { mockPlaylists } = require('./data/mockData');
    expect(Array.isArray(mockPlaylists)).toBe(true);
    expect(mockPlaylists.length).toBeGreaterThan(0);
  });
});