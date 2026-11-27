//! 검색 결과 캐시
//! 짧은 TTL의 LRU 캐시로 구현하여 중복 API 호출 방지

use std::time::{Duration, Instant};
use std::collections::HashMap;
use serde::Serialize;

/// YouTube 영상 정보
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

/// YouTube 검색 결과
#[derive(Debug, Clone, Serialize)]
pub struct YouTubeSearchResult {
    pub results: Vec<YouTubeVideo>,
    pub total_results: usize,
}

/// 캐시 항목 (TTL 기반 만료)
#[derive(Debug, Clone)]
struct CacheItem {
    data: YouTubeSearchResult,
    expires_at: Instant,
}

/// YouTube 검색 결과 캐시
#[derive(Debug)]
pub struct YouTubeSearchCache {
    cache: HashMap<String, CacheItem>,
    ttl: Duration,
}

impl YouTubeSearchCache {
    /// TTL 5분 캐시 생성
    pub fn new(ttl_seconds: u64) -> Self {
        Self {
            cache: HashMap::new(),
            ttl: Duration::from_secs(ttl_seconds),
        }
    }

    /// 캐시 키 생성 (검색어 + limit 조합)
    fn make_key(query: &str, limit: u32) -> String {
        format!("{}:{}", query.to_lowercase(), limit)
    }

    /// 캐시에서 조회
    pub fn get(&self, query: &str, limit: u32) -> Option<YouTubeSearchResult> {
        let key = Self::make_key(query, limit);
        
        self.cache.get(&key).and_then(|item| {
            if item.expires_at > Instant::now() {
                Some(item.data.clone())
            } else {
                None
            }
        })
    }

    /// 캐시에 저장
    pub fn set(&mut self, query: &str, limit: u32, data: YouTubeSearchResult) {
        let key = Self::make_key(query, limit);
        
        // 캐시 크기 제한 (100개 초과 시 오래된 항목 제거)
        if self.cache.len() >= 100 {
            self.cache.retain(|_, item| item.expires_at > Instant::now());
        }
        
        let expires_at = Instant::now() + self.ttl;
        self.cache.insert(key, CacheItem { data, expires_at });
    }

    /// 만료된 항목 정리
    pub fn cleanup(&mut self) {
        self.cache.retain(|_, item| item.expires_at > Instant::now());
    }
}

impl Default for YouTubeSearchCache {
    fn default() -> Self {
        Self::new(300) // 5분 TTL
    }
}