//! API 라우트 모듈
//! YouTube와 SoundCloud API 통합을 위한 라우트 정의

pub mod youtube;
pub mod soundcloud;

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
}