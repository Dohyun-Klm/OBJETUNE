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
    const BASE_URL: &'static str = "https://api.soundcloud.com";

    /// 트랙 검색 (공개 콘텐츠만)
    async fn search_tracks(query: &str, limit: u32) -> Result<Vec<SoundCloudTrack>, String> {
        let client = reqwest::Client::new();
        
        let params = [
            ("q", query),
            ("limit", &limit.to_string()),
            ("client_id", &get_client_id()),
        ];

        let url = format!("{}/search/tracks", Self::BASE_URL);
        
        let response = client
            .get(&url)
            .query(&params)
            .send()
            .await
            .map_err(|e| format!("API 요청 실패: {}", e))?;

        if response.status() == StatusCode::TOO_MANY_REQUESTS {
            return Err("요청이 과도합니다".to_string());
        }

        let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        let items: Vec<_> = json.as_array().unwrap_or(&Vec::new()).to_vec();

        let tracks = items.into_iter().filter_map(|item| {
            Some(SoundCloudTrack {
                id: item.get("id")?.as_u64()?,
                title: item.get("title")?.as_str()?.to_string(),
                description: item.get("description")?.as_str()?.to_string(),
                url: item.get("permalink_url")?.as_str()?.to_string(),
                embed_url: format!(
                    "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/{}",
                    item.get("id")?
                ),
                artwork_url: item.get("artwork_url").and_then(|v| v.as_str()).map(|s| s.to_string()),
                user: item.get("user").and_then(|u| u.as_object()).and_then(|u| {
                    Some(SoundCloudUser {
                        id: u.get("id")?.as_u64()?,
                        username: u.get("username")?.as_str()?.to_string(),
                        avatar_url: u.get("avatar_url").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        permalink_url: u.get("permalink_url")?.as_str()?.to_string(),
                    })
                }),
                duration: item.get("duration")?.as_u64()? as u32,
                genre: item.get("genre").and_then(|v| v.as_str()).map(|s| s.to_string()),
                release_date: item.get("release_date").and_then(|v| v.as_str()).map(|s| s.to_string()),
                created_at: item.get("created_at").and_then(|v| v.as_str()).map(|s| s.to_string()),
            })
        }).collect();

        Ok(tracks)
    }

    /// URL로 트랙 정보 추출
    async fn get_track_by_url(url: &str) -> Result<SoundCloudTrack, String> {
        // URL에서 track ID 추출 시도
        let track_id = Self::extract_track_id(url);
        
        if let Some(id) = track_id {
            let client = reqwest::Client::new();
            let api_url = format!("{}/tracks/{}", Self::BASE_URL, id);
            
            // client_id 파라미터 추가
            let url_with_key = format!("{}?client_id={}", api_url, get_client_id());
            
            let response = client
                .get(&url_with_key)
                .send()
                .await
                .map_err(|e| format!("API 요청 실패: {}", e))?;

            if response.status() == StatusCode::NOT_FOUND {
                return Err("트랙을 찾을 수 없습니다".to_string());
            }

            let item = response.json::<serde_json::Value>().await.map_err(|e| e.to_string())?;
            
            // Helper function to extract optional field
            let get_str = |obj: &serde_json::Value, key: &str, default: &str| -> String {
                obj.get(key)
                    .and_then(|v| v.as_str())
                    .unwrap_or(default)
                    .to_string()
            };

            let track_id_val = item.get("id").and_then(|v| v.as_u64());
            let title = get_str(&item, "title", "Unknown Title");
            let description = get_str(&item, "description", "");
            let permalink_url = get_str(&item, "permalink_url", "");
            
            let artwork_url = item.get("artwork_url").and_then(|v| v.as_str()).map(|s| s.to_string());
            let genre = item.get("genre").and_then(|v| v.as_str()).map(|s| s.to_string());
            let release_date = item.get("release_date").and_then(|v| v.as_str()).map(|s| s.to_string());
            let created_at = item.get("created_at").and_then(|v| v.as_str()).map(|s| s.to_string());
            let duration = item.get("duration").and_then(|v| v.as_u64()).unwrap_or(0) as u32;

            let user = item.get("user").and_then(|u| u.as_object()).map(|u| {
                let u = u.clone();
                SoundCloudUser {
                    id: u.get("id").and_then(|v| v.as_u64()).unwrap_or(0),
                    username: get_str(&serde_json::Value::Object(u.clone()), "username", ""),
                    avatar_url: u.get("avatar_url").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    permalink_url: get_str(&serde_json::Value::Object(u), "permalink_url", ""),
                }
            });

            return Ok(SoundCloudTrack {
                id: track_id_val.unwrap_or(0),
                title,
                description,
                url: permalink_url.clone(),
                embed_url: format!(
                    "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/{}",
                    track_id_val.unwrap_or(0)
                ),
                artwork_url,
                user,
                duration,
                genre,
                release_date,
                created_at,
            });
        }

        Err("트랙 ID를 추출할 수 없습니다".to_string())
    }

    /// SoundCloud URL에서 track ID 추출
    fn extract_track_id(url: &str) -> Option<u64> {
        use regex::Regex;
        
        // 숫자 ID가 있는 경우
        let re = Regex::new(r"(\d+)$").ok()?;
        re.captures(url)?.get(1)?.as_str().parse().ok()
    }
}

/// 클라이언트 ID (SoundCloud 공개 API용)
fn get_client_id() -> String {
    // SoundCloud는 공개 client_id가 제한적입니다
    // 프로덕션에서는 환경변수로 관리해야 합니다
    std::env::var("SOUNDCLOUD_CLIENT_ID")
        .unwrap_or_else(|_| "2t9loNQ39az6DtGnbUdYXAoxq9DMqvxN1w9WnA5pTz3rwbG6sS9Fqjqn4t8YcGhT".to_string())
}

/// SoundCloud 트랙 검색 API
pub async fn search(
    Query(params): Query<SearchQuery>,
) -> Result<Json<SoundCloudSearchResult>, (StatusCode, Json<ErrorResponse>)> {
    if params.q.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                message: "검색어를 입력해주세요".to_string(),
                error_code: Some("EMPTY_QUERY".to_string()),
            }),
        ));
    }

    let limit = params.limit.min(50).max(1);
    
    match SoundCloudApiClient::search_tracks(&params.q, limit).await {
        Ok(tracks) => Ok(Json(SoundCloudSearchResult {
            results: tracks,
            total_count: 0, // 실제 API에서는 별도 호출 필요
        })),
        Err(e) => {
            // 네트워크 오류 구분
            if e.contains("요청이 과도합니다") {
                Err((
                    StatusCode::TOO_MANY_REQUESTS,
                    Json(ErrorResponse {
                        message: "요청이 많습니다. 잠시 후 다시 시도해주세요.".to_string(),
                        error_code: Some("RATE_LIMITED".to_string()),
                    }),
                ))
            } else {
                Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        message: e,
                        error_code: None,
                    }),
                ))
            }
        }
    }
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