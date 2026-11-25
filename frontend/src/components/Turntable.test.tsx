import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Turntable } from './Turntable';
import { NowPlaying, Track } from '../types';

// Mock track for testing
const mockTrack: Track = {
  id: 'test-track-1',
  title: 'Test Song',
  artist: 'Test Artist',
  album: 'Test Album',
  duration: 180,
  thumbnail: '/test-thumbnail.jpg',
  platform: 'spotify',
  url: 'https://example.com/test',
  isPlayable: true,
  addedAt: '2024-01-01T00:00:00.000Z',
};

const mockNowPlaying: NowPlaying = {
  track: mockTrack,
  isPlaying: true,
  volume: 80,
  progress: 30,
  duration: 180,
};

describe('Turntable', () => {
  it('renders turntable container with correct ARIA label', () => {
    render(<Turntable nowPlaying={null} playbackState="stopped" onPlayPause={() => {}} />);
    const container = screen.getByRole('region', { name: 'Turntable' });
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('vw-turntable-container');
  });

  it('shows play/pause button', () => {
    render(<Turntable nowPlaying={mockNowPlaying} playbackState="paused" onPlayPause={() => {}} />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('shows pause button when playing', () => {
    render(<Turntable nowPlaying={mockNowPlaying} playbackState="playing" onPlayPause={() => {}} />);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('calls onPlayPause when play button is clicked', () => {
    const mockPlayPause = jest.fn();
    render(<Turntable nowPlaying={mockNowPlaying} playbackState="paused" onPlayPause={mockPlayPause} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(mockPlayPause).toHaveBeenCalledTimes(1);
  });

  it('does not show play button when showPlayButton is false', () => {
    render(<Turntable nowPlaying={mockNowPlaying} playbackState="playing" onPlayPause={() => {}} showPlayButton={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders vinyl record when track is playing', () => {
    render(<Turntable nowPlaying={mockNowPlaying} playbackState="playing" onPlayPause={() => {}} showPlayButton={false} />);
    const vinyl = screen.getByRole('img', { name: /Test Song by Test Artist/i });
    expect(vinyl).toBeInTheDocument();
  });

  it('displays track title on vinyl when playing', () => {
    render(<Turntable nowPlaying={mockNowPlaying} playbackState="playing" onPlayPause={() => {}} showPlayButton={false} />);
    expect(screen.getByText('PLAYING')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Turntable nowPlaying={null} playbackState="stopped" onPlayPause={() => {}} className="custom-class" />);
    const container = screen.getByRole('region', { name: 'Turntable' });
    expect(container).toHaveClass('custom-class');
  });

  it('renders tonearm elements', () => {
    render(<Turntable nowPlaying={null} playbackState="stopped" onPlayPause={() => {}} />);
    expect(screen.getByTestId('tonearm')).toBeInTheDocument();
    expect(screen.getByTestId('tonearm-pivot')).toBeInTheDocument();
    expect(screen.getByTestId('tonearm-head')).toBeInTheDocument();
  });

  it('renders HP light element', () => {
    render(<Turntable nowPlaying={null} playbackState="stopped" onPlayPause={() => {}} />);
    expect(screen.getByTestId('hp-light')).toBeInTheDocument();
  });
});

describe('VinylRecord (via Turntable)', () => {
  it('renders vinyl record with default label when no cover art', () => {
    const trackWithoutArt: NowPlaying = {
      ...mockNowPlaying,
      track: { ...mockTrack, coverArtUrl: undefined } as Track,
    };
    render(<Turntable nowPlaying={trackWithoutArt} playbackState="stopped" onPlayPause={() => {}} showPlayButton={false} />);
    expect(screen.getByText('OBJETUNE')).toBeInTheDocument();
  });

  it('shows PAUSED status when not playing', () => {
    render(<Turntable nowPlaying={mockNowPlaying} playbackState="paused" onPlayPause={() => {}} showPlayButton={false} />);
    expect(screen.getByTestId('vinyl-record')).toBeInTheDocument();
  });

  it('vinyl rotates when playing', () => {
    render(<Turntable nowPlaying={mockNowPlaying} playbackState="playing" onPlayPause={() => {}} showPlayButton={false} />);
    const vinyl = screen.getByRole('img', { name: /Test Song by Test Artist/i });
    expect(vinyl).toHaveStyle('transform: rotate(0deg)');
  });
});

describe('Turntable with null nowPlaying', () => {
  it('renders without crashing when nowPlaying is null', () => {
    render(<Turntable nowPlaying={null} playbackState="stopped" onPlayPause={() => {}} />);
    expect(screen.getByRole('region', { name: 'Turntable' })).toBeInTheDocument();
  });

  it('does not spin when nowPlaying is null', () => {
    render(<Turntable nowPlaying={null} playbackState="playing" onPlayPause={() => {}} />);
    // Should show default label
    expect(screen.getByText('OBJETUNE')).toBeInTheDocument();
  });
});

describe('PlaybackState transitions', () => {
  it('shows correct button for stopped state', () => {
    render(<Turntable nowPlaying={mockNowPlaying} playbackState="stopped" onPlayPause={() => {}} />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('shows correct button for loading state', () => {
    render(<Turntable nowPlaying={mockNowPlaying} playbackState="loading" onPlayPause={() => {}} />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });
});