import React, { useState } from 'react';
import './SearchBar.css';
import { PlatformFilter, PlatformSearchResult } from '../types';
import { validateSoundCloudUrl, fetchSoundCloudTrackByUrl } from '../services/platformAdapter';

interface SearchBarProps {
  value: string;
  onSearch: (query: string) => void;
  platformFilter: PlatformFilter;
  onPlatformFilter: (platform: PlatformFilter) => void;
  placeholder?: string;
  className?: string;
  onSoundCloudTrackAdded?: (track: PlatformSearchResult) => void;
}

const platforms = [
  { id: 'all', label: 'All' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'soundcloud', label: 'SoundCloud' },
  { id: 'spotify', label: 'Spotify' },
  { id: 'bandcamp', label: 'BandCamp' },
];

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onSearch,
  platformFilter,
  onPlatformFilter,
  placeholder = 'Search music...',
  className = '',
  onSoundCloudTrackAdded,
}) => {
  const [soundcloudUrl, setSoundcloudUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className={`vw-search-bar ${className}`} role="search">
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
            onClick={handleSoundCloudSubmit}
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
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            aria-label="Search music"
          />
          <select
            className="vw-search-bar__filter"
            value={platformFilter}
            onChange={(e) => onPlatformFilter(e.target.value as PlatformFilter)}
            aria-label="Filter by platform"
          >
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
};