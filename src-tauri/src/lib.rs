//! OBJETUNE Tauri 백엔드
//! Tauri 2 + Rust 핵심 로직

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        // 라이브러리 모드용 커맨드 등록
        .invoke_handler(tauri::generate_handler![
            app_lib::get_app_info,
            app_lib::get_current_mode,
            app_lib::enter_library_mode,
            app_lib::enter_turntable_mode,
            app_lib::Track,
            app_lib::Playlist,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}