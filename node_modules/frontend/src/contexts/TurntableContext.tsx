import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from 'react';
import { TurntableSettings, PlaybackState, VinylState } from '../types';

// 턴테이블 컨텍스트 타입
interface TurntableContextType {
  settings: TurntableSettings;
  toggleDynamicVinylLabel: () => void;
  playbackState: PlaybackState;
  setPlaybackState: (state: PlaybackState) => void;
  vinylState: VinylState;
  setVinylState: Dispatch<SetStateAction<VinylState>>;
}

const TurntableContext = createContext<TurntableContextType | undefined>(undefined);

export const useTurntable = () => {
  const context = useContext(TurntableContext);
  if (!context) {
    throw new Error('useTurntable must be used within TurntableProvider');
  }
  return context;
};

export const TurntableProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 설정 - 로컬스토리지에 저장
  const [settings, setSettings] = useState<TurntableSettings>(() => {
    try {
      const saved = localStorage.getItem('turntable-settings');
      return saved ? JSON.parse(saved) : { dynamicVinylLabel: false };
    } catch {
      return { dynamicVinylLabel: false };
    }
  });

  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [vinylState, setVinylState] = useState<VinylState>({
    rotation: 0,
    isRotating: false,
  });

  // 설정 토글 및 저장
  const toggleDynamicVinylLabel = () => {
    const newSettings = { ...settings, dynamicVinylLabel: !settings.dynamicVinylLabel };
    setSettings(newSettings);
    localStorage.setItem('turntable-settings', JSON.stringify(newSettings));
  };

  // 재생 상태 변경
  const handleSetPlaybackState = (state: PlaybackState) => {
    setPlaybackState(state);
    // 상태에 따라 회전 제어
    setVinylState(prev => ({
      ...prev,
      isRotating: state === 'playing',
    }));
  };

  const value = {
    settings,
    toggleDynamicVinylLabel,
    playbackState,
    setPlaybackState: handleSetPlaybackState,
    vinylState,
    setVinylState,
  };

  return (
    <TurntableContext.Provider value={value}>
      {children}
    </TurntableContext.Provider>
  );
};