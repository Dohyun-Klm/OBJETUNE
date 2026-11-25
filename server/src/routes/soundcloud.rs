//! SoundCloud API 라우트
//! SoundCloud 검색 및 트랙 정보 조회

use axum::{
    extract::Query,
    Json,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use crate::ErrorResponse;

#[derive(Debug, Clone, Serialize)]
pub struct SoundCloudSearchResult {
    pub results: Vec<SoundCloudTrack>,
    pub total_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct SoundCloudTrack {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub url: String,
    pub embed_url: String,
    pub artwork_url: Option<String>,
    pub user: Option<SoundCloudUser>,
    pub duration: u32, // ms 단위
    pub genre: Option<String>,
    pub release_date: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SoundCloudUser {
    pub id: u64,
    pub username: String,
    pub avatar_url: Option<String>,
    pub permalink_url: String,
}

#[derive(Deserialize)]
pub struct SearchQuery {
    /// 검색어
    #[serde(default)]
    pub q: String,
    /// 결과 개수
    #[serde(default = "default_limit")]
    pub limit: u32,
}

#[derive(Deserialize)]
pub struct TrackQuery {
    /// SoundCloud 트랙 URL
    pub url: String,
}

fn default_limit() -> u32 { 10 }

/// SoundCloud API 클라이언트
struct SoundCloudApiClient;

impl SoundCloudApiClient {
    /// SoundCloud URL에서 track 정보 추출
    /// Artist Pro 없이도 SoundCloud Widget으로 재생 가능하도록 URL 직접 매핑
    async fn get_track_by_url(url: &str) -> Result<SoundCloudTrack, String> {
        let trimmed_url = url.trim();
        
        // SoundCloud URL 정규식 검증
        if !trimmed_url.contains("soundcloud.com") && !trimmed_url.contains("soundcloud.fr") {
            return Err("SoundCloud URL이 아닙니다".to_string());
        }

        // URL에서 artist/track 추출 시도
        let title = if let Some(last_segment) = trimmed_url.rsplit('/').next() {
            if !last_segment.is_empty() {
                // URL에서 추출한 이름으로 타이틀 생성
                let clean_name = last_segment.replace('_', " ").replace('-', " ");
                format!("\"{}\"", clean_name)
            } else {
                trimmed_url.to_string()
            }
        } else {
            trimmed_url.to_string()
        };
        
        let embed_url = format!(
            "https://w.soundcloud.com/player/?url={}",
            trimmed_url.replace(" ", "%20")
        );
        
        Ok(SoundCloudTrack {
            id: 0,
            title,
            description: String::new(),
            url: trimmed_url.to_string(),
            embed_url,
            artwork_url: None,
            user: None,
            duration: 0,
            genre: None,
            release_date: None,
            created_at: None,
        })
    }
}

/// SoundCloud 트랙 검색 API
/// 검색 기능은 Artist Pro 구독이 필요하므로 비활성화됨
/// 대신 URL 입력 방식(Widget API)으로 재생 지원
pub async fn search(
    Query(_params): Query<SearchQuery>,
) -> Result<Json<SoundCloudSearchResult>, (StatusCode, Json<ErrorResponse>)> {
    // SoundCloud 검색 API는 Artist Pro 구독이 필수
    // MVP에서는 검색 기능을 비활성화하고 URL 입력 방식만 지원
    Err((
        StatusCode::GONE,  // 410: Search 기능 영구 중단됨
        Json(ErrorResponse {
            message: "SoundCloud 검색은 artist pro 구독이 필요합니다. 트랙 URL을 직접 입력해주세요.".to_string(),
            error_code: Some("SEARCH_NOT_SUPPORTED".to_string()),
        }),
    ))
}

/// SoundCloud 트랙 URL에서 정보 추출 API
pub async fn get_track_by_url(
    Query(params): Query<TrackQuery>,
) -> Result<Json<SoundCloudTrack>, (StatusCode, Json<ErrorResponse>)> {
    if params.url.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                message: "유효한 SoundCloud URL을 입력해주세요".to_string(),
                error_code: Some("EMPTY_URL".to_string()),
            }),
        ));
    }

    // URL 검증
    if !params.url.contains("soundcloud.com") && !params.url.contains("soundcloud.fr") {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                message: "SoundCloud URL이 아닙니다".to_string(),
                error_code: Some("INVALID_URL".to_string()),
            }),
        ));
    }

    match SoundCloudApiClient::get_track_by_url(&params.url).await {
        Ok(track) => Ok(Json(track)),
        Err(e) => {
            if e.contains("찾을 수 없습니다") {
                Err((
                    StatusCode::NOT_FOUND,
                    Json(ErrorResponse {
                        message: e,
                        error_code: Some("TRACK_NOT_FOUND".to_string()),
                    }),
                ))
            } else {
                Err((
                    StatusCode::BAD_REQUEST,
                    Json(ErrorResponse {
                        message: e,
                        error_code: Some("URL_EXTRACTION_FAILED".to_string()),
                    }),
                ))
            }
        }
    }
}