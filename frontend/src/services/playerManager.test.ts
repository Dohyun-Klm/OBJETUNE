import { Track } from '../types';
import { playerManager } from './playerManager';

it('replaces the YouTube iframe without removing its dock and reports native pause controls', async () => {
  const dock = document.createElement('div');
  dock.id = 'youtube-player-container';
  document.body.appendChild(dock);
  const originalYouTube = window.YT;
  let changeState: (state: number) => void = () => {};
  const seekTo = jest.fn();
  const Player = jest.fn((elementId: string, options: YT.PlayerOptions) => {
    const frame = document.createElement('iframe');
    document.getElementById(elementId)?.replaceWith(frame);
    const instance = { destroy: () => frame.remove(), getCurrentTime: () => 1, getDuration: () => 100, seekTo };
    const target = instance as unknown as YT.Player;
    changeState = data => options.events?.onStateChange?.({ target, data, type: 'onStateChange' });
    Promise.resolve().then(() => options.events?.onReady?.({ target, type: 'onReady' }));
    return instance;
  });
  Object.defineProperty(window, 'YT', { configurable: true, writable: true, value: { Player } });
  const pause = jest.fn();
  const subscription = playerManager.on('pause', pause);
  const track: Track = {
    id: 'youtube-first', platformId: 'first', platform: 'youtube', title: 'First', artist: '',
    album: '', duration: 100, thumbnail: '', url: '', embedUrl: '', isPlayable: true, addedAt: '',
  };

  try {
    await playerManager.load(track);
    changeState(1);
    changeState(2);
    expect(pause).toHaveBeenCalled();
    await playerManager.seekTo(150);
    expect(seekTo).toHaveBeenCalledWith(100, true);
    await playerManager.load({ ...track, id: 'youtube-second', platformId: 'second' });
    expect(document.getElementById(dock.id)).toBe(dock);
    expect(dock.querySelectorAll('iframe')).toHaveLength(1);
    expect(Player).toHaveBeenLastCalledWith('youtube-player-mount', expect.objectContaining({
      videoId: 'second', width: '100%', height: '100%',
    }));
  } finally {
    subscription.unsubscribe();
    playerManager.destroy();
    window.YT = originalYouTube;
    dock.remove();
  }
});

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
    seekTo: jest.fn(),
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
    await playerManager.seekTo(37.5);
    expect(widget.seekTo).toHaveBeenCalledWith(37500);
  } finally {
    playerManager.destroy();
    window.SC = originalSoundCloud;
  }
});
