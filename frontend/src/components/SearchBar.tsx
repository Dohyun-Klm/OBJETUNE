import React from 'react';
import './SearchBar.css';
import { PlatformFilter } from '../types';

interface SearchBarProps {
  value: string;
  onSearch: (query: string) => void;
  platformFilter: PlatformFilter;
  onPlatformFilter: (platform: PlatformFilter) => void;
  placeholder?: string;
  className?: string;
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
}) => {
  return (
    <div className={`vw-search-bar ${className}`} role="search">
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
    </div>
  );
};