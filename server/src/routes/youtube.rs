//! YouTube Data API v3 라우트
//! 영상 검색 및 메타데이터 조회

use axum::{
    extract::{Query, Path, Extension},
    Json,
    http::StatusCode,
};
use serde::Deserialize;
use std::sync::Arc;
use std::time::Duration;
use crate::{AppState, ErrorResponse, YouTubeSearchResult, YouTubeVideo};

#[derive(Deserialize)]
pub struct SearchQuery {
    /// 검색어 (최대 100자)
    #[serde(default)]
    pub q: String,
    /// 결과 개수 (최대 50개)
    #[serde(default = "default_limit")]
    pub limit: u32,
}

fn default_limit() -> u32 { 10 }

/// ISO 8601 지속 시간 파싱 (PT1H2M3S 형식 -> 초)
fn parse_iso_duration(duration: &str) -> Option<u32> {
    let duration = duration.strip_prefix('P')?;
    let mut total: u32 = 0;
    let mut component = String::new();
    let mut in_time = false;
    let mut components_seen = 0;

    for character in duration.chars() {
        if character == 'T' {
            if in_time {
                return None;
            }
            in_time = true;
            continue;
        }

        if character.is_ascii_digit() {
            component.push(character);
            continue;
        }

        let amount = component.parse::<u32>().ok()?;
        component.clear();
        let multiplier = match (in_time, character) {
            (false, 'D') => 86_400,
            (true, 'H') => 3_600,
            (true, 'M') => 60,
            (true, 'S') => 1,
            _ => return None,
        };
        total = total.checked_add(amount.checked_mul(multiplier)?)?;
        components_seen += 1;
    }

    if !component.is_empty() || components_seen == 0 {
        None
    } else {
        Some(total)
    }
}

/// YouTube 데이터 API v3 클라이언트
struct YouTubeApiClient {
    api_key: String,
    base_url: &'static str,
    client: reqwest::Client,
}

impl YouTubeApiClient {
    fn new(api_key: String) -> Self {
        Self {
            api_key,
            base_url: "https://www.googleapis.com/youtube/v3",
            // 10초 타임아웃 설정
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap(),
        }
    }

    /// 영상 검색
    async fn search_videos(&self, query: &str, limit: u32) -> Result<Vec<YouTubeVideo>, String> {
        let params = [
            ("part", "snippet"),
            ("q", query),
            ("type", "video"),
            ("maxResults", &limit.to_string()),
            ("order", "relevance"),
            ("key", &self.api_key),
        ];

        let url = format!("{}/search", self.base_url);
        
        let response = self.client
            .get(&url)
            .query(&params)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    "YouTube API 요청 시간 초과".to_string()
                } else {
                    format!("API 요청 실패: {}", e)
                }
            })?;

        let status = response.status();
        
        if !status.is_success() {
            let err_text = response.text().await.unwrap_or_default();
            return Err(format!("YouTube API 오류: {} - {}", status, err_text));
        }

        let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        let items = json.get("items")
            .and_then(|i| i.as_array())
            .map(|a| a.to_vec())
            .unwrap_or_default();

        let mut videos = Vec::new();
        for item in items {
            if let Some(id) = item.get("id").and_then(|i| i.get("videoId")).and_then(|v| v.as_str()) {
                let video = self.get_video_details(id).await?;
                videos.push(video);
            }
        }

        Ok(videos)
    }

    /// 영상 상세 정보 조회
    async fn get_video_details(&self, video_id: &str) -> Result<YouTubeVideo, String> {
        let params = [
            ("part", "snippet,contentDetails,statistics"),
            ("id", video_id),
            ("key", &self.api_key),
        ];

        let url = format!("{}/videos", self.base_url);
        
        let response = self.client
            .get(&url)
            .query(&params)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    "영상 상세 정보 요청 시간 초과".to_string()
                } else {
                    format!("API 요청 실패: {}", e)
                }
            })?;

        let status = response.status();
        
        if !status.is_success() {
            let err_text = response.text().await.unwrap_or_default();
            return Err(format!("YouTube API 오류: {} - {}", status, err_text));
        }

        let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        let items = json.get("items").and_then(|i| i.as_array()).and_then(|a| a.first());

        let item = items.ok_or("영상 정보를 찾을 수 없습니다")?;

        let snippet = item.get("snippet").and_then(|s| s.as_object());
        let content_details = item.get("contentDetails").and_then(|c| c.as_object());
        let statistics = item.get("statistics").and_then(|s| s.as_object());

        let title = snippet
            .and_then(|s| s.get("title").and_then(|t| t.as_str()))
            .unwrap_or("Unknown Title")
            .to_string();
        
        let channel_title = snippet
            .and_then(|s| s.get("channelTitle").and_then(|t| t.as_str()))
            .unwrap_or("Unknown Channel")
            .to_string();
        
        let thumbnail = snippet
            .and_then(|s| s.get("thumbnails"))
            .and_then(|t| t.as_object())
            .and_then(|t| t.get("high"))
            .and_then(|h| h.as_object())
            .and_then(|h| h.get("url").and_then(|u| u.as_str()))
            .unwrap_or("https://i.ytimg.com/vi/default/default.jpg")
            .to_string();

        let duration = content_details
            .and_then(|c| c.get("duration").and_then(|d| d.as_str()))
            .and_then(parse_iso_duration);

        let published_at = snippet
            .and_then(|s| s.get("publishedAt").and_then(|p| p.as_str()))
            .unwrap_or("")
            .to_string();

        let view_count = statistics
            .and_then(|s| s.get("viewCount").and_then(|v| v.as_str()))
            .and_then(|v| v.parse::<u64>().ok());

        Ok(YouTubeVideo {
            video_id: video_id.to_string(),
            title,
            channel_title,
            thumbnail,
            video_url: format!("https://www.youtube.com/watch?v={}", video_id),
            duration_seconds: duration,
            published_at,
            view_count,
        })
    }
}

/// YouTube 영상 검색 API
pub async fn search(
    Query(params): Query<SearchQuery>,
    Extension(state): Extension<Arc<AppState>>,
) -> Result<Json<YouTubeSearchResult>, (StatusCode, Json<ErrorResponse>)> {
    // 입력 검증
    if params.q.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                message: "검색어를 입력해주세요".to_string(),
                error_code: Some("EMPTY_QUERY".to_string()),
            }),
        ));
    }

    if params.q.len() > 100 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                message: "검색어는 100자를 초과할 수 없습니다".to_string(),
                error_code: Some("QUERY_TOO_LONG".to_string()),
            }),
        ));
    }

    let limit = params.limit.min(50).max(1);

    // 캐시 확인
    if let Some(cached) = state.cache.get(&params.q, limit) {
        tracing::debug!("검색 결과 캐시 히트: {}", params.q);
        return Ok(Json(cached));
    }

    // API 키 확인
    let api_key = state.youtube_api_key.clone()
        .ok_or_else(|| (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorResponse {
                message: "YouTube Data API 키가 설정되지 않았습니다. 서버 관리자에게 문의해주세요.".to_string(),
                error_code: Some("NO_API_KEY".to_string()),
            }),
        ))?;

    let client = YouTubeApiClient::new(api_key);
    
    match client.search_videos(&params.q, limit).await {
        Ok(videos) => {
            let total = videos.len();
            
            // 캐시에 저장
            state.cache.set(&params.q, limit, YouTubeSearchResult {
                results: videos.clone(),
                total_results: total,
            });
            
            Ok(Json(YouTubeSearchResult {
                results: videos,
                total_results: total,
            }))
        }
        Err(e) => {
            // quota 한도 초과 또는 네트워크 오류 구분
            if e.contains("quota") || e.contains("403") {
                Err((
                    StatusCode::SERVICE_UNAVAILABLE,
                    Json(ErrorResponse {
                        message: "YouTube API 쿼리 할당량이 부족합니다. 잠시 후 다시 시도해주세요.".to_string(),
                        error_code: Some("QUOTA_EXCEEDED".to_string()),
                    }),
                ))
            } else if e.contains("시간 초과") {
                Err((
                    StatusCode::REQUEST_TIMEOUT,
                    Json(ErrorResponse {
                        message: "요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.".to_string(),
                        error_code: Some("TIMEOUT".to_string()),
                    }),
                ))
            } else {
                Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        message: "검색 중 오류가 발생했습니다".to_string(),
                        error_code: None,
                    }),
                ))
            }
        }
    }
}

/// YouTube 영상 상세 조회 API
pub async fn get_video(
    Path(video_id): Path<String>,
    Extension(state): Extension<Arc<AppState>>,
) -> Result<Json<YouTubeVideo>, (StatusCode, Json<ErrorResponse>)> {
    // 비디오 ID 검증
    if video_id.len() > 100 || video_id.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                message: "유효하지 않은 비디오 ID입니다".to_string(),
                error_code: Some("INVALID_VIDEO_ID".to_string()),
            }),
        ));
    }

    let api_key = state.youtube_api_key.clone()
        .ok_or_else(|| (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorResponse {
                message: "YouTube Data API 키가 설정되지 않았습니다".to_string(),
                error_code: Some("NO_API_KEY".to_string()),
            }),
        ))?;

    let client = YouTubeApiClient::new(api_key);
    
    match client.get_video_details(&video_id).await {
        Ok(video) => Ok(Json(video)),
        Err(e) => {
            if e.contains("404") || e.contains("찾을 수 없습니다") {
                Err((
                    StatusCode::NOT_FOUND,
                    Json(ErrorResponse {
                        message: "영상을 찾을 수 없습니다".to_string(),
                        error_code: Some("VIDEO_NOT_FOUND".to_string()),
                    }),
                ))
            } else if e.contains("시간 초과") {
                Err((
                    StatusCode::REQUEST_TIMEOUT,
                    Json(ErrorResponse {
                        message: "요청 시간이 초과되었습니다".to_string(),
                        error_code: Some("TIMEOUT".to_string()),
                    }),
                ))
            } else {
                Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        message: "영상 조회 중 오류가 발생했습니다".to_string(),
                        error_code: None,
                    }),
                ))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::parse_iso_duration;

    #[test]
    fn parses_youtube_iso_durations() {
        assert_eq!(parse_iso_duration("PT3M4S"), Some(184));
        assert_eq!(parse_iso_duration("PT1H2M3S"), Some(3723));
        assert_eq!(parse_iso_duration("PT45S"), Some(45));
    }

    #[test]
    fn rejects_malformed_durations() {
        assert_eq!(parse_iso_duration("3 minutes"), None);
        assert_eq!(parse_iso_duration("PTinvalidS"), None);
    }
}
