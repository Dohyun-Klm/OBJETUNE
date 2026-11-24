//! OBJETUNE - Rust 백엔드 모듈
//! 
//! 이 모듈은 Tauri 데스크탑 앱의 핵심 로직을 담당합니다.
//! - 명령어(Command) 인터페이스
//! - 데이터 모델
//! - 플랫폼 연동

use tauri::command;

/// 앱 정보를 반환하는 명령어
#[command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME").to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        mode: "shell".to_string(),
    }
}

/// 현재 모드를 반환하는 명령어
#[command]
pub fn get_current_mode() -> String {
    "shell".to_string()
}

/// 라이브러리 모드 진입 (미구현)
#[command]
pub fn enter_library_mode() -> Result<String, String> {
    Err("Library Mode is not yet implemented".to_string())
}

/// 튜rnplate Mode 진입 (미구현)
#[command]
pub fn enter_turntable_mode() -> Result<String, String> {
    Err("Turntable Mode is not yet implemented".to_string())
}

/// 앱 정보 구조체
#[derive(Debug, Clone, serde::Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub mode: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_app_info() {
        let info = get_app_info();
        assert_eq!(info.name, "objetune");
        assert!(!info.version.is_empty());
        assert_eq!(info.mode, "shell");
    }

    #[test]
    fn test_get_current_mode() {
        let mode = get_current_mode();
        assert_eq!(mode, "shell");
    }

    #[test]
    fn test_enter_library_mode_returns_error() {
        let result = enter_library_mode();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not yet implemented"));
    }

    #[test]
    fn test_enter_turntable_mode_returns_error() {
        let result = enter_turntable_mode();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not yet implemented"));
    }
}