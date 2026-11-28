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
use std::hash::{Hash, Hasher};

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
    
    if !is_soundcloud_url(trimmed_url) {
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
    
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    trimmed_url.hash(&mut hasher);
    let id = format!("sc-{:x}", hasher.finish());
    
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

fn is_soundcloud_url(value: &str) -> bool {
    let Some((scheme, rest)) = value.split_once("://") else {
        return false;
    };
    if scheme != "https" && scheme != "http" {
        return false;
    }

    let host = rest.split(['/', '?', '#', ':']).next().unwrap_or_default().to_ascii_lowercase();
    host == "soundcloud.com"
        || host.ends_with(".soundcloud.com")
        || host == "soundcloud.fr"
        || host.ends_with(".soundcloud.fr")
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

    if !is_soundcloud_url(params.url.trim()) {
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

#[cfg(test)]
mod tests {
    use super::is_soundcloud_url;

    #[test]
    fn accepts_soundcloud_hosts_over_http_or_https() {
        assert!(is_soundcloud_url("https://soundcloud.com/artist/track"));
        assert!(is_soundcloud_url("https://on.soundcloud.com/short-link"));
        assert!(is_soundcloud_url("http://soundcloud.fr/artist/track"));
    }

    #[test]
    fn rejects_urls_with_soundcloud_only_in_the_path_or_query() {
        assert!(!is_soundcloud_url("https://example.com/soundcloud.com/track"));
        assert!(!is_soundcloud_url("https://soundcloud.com.example.org/track"));
        assert!(!is_soundcloud_url("javascript://soundcloud.com/track"));
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
