import React from 'react';
import './Sidebar.css';

interface SidebarProps {
  currentView: 'all' | 'playlists' | 'favorites' | 'recently-played';
  onViewChange: (view: 'all' | 'playlists' | 'favorites' | 'recently-played') => void;
  currentMode?: 'shell' | 'library' | 'turntable';
  onModeChange?: (mode: 'library' | 'turntable') => void;
  className?: string;
}

const navigationItems = [
  { id: 'all', label: 'Library', icon: '🎵' },
  { id: 'playlists', label: 'Playlists', icon: '📋' },
  { id: 'favorites', label: 'Favorites', icon: '⭐' },
  { id: 'recently-played', label: 'Recently Played', icon: '⏮️' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onViewChange, 
  currentMode = 'library',
  onModeChange,
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
            🎧
          </button>
          <button
            className={`vw-sidebar__mode-btn ${currentMode === 'library' ? 'vw-sidebar__mode-btn--active' : ''}`}
            onClick={() => onModeChange('library')}
            aria-label="Library Mode"
          >
            🖼️
          </button>
        </div>
      )}
      
      <div className="vw-sidebar__nav">
        {navigationItems.map((item) => (
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
            <span className="vw-sidebar__nav-item__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
};