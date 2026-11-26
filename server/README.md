# OBJETUNE API Server

Rust + Axum 기반 YouTube 검색 API 서버

## 기능

- YouTube Data API v3를 통한 비디오 검색
- 비디오 상세 정보 조회 (제목, 채널, 썸네일, 재생시간, 게시일)
- 5분 TTL 검색 결과 캐시
- 입력 검증 및 에러 처리
- CORS 지원

## API 엔드포인트

### GET /health
서버 상태 확인

### GET /api/v1/youtube/search?q={query}&limit={n}
YouTube 동영상 검색

**파라미터:**
- `q`: 검색어 (필수, 최대 100자)
- `limit`: 결과 개수 (기본 10, 최대 50)

**응답 예시:**
```json
{
  "results": [
    {
      "video_id": "abc123",
      "title": "Video Title",
      "channel_title": "Channel Name",
      "thumbnail": "https://i.ytimg.com/vi/...",
      "video_url": "https://www.youtube.com/watch?v=abc123",
      "duration_seconds": 180,
      "published_at": "2024-01-01T00:00:00Z",
      "view_count": 10000
    }
  ],
  "total_results": 1
}
```

### GET /api/v1/youtube/videos/{id}
비디오 상세 정보 조회

### GET /api/v1/soundcloud/search
**비활성화됨** - Artist Pro 구독이 필요

### GET /api/v1/soundcloud/track?url={url}
SoundCloud 트랙 URL에서 정보 추출

## 환경 변수 설정

### 로컬 개발

1. `.env.example`을 복사하여 `.env` 생성
2. `YOUTUBE_API_KEY`에 실제 키 입력

```bash
cp .env.example .env
# .env 파일을 열어 YOUTUBE_API_KEY 설정
```

### 실행

```bash
# 의존성 설치
cargo build

# 실행
cargo run
# 또는
./target/debug/objetune-api
```

### 테스트

```bash
cargo test
```

### Production CORS 설정

프로덕션 환경에서는 허용할 도메인을 지정해야 합니다:

```bash
# 환경변수로 CORS origins 설정 (콤마로 구분)
export CORS_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"

# 또는 .env 파일에 추가
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

## 프론트엔드 연동

React/Vite 개발 서버(http://localhost:3000)에서 직접 호출됩니다.

```tsx
// 프론트엔드 예시
const response = await fetch('/api/v1/youtube/search?q=query&limit=10');
const data = await response.json();
```

## 보안 고려사항

- YouTube API 키는 서버 환경변수에만 저장
- 클라이언트 요청에는 API 키가 노출되지 않음
- CORS는 프로덕션에서는 도메인 제한 사용 권장
- 요청당 50개 이하의 결과만 반환
- 100자를 초과하는 검색어는 거부

## 라이선스

MIT