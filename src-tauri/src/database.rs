//! SQLite 데이터베이스 저장소
//! 로컬 메타데이터 및 사용자 컬렉션 관리

use rusqlite::{Connection, Result as SqlResult, params};
use serde::{Serialize, Deserialize};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use std::time::{SystemTime, UNIX_EPOCH};

pub static DB_CONNECTION: Lazy<Mutex<Option<Connection>>> = Lazy::new(|| Mutex::new(None));

/// 트랙 모델
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
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
    pub updated_at: i64,
}

impl Track {
    pub fn from_parts(
        platform: &str,
        platform_id: &str,
        title: String,
        artist: String,
        embed_url: String,
        duration: u32,
        thumbnail: Option<String>,
        url: Option<String>,
        cover_art_url: Option<String>,
    ) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        
        let id = format!("{}-{}", platform, platform_id);
        
        Track {
            id,
            platform: platform.to_string(),
            platform_id: platform_id.to_string(),
            title,
            artist,
            album: None,
            duration,
            thumbnail,
            url,
            embed_url,
            cover_art_url,
            added_at: now,
            updated_at: now,
        }
    }
}

/// 플레이리스트 모델
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub cover_image: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Playlist {
    pub fn new(name: String) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        
        let id = format!("playlist-{}", now);
        
        Playlist {
            id,
            name,
            description: None,
            cover_image: None,
            created_at: now,
            updated_at: now,
        }
    }
}

/// 히스토리 엔트리 모델
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub track_id: String,
    pub played_at: i64,
}

/// 설정 모델
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
    pub updated_at: i64,
}

/// 데이터베이스 초기화 및 스키마 생성
pub fn init_database(db_path: &str) -> SqlResult<()> {
    let conn = Connection::open(db_path)?;
    
    // 외장 키 제약조건 활성화
    conn.execute("PRAGMA foreign_keys = ON;", [])?;
    
    // 스키마 버전 테이블
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        )",
        [],
    )?;
    
    // 현재 스키마 버전 (0.1.0 기준)
    if !schema_exists(&conn)? {
        conn.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?1)", 
            params![current_timestamp()])?;
    }
    
    // Track 테이블
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tracks (
            id TEXT PRIMARY KEY,
            platform TEXT NOT NULL,
            platform_id TEXT NOT NULL,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            album TEXT,
            duration INTEGER NOT NULL,
            thumbnail TEXT,
            url TEXT,
            embed_url TEXT NOT NULL,
            cover_art_url TEXT,
            added_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;
    
    // Playlist 테이블
    conn.execute(
        "CREATE TABLE IF NOT EXISTS playlists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            cover_image TEXT,
            is_folder INTEGER DEFAULT 0,
            parent_id INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;
    
    // PlaylistTrack 테이블 (플레이리스트의 트랙 관계)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS playlist_tracks (
            playlist_id TEXT NOT NULL,
            track_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            added_at INTEGER NOT NULL,
            PRIMARY KEY (playlist_id, track_id),
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
        )",
        [],
    )?;
    
    // Favorites 테이블
    conn.execute(
        "CREATE TABLE IF NOT EXISTS favorites (
            track_id TEXT PRIMARY KEY,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
        )",
        [],
    )?;
    
    // History 테이블
    conn.execute(
        "CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track_id TEXT NOT NULL,
            played_at INTEGER NOT NULL,
            FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
        )",
        [],
    )?;
    
    // Settings 테이블
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;
    
    // Queue 테이블 (세션별 임시 대기열)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS queue (
            position INTEGER PRIMARY KEY,
            track_id TEXT NOT NULL,
            added_at INTEGER NOT NULL,
            FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
        )",
        [],
    )?;
    
    // 인덱스 생성
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tracks_platform ON tracks(platform)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_history_played_at ON history(played_at DESC)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_playlist_tracks_position ON playlist_tracks(playlist_id, position)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorites(created_at DESC)", [])?;
    
    // 연결池에 저장
    *DB_CONNECTION.lock().unwrap() = Some(conn);
    
    Ok(())
}

fn schema_exists(conn: &Connection) -> SqlResult<bool> {
    let found: i64 = conn.query_row(
        "SELECT COUNT(*) FROM schema_migrations WHERE version >= 1",
        [],
        |row| row.get(0),
    )?;
    Ok(found > 0)
}

fn current_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn test_track_id_generation() {
        let track = Track::from_parts(
            "youtube",
            "dQw4w9WgXcQ",
            "Test Track".to_string(),
            "Test Artist".to_string(),
            "https://www.youtube.com/embed/dQw4w9WgXcQ".to_string(),
            180,
            None,
            None,
            None,
        );
        
        assert_eq!(track.id, "youtube-dQw4w9WgXcQ");
        assert_eq!(track.platform, "youtube");
        assert_eq!(track.platform_id, "dQw4w9WgXcQ");
    }

    #[test]
    fn test_playlist_id_generation() {
        let playlist = Playlist::new("Test Playlist".to_string());
        
        assert!(playlist.id.starts_with("playlist-"));
        assert_eq!(playlist.name, "Test Playlist");
    }

    #[test]
    fn test_database_initialization() {
        let mut db_path = env::temp_dir();
        db_path.push("objetune_test_db.sqlite");
        
        let result = init_database(&db_path.to_string_lossy());
        assert!(result.is_ok());
        
        // 정리
        let _ = fs::remove_file(db_path);
    }
}