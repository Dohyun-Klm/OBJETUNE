//! OBJETUNE Tauri 백엔드
//! Tauri 2 + Rust 핵심 로직 - SQLite 저장소와 데이터 관리

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};

mod database;
use database::{Track, Playlist, init_database, DB_CONNECTION};

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
async fn init_db() -> Result<String, ErrorResponse> {
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
        let _ = fs::create_dir_all(parent);
    }
    
    init_database(&db_path).map_err(|e| ErrorResponse { 
        message: format!("Database initialization failed: {}", e) 
    })?;
    
    Ok(db_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = std::panic::catch_unwind(|| {
        let _ = init_db();
    });
    
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
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}