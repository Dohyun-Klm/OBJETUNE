import React from 'react';
import { TurntableSettings } from '../types';

interface SettingsProps {
  settings: TurntableSettings;
  onToggleDynamicVinylLabel: () => void;
  className?: string;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onToggleDynamicVinylLabel,
  className = '',
}) => {
  return (
    <div className={`vw-settings ${className}`} role="region" aria-label="Settings">
      <h3 className="vw-settings__title">Settings</h3>
      
      <div className="vw-settings__group">
        <h4 className="vw-settings__group-title">Turntable</h4>
        
        <div className="vw-settings__item">
          <label className="vw-settings__label">
            <input
              type="checkbox"
              checked={settings.dynamicVinylLabel}
              onChange={onToggleDynamicVinylLabel}
              className="vw-settings__checkbox"
              aria-label="Toggle Dynamic Vinyl Label"
            />
            <span className="vw-settings__label-text">Dynamic Vinyl Label</span>
          </label>
          <p className="vw-settings__description">
            Show track artwork on LP label
          </p>
        </div>
      </div>
    </div>
  );
};