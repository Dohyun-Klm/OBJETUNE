//! OBJETUNE Tauri 백엔드
//! Tauri 2 + Rust 핵심 로직 - SQLite 저장소와 데이터 관리

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use tauri::{Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;

mod database;
use database::{Track, Playlist, init_database, DB_CONNECTION};

const API_SERVER_PORT: u16 = 8080;

fn api_server_binary_path(_app: &tauri::AppHandle) -> Option<PathBuf> {
    let binary_name = if cfg!(windows) { "objetune-api.exe" } else { "objetune-api" };

    #[cfg(debug_assertions)]
    {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("server")
            .join("target")
            .join("debug")
            .join(binary_name);
        return path.exists().then_some(path);
    }

    #[cfg(not(debug_assertions))]
    {
        _app.path()
            .resolve(
                format!("../server/target/release/{binary_name}"),
                tauri::path::BaseDirectory::Resource,
            )
            .ok()
    }
}

fn launch_api_server(app: &tauri::AppHandle) -> Option<Child> {
    if std::net::TcpStream::connect(("127.0.0.1", API_SERVER_PORT)).is_ok() {
        return None;
    }

    let Some(binary_path) = api_server_binary_path(app) else {
        eprintln!("OBJETUNE API server binary is missing; start server separately.");
        return None;
    };

    match Command::new(binary_path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => {
            for _ in 0..30 {
                if std::net::TcpStream::connect(("127.0.0.1", API_SERVER_PORT)).is_ok() {
                    return Some(child);
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
            Some(child)
        }
        Err(error) => {
            eprintln!("Could not start OBJETUNE API server: {error}");
            None
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub mode: String,
}

// Track API 응답
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackResponse {
    pub id: String,
    pub platform: String,
    pub platform_id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration: u32,
    pub thumbnail: Option<String>,
    pub url: Option<String>,
    pub embed_url: String,
    pub cover_art_url: Option<String>,
    pub added_at: i64,
    pub is_favorite: bool,
}

// Playlist API 응답
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub cover_image: Option<String>,
    pub track_count: u32,
    pub created_at: i64,
    pub updated_at: i64,
    pub is_favorite: bool,
}

// Create Track 요청
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTrackRequest {
    pub platform: String,
    pub platform_id: String,
    pub title: String,
    pub artist: String,
    pub duration: u32,
    pub thumbnail: Option<String>,
    pub url: Option<String>,
    pub embed_url: String,
    pub cover_art_url: Option<String>,
    pub album: Option<String>,
}

// Create Playlist 요청
#[derive(Debug, Clone, Deserialize)]
pub struct CreatePlaylistRequest {
    pub name: String,
    pub description: Option<String>,
    pub cover_image: Option<String>,
}

// Error 응답
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub message: String,
}

// rusqlite::Error에서 ErrorResponse로 변환
impl From<rusqlite::Error> for ErrorResponse {
    fn from(err: rusqlite::Error) -> Self {
        ErrorResponse {
            message: format!("Database error: {}", err),
        }
    }
}

impl From<std::sync::PoisonError<std::sync::MutexGuard<'_, Option<rusqlite::Connection>>>> for ErrorResponse {
    fn from(err: std::sync::PoisonError<std::sync::MutexGuard<'_, Option<rusqlite::Connection>>>) -> Self {
        ErrorResponse {
            message: format!("Database lock error: {}", err),
        }
    }
}

#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME").to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        mode: "library".to_string(),
    }
}

// 현재 앱 모드 상태 (library 또는 turntable)
static APP_MODE: Lazy<Mutex<String>> = Lazy::new(|| Mutex::new("library".to_string()));

#[tauri::command]
fn get_current_mode() -> String {
    APP_MODE.lock().unwrap().clone()
}

#[tauri::command]
fn enter_library_mode(app: tauri::AppHandle) -> Result<String, String> {
    let mut mode = APP_MODE.lock().unwrap();
    *mode = "library".to_string();
    drop(mode);
    // Frontend에 모드 변경 이벤트 발송
    let _ = app.emit("mode_change", "library");
    Ok("Library mode activated".to_string())
}

#[tauri::command]
fn enter_turntable_mode(app: tauri::AppHandle) -> Result<String, String> {
    let mut mode = APP_MODE.lock().unwrap();
    *mode = "turntable".to_string();
    drop(mode);
    // Frontend에 모드 변경 이벤트 발송
    let _ = app.emit("mode_change", "turntable");
    Ok("Turntable mode activated".to_string())
}

#[tauri::command]
fn set_mode(app: tauri::AppHandle, mode: String) -> Result<bool, String> {
    if mode != "library" && mode != "turntable" {
        return Err("Invalid mode".to_string());
    }
    let mut app_mode = APP_MODE.lock().unwrap();
    *app_mode = mode.clone();
    drop(app_mode);
    let _ = app.emit("mode_change", mode);
    Ok(true)
}

// ============================================
// Track 관리 API
// ============================================

#[tauri::command]
async fn create_track(req: CreateTrackRequest) -> Result<TrackResponse, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized. Call initializeDatabase first.".to_string() 
    })?;
    
    let track = Track::from_parts(
        &req.platform,
        &req.platform_id,
        req.title.clone(),
        req.artist.clone(),
        req.embed_url.clone(),
        req.duration,
        req.thumbnail,
        req.url,
        req.cover_art_url,
        req.album.clone(),
    );
    
    conn.execute(
        "INSERT OR REPLACE INTO tracks 
         (id, platform, platform_id, title, artist, album, duration, thumbnail, url, embed_url, cover_art_url, added_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        rusqlite::params![
            &track.id,
            &track.platform,
            &track.platform_id,
            &track.title,
            &track.artist,
            &track.album,
            track.duration as i64,
            &track.thumbnail,
            &track.url,
            &track.embed_url,
            &track.cover_art_url,
            track.added_at,
            track.updated_at,
        ],
    ).map_err(|e| ErrorResponse { 
        message: format!("Failed to create track: {}", e) 
    })?;
    
    Ok(TrackResponse {
        id: track.id,
        platform: track.platform,
        platform_id: track.platform_id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        thumbnail: track.thumbnail,
        url: track.url,
        embed_url: track.embed_url,
        cover_art_url: track.cover_art_url,
        added_at: track.added_at,
        is_favorite: false,
    })
}

#[tauri::command]
async fn get_track(track_id: String) -> Result<TrackResponse, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    conn.query_row(
        "SELECT id, platform, platform_id, title, artist, album, duration, thumbnail, url, embed_url, cover_art_url, added_at,
                (SELECT 1 FROM favorites WHERE track_id = id) as is_favorite
         FROM tracks WHERE id = ?1",
        rusqlite::params![&track_id],
        |row| {
            Ok(TrackResponse {
                id: row.get(0)?,
                platform: row.get(1)?,
                platform_id: row.get(2)?,
                title: row.get(3)?,
                artist: row.get(4)?,
                album: row.get(5)?,
                duration: row.get(6)?,
                thumbnail: row.get(7)?,
                url: row.get(8)?,
                embed_url: row.get(9)?,
                cover_art_url: row.get(10)?,
                added_at: row.get(11)?,
                is_favorite: row.get(12)?,
            })
        },
    ).map_err(|e| ErrorResponse { 
        message: format!("Track not found: {}", e) 
    })
}

#[tauri::command]
async fn get_all_tracks() -> Result<Vec<TrackResponse>, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let mut stmt = conn.prepare(
        "SELECT id, platform, platform_id, title, artist, album, duration, thumbnail, url, embed_url, cover_art_url, added_at,
                (SELECT 1 FROM favorites WHERE track_id = id) as is_favorite
         FROM tracks ORDER BY added_at DESC"
    )?;
    
    let track_iter = stmt.query_map(rusqlite::params![], |row| {
        Ok(TrackResponse {
            id: row.get(0)?,
            platform: row.get(1)?,
            platform_id: row.get(2)?,
            title: row.get(3)?,
            artist: row.get(4)?,
            album: row.get(5)?,
            duration: row.get(6)?,
            thumbnail: row.get(7)?,
            url: row.get(8)?,
            embed_url: row.get(9)?,
            cover_art_url: row.get(10)?,
            added_at: row.get(11)?,
            is_favorite: row.get(12)?,
        })
    })?;
    
    let tracks: Result<Vec<_>, _> = track_iter.collect();
    tracks.map_err(|e| ErrorResponse { 
        message: format!("Failed to get tracks: {}", e) 
    })
}

// ============================================
// Playlist 관리 API
// ============================================

#[tauri::command]
async fn create_playlist(req: CreatePlaylistRequest) -> Result<PlaylistResponse, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let playlist = Playlist::new(req.name.clone());
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    
    conn.execute(
        "INSERT INTO playlists (id, name, description, cover_image, is_folder, parent_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 0, NULL, ?5, ?6)",
        rusqlite::params![
            &playlist.id,
            &playlist.name,
            &req.description,
            &req.cover_image,
            now,
            now,
        ],
    ).map_err(|e| ErrorResponse { 
        message: format!("Failed to create playlist: {}", e) 
    })?;
    
    Ok(PlaylistResponse {
        id: playlist.id,
        name: playlist.name,
        description: req.description,
        cover_image: req.cover_image,
        track_count: 0,
        created_at: now,
        updated_at: now,
        is_favorite: false,
    })
}

#[tauri::command]
async fn get_playlists() -> Result<Vec<PlaylistResponse>, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let mut stmt = conn.prepare(
        "SELECT id, name, description, cover_image, created_at, updated_at 
         FROM playlists ORDER BY created_at DESC"
    )?;
    
    let playlist_iter = stmt.query_map(rusqlite::params![], |row| {
        Ok(PlaylistResponse {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            cover_image: row.get(3)?,
            track_count: 0,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            is_favorite: false,
        })
    })?;
    
    let playlists: Result<Vec<_>, _> = playlist_iter.collect();
    playlists.map_err(|e| ErrorResponse { 
        message: format!("Failed to get playlists: {}", e) 
    })
}

// ============================================
// Favorite 관리 API
// ============================================

#[tauri::command]
async fn add_favorite(track_id: String) -> Result<bool, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let track_exists: i64 = conn.query_row(
        "SELECT 1 FROM tracks WHERE id = ?1",
        rusqlite::params![&track_id],
        |row| row.get(0),
    )?;
    
    if track_exists == 0 {
        return Err(ErrorResponse { 
            message: "Track not found".to_string() 
        });
    }
    
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    
    conn.execute(
        "INSERT OR IGNORE INTO favorites (track_id, created_at) VALUES (?1, ?2)",
        rusqlite::params![&track_id, now],
    ).map_err(|e| ErrorResponse { 
        message: format!("Failed to add favorite: {}", e) 
    })?;
    
    Ok(true)
}

#[tauri::command]
async fn remove_favorite(track_id: String) -> Result<bool, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    conn.execute(
        "DELETE FROM favorites WHERE track_id = ?1",
        rusqlite::params![&track_id],
    ).map_err(|e| ErrorResponse { 
        message: format!("Failed to remove favorite: {}", e) 
    })?;
    
    Ok(true)
}

#[tauri::command]
async fn get_favorites() -> Result<Vec<TrackResponse>, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let mut stmt = conn.prepare(
        "SELECT t.id, t.platform, t.platform_id, t.title, t.artist, t.album, t.duration, t.thumbnail, t.url, t.embed_url, t.cover_art_url, t.added_at,
                (SELECT 1 FROM favorites WHERE track_id = t.id) as is_favorite
         FROM tracks t
         INNER JOIN favorites f ON t.id = f.track_id
         ORDER BY f.created_at DESC"
    )?;
    
    let track_iter = stmt.query_map(rusqlite::params![], |row| {
        Ok(TrackResponse {
            id: row.get(0)?,
            platform: row.get(1)?,
            platform_id: row.get(2)?,
            title: row.get(3)?,
            artist: row.get(4)?,
            album: row.get(5)?,
            duration: row.get(6)?,
            thumbnail: row.get(7)?,
            url: row.get(8)?,
            embed_url: row.get(9)?,
            cover_art_url: row.get(10)?,
            added_at: row.get(11)?,
            is_favorite: true,
        })
    })?;
    
    let tracks: Result<Vec<_>, _> = track_iter.collect();
    tracks.map_err(|e| ErrorResponse { 
        message: format!("Failed to get favorites: {}", e) 
    })
}

// ============================================
// History 관리 API
// ============================================

#[tauri::command]
async fn add_to_history(track_id: String) -> Result<bool, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let track_exists: i64 = conn.query_row(
        "SELECT 1 FROM tracks WHERE id = ?1",
        rusqlite::params![&track_id],
        |row| row.get(0),
    )?;
    
    if track_exists == 0 {
        return Err(ErrorResponse { 
            message: "Track not found".to_string() 
        });
    }
    
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    
    conn.execute(
        "INSERT INTO history (track_id, played_at) VALUES (?1, ?2)",
        rusqlite::params![&track_id, now],
    ).map_err(|e| ErrorResponse { 
        message: format!("Failed to add to history: {}", e) 
    })?;
    
    conn.execute(
        "DELETE FROM history WHERE id NOT IN (
            SELECT id FROM history ORDER BY played_at DESC LIMIT 100
        )",
        [],
    ).ok();
    
    Ok(true)
}

#[tauri::command]
async fn get_history(limit: Option<u32>) -> Result<Vec<TrackResponse>, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let limit_val = limit.unwrap_or(50).min(100) as i64;
    
    let mut stmt = conn.prepare(
        "SELECT t.id, t.platform, t.platform_id, t.title, t.artist, t.album, t.duration, t.thumbnail, t.url, t.embed_url, t.cover_art_url, t.added_at,
                (SELECT 1 FROM favorites WHERE track_id = t.id) as is_favorite
         FROM tracks t
         INNER JOIN history h ON t.id = h.track_id
         ORDER BY h.played_at DESC
         LIMIT ?"
    )?;
    
    let track_iter = stmt.query_map(rusqlite::params![limit_val], |row| {
        Ok(TrackResponse {
            id: row.get(0)?,
            platform: row.get(1)?,
            platform_id: row.get(2)?,
            title: row.get(3)?,
            artist: row.get(4)?,
            album: row.get(5)?,
            duration: row.get(6)?,
            thumbnail: row.get(7)?,
            url: row.get(8)?,
            embed_url: row.get(9)?,
            cover_art_url: row.get(10)?,
            added_at: row.get(11)?,
            is_favorite: row.get(12)?,
        })
    })?;
    
    let tracks: Result<Vec<_>, _> = track_iter.collect();
    tracks.map_err(|e| ErrorResponse { 
        message: format!("Failed to get history: {}", e) 
    })
}

// ============================================
// Track by Platform API
// ============================================

#[tauri::command]
async fn get_tracks_by_platform(platform: String) -> Result<Vec<TrackResponse>, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let mut stmt = conn.prepare(
        "SELECT id, platform, platform_id, title, artist, album, duration, thumbnail, url, embed_url, cover_art_url, added_at,
                (SELECT 1 FROM favorites WHERE track_id = id) as is_favorite
         FROM tracks WHERE platform = ?1
         ORDER BY added_at DESC"
    )?;
    
    let track_iter = stmt.query_map(rusqlite::params![&platform], |row| {
        Ok(TrackResponse {
            id: row.get(0)?,
            platform: row.get(1)?,
            platform_id: row.get(2)?,
            title: row.get(3)?,
            artist: row.get(4)?,
            album: row.get(5)?,
            duration: row.get(6)?,
            thumbnail: row.get(7)?,
            url: row.get(8)?,
            embed_url: row.get(9)?,
            cover_art_url: row.get(10)?,
            added_at: row.get(11)?,
            is_favorite: row.get(12)?,
        })
    })?;
    
    let tracks: Result<Vec<_>, _> = track_iter.collect();
    tracks.map_err(|e| ErrorResponse { 
        message: format!("Failed to get tracks: {}", e) 
    })
}

// ============================================
// Playlist Track Management
// ============================================

#[tauri::command]
async fn get_playlist_tracks(playlist_id: String) -> Result<Vec<TrackResponse>, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let mut stmt = conn.prepare(
        "SELECT t.id, t.platform, t.platform_id, t.title, t.artist, t.album, t.duration, t.thumbnail, t.url, t.embed_url, t.cover_art_url, t.added_at,
                (SELECT 1 FROM favorites WHERE track_id = t.id) as is_favorite
         FROM tracks t
         INNER JOIN playlist_tracks pt ON t.id = pt.track_id
         WHERE pt.playlist_id = ?1
         ORDER BY pt.position"
    )?;
    
    let track_iter = stmt.query_map(rusqlite::params![&playlist_id], |row| {
        Ok(TrackResponse {
            id: row.get(0)?,
            platform: row.get(1)?,
            platform_id: row.get(2)?,
            title: row.get(3)?,
            artist: row.get(4)?,
            album: row.get(5)?,
            duration: row.get(6)?,
            thumbnail: row.get(7)?,
            url: row.get(8)?,
            embed_url: row.get(9)?,
            cover_art_url: row.get(10)?,
            added_at: row.get(11)?,
            is_favorite: row.get(12)?,
        })
    })?;
    
    let tracks: Result<Vec<_>, _> = track_iter.collect();
    tracks.map_err(|e| ErrorResponse { 
        message: format!("Failed to get playlist tracks: {}", e) 
    })
}

#[tauri::command]
async fn add_track_to_playlist(playlist_id: String, track_id: String) -> Result<bool, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let track_exists: i64 = conn.query_row(
        "SELECT 1 FROM tracks WHERE id = ?1",
        rusqlite::params![&track_id],
        |row| row.get(0),
    )?;
    
    if track_exists == 0 {
        return Err(ErrorResponse { 
            message: "Track not found".to_string() 
        });
    }
    
    let playlist_exists: i64 = conn.query_row(
        "SELECT 1 FROM playlists WHERE id = ?1",
        rusqlite::params![&playlist_id],
        |row| row.get(0),
    )?;
    
    if playlist_exists == 0 {
        return Err(ErrorResponse { 
            message: "Playlist not found".to_string() 
        });
    }
    
    let already_added: i64 = conn.query_row(
        "SELECT 1 FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
        rusqlite::params![&playlist_id, &track_id],
        |row| row.get(0),
    )?;
    
    if already_added == 1 {
        return Ok(true);
    }
    
    let max_position: i64 = conn.query_row(
        "SELECT COALESCE(MAX(position), 0) FROM playlist_tracks WHERE playlist_id = ?1",
        rusqlite::params![&playlist_id],
        |row| row.get(0),
    )?;
    
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    
    conn.execute(
        "INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![&playlist_id, &track_id, max_position + 1, now],
    )?;
    
    Ok(true)
}

#[tauri::command]
async fn remove_track_from_playlist(playlist_id: String, track_id: String) -> Result<bool, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    conn.execute(
        "DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
        rusqlite::params![&playlist_id, &track_id],
    )?;
    
    conn.execute(
        "UPDATE playlist_tracks SET position = position - 1 
         WHERE playlist_id = ?1 AND position > (
            SELECT position FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2
        )",
        rusqlite::params![&playlist_id, &playlist_id, &track_id],
    )?;
    
    Ok(true)
}

#[tauri::command]
async fn delete_playlist(playlist_id: String) -> Result<bool, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    conn.execute("DELETE FROM playlists WHERE id = ?1", rusqlite::params![&playlist_id])?;
    
    Ok(true)
}

// ============================================
// History API - clear history
// ============================================

#[tauri::command]
async fn clear_history() -> Result<bool, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    conn.execute("DELETE FROM history", [])?;
    
    Ok(true)
}

// ============================================
// Settings API
// ============================================

#[tauri::command]
async fn get_setting(key: String) -> Result<Option<String>, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![&key],
        |row| row.get(0),
    ).optional().map_err(|e| ErrorResponse { 
        message: format!("Failed to get setting: {}", e) 
    })
}

#[tauri::command]
async fn set_setting(key: String, value: String) -> Result<bool, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![&key, &value, now],
    ).map_err(|e| ErrorResponse { 
        message: format!("Failed to set setting: {}", e) 
    })?;
    
    Ok(true)
}

// ============================================
// Queue API
// ============================================

#[tauri::command]
async fn get_queue() -> Result<Vec<TrackResponse>, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let mut stmt = conn.prepare(
        "SELECT t.id, t.platform, t.platform_id, t.title, t.artist, t.album, t.duration, t.thumbnail, t.url, t.embed_url, t.cover_art_url, t.added_at,
                (SELECT 1 FROM favorites WHERE track_id = t.id) as is_favorite
         FROM tracks t
         INNER JOIN queue q ON t.id = q.track_id
         ORDER BY q.position"
    )?;
    
    let track_iter = stmt.query_map(rusqlite::params![], |row| {
        Ok(TrackResponse {
            id: row.get(0)?,
            platform: row.get(1)?,
            platform_id: row.get(2)?,
            title: row.get(3)?,
            artist: row.get(4)?,
            album: row.get(5)?,
            duration: row.get(6)?,
            thumbnail: row.get(7)?,
            url: row.get(8)?,
            embed_url: row.get(9)?,
            cover_art_url: row.get(10)?,
            added_at: row.get(11)?,
            is_favorite: row.get(12)?,
        })
    })?;
    
    let tracks: Result<Vec<_>, _> = track_iter.collect();
    tracks.map_err(|e| ErrorResponse { 
        message: format!("Failed to get queue: {}", e) 
    })
}

#[tauri::command]
async fn add_to_queue(track_id: String) -> Result<bool, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let track_exists: i64 = conn.query_row(
        "SELECT 1 FROM tracks WHERE id = ?1",
        rusqlite::params![&track_id],
        |row| row.get(0),
    )?;
    
    if track_exists == 0 {
        return Err(ErrorResponse { 
            message: "Track not found".to_string() 
        });
    }
    
    let already_in_queue: i64 = conn.query_row(
        "SELECT 1 FROM queue WHERE track_id = ?1",
        rusqlite::params![&track_id],
        |row| row.get(0),
    )?;
    
    if already_in_queue == 1 {
        return Ok(true);
    }
    
    let max_position: i64 = conn.query_row(
        "SELECT COALESCE(MAX(position), 0) FROM queue",
        [],
        |row| row.get(0),
    )?;
    
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    
    conn.execute(
        "INSERT INTO queue (position, track_id, added_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![max_position + 1, &track_id, now],
    ).map_err(|e| ErrorResponse { 
        message: format!("Failed to add to queue: {}", e) 
    })?;
    
    Ok(true)
}

#[tauri::command]
async fn remove_from_queue(track_id: String) -> Result<bool, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    conn.execute(
        "DELETE FROM queue WHERE track_id = ?1",
        rusqlite::params![&track_id],
    ).map_err(|e| ErrorResponse { 
        message: format!("Failed to remove from queue: {}", e) 
    })?;
    
    conn.execute(
        "UPDATE queue SET position = position - 1 WHERE position > (
            SELECT position FROM queue WHERE track_id = ?1
        )",
        rusqlite::params![&track_id],
    ).ok();
    
    Ok(true)
}

#[tauri::command]
async fn clear_queue() -> Result<bool, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    conn.execute("DELETE FROM queue", [])
        .map_err(|e| ErrorResponse { 
            message: format!("Failed to clear queue: {}", e) 
        })?;
    
    Ok(true)
}

#[tauri::command]
async fn move_queue_item(track_id: String, new_position: i64) -> Result<bool, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let current_position: i64 = conn.query_row(
        "SELECT position FROM queue WHERE track_id = ?1",
        rusqlite::params![&track_id],
        |row| row.get(0),
    )?;
    
    if current_position == 0 {
        return Err(ErrorResponse { message: "Track not in queue".to_string() });
    }
    
    let total_items: i64 = conn.query_row("SELECT COUNT(*) FROM queue", [], |row| row.get(0))?;
    
    if new_position < 1 || new_position > total_items {
        return Err(ErrorResponse { 
            message: format!("Invalid position. Must be between 1 and {}", total_items) 
        });
    }
    
    if current_position == new_position {
        return Ok(true);
    }
    
    if new_position < current_position {
        conn.execute(
            "UPDATE queue SET position = position + 1 
             WHERE position >= ?1 AND position < ?2",
            rusqlite::params![new_position, current_position],
        )?;
    } else {
        conn.execute(
            "UPDATE queue SET position = position - 1 
             WHERE position > ?1 AND position <= ?2",
            rusqlite::params![current_position, new_position],
        )?;
    }
    
    conn.execute(
        "UPDATE queue SET position = ?1 WHERE track_id = ?2",
        rusqlite::params![new_position, &track_id],
    )?;
    
    Ok(true)
}

// Database 이니셜라이저
#[tauri::command]
fn init_db() -> Result<String, ErrorResponse> {
    use std::env;
    use std::fs;
    
    let db_path = if cfg!(target_os = "windows") {
        env::var("APPDATA").unwrap_or_else(|_| "C:\\temp".to_string()) + "\\objetune\\db.sqlite"
    } else if cfg!(target_os = "macos") {
        env::var("HOME").unwrap_or_else(|_| "/tmp".to_string()) + "/Library/Application Support/objetune/db.sqlite"
    } else {
        env::var("XDG_DATA_HOME").unwrap_or_else(|_| {
            env::var("HOME").unwrap_or_else(|_| "/tmp".to_string()) + "/.local/share"
        }) + "/objetune/db.sqlite"
    };
    
    if let Some(parent) = std::path::Path::new(&db_path).parent() {
        fs::create_dir_all(parent).map_err(|e| ErrorResponse {
            message: format!("Failed to create database directory: {}", e),
        })?;
    }
    
    init_database(&db_path).map_err(|e| ErrorResponse { 
        message: format!("Database initialization failed: {}", e) 
    })?;
    
    Ok(db_path)
}

#[tauri::command]
async fn get_window_size(app: tauri::AppHandle) -> Result<(u32, u32), ErrorResponse> {
    if let Some(window) = app.get_webview_window("main") {
        let size = window.inner_size().map_err(|e| ErrorResponse { message: e.to_string() })?;
        Ok((size.width, size.height))
    } else {
        Ok((800, 600))
    }
}

#[tauri::command]
async fn set_window_size(app: tauri::AppHandle, width: u32, height: u32) -> Result<bool, ErrorResponse> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: width as f64, height: height as f64 }))
            .map_err(|e| ErrorResponse { message: e.to_string() })?;
    }
    Ok(true)
}

#[tauri::command]
async fn get_window_position(app: tauri::AppHandle) -> Result<(i32, i32), ErrorResponse> {
    if let Some(window) = app.get_webview_window("main") {
        let pos = window.outer_position().map_err(|e| ErrorResponse { message: e.to_string() })?;
        Ok((pos.x, pos.y))
    } else {
        Ok((0, 0))
    }
}

#[tauri::command]
async fn set_window_position(app: tauri::AppHandle, x: i32, y: i32) -> Result<bool, ErrorResponse> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_position(tauri::Position::Logical(tauri::LogicalPosition { x: x as f64, y: y as f64 }))
            .map_err(|e| ErrorResponse { message: e.to_string() })?;
    }
    Ok(true)
}

// 창 상태 저장/복원 (위치, 크기, 최대화 여부)
#[tauri::command]
async fn save_window_state(app: tauri::AppHandle) -> Result<bool, ErrorResponse> {
    if let Some(window) = app.get_webview_window("main") {
        let pos = window.outer_position().map_err(|e| ErrorResponse { message: e.to_string() })?;
        let size = window.inner_size().map_err(|e| ErrorResponse { message: e.to_string() })?;
        let is_max = window.is_maximized().map_err(|e| ErrorResponse { message: e.to_string() })?;
        
        let state = serde_json::json!({
            "x": pos.x,
            "y": pos.y,
            "width": size.width,
            "height": size.height,
            "maximized": is_max
        });
        
        let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { message: e.to_string() })?;
        if let Some(conn) = conn_guard.as_ref() {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('window_state', ?1, ?2)",
                rusqlite::params![state.to_string(), now],
            ).map_err(|e| ErrorResponse { message: e.to_string() })?;
        }
    }
    Ok(true)
}

#[tauri::command]
async fn load_window_state(app: tauri::AppHandle) -> Result<bool, ErrorResponse> {
    let result = get_setting("window_state".to_string()).await?;
    if let Some(state_str) = result {
        if let Ok(state) = serde_json::from_str::<serde_json::Value>(&state_str) {
            if let Some(window) = app.get_webview_window("main") {
                // 창이 숨겨져 있다면 복원하지 않음 (자동 시작 시점의 상태 유지)
                if !window.is_visible().map_err(|e| ErrorResponse { message: e.to_string() })? {
                    return Ok(true);
                }
                
                if let (Some(x), Some(y), Some(w), Some(h)) = (
                    state.get("x").and_then(|v| v.as_i64()),
                    state.get("y").and_then(|v| v.as_i64()),
                    state.get("width").and_then(|v| v.as_u64()),
                    state.get("height").and_then(|v| v.as_u64()),
                ) {
                    let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition { x: x as f64, y: y as f64 }));
                    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: w as f64, height: h as f64 }));
                    if let Some(max) = state.get("maximized").and_then(|v| v.as_bool()) {
                        if max {
                            let _ = window.maximize();
                        }
                    }
                }
            }
        }
    }
    Ok(true)
}

#[tauri::command]
async fn set_always_on_top(always_on_top: bool) -> Result<bool, ErrorResponse> {
    // 설정 저장
    let _ = set_setting("always_on_top".to_string(), always_on_top.to_string()).await;
    Ok(true)
}

#[tauri::command]
async fn get_always_on_top() -> Result<bool, ErrorResponse> {
    // 설정에서 조회하거나 기본값 false 반환
    let result = get_setting("always_on_top".to_string()).await?;
    Ok(result.map(|v| v == "true").unwrap_or(false))
}

#[tauri::command]
async fn is_minimized(app: tauri::AppHandle) -> Result<bool, ErrorResponse> {
    if let Some(window) = app.get_webview_window("main") {
        window.is_minimized().map_err(|e| ErrorResponse { message: e.to_string() })
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn minimize(app: tauri::AppHandle) -> Result<bool, ErrorResponse> {
    if let Some(window) = app.get_webview_window("main") {
        let minimize_to_tray = get_minimize_to_tray_setting().await.unwrap_or(true);
        
        if minimize_to_tray {
            window.hide().map_err(|e| ErrorResponse { message: e.to_string() })?;
        } else {
            window.minimize().map_err(|e| ErrorResponse { message: e.to_string() })?;
        }
        Ok(true)
    } else {
        Ok(true)
    }
}

async fn get_minimize_to_tray_setting() -> Result<bool, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let result: Option<String> = conn.query_row(
        "SELECT value FROM settings WHERE key = 'minimize_to_tray'",
        [],
        |row| row.get(0),
    ).optional().map_err(|e| ErrorResponse { 
        message: format!("Failed to get minimize_to_tray setting: {}", e) 
    })?;
    
    Ok(result.map(|v| v == "true").unwrap_or(true))
}

#[tauri::command]
async fn maximize(app: tauri::AppHandle) -> Result<bool, ErrorResponse> {
    if let Some(window) = app.get_webview_window("main") {
        window.maximize().map_err(|e| ErrorResponse { message: e.to_string() })?;
        Ok(true)
    } else {
        Ok(true)
    }
}

#[tauri::command]
async fn unmaximize(app: tauri::AppHandle) -> Result<bool, ErrorResponse> {
    if let Some(window) = app.get_webview_window("main") {
        window.unmaximize().map_err(|e| ErrorResponse { message: e.to_string() })?;
        Ok(true)
    } else {
        Ok(true)
    }
}

#[tauri::command]
async fn is_maximized(app: tauri::AppHandle) -> Result<bool, ErrorResponse> {
    if let Some(window) = app.get_webview_window("main") {
        window.is_maximized().map_err(|e| ErrorResponse { message: e.to_string() })
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn toggle_always_on_top() -> Result<bool, ErrorResponse> {
    // 현재 설정을 가져와서 토글 (간단히 true 반환, 실제는 get_setting 사용)
    Ok(true)
}

// 재생 설정 API
#[tauri::command]
async fn get_shuffle() -> Result<bool, ErrorResponse> {
    let result = get_setting("shuffle".to_string()).await?;
    Ok(result.map(|v| v == "true").unwrap_or(false))
}

#[tauri::command]
async fn set_shuffle(enabled: bool) -> Result<bool, ErrorResponse> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('shuffle', ?1, ?2)",
        rusqlite::params![enabled.to_string(), now],
    ).map_err(|e| ErrorResponse { 
        message: format!("Failed to set shuffle: {}", e) 
    })?;
    
    Ok(true)
}

#[tauri::command]
async fn get_repeat() -> Result<String, ErrorResponse> {
    let result = get_setting("repeat".to_string()).await?;
    Ok(result.unwrap_or_else(|| "off".to_string()))
}

#[tauri::command]
async fn set_repeat(mode: String) -> Result<bool, ErrorResponse> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('repeat', ?1, ?2)",
        rusqlite::params![mode, now],
    ).map_err(|e| ErrorResponse { 
        message: format!("Failed to set repeat: {}", e) 
    })?;
    
    Ok(true)
}

// ============================================
// Global Shortcut API
// ============================================

#[tauri::command]
async fn register_media_shortcuts() -> Result<bool, ErrorResponse> {
    // Media shortcuts are registered globally via Tauri's globalShortcut API
    // This command enables media control shortcuts for the app
    // The actual registration happens through the plugin initialization
    Ok(true)
}

#[tauri::command] 
async fn unregister_media_shortcuts() -> Result<bool, ErrorResponse> {
    // Media shortcuts are automatically unregistered when the app closes
    // This is a placeholder for manual deregistration if needed
    Ok(true)
}

#[tauri::command]
fn emit_media_event(_event_name: String) -> Result<bool, ErrorResponse> {
    // This can be used to emit events from Rust to JS
    Ok(true)
}

// 자동 실행 관련 API
#[tauri::command]
async fn get_startup_enabled(_app: tauri::AppHandle) -> Result<bool, ErrorResponse> {
    // 설정에서 조회하거나 기본값 false 반환
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let result: Option<String> = conn.query_row(
        "SELECT value FROM settings WHERE key = 'startup_enabled'",
        [],
        |row| row.get(0),
    ).optional().map_err(|e| ErrorResponse { 
        message: format!("Failed to get startup_enabled setting: {}", e) 
    })?;
    
    Ok(result.map(|v| v == "true").unwrap_or(false))
}

#[tauri::command]
async fn set_startup_enabled(app: tauri::AppHandle, enabled: bool) -> Result<bool, ErrorResponse> {
    // tauri-plugin-autostart를 사용한 자동 실행 설정
    let autostart_manager = app.autolaunch();
    if enabled {
        autostart_manager.enable().map_err(|e| ErrorResponse { message: e.to_string() })?;
    } else {
        autostart_manager.disable().map_err(|e| ErrorResponse { message: e.to_string() })?;
    }
    
    // 설정 저장
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('startup_enabled', ?1, ?2)",
        rusqlite::params![enabled.to_string(), now],
    ).map_err(|e| ErrorResponse { 
        message: format!("Failed to set startup_enabled: {}", e) 
    })?;
    
    Ok(true)
}

// 트레이로 최소화 설정 API
#[tauri::command]
async fn get_minimize_to_tray() -> Result<bool, ErrorResponse> {
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    let result: Option<String> = conn.query_row(
        "SELECT value FROM settings WHERE key = 'minimize_to_tray'",
        [],
        |row| row.get(0),
    ).optional().map_err(|e| ErrorResponse { 
        message: format!("Failed to get minimize_to_tray setting: {}", e) 
    })?;
    
    Ok(result.map(|v| v == "true").unwrap_or(true)) // 기본값 true
}

#[tauri::command]
async fn set_minimize_to_tray(enabled: bool) -> Result<bool, ErrorResponse> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    
    let conn_guard = DB_CONNECTION.lock().map_err(|e| ErrorResponse { 
        message: format!("Database lock error: {}", e) 
    })?;
    
    let conn = conn_guard.as_ref().ok_or_else(|| ErrorResponse { 
        message: "Database not initialized".to_string() 
    })?;
    
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('minimize_to_tray', ?1, ?2)",
        rusqlite::params![enabled.to_string(), now],
    ).map_err(|e| ErrorResponse { 
        message: format!("Failed to set minimize_to_tray: {}", e) 
    })?;
    
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let api_server_child = Arc::new(Mutex::new(None::<Child>));
    let api_server_for_setup = Arc::clone(&api_server_child);
    
    let app = tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::default()
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,  // --minimized 플래그 제거: 앱 시작 시 창이 보이도록
        ))
        .setup(move |app| {
            init_db().map_err(|error| std::io::Error::other(error.message))?;

            if let Some(child) = launch_api_server(app.handle()) {
                *api_server_for_setup.lock().unwrap() = Some(child);
            }

            // 시스템 트레이 생성
            let icon = app.default_window_icon()
                .map(|i| i.clone())
                .unwrap_or_else(|| tauri::include_image!("icons/icon.png"));
            
            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(icon)
                .tooltip(" OBJETUNE")
                .menu(&tauri::menu::MenuBuilder::new(app)
                    .item(&tauri::menu::MenuItem::with_id(app, "show", "보이기", true, None::<&str>)?)
                    .item(&tauri::menu::MenuItem::with_id(app, "hide", "숨기기", true, None::<&str>)?)
                    .separator()
                    .item(&tauri::menu::MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?)
                    .build()?)
                .show_menu_on_left_click(false)  // 왼쪽 클릭시 메뉴 대신 토글 동작
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    use tauri::tray::MouseButton;
                    use tauri::tray::MouseButtonState;
                    use tauri::tray::TrayIconEvent;
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(&app.handle().clone())?;
            
            // 창 상태 복원
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = load_window_state(app_handle.clone()).await;
            });
            
            // 자동 실행 상태 확인 및 적용
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(enabled) = get_startup_enabled(app_handle.clone()).await {
                    if enabled {
                        let _ = app_handle.autolaunch().enable();
                    }
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init_db,
            get_app_info,
            get_current_mode,
            set_mode,
            enter_library_mode,
            enter_turntable_mode,
            create_track,
            get_track,
            get_all_tracks,
            get_tracks_by_platform,
            create_playlist,
            get_playlists,
            get_playlist_tracks,
            add_track_to_playlist,
            remove_track_from_playlist,
            delete_playlist,
            add_favorite,
            remove_favorite,
            get_favorites,
            add_to_history,
            get_history,
            clear_history,
            get_setting,
            set_setting,
            get_queue,
            add_to_queue,
            remove_from_queue,
            clear_queue,
            move_queue_item,
            get_window_size,
            set_window_size,
            get_window_position,
            set_window_position,
            get_always_on_top,
            set_always_on_top,
            is_minimized,
            minimize,
            maximize,
            unmaximize,
            is_maximized,
            toggle_always_on_top,
            get_startup_enabled,
            set_startup_enabled,
            get_minimize_to_tray,
            set_minimize_to_tray,
            save_window_state,
            load_window_state,
            get_shuffle,
            set_shuffle,
            get_repeat,
            set_repeat,
            register_media_shortcuts,
            unregister_media_shortcuts,
            emit_media_event,
        ])
        .on_window_event(|window, event| {
            // 창 상태 변경 시 자동 저장 (리사이즈/이동 시 저장)
            if matches!(event, 
                tauri::WindowEvent::Resized(_) | 
                tauri::WindowEvent::Moved(_) |
                tauri::WindowEvent::Focused(_)
            ) {
                let app_handle = window.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = save_window_state(app_handle).await;
                });
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_app_handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            if let Some(mut child) = api_server_child.lock().unwrap().take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    });
}
