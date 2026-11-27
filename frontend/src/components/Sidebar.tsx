import React from 'react';
import './Sidebar.css';

interface SidebarProps {
  currentView: 'all' | 'playlists' | 'favorites' | 'recently-played' | 'queue';
  onViewChange: (view: 'all' | 'playlists' | 'favorites' | 'recently-played' | 'queue') => void;
  currentMode?: 'shell' | 'library' | 'turntable';
  onModeChange?: (mode: 'library' | 'turntable') => void;
  className?: string;
  queueLength?: number;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  showCount?: boolean;
  count?: number;
}

// SVG 아이콘 컴포넌트
const Icon: React.FC<{ name: string; className?: string }> = ({ name, className = '' }) => {
  const icons: Record<string, React.ReactNode> = {
    music: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" strokeWidth="2" stroke="currentColor">
        <path d="M12 4v16m8-8H4v16h16z" strokeLinecap="round" />
      </svg>
    ),
    playlist: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" strokeWidth="2" stroke="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <path d="M3 9h18" strokeLinecap="round" />
        <path d="M3 13h18" strokeLinecap="round" />
      </svg>
    ),
    favorite: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <path d="M12 21s-5-4-5-11a5 5 0 0 1 10 0c0 7-5 11-5 11z" strokeLinecap="round" />
      </svg>
    ),
    history: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 10v4l1 1" strokeLinecap="round" />
      </svg>
    ),
    queue: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <path d="M3 9h18" strokeLinecap="round" />
      </svg>
    ),
    settings: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0-3.28 1c0 1.23-.79 2.21-1.82 2.36" strokeLinecap="round" />
        <path d="M12 8.5V4l-4 4h2.5" strokeLinecap="round" />
        <path d="M7 13.5V16l-4 4h2.5" strokeLinecap="round" />
        <path d="M15.7 15.7L16.5 16.5" strokeLinecap="round" />
        <path d="M8.3 8.3L9 9" strokeLinecap="round" />
      </svg>
    ),
    turntable: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8" strokeLinecap="round" />
        <path d="M8 12h8" strokeLinecap="round" />
      </svg>
    ),
    library: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <path d="M3 9h18" strokeLinecap="round" />
      </svg>
    ),
  };

  const IconComponent = icons[name];
  return IconComponent ? (
    <span className={`vw-sidebar__icon ${className}`} aria-hidden="true">
      {IconComponent}
    </span>
  ) : null;
};

const navigationItems: NavigationItem[] = [
  { id: 'all', label: 'Library', icon: 'music' },
  { id: 'playlists', label: 'Playlists', icon: 'playlist' },
  { id: 'favorites', label: 'Favorites', icon: 'favorite' },
  { id: 'recently-played', label: 'Recently Played', icon: 'history' },
  { id: 'queue', label: 'Queue', icon: 'queue', showCount: true, count: 0 },
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onViewChange, 
  currentMode = 'library',
  onModeChange,
  queueLength = 0,
  className = '' 
}) => {
  return (
    <nav className={`vw-sidebar ${className}`} aria-label="Main navigation">
      <div className="vw-sidebar__logo" aria-label="OBJETUNE">
        <span>OBJETUNE</span>
      </div>
      
      {/* 앱 모드 전환 (터널블 모드 전용) */}
      {onModeChange && (
        <div className="vw-sidebar__mode-switch">
          <button
            className={`vw-sidebar__mode-btn ${currentMode === 'turntable' ? 'vw-sidebar__mode-btn--active' : ''}`}
            onClick={() => onModeChange('turntable')}
            aria-label="Turntable Mode"
          >
            <Icon name="turntable" />
          </button>
          <button
            className={`vw-sidebar__mode-btn ${currentMode === 'library' ? 'vw-sidebar__mode-btn--active' : ''}`}
            onClick={() => onModeChange('library')}
            aria-label="Library Mode"
          >
            <Icon name="library" />
          </button>
        </div>
      )}
      
      <div className="vw-sidebar__nav">
        {navigationItems.map((item) => {
          const displayCount = item.id === 'queue' ? queueLength : item.count;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`vw-sidebar__nav-item ${currentView === item.id ? 'vw-sidebar__nav-item--active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                if (item.id !== 'settings') {
                  onViewChange(item.id as any);
                }
              }}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.showCount && (displayCount ?? 0) > 0 && (
                <span className="vw-sidebar__nav-item__count">{displayCount}</span>
              )}
            </a>
          );
        })}
      </div>
    </nav>
  );
};