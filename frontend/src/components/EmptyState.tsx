import React from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Nothing here yet',
  description = 'Start exploring the music library',
  action,
  className = '',
}) => {
  return (
    <div className={`vw-empty-state ${className}`} role="region" aria-label="Empty state">
      <svg
        className="vw-empty-state__icon"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="50" cy="50" r="40" />
        <path d="M50 25v50M35 50h30" />
      </svg>
      <h3 className="vw-empty-state__title">{title}</h3>
      <p className="vw-empty-state__description">{description}</p>
      {action && <div className="vw-empty-state__action">{action}</div>}
    </div>
  );
};