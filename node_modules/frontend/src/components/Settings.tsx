import React, { useState, useEffect } from 'react';
import { TurntableSettings } from '../types';
import {
  getWindowSize,
  setWindowSize,
  getWindowPosition,
  setWindowPosition,
  getAlwaysOnTop,
  toggleAlwaysOnTop,
  minimize,
  maximize,
  unmaximize,
  isMaximized,
  getStartupEnabled,
  setStartupEnabled,
  getMinimizeToTray,
  setMinimizeToTray,
} from '../services/tauriApi';

interface SettingsProps {
  settings: TurntableSettings;
  onToggleDynamicVinylLabel: () => void;
  className?: string;
}

// 창 관리 상태 타입
interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
  alwaysOnTop: boolean;
  isMaximized: boolean;
  startupEnabled: boolean;
  minimizeToTray: boolean;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onToggleDynamicVinylLabel,
  className = '',
}) => {
  const [windowState, setWindowState] = useState<WindowState>({
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    alwaysOnTop: false,
    isMaximized: false,
    startupEnabled: false,
    minimizeToTray: true,
  });

  const [showWindowSettings, setShowWindowSettings] = useState(false);
  const [widthInput, setWidthInput] = useState(800);
  const [heightInput, setHeightInput] = useState(600);
  const [isEditingPosition, setIsEditingPosition] = useState(false);
  const [xInput, setXInput] = useState(0);
  const [yInput, setYInput] = useState(0);

  useEffect(() => {
    loadWindowState();
    loadStartupState();
    loadMinimizeToTrayState();
  }, []);

  const loadWindowState = async () => {
    const size = await getWindowSize();
    const pos = await getWindowPosition();
    const aot = await getAlwaysOnTop();
    const maximized = await isMaximized();

    setWindowState(prev => ({
      ...prev,
      width: size?.width ?? 800,
      height: size?.height ?? 600,
      x: pos?.x ?? 0,
      y: pos?.y ?? 0,
      alwaysOnTop: aot ?? false,
      isMaximized: maximized ?? false,
    }));

    setWidthInput(size?.width ?? 800);
    setHeightInput(size?.height ?? 600);
    setXInput(pos?.x ?? 0);
    setYInput(pos?.y ?? 0);
  };

  const loadStartupState = async () => {
    const enabled = await getStartupEnabled();
    setWindowState(prev => ({
      ...prev,
      startupEnabled: enabled,
    }));
  };

  const loadMinimizeToTrayState = async () => {
    const enabled = await getMinimizeToTray();
    setWindowState(prev => ({
      ...prev,
      minimizeToTray: enabled,
    }));
  };

  const handleResize = async () => {
    await setWindowSize(widthInput, heightInput);
    setWindowState(prev => ({
      ...prev,
      width: widthInput,
      height: heightInput,
    }));
  };

  const handlePositionApply = async () => {
    await setWindowPosition(xInput, yInput);
    setWindowState(prev => ({
      ...prev,
      x: xInput,
      y: yInput,
    }));
    setIsEditingPosition(false);
  };

  const handleAlwaysOnTop = async () => {
    const result = await toggleAlwaysOnTop();
    if (result) {
      setWindowState(prev => ({
        ...prev,
        alwaysOnTop: !prev.alwaysOnTop,
      }));
    }
  };

  const handleMaximizeToggle = async () => {
    if (windowState.isMaximized) {
      await unmaximize();
    } else {
      await maximize();
    }
    setWindowState(prev => ({
      ...prev,
      isMaximized: !prev.isMaximized,
    }));
  };

  const handleMinimize = async () => {
    await minimize();
  };

  const handleStartupToggle = async () => {
    await setStartupEnabled(!windowState.startupEnabled);
    setWindowState(prev => ({
      ...prev,
      startupEnabled: !prev.startupEnabled,
    }));
  };

  const handleMinimizeToTrayToggle = async () => {
    await setMinimizeToTray(!windowState.minimizeToTray);
    setWindowState(prev => ({
      ...prev,
      minimizeToTray: !prev.minimizeToTray,
    }));
  };

  return (
    <div className={`vw-settings ${className}`} role="region" aria-label="Settings">
      <h3 className="vw-settings__title">Settings</h3>

      {/* 턴테이블 설정 */}
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

      {/* 창 관리 설정 - P1 기능으로 구현 */}
      <div className="vw-settings__group">
        <h4 className="vw-settings__group-title">Window</h4>

        <div className="vw-settings__item">
          <button
            className="vw-settings__btn"
            onClick={() => setShowWindowSettings(!showWindowSettings)}
            aria-expanded={showWindowSettings}
          >
            {showWindowSettings ? 'Hide Advanced' : 'Show Advanced Settings'}
          </button>
        </div>

        {showWindowSettings && (
          <>
            {/* 창 크기 */}
            <div className="vw-settings__item">
              <h5 className="vw-settings__sub-title">Size</h5>
              <div className="vw-settings__size-controls">
                <input
                  type="number"
                  min="400"
                  max="2560"
                  value={widthInput}
                  onChange={(e) => setWidthInput(parseInt(e.target.value) || 800)}
                  aria-label="Window width"
                />
                <span>x</span>
                <input
                  type="number"
                  min="300"
                  max="1440"
                  value={heightInput}
                  onChange={(e) => setHeightInput(parseInt(e.target.value) || 600)}
                  aria-label="Window height"
                />
                <button
                  className="vw-settings__btn vw-settings__btn--primary"
                  onClick={handleResize}
                  aria-label="Apply window size"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* 창 위치 */}
            <div className="vw-settings__item">
              <h5 className="vw-settings__sub-title">Position</h5>
              {isEditingPosition ? (
                <div className="vw-settings__position-controls">
                  <input
                    type="number"
                    value={xInput}
                    onChange={(e) => setXInput(parseInt(e.target.value) || 0)}
                    aria-label="Window X position"
                  />
                  <span>, </span>
                  <input
                    type="number"
                    value={yInput}
                    onChange={(e) => setYInput(parseInt(e.target.value) || 0)}
                    aria-label="Window Y position"
                  />
                  <button
                    className="vw-settings__btn vw-settings__btn--primary"
                    onClick={handlePositionApply}
                    aria-label="Apply window position"
                  >
                    Apply
                  </button>
                  <button
                    className="vw-settings__btn"
                    onClick={() => setIsEditingPosition(false)}
                    aria-label="Cancel position edit"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="vw-settings__position-display">
                  <span>X: {windowState.x}, Y: {windowState.y}</span>
                  <button
                    className="vw-settings__btn"
                    onClick={() => setIsEditingPosition(true)}
                    aria-label="Edit window position"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            {/* 창 제어 버튼들 */}
            <div className="vw-settings__item">
              <h5 className="vw-settings__sub-title">Window Controls</h5>
              <div className="vw-settings__controls">
                <button
                  className="vw-settings__btn"
                  onClick={handleMinimize}
                  aria-label="Minimize"
                >
                  Minimize
                </button>
                <button
                  className="vw-settings__btn"
                  onClick={handleMaximizeToggle}
                  aria-label={windowState.isMaximized ? 'Unmaximize' : 'Maximize'}
                >
                  {windowState.isMaximized ? 'Unmaximize' : 'Maximize'}
                </button>
                <button
                  className="vw-settings__btn"
                  onClick={handleAlwaysOnTop}
                  aria-label={windowState.alwaysOnTop ? 'Disable Always on Top' : 'Enable Always on Top'}
                >
                  {windowState.alwaysOnTop ? 'Always on Top: ON' : 'Always on Top: OFF'}
                </button>
              </div>
            </div>

            {/* 자동 실행 */}
            <div className="vw-settings__item">
              <h5 className="vw-settings__sub-title">Startup</h5>
              <label className="vw-settings__label">
                <input
                  type="checkbox"
                  checked={windowState.startupEnabled}
                  onChange={handleStartupToggle}
                  className="vw-settings__checkbox"
                  aria-label="Toggle startup on Windows login"
                />
                <span className="vw-settings__label-text">
                  Launch at startup (Windows only)
                </span>
              </label>
              <p className="vw-settings__description">
                Automatically start OBJETUNE when Windows starts
              </p>
            </div>

            {/* 트레이로 최소화 */}
            <div className="vw-settings__item">
              <h5 className="vw-settings__sub-title">Tray</h5>
              <label className="vw-settings__label">
                <input
                  type="checkbox"
                  checked={windowState.minimizeToTray}
                  onChange={handleMinimizeToTrayToggle}
                  className="vw-settings__checkbox"
                  aria-label="Toggle minimize to tray"
                />
                <span className="vw-settings__label-text">
                  Minimize to system tray
                </span>
              </label>
              <p className="vw-settings__description">
                Hide to tray instead of taskbar when minimized
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};