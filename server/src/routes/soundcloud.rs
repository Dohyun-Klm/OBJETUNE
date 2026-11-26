//! SoundCloud API 라우트
//! SoundCloud는 YouTube API 서버의 의존도가 없음
//! 프론트엔드에서 공개 URL을 직접 입력받아 Widget API로 재생

use axum::{
    extract::Query,
    Json,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use crate::ErrorResponse;

#[derive(Debug, Clone, Serialize)]
pub struct SoundCloudTrack {
    pub id: String,
    pub title: String,
    pub description: String,
    pub url: String,
    pub embed_url: String,
    pub artwork_url: Option<String>,
    pub duration: u32, // ms 단위
}

#[derive(Deserialize)]
pub struct TrackQuery {
    /// SoundCloud 트랙 URL
    pub url: String,
}

/// SoundCloud 트랙 URL에서 정보 추출
async fn extract_track_info(url: &str) -> Result<SoundCloudTrack, String> {
    let trimmed_url = url.trim();
    
    // SoundCloud URL 정규식 검증
    if !trimmed_url.contains("soundcloud.com") && !trimmed_url.contains("soundcloud.fr") {
        return Err("SoundCloud URL이 아닙니다".to_string());
    }

    // URL에서 artist/track 추출 시도
    let title = if let Some(last_segment) = trimmed_url.rsplit('/').next() {
        if !last_segment.is_empty() {
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
        urlencoding::encode(trimmed_url)
    );
    
    // 간단한 고유 ID 생성
    let id = format!("sc-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos());
    
    Ok(SoundCloudTrack {
        id,
        title,
        description: String::new(),
        url: trimmed_url.to_string(),
        embed_url,
        artwork_url: None,
        duration: 0,
    })
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

    match extract_track_info(&params.url).await {
        Ok(track) => Ok(Json(track)),
        Err(e) => {
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

/// SoundCloud 검색 API - 비활성화됨
/// Artist Pro 구독이 필요하여 검색 기능은 구현하지 않음
/// 대신 URL 입력 방식(Widget API)으로 재생 지원
pub async fn search(
    Query(_params): Query<()>,
) -> Result<Json<ErrorResponse>, (StatusCode, Json<ErrorResponse>)> {
    Err((
        StatusCode::GONE,  // 410: Search 기능 영구 중단됨
        Json(ErrorResponse {
            message: "SoundCloud 검색은 artist pro 구독이 필요합니다. 트랙 URL을 직접 입력해주세요.".to_string(),
            error_code: Some("SEARCH_NOT_SUPPORTED".to_string()),
        }),
    ))
}