import React, { useState } from 'react';
import './App.css';

// Tauri API 호출을 위한 타입 정의
interface AppInfo {
  name: string;
  version: string;
  mode: string;
}

function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [currentMode, setCurrentMode] = useState<string>('shell');
  const [message, setMessage] = useState<string>('');

  // Tauri API가 있는지 확인하고 앱 정보 가져오기
  React.useEffect(() => {
    const loadAppData = async () => {
      try {
        // Tauri 환경 확인 (__TAURI_INTEGRATION__는 Tauri v2에서 제공)
        if ((window as any).__TAURI_INTEGRATION__) {
          // @ts-expect-error Tauri API 동적 로드
          const { invoke } = await import('@tauri-apps/api/tauri');
          const info = await invoke('get_app_info');
          setAppInfo(info as AppInfo);
          const mode = await invoke('get_current_mode');
          setCurrentMode(mode as string);
        } else {
          // 개발 모드: 모의 데이터
          setAppInfo({
            name: 'OBJETUNE',
            version: '0.1.0',
            mode: 'shell'
          });
          setCurrentMode('shell');
        }
      } catch (error) {
        console.error('Failed to load app data:', error);
        // 오류 시 모의 데이터 사용
        setAppInfo({
          name: 'OBJETUNE',
          version: '0.1.0',
          mode: 'shell'
        });
        setCurrentMode('shell');
      }
    };
    loadAppData();
  }, []);

  const handleLibraryMode = () => {
    setMessage('Library Mode: 미구현');
  };

  const handleTurntableMode = () => {
    setMessage('Turntable Mode: 미구현');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>OBJETUNE</h1>
        <p className="subtitle">Rust + Tauri 2 + React 데스크탑 앱 골격</p>
        
        {appInfo && (
          <div className="app-info">
            <p><strong>버전:</strong> {appInfo.version}</p>
            <p><strong>모드:</strong> {currentMode}</p>
          </div>
        )}

        <div className="content-section">
          <h2>모드 선택</h2>
          <div className="mode-buttons">
            <button className="mode-btn library-btn" onClick={handleLibraryMode}>
              Library Mode
            </button>
            <button className="mode-btn turntable-btn" onClick={handleTurntableMode}>
              Turntable Mode
            </button>
          </div>
        </div>

        {message && <div className="message">{message}</div>}

        <div className="footer">
          <p>음악 검색 및 재생 기능은 추후 구현 예정입니다.</p>
        </div>
      </header>
    </div>
  );
}

export default App;