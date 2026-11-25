//! OBJETUNE Tauri 백엔드
//! Tauri 2 + Rust 핵심 로직

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub mode: String,
}

// Note: Tauri v2 commands in lib.rs should NOT be marked as `pub`
// due to a limitation in the glue code generation

#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME").to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        mode: "library".to_string(),
    }
}

#[tauri::command]
fn get_current_mode() -> String {
    "library".to_string()
}

#[tauri::command]
fn enter_library_mode() -> Result<String, String> {
    Ok("Library mode activated".to_string())
}

#[tauri::command]
fn enter_turntable_mode() -> Result<String, String> {
    Err("Turntable Mode is not yet implemented".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_current_mode,
            enter_library_mode,
            enter_turntable_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}