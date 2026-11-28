import { Track } from '../types';
import { playerManager } from './playerManager';

it('uses the SoundCloud Widget title and artwork while keeping the saved track identity', async () => {
  const url = 'https://soundcloud.com/bangtan/thankyouarmy2020';
  const artwork = 'https://i1.sndcdn.com/artworks-test.jpg';
  const track: Track = {
    id: 'soundcloud-sc-legacy',
    platformId: 'sc-legacy',
    platform: 'soundcloud',
    title: '"thankyouarmy2020"',
    artist: 'bangtan',
    album: '',
    thumbnail: '',
    duration: 0,
    url,
    embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}`,
    isPlayable: true,
    addedAt: '2026-01-01T00:00:00.000Z',
    isFavorite: true,
  };

  const events = new Map<string, () => void>();
  const widget = {
    bind: (event: string, callback: () => void) => events.set(event, callback),
    getCurrentSound: (callback: (sound: object) => void) => callback({
      title: 'Still With You by JK of BTS',
      user: { username: '방탄소년단' },
      artwork_url: artwork,
      duration: 240000,
    }),
  };
  const Widget = Object.assign(() => widget, {
    Events: { READY: 'ready', PLAY: 'play', PAUSE: 'pause', FINISH: 'finish', PLAY_PROGRESS: 'progress', ERROR: 'error' },
  });
  const originalSoundCloud = window.SC;
  Object.defineProperty(window, 'SC', { configurable: true, writable: true, value: { Widget } });

  try {
    const loading = playerManager.load(track);
    await Promise.resolve();
    events.get('ready')?.();
    await expect(loading).resolves.toMatchObject({
      id: track.id,
      platformId: track.platformId,
      isFavorite: true,
      title: 'Still With You by JK of BTS',
      artist: '방탄소년단',
      thumbnail: artwork,
      coverArtUrl: artwork,
      duration: 240,
    });
  } finally {
    playerManager.destroy();
    window.SC = originalSoundCloud;
  }
});
