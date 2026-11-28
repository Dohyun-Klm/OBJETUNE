//! OBJETUNE API Server
//! YouTube Data API v3를 통한 콘텐츠 검색 및 메타데이터 제공

use axum::{
    routing::{get, Router},
    Extension, Json,
};
use tower_http::cors::{CorsLayer, AllowOrigin, AllowMethods, AllowHeaders};
use dotenvy::dotenv;
use std::{env, net::SocketAddr, sync::Arc, time::{Duration, Instant}};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use axum::http::HeaderName;

mod routes;
pub use routes::*;

#[derive(Debug, Clone)]
pub struct AppState {
    pub youtube_api_key: Option<String>,
    pub cache: Arc<YouTubeSearchCache>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ErrorResponse {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct YouTubeSearchResult {
    pub results: Vec<YouTubeVideo>,
    pub total_results: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct YouTubeVideo {
    pub video_id: String,
    pub title: String,
    pub channel_title: String,
    pub thumbnail: String,
    pub video_url: String,
    pub duration_seconds: Option<u32>,
    pub published_at: String,
    pub view_count: Option<u64>,
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "objetune-api"
    }))
}

/// YouTube 검색 결과 캐시 (5분 TTL)
pub struct YouTubeSearchCache {
    cache: RwLock<HashMap<String, CacheEntry>>,
    ttl: Duration,
}

impl std::fmt::Debug for YouTubeSearchCache {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("YouTubeSearchCache")
            .field("ttl", &self.ttl)
            .finish()
    }
}

impl std::clone::Clone for YouTubeSearchCache {
    fn clone(&self) -> Self {
        Self {
            cache: RwLock::new(self.cache.read().unwrap().clone()),
            ttl: self.ttl,
        }
    }
}

#[derive(Debug, Clone)]
struct CacheEntry {
    data: YouTubeSearchResult,
    expires_at: Instant,
}

impl YouTubeSearchCache {
    pub fn new(ttl_seconds: u64) -> Self {
        Self {
            cache: RwLock::new(HashMap::new()),
            ttl: Duration::from_secs(ttl_seconds),
        }
    }

    fn make_key(query: &str, limit: u32) -> String {
        format!("{}:{}", query.to_lowercase(), limit)
    }

    pub fn get(&self, query: &str, limit: u32) -> Option<YouTubeSearchResult> {
        let key = Self::make_key(query, limit);
        let cache = self.cache.read().unwrap();
        
        cache.get(&key).and_then(|entry| {
            if entry.expires_at > Instant::now() {
                Some(entry.data.clone())
            } else {
                None
            }
        })
    }

    pub fn set(&self, query: &str, limit: u32, data: YouTubeSearchResult) {
        let key = Self::make_key(query, limit);
        let mut cache = self.cache.write().unwrap();
        
        // 캐시 크기 제한 (100개 초과 시 오래된 항목 정리)
        if cache.len() >= 100 {
            cache.retain(|_, entry| entry.expires_at > Instant::now());
        }
        
        let expires_at = Instant::now() + self.ttl;
        cache.insert(key, CacheEntry { data, expires_at });
    }
}

impl Default for YouTubeSearchCache {
    fn default() -> Self {
        Self::new(300) // 5분 TTL
    }
}

#[tokio::main]
async fn main() {
    // 로깅 설정
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::new(
            env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string())
        ))
        .init();

    // 환경 변수 로드
    dotenv().ok();

    // YouTube API 키 읽기 (서버 프로세스 환경변수에서만 읽음)
    let youtube_api_key = env::var("YOUTUBE_API_KEY").ok();
    
    if youtube_api_key.is_none() {
        tracing::warn!("YOUTUBE_API_KEY가 설정되지 않았습니다. YouTube 검색 기능이 제한됩니다.");
    } else {
        tracing::info!("YouTube API 키가 성공적으로 로드되었습니다.");
    }

    // 캐시 및 앱 상태 생성
    let cache = Arc::new(YouTubeSearchCache::new(300)); // 5분 TTL
    let app_state = Arc::new(AppState { youtube_api_key, cache });

    // CORS 설정 - Tauri 데스크탑 앱 및 React devOrigin 허용
    // Production에서는 CORS_ORIGINS 환경변수로 허용할 도메인 목록을 콤마로 구분하여 설정
    let cors_origins: Vec<_> = env::var("CORS_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:3000,http://127.0.0.1:3000,tauri://localhost".to_string())
        .split(',')
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim().parse().unwrap())
        .collect();
    
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(cors_origins.into_iter()))
        .allow_methods(AllowMethods::list([axum::http::Method::GET, axum::http::Method::OPTIONS].into_iter()))
        .allow_headers(AllowHeaders::list([
            HeaderName::from_static("content-type"),
            HeaderName::from_static("authorization"),
        ].into_iter()))
        .allow_credentials(true);

    // 라우터 설정
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/youtube/search", get(youtube::search))
        .route("/api/v1/youtube/videos/:video_id", get(youtube::get_video))
        .route("/api/v1/soundcloud/search", get(soundcloud::search))
        .route("/api/v1/soundcloud/track", get(soundcloud::get_track_by_url))
        .layer(Extension(cors))
        .layer(Extension(app_state));

    // 서버 시작 (기본 8080 포트, 환경변수로 재설정 가능)
    let port = env::var("API_PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = SocketAddr::from(([127, 0, 0, 1], port.parse().unwrap_or(8080)));
    
    tracing::info!("OBJETUNE API Server starting on {}", addr);
    
    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app)
        .await
        .unwrap();
}

#[cfg(test)]
mod tests {
    use super::{YouTubeSearchCache, YouTubeSearchResult, YouTubeVideo};

    fn sample_result() -> YouTubeSearchResult {
        YouTubeSearchResult {
            results: vec![YouTubeVideo {
                video_id: "sample-id".to_string(),
                title: "Sample Track".to_string(),
                channel_title: "Sample Artist".to_string(),
                thumbnail: String::new(),
                video_url: "https://www.youtube.com/watch?v=sample-id".to_string(),
                duration_seconds: Some(180),
                published_at: String::new(),
                view_count: None,
            }],
            total_results: 1,
        }
    }

    #[test]
    fn cache_returns_matching_result_and_separates_limits() {
        let cache = YouTubeSearchCache::new(30);
        cache.set("Sample", 1, sample_result());

        assert_eq!(cache.get("sample", 1).unwrap().total_results, 1);
        assert!(cache.get("sample", 2).is_none());
    }

    #[test]
    fn cache_expires_results_after_ttl() {
        let cache = YouTubeSearchCache::new(0);
        cache.set("sample", 1, sample_result());

        assert!(cache.get("sample", 1).is_none());
    }
}
