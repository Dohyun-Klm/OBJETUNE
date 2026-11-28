import React, { useState } from 'react';
import './SearchBar.css';
import { PlatformFilter } from '../types';
import { validateSoundCloudUrl } from '../services/platformAdapter';
import type { YouTubeSearchMode } from '../services/tauriApi';

interface SearchBarProps {
  value: string;
  onSearch: (query: string) => void;
  platformFilter: PlatformFilter;
  onPlatformFilter: (platform: PlatformFilter) => void;
  placeholder?: string;
  className?: string;
  onYouTubeSearch?: (query: string) => void;
  youtubeMode: YouTubeSearchMode;
  onYouTubeModeChange: (mode: YouTubeSearchMode) => void;
  onSoundCloudUrlSubmit?: (url: string) => Promise<void>;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onSearch,
  platformFilter,
  onPlatformFilter,
  placeholder = '검색...',
  className = '',
  onYouTubeSearch,
  youtubeMode,
  onYouTubeModeChange,
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

  const handleSoundCloudSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !onSoundCloudUrlSubmit) return;
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
      await onSoundCloudUrlSubmit(trimmedUrl);
      setSoundcloudUrl('');
    } catch (err: any) {
      setUrlError(err.message || '트랙 조회에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`vw-search-bar ${className}`} role="search">
      {/* Platform toggle button - left side */}
      <button
        type="button"
        className="vw-search-bar__platform-switch"
        role="switch"
        aria-checked={platformFilter === 'soundcloud'}
        onClick={handlePlatformToggle}
        aria-label="SoundCloud 모드"
        title="YouTube / SoundCloud 전환"
      >
        <span aria-hidden="true">YouTube</span>
        <span className="vw-search-bar__lever" aria-hidden="true" />
        <span aria-hidden="true">SoundCloud</span>
      </button>
      
      {/* Search input area - right side */}
      <div className="vw-search-bar__input-area">
        {platformFilter === 'soundcloud' ? (
          <>
            <form className="vw-search-bar__url-form" onSubmit={handleSoundCloudSubmit}>
              <input
                type="text"
                inputMode="url"
                className="vw-search-bar__input"
                value={soundcloudUrl}
                onChange={(e) => {
                  setSoundcloudUrl(e.target.value);
                  setUrlError(null);
                }}
                placeholder="SoundCloud는 트랙 URL을 입력하여 재생할 수 있습니다."
                aria-label="SoundCloud track URL"
                disabled={submitting}
              />
              <button
                type="submit"
                className="vw-search-bar__submit"
                disabled={submitting || !onSoundCloudUrlSubmit}
                aria-label="Add SoundCloud track"
              >
                {submitting ? '등록 중…' : '트랙 추가'}
              </button>
            </form>
            {urlError && (
              <div className="vw-search-bar__error" role="alert">
                {urlError}
              </div>
            )}
          </>
        ) : (
          <form className="vw-search-bar__youtube-form" onSubmit={(event) => {
            event.preventDefault();
            if (value.trim()) onYouTubeSearch?.(value.trim());
          }}>
            <select className="vw-search-bar__filter" aria-label="YouTube 검색 범위" value={youtubeMode}
              onChange={(event) => onYouTubeModeChange(event.target.value === 'all' ? 'all' : 'music')}>
              <option value="music">음악</option>
              <option value="all">전체 영상</option>
            </select>
            <input
              type="search"
              className="vw-search-bar__input"
              value={value}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={placeholder}
              aria-label="Search music"
            />
            <button type="submit" className="vw-search-bar__submit" disabled={!value.trim()}>검색</button>
          </form>
        )}
      </div>
    </div>
  );
};
