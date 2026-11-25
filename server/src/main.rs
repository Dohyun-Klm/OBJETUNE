//! OBJETUNE API Server
//! YouTube Data API v3를 통한 콘텐츠 검색 및 메타데이터 제공

use axum::{
    routing::{get, Router},
    Extension,
    Json,
};
use tower_http::cors::{CorsLayer, Any};
use dotenvy::dotenv;
use std::{env, net::SocketAddr, sync::Arc};
use serde::{Deserialize, Serialize};

mod routes;
pub use routes::*;

#[derive(Debug, Clone)]
pub struct AppState {
    pub youtube_api_key: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ErrorResponse {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "objetune-api"
    }))
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

    let app_state = Arc::new(AppState { youtube_api_key });

    // CORS 설정 (개발용 - 프로덕션에서는 도메인 제한 필요)
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

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
    let addr = SocketAddr::from(([0, 0, 0, 0], port.parse().unwrap_or(8080)));
    
    tracing::info!("OBJETUNE API Server starting on {}", addr);
    
    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app)
        .await
        .unwrap();
}