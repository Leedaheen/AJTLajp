# 고소작업대 임대 운영 협업 앱 기획서

> 작성일: 2026-06-10  
> 작성자: Leedaheen  
> 현장: P4 복합동 / P5 복합동

---

## 1. 프로젝트 개요

대형 건설 현장의 고소작업대 임대 운영을 위한 모바일/PC 협업 앱.  
협력사, AJ영업팀, AJ현장관리자, AS기사가 함께 사용하는 실시간 운영 플랫폼.

### 핵심 목표
- 반입/반출 신청부터 완료까지 디지털화
- QR코드 기반 장비 이력 관리
- AS 요청/처리 실시간 추적
- 장비 가동률 데이터 분석

---

## 2. 기술 스택

| 구분 | 기술 | 이유 |
|------|------|------|
| 프론트엔드 | HTML + Vanilla JS (모듈 분리) | 별도 설치 없이 브라우저 실행 |
| 백엔드 | Python FastAPI | 빠른 응답, async 지원 |
| 데이터베이스 | Supabase (PostgreSQL) | RLS 보안, Realtime, 무료 시작 |
| 인증 | Google OAuth2 + JWT | 별도 가입 불필요, 보안 강력 |
| 푸시 알림 | PWA Web Push (VAPID + pywebpush) | Firebase 의존 없음 |
| QR 생성 | qrcode (Python) | 경량, 커스텀 가능 |
| PDF 출력 | ReportLab (Python) | QR 인쇄용 PDF 정밀 레이아웃 |
| 차트 | Chart.js | CDN 사용, 간단 |
| 배포 | Render.com | 현재 사용 중인 플랫폼 |
| 오프라인 | Service Worker + IndexedDB | PWA 수준 오프라인 지원 |

### 색상 팔레트
- 주색: `#1B365D` (네이비)
- 강조: `#E8192C` (레드)
- 보조: `#3D3D3D` (다크그레이)

---

## 3. 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                      │
│  HTML + Vanilla JS (모듈 분리)  ←→  Service Worker       │
│  반응형 CSS (#1B365D / #E8192C / #3D3D3D)                │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS REST / WebSocket
┌────────────────────▼────────────────────────────────────┐
│               BACKEND (Python / FastAPI)                 │
│  Render.com 배포  |  환경변수: .env (노출 없음)           │
│  인증: Google OAuth2 + JWT                               │
│  QR생성: qrcode  |  PDF: ReportLab                      │
│  Push알림: PWA Web Push (pywebpush + VAPID)             │
└────────────────────┬────────────────────────────────────┘
                     │ Supabase Client (postgrest)
┌────────────────────▼────────────────────────────────────┐
│                   Supabase (PostgreSQL)                  │
│  RLS(행 수준 보안) + Realtime 구독 + Storage(파일)        │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 프로젝트 파일 구조

```
ajpjt/
├── backend/
│   ├── main.py                     # 앱 진입점, 라우터 등록
│   ├── config.py                   # 환경변수 로드 (dotenv)
│   ├── database.py                 # Supabase 클라이언트 초기화
│   ├── auth.py                     # Google OAuth2, JWT 처리
│   ├── models/
│   │   ├── user.py
│   │   ├── equipment.py
│   │   ├── transit.py
│   │   ├── as_request.py
│   │   └── usage_log.py
│   ├── routers/
│   │   ├── users.py                # 사용자 CRUD, 권한관리
│   │   ├── equipment.py            # 장비 관리
│   │   ├── transit.py              # 반입/반출 신청
│   │   ├── as_requests.py          # AS 요청/처리
│   │   ├── usage_logs.py           # 사용 시간 기록
│   │   ├── qr.py                   # QR 생성, PDF 출력
│   │   ├── notifications.py        # 알림 발송
│   │   └── analytics.py            # 데이터 분석
│   ├── services/
│   │   ├── qr_service.py           # QR코드 생성 로직
│   │   ├── pdf_service.py          # PDF 생성 로직
│   │   ├── push_service.py         # PWA Web Push (pywebpush)
│   │   └── offline_sync.py         # 오프라인 동기화
│   ├── requirements.txt
│   └── .env                        # 환경변수 (git 제외)
│
├── frontend/
│   ├── index.html                  # 메인 진입점
│   ├── manifest.json               # PWA 매니페스트
│   ├── sw.js                       # Service Worker (오프라인 + Push 수신)
│   ├── css/
│   │   ├── base.css                # 전역 스타일, 색상 변수
│   │   ├── layout.css              # 반응형 레이아웃
│   │   ├── components.css          # 버튼, 카드, 모달 등
│   │   └── dashboard.css           # 홈 대시보드
│   └── js/
│       ├── app.js                  # 라우팅, 초기화
│       ├── auth.js                 # 로그인/로그아웃, 권한 체크
│       ├── api.js                  # fetch 래퍼, 에러 처리
│       ├── storage.js              # localStorage, 오프라인 큐
│       ├── notifications.js        # Push 수신, 알림 설정
│       ├── qr-scanner.js           # QR 스캔 (카메라)
│       ├── pages/
│       │   ├── home.js             # 홈 대시보드
│       │   ├── transit.js          # 반입/반출 페이지
│       │   ├── equipment.js        # 장비 관리 페이지
│       │   ├── as-request.js       # AS 요청/처리 페이지
│       │   ├── usage-log.js        # 사용 기록 페이지
│       │   ├── analytics.js        # 분석 리포트 페이지
│       │   └── admin.js            # 관리자 페이지
│       └── components/
│           ├── modal.js            # 공통 모달
│           ├── toast.js            # 알림 토스트
│           ├── table.js            # 공통 테이블
│           └── chart.js            # Chart.js 래퍼
│
└── supabase/
    └── schema.sql                  # DB 스키마 전체
```

---

## 5. 데이터베이스 설계

### 5-1. 사용자 테이블 (app_users)

```sql
CREATE TABLE app_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id     text UNIQUE NOT NULL,
  email         text UNIQUE NOT NULL,
  name          text NOT NULL,
  phone         text,
  role          text CHECK (role IN ('tech','partner','aj','as_tech')),
  site_id       text CHECK (site_id IN ('P4','P5','ALL')),
  status        text DEFAULT 'pending' CHECK (status IN ('pending','active','rejected')),
  reject_reason text,
  push_sub      jsonb,              -- PWA Push 구독 정보
  notif_prefs   jsonb DEFAULT '{}', -- 알림 수신 선택 설정
  created_at    timestamptz DEFAULT now(),
  approved_at   timestamptz,
  approved_by   uuid REFERENCES app_users(id)
);
```

### 5-2. 장비 테이블 (equipment)

```sql
CREATE TABLE equipment (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  equip_no    text NOT NULL,
  spec        text,                    -- 6M, 8M, 10M, 12M, 14M, 16M, 16M굴절, 18M, 20M굴절
  model       text,
  site_id     text,
  site_name   text,
  company     text,
  status      text DEFAULT 'stock',   -- stock / in_use / transit / returned
  qr_code     text UNIQUE,            -- 반출 시 NULL로 삭제
  in_date     text,
  out_date    text,
  transit_id  bigint REFERENCES transit(id),
  record_id   text UNIQUE,
  created_at  timestamptz DEFAULT now()
);
```

### 5-3. 반입/반출 신청 테이블 (transit)

```sql
CREATE TABLE transit (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id        text UNIQUE,
  type             text CHECK (type IN ('in','out')),
  site_id          text,
  site_name        text,
  company          text,
  equip_specs      jsonb,             -- [{spec:'6M', qty:2}, ...]
  aj_equip         text,
  reporter_name    text,
  reporter_phone   text,
  manager_name     text,              -- 양중담당자
  manager_phone    text,
  manager_location text,
  requested_date   text,              -- 희망 날짜
  scheduled_date   text,              -- AJ 확정 날짜
  vehicle_info     text,              -- 배차 차량번호
  driver_info      text,              -- 배차 기사
  status           text DEFAULT 'requested',
  -- requested / scheduled / confirmed / completed / cancelled
  cancelled_reason text,
  note             text,
  change_log       jsonb DEFAULT '[]', -- 변경 이력 (누가/언제/무엇을)
  created_by       uuid REFERENCES app_users(id),
  created_at       timestamptz DEFAULT now(),
  completed_at     timestamptz
);
```

### 5-4. AS 요청 테이블 (as_requests)

```sql
CREATE TABLE as_requests (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id      text UNIQUE,
  site_id        text,
  site_name      text,
  equip_no       text,
  equip_id       bigint REFERENCES equipment(id),
  company        text,
  location       text,               -- 층/열수
  fault_type     text,
  -- 작동불량 / 충전불량 / 누유의심 / 파손 / 자재요청 / 오류코드 / 기타
  description    text,
  reporter_name  text,
  reporter_phone text,
  user_name      text,
  user_phone     text,
  status         text DEFAULT 'requested',
  -- requested / in_progress / material_pending / completed
  tech_id        uuid REFERENCES app_users(id),
  tech_name      text,
  tech_phone     text,
  resolve_note   text,
  requested_at   timestamptz DEFAULT now(),
  material_at    timestamptz,
  resolved_at    timestamptz,
  elapsed_min    integer              -- 소요시간(분) 자동계산
);
```

### 5-5. 장비 사용 기록 테이블 (usage_logs)

```sql
CREATE TABLE usage_logs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id    text UNIQUE,
  equip_id     bigint REFERENCES equipment(id),
  equip_no     text,
  site_id      text,
  company      text,
  team_name    text,
  floor        text,
  location     text,
  recorder_id  uuid REFERENCES app_users(id),
  recorder     text,
  start_time   timestamptz,
  end_time     timestamptz,
  used_hours   numeric DEFAULT 0,
  status       text DEFAULT 'using',  -- using / done
  date         text,
  created_at   timestamptz DEFAULT now()
);
```

### 5-6. 알림 테이블 (notifications)

```sql
CREATE TABLE notifications (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_id  uuid REFERENCES app_users(id),
  type       text,      -- transit / as / approval / schedule
  title      text,
  body       text,
  ref_id     text,
  is_read    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

---

## 6. 사용자 역할 및 권한

### 역할 종류

| 역할 코드 | 역할명 | 설명 |
|----------|--------|------|
| `tech` | 기술인 | 현장 작업자. QR 스캔으로 사용/AS 요청 |
| `partner` | 협력사 담당자 | 반입/반출 신청, 일정 확인 |
| `aj` | AJ관리자 | 모든 기능 + 사용자 승인 + 일정 확정 |
| `as_tech` | AS기사 | 담당 구역 AS 요청 확인 및 처리 |
| `admin` | 관리자 | 시스템 전체 관리 (개발자용, 일반 사용자에게는 노출 안됨) |


### 역할별 기능 권한

| 기능 | 기술인 | 협력사 | AJ관리자 | AS기사 |
|------|:------:|:------:|:--------:|:------:|
| 홈 대시보드 조회 | ✅ | ✅ | ✅ | ✅ |
| 반입/반출 신청 | ❌ | ✅ | ✅ | ❌ |
| 반입/반출 일정 확인 | ❌ | ✅(본인사) | ✅ | ❌ |
| 반입/반출 완료 처리 | ❌ | ❌ | ✅ | ❌ |
| 재고/일정/배차 관리 | ❌ | ❌ | ✅ | ❌ |
| QR 스캔 | ✅ | ✅ | ✅ | ✅ |
| AS 요청 | ✅ | ✅ | ✅ | ❌ |
| AS 처리/완료 | ❌ | ❌ | ✅(조회) | ✅ |
| 사용 시간 기록 | ✅ | ✅ | ✅ | ❌ |
| 분석 리포트 | ❌ | ❌ | ✅ | ❌ |
| 사용자 승인/관리 | ❌ | ❌ | ✅ | ❌ |

### 승인 정책

| 역할 | 승인 필요 여부 |
|------|--------------|
| 기술인 | 즉시 사용 가능 |
| 협력사 담당자 | AJ관리자 승인 후 사용 |
| AS기사 | AJ관리자 승인 후 사용 |
| AJ관리자 | 즉시 사용 가능 |

---

## 7. API 엔드포인트 설계

```
# 인증
POST   /auth/google                    # Google OAuth 로그인
GET    /auth/me                        # 현재 사용자 정보

# 사용자 관리
GET    /users                          # 목록 (aj만)
PATCH  /users/{id}/approve             # 승인/거절
PATCH  /users/{id}/role                # 역할 변경

# 반입/반출
GET    /transit                        # 목록
POST   /transit                        # 신청 등록
PATCH  /transit/{id}                   # 일정 변경 (변경이력 자동기록)
PATCH  /transit/{id}/complete          # 완료 처리
PATCH  /transit/{id}/cancel            # 취소

# 장비
GET    /equipment                      # 목록 (검색 필터 포함)
GET    /equipment/{id}                 # 상세
POST   /equipment/qr/{qr_code}         # QR 스캔 → 장비 정보 반환

# AS 요청
GET    /as-requests                    # 목록 (검색 필터 포함)
POST   /as-requests                    # 요청 등록
PATCH  /as-requests/{id}/resolve       # 처리 완료

# 사용 기록
POST   /usage-logs/start               # 사용 시작
POST   /usage-logs/end                 # 사용 종료

# 분석
GET    /analytics/as                   # AS 분석 데이터
GET    /analytics/usage                # 가동률 분석 데이터

# QR / PDF
POST   /qr/generate/{equip_id}         # QR 생성
POST   /qr/pdf                         # PDF 일괄 출력

# 알림
GET    /notifications                  # 내 알림 목록
PATCH  /notifications/{id}/read        # 읽음 처리
PATCH  /users/me/notif-prefs           # 알림 수신 설정

# PWA Push
POST   /push/subscribe                 # 구독 정보 저장
POST   /push/send                      # 푸시 발송 (내부용)
```

---

## 8. 화면 구성

### 8-1. 홈 대시보드 (전체 공통)

```
┌──────────────────────────────────────────────────────────────┐
│  AJ 고소작업대 운영시스템     [현장: P4] [이름] [로그아웃]    │
├───────────────┬──────────────────┬───────────────────────────┤
│  반입반출 일정 │  장비 가동 현황  │    AS 처리 현황           │
│               │                  │                           │
│  · 예정 3건   │  P4: 12대 가동  │  · 처리중 2건             │
│  · 완료 1건   │  P5:  8대 가동  │  · 신규요청 1건           │
│               │                  │  · 자재수급중 1건         │
│  [이동 버튼]  │  [이동 버튼]    │    [이동 버튼]            │
│  (권한없으면  │  (권한없으면    │    (권한없으면            │
│   비활성화)   │   비활성화)     │     비활성화)             │
└───────────────┴──────────────────┴───────────────────────────┘
```

### 8-2. 반입 신청서 (협력사)

- 업체명 / 담당자 / 연락처 (이전 입력값 자동 불러오기)
- 양중담당자 / 연락처
- 희망 반입 날짜 (달력 선택)
- 장비 제원 + 수량 (행 추가 버튼)
  - 선택 옵션: 6M / 8M / 10M / 12M / 14M / 16M / 16M굴절 / 18M / 20M굴절
- 현장 선택: P4복합동 / P5복합동
- 안전서류 다운로드 링크 (안전검사증, 보험증서 등)

### 8-3. QR 스캔 액션 메뉴

```
스캔 후 팝업:
  장비번호: AJ-2024-001
  제원: 8M / P4 복합동

  [장비 사용 신청]  [사용 종료]  [AS 요청]
```

### 8-4. QR PDF 레이아웃

```
A4 용지 기준:
  - 중앙: QR코드 (크게)
  - 하단: 장비번호 + 반입날짜
  - 여러 장비 한 번에 인쇄 가능
  - A4 용지 한 장에 QR코드 최대 1개 배치
```

---

## 9. 사용자 시나리오 (전체 흐름)

```
[협력사] 반입 신청
    ↓ 알림
[AJ관리자] 일정 확정 + 배차 입력
    ↓ 알림
[협력사] 확정 일정 확인
    ↓
[AJ관리자] 반입 완료 처리 → QR 자동 생성 → PDF 인쇄 → 장비 부착
    ↓
[기술인] QR 스캔 → 사용 시작/종료 기록
[기술인] QR 스캔 → AS 요청 → AS기사 알림
    ↓
[AS기사] 요청 확인 → 처리 완료 등록 → 소요시간 자동 기록
    ↓
[AJ관리자] 반출 완료 처리 → QR 삭제 → 이력 보존
```

---

## 10. 역할별 사용자 가이드

### 기술인 (현장 작업자)

1. 앱 접속 → 구글 로그인 → 역할: 기술인 선택 → 즉시 사용 가능
2. QR 스캔 버튼 탭 → 장비 QR 스캔
3. 팝업에서 선택:
   - **장비 사용 신청**: 팀명/층수/위치 입력 → 시작 시각 자동 기록
   - **사용 종료**: 종료 시각 자동 기록 + 사용 시간 계산
   - **AS 요청**: 위치/고장 종류/내용 입력 → AS기사에게 알림 발송

### 협력사 담당자

1. 앱 접속 → 구글 로그인 → 역할: 협력사 담당자 선택 → AJ관리자 승인 대기
2. 승인 완료 알림 수신 후 사용 시작
3. 반입 신청서 작성 → 제출 → AJ관리자 알림 발송
4. 내 신청 목록에서 진행 상태 실시간 확인
5. 일정 확정/변경 알림 자동 수신

### AJ관리자

1. 앱 접속 → 구글 로그인 → 즉시 사용 가능 (모든 기능)
2. 신규 가입 신청 알림 → 승인 또는 거절(사유 입력)
3. 반입 신청 알림 → 날짜 확정 + 배차 정보 입력 → 저장
4. 반입 당일: 반입 완료 처리 → QR PDF 자동 생성 → 인쇄 → 장비 부착
5. 반출 시: 반출 완료 처리 → QR 자동 삭제 → 이력 기록 유지
6. 분석 메뉴에서 AS 현황 / 가동률 리포트 확인

### AS기사

1. 앱 접속 → 구글 로그인 → 역할: AS기사 선택 → AJ관리자 승인 대기
2. 승인 완료 후 담당 구역 AS 요청 알림 수신
3. AS 목록에서 요청 내역 확인 → 처리 시작
4. 현장 처리 완료 → 처리 내용 입력 → 완료 등록
5. 소요시간 자동 계산 기록

---

## 11. 알림 시스템 (PWA Web Push)

### 발송 시점

| 이벤트 | 수신 대상 |
|--------|---------|
| 신규 가입 신청 | AJ관리자 |
| 가입 승인/거절 | 신청자 |
| 반입 신청 등록 | AJ관리자 |
| 일정 확정 | 협력사 담당자 |
| 일정 변경 | 관련자 전체 |
| 반입/반출 완료 | 협력사 담당자 |
| AS 신규 요청 | 담당 AS기사 |
| AS 처리 완료 | 요청자 |

### 알림 내용 형식
```
일정 변경 예시:
제목: "[반입 일정 변경] OO건설"
내용: "희망일 3/18 → 확정일 3/19 / 배차: 5톤트럭 홍길동 연락처 010-1234-5678 차량번호 123가4567"
```

---

## 12. 오프라인 기능

- Service Worker로 캐시 관리
- 오프라인 중 입력: IndexedDB에 임시 저장
- 인터넷 복귀 시 Background Sync로 자동 전송
- 안내 메시지: "현재 오프라인 상태입니다. 인터넷 연결 후 자동으로 전송됩니다."

---

## 13. 검색 기능

### 장비 검색 필터
- 업체명 / 장비번호 / 위치 / 층 / 제원

### AS 내역 검색 필터
- 장비번호 / 고장유형 / 처리중 / 자재수급중 / 기한별 / 업체별

---

## 14. 에러 처리

| 상황 | 메시지 |
|------|--------|
| 이미 사용 중인 QR 재스캔 | "이 장비는 현재 OO팀이 사용 중입니다" |
| 권한 없는 메뉴 접근 | "접근 권한이 없습니다. 관리자에게 문의하세요" |
| 신청 중 네트워크 끊김 | "네트워크 오류. 내용은 임시 저장됩니다" |
| 중복 AS 요청 | "동일 장비의 AS가 이미 처리 중입니다 (담당: OO기사)" |
| 중복 QR 코드 | "이미 등록된 QR코드입니다" |

---

## 15. 보안

- Google OAuth2로 본인 인증
- JWT 토큰으로 API 접근 제어
- Supabase RLS(Row Level Security)로 DB 행 수준 접근 제어
- 환경변수는 `.env` 파일로 분리 관리 (git 제외)
- Render.com 대시보드 Environment Variables에 등록

---

## 16. 성능 목표

- 동시 접속: 200명 이상
- API 응답속도: 200ms 이하 (목표)
- DB 인덱스 적용: equip_no / site_id / status / created_at
- Supabase Realtime으로 실시간 데이터 반영

---

## 17. 개발 일정 (Sprint 계획)

| 스프린트 | 기간 | 내용 |
|---------|------|------|
| S1 | 1~2주 | DB 스키마, Google 로그인, 사용자 승인 흐름 |
| S2 | 3~4주 | 홈 대시보드, 반입/반출 신청, 장비 테이블 |
| S3 | 5~6주 | QR 생성/스캔, PDF 출력, AS 요청 |
| S4 | 7~8주 | 사용 시간 기록, 알림 시스템, 권한 관리 |
| S5 | 9~10주 | 분석 리포트, 오프라인 기능, 검색 |
| S6 | 11~12주 | 전체 테스트, 성능 최적화, 배포 |

---

## 18. 환경변수 목록

```bash
# backend/.env (절대 git에 포함 금지)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
JWT_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:admin@example.com
```

## 19. 참고

- 이모지 사용 금지
- 모든 날짜/시간은 YYYY-MM-DD HH:MM:SS 형식 (예: "2024-03-18 14:30:00")
- 전화번호는 하이픈 포함 (예: "010-1234-5678") 클릭 시 tel:링크로 전화 연결
- 역할별 UI 요소는 권한에 따라 동적 표시/숨김 처리
- 에러 메시지는 사용자 친화적으로 표시, 개발자용 상세 로그는 서버에 기록
- API 응답은 일관된 JSON 형식으로 반환 (예: { success: true, data: {...}, error: null })
- 모든 주요 액션(신청, 승인, 완료 등)은 변경 이력에 기록하여 감사 추적 가능하도록 설계
- 개발자용 관리자 페이지는 일반 사용자에게 노출되지 않도록 별도 라우터로 분리, 역할 체크 강화
- QR코드 생성 시 장비번호 + 고유 ID 조합으로 생성하여 중복 방지, 보안 강화
- AS 요청 시 고장 유형 선택과 상세 설명 입력으로 문제 파악 용이, 처리 시간 단축 목표
- 분석 리포트는 시각적 차트와 함께 표 형태로도 제공하여 다양한 사용자 선호도 충족 
- PWA 기능은 점진적으로 적용하여 초기에는 핵심 기능에 집중, 이후 오프라인 지원과 푸시 알림 완성도 향상 계획 (PC와 모바일에 설치 가능하도록)
- 개발 초기에는 프론트엔드에 최소한의 스타일링과 인터랙션으로 시작하여, 백엔드 API와 데이터 흐름이 안정화된 후 점진적으로 UI/UX 개선 및 추가 기능 개발 예정
- 모든 개발 단계에서 사용자 피드백을 적극 수렴하여 실제 현장 운영에 최적화된 앱으로 발전시킬 계획
- 최종 배포 전에는 현장 담당자들과 함께 실제 시나리오 테스트를 진행하여, 예상치 못한 문제점이나 개선점을 발견하고 반영할 예정
- 앱 사용에 대한 간단한 사용자 매뉴얼과 FAQ 문서를 작성하여, 현장 직원들이 쉽게 접근하고 활용할 수 있도록 지원할 계획
- 지속적인 유지보수와 업데이트 계획을 수립하여, 현장 운영 중 발생할 수 있는 문제에 신속하게 대응하고, 사용자 요구사항에 맞춰 기능 개선을 이어갈 예정
- 앱의 안정성과 보안을 최우선으로 고려하여, 정기적인 보안 점검과 코드 리뷰를 통해 잠재적인 취약점을 사전에 발견하고 해결할 계획
- 장기적으로는 AI 기반 예측 분석 기능을 도입하여, 장비 고장 예측이나 최적의 반입/반출 일정 추천 등 고도화된 기능을 제공하는 방향으로 발전시킬 계획
- 항상 PC와 모바일 양쪽에서 원활한 사용자 경험을 제공하기 위해, 반응형 디자인과 다양한 디바이스 테스트를 통해 UI/UX를 지속적으로 개선할 예정

