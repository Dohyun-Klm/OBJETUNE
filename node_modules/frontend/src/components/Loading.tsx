import React from 'react';
import './Loading.css';

interface LoadingProps {
  message?: string;
  className?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  message = 'Loading...',
  className = '',
}) => {
  return (
    <div className={`vw-loading ${className}`} role="status" aria-live="polite">
      <div className="vw-loading__spinner" aria-hidden="true" />
      <span className="vw-loading__message visually-hidden">{message}</span>
    </div>
  );
};