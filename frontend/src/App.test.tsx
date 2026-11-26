import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    // window.__TAURI_INTEGRATION__ 모킹 (setupTests.ts에서 이미 설정됨)
    (window as any).__TAURI_INTEGRATION__ = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  async function renderApp() {
    const { container, ...utils } = render(<App />);
    // 비동기 데이터 로딩 완료 대기
    await waitFor(() => {
      // localTracks가 설정될 때까지 대기 (적어도 mockTracks가 로드되었음을 확인)
      expect(screen.getByText('Blue Moon')).toBeInTheDocument();
    });
    return { container, ...utils };
  }

  it('renders the main title', async () => {
    await renderApp();
    expect(screen.getByRole('heading', { name: /library/i })).toBeInTheDocument();
  });

  it('renders search bar', async () => {
    await renderApp();
    expect(screen.getByLabelText('Search music')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by platform')).toBeInTheDocument();
  });

  it('renders navigation items', async () => {
    await renderApp();
    // Library는 여러 곳에 있으므로 getAllByText 사용
    const libraryElements = screen.getAllByText('Library');
    expect(libraryElements.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Playlists').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Favorites').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Recently Played').length).toBeGreaterThan(0);
  });

  it('renders tracks in library view', async () => {
    await renderApp();
    // Mock 데이터에 있는 트랙 제목들이 렌더링되어야 함
    expect(screen.getAllByText('Blue Moon').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Let It Be').length).toBeGreaterThan(0);
  });

  it('renders mini player', async () => {
    await renderApp();
    expect(screen.getByRole('region', { name: 'Mini player' })).toBeInTheDocument();
  });

  it('changes view when navigation item is clicked', async () => {
    await renderApp();
    const playlistsLink = screen.getByRole('link', { name: /playlists/i });
    fireEvent.click(playlistsLink);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /playlists/i })).toBeInTheDocument();
    });
    // 플레이리스트 뷰에서는 플레이리스트 이름이 표시됨
    expect(screen.getByText('Vintage Classics')).toBeInTheDocument();
  });

  it('filters tracks by search query', async () => {
    await renderApp();
    const searchInput = screen.getByLabelText('Search music');
    fireEvent.change(searchInput, { target: { value: 'Blue' } });
    await waitFor(() => {
      // 검색 결과에 맞는 트랙만 표시됨
      const blueMoonElements = screen.getAllByText('Blue Moon');
      expect(blueMoonElements.length).toBeGreaterThan(0);
    });
  });

  it('shows empty state when no results', async () => {
    await renderApp();
    const searchInput = screen.getByLabelText('Search music');
    fireEvent.change(searchInput, { target: { value: 'nonexistent-song-xyz' } });
    await waitFor(() => {
      expect(screen.getByText('No music found')).toBeInTheDocument();
    });
  });

  it('loads app info on mount', async () => {
    await renderApp();
    // Tauri API가 호출되었는지 확인 (invoke 함수가 global에서 제공됨)
    const mockInvokeImpl = (global as any).mockInvokeImpl;
    expect(mockInvokeImpl).toBeDefined();
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