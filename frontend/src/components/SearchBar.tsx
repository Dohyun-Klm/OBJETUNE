import React, { useState } from 'react';
import './SearchBar.css';
import { PlatformFilter, PlatformSearchResult, Track } from '../types';
import { validateSoundCloudUrl, fetchSoundCloudTrackByUrl } from '../services/platformAdapter';

interface SearchBarProps {
  value: string;
  onSearch: (query: string) => void;
  platformFilter: PlatformFilter;
  onPlatformFilter: (platform: PlatformFilter) => void;
  placeholder?: string;
  className?: string;
  onTrackAdded?: (track: Track) => void;
  onSoundCloudTrackAdded?: (track: PlatformSearchResult) => void;
  onYouTubeSearch?: (query: string) => void;
  onSoundCloudUrlSubmit?: (url: string) => void;
}

// 현재 지원하는 플랫폼 (Spotify, Bandcamp 비활성화 - API 미연동)
const platforms = [
  { id: 'youtube', label: 'YouTube' },
  { id: 'soundcloud', label: 'SoundCloud' },
];

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onSearch,
  platformFilter,
  onPlatformFilter,
  placeholder = '검색...',
  className = '',
  onTrackAdded,
  onSoundCloudTrackAdded,
  onYouTubeSearch,
  onSoundCloudUrlSubmit,
}) => {
  const [soundcloudUrl, setSoundcloudUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Platform toggle handler
  const handlePlatformToggle = () => {
    const nextPlatform = platformFilter === 'youtube' ? 'soundcloud' : 'youtube';
    onPlatformFilter(nextPlatform);
    
    // Reset URL input when switching to SoundCloud
    if (nextPlatform === 'soundcloud') {
      setSoundcloudUrl('');
      setUrlError(null);
    }
  };

  const handleSoundCloudSubmit = async () => {
    const trimmedUrl = soundcloudUrl.trim();
    
    if (!trimmedUrl) {
      setUrlError('URL을 입력해주세요');
      return;
    }

    const validation = validateSoundCloudUrl(trimmedUrl);
    if (!validation.isValid) {
      setUrlError(validation.error || '유효하지 않은 URL입니다');
      return;
    }

    setSubmitting(true);
    setUrlError(null);

    try {
      const track = await fetchSoundCloudTrackByUrl(trimmedUrl);
      if (onSoundCloudTrackAdded) {
        onSoundCloudTrackAdded(track);
      }
      if (onTrackAdded) {
        // PlatformSearchResult를 Track으로 변환
        onTrackAdded({
          id: Date.now().toString(),
          platform: 'soundcloud',
          platformId: 'placeholder',
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          thumbnail: track.thumbnail,
          url: track.url,
          embedUrl: track.embedUrl,
          isPlayable: true,
          addedAt: new Date().toISOString(),
        });
      }
      setSoundcloudUrl('');
    } catch (err: any) {
      setUrlError(err.message || '트랙 조회에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && platformFilter === 'soundcloud') {
      handleSoundCloudSubmit();
    }
  };

  const getCurrentPlatform = () => {
    return platforms.find(p => p.id === platformFilter) || platforms[0];
  };

  return (
    <div className={`vw-search-bar ${className}`} role="search">
      {/* Platform toggle button - left side */}
      <button
        className="vw-search-bar__platform-btn"
        onClick={handlePlatformToggle}
        aria-label={`Switch to ${platformFilter === 'youtube' ? 'SoundCloud' : 'YouTube'}`}
        title={`${getCurrentPlatform().label} 모드`}
      >
        {getCurrentPlatform().label}
      </button>
      
      {/* Search input area - right side */}
      <div className="vw-search-bar__input-area">
        {platformFilter === 'soundcloud' ? (
          <>
            <input
              type="text"
              className="vw-search-bar__input"
              value={soundcloudUrl}
              onChange={(e) => {
                setSoundcloudUrl(e.target.value);
                setUrlError(null);
              }}
              onKeyPress={handleKeyPress}
              placeholder="SoundCloud 트랙 URL을 붙여넣기 (예: https://soundcloud.com/artist/track)"
              aria-label="SoundCloud track URL"
            />
            <button
              className="vw-search-bar__submit"
              onClick={() => {
                if (onSoundCloudUrlSubmit) {
                  onSoundCloudUrlSubmit(soundcloudUrl);
                  setSoundcloudUrl('');
                } else {
                  handleSoundCloudSubmit();
                }
              }}
              disabled={submitting}
              aria-label="Add SoundCloud track"
            >
              {submitting ? '등록중...' : '트랙 추가'}
            </button>
            {urlError && (
              <div className="vw-search-bar__error" role="alert">
                {urlError}
              </div>
            )}
            <div className="vw-search-bar__note">
              SoundCloud는 트랙 URL을 입력하여 재생할 수 있습니다.
            </div>
          </>
        ) : (
          <>
            <input
              type="search"
              className="vw-search-bar__input"
              value={value}
              onChange={(e) => {
                onSearch(e.target.value);
                if (onYouTubeSearch) {
                  onYouTubeSearch(e.target.value);
                }
              }}
              placeholder={placeholder}
              aria-label="Search music"
            />
          </>
        )}
      </div>
    </div>
  );
};