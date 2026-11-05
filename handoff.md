# 🚀 Project Handoff Document: 캠퍼스 스펙 트래커 (Campus Spec Tracker)
> **작성 시점**: 2026-11-06  
> **인계 대상**: Claude (다음 개발 에이전트 / 작업자)  
> **현재 작업 디렉토리**: `/Users/jungwoojin/Downloads/TTK`  
> **로컬 실행 서버**: `http://localhost:8000` (`python3 server.py`)

---

## 1. 프로젝트 개요 (Overview)

* **프로젝트명**: 캠퍼스 스펙 트래커 (Campus Spec Tracker)
* **목적**: 강원대학교 AI공학 전공생 및 IT/데이터 직무 취준생을 위한 전공 맞춤 자격증 추천, 역량 진단 대시보드, 네이버 뉴스 API 기반 실시간 채용 동향 연동, 그리고 게이미피케이션(곰두리 육성 & RPG 배틀).
* **타겟 사용자**: 정우진 (강원대학교 AI공학 전공, 21학번)
* **현재 아키텍처**:
  * **프론트엔드**: Vanilla JavaScript (ES6+), HTML5, Tailwind CSS (CDN 3.x), Chart.js, FontAwesome 6.4.0
  * **백엔드/프록시**: Python 3 내장 모듈 기반 경량 REST API & 정적 파일 서버 (`server.py`)
  * **외부 연동**:
    * 네이버 클라우드 플랫폼 (NCP NAVER API HUB) 뉴스 검색 API
    * Clearbit 기업 로고 API (`logo.clearbit.com`)
    * UI-Avatars Fallback API (`ui-avatars.com`)

---

## 2. 파일 구조 및 역할 (File Directory)

```bash
TTK/
├── server.py            # Python 백엔드 서버 (포트 8000: 네이버 뉴스 API 프록시 + 정적 파일 서빙)
├── index.html           # 메인 SPA 대시보드 (역량 분석, AI 자격증 로드맵, 네이버 뉴스 동기화 센터)
├── script.js            # 핵심 클라이언트 로직 (차트 생성, 네이버 뉴스 API 통신, 필터링 엔진, 펫 상태)
├── style.css            # Pretendard 웹폰트, 커스텀 카드 패널(.card-panel), 스크롤바 커스텀
├── pet.html             # 독립형 곰두리 RPG 배틀 아레나 (스펙 기반 ATK/HP 배틀 시뮬레이션)
├── handoff_document.md  # 초기 UI/UX 디자인 시스템 및 자격증/스펙 DB 명세서
├── handoff.md           # [본 문서] 클로드 작업을 위한 최종 상세 인수인계서
└── README.md            # 프로젝트 개요 및 로컬 실행 가이드
```

---

## 3. 핵심 구현 기능 상세 명세 (Implemented Features)

### 3.1. 네이버 뉴스 검색 API 실시간 연동 (최신 구현부)
* **문제 배경**: 브라우저(클라이언트 JS)에서 네이버 API 직접 호출 시 CORS 에러가 발생하므로, 로컬 백엔드 서버(`server.py`)를 프록시로 구축함.
* **백엔드 엔드포인트 (`server.py`)**:
  1. `GET /api/naver/news`: 쿼리(`query`), 개수(`display`), 정렬(`sort`) 파라미터 전달 시 네이버 API 서버 호출 후 원본 JSON 응답 반환.
  2. `GET /api/naver/check`: 등록된 Client ID/Secret의 유효성을 실시간 단건 테스트하여 통신 상태(성공 여부, HTTP 상태 코드, Raw 응답) 반환.
  3. `GET /api/naver/live-specs`: 카테고리(`all`, `data`, `finance`, `dev`) 또는 검색어 기반으로 네이버 뉴스에서 채용/자격증 기사를 스크랩·정제하여 기업명, 로고 도메인, 추출 자격증, 직무, 원문 링크를 구조화해 반환.
* **클라이언트 UI (`index.html`, `script.js`)**:
  * **[실시간 뉴스 모드] / [기준 스펙 DB 모드]** 원클릭 토글 스위치.
  * 실시간 검색어 입력창 (Enter 시 네이버 뉴스 즉시 쿼리 & 테이블 갱신).
  * 네이버 뉴스 원문 링크(`<a href="..." target="_blank">`) 클릭 시 기사 원문 새 창 이동.
  * **네이버 뉴스 API 설정 모달 (`#naverApiSettingsModal`)**: Client ID, Client Secret, 인증 방식(NCP vs Developers)을 직접 수정 및 테스트 가능.

### 3.2. ⚠️ 네이버 API 현재 상태 및 해결 가이드 (중요!)
사용자가 제공한 인증 정보:
* **Application 이름**: `jinwoo`
* **Client ID (`X-NCP-APIGW-API-KEY-ID`)**: `ykt5y8h8mz`
* **Client Secret (`X-NCP-APIGW-API-KEY`)**: `(삭제됨 - 유출되어 재발급 필요, 서버 .env에만 보관)`

**현재 네이버 API Gateway 응답**:
```json
HTTP 401 Unauthorized
{
  "error": {
    "errorCode": "200",
    "message": "Authentication Failed",
    "details": "Invalid authentication information."
  }
}
```
**원인 및 클로드가 사용자에게 안내하거나 점검해야 할 사항**:
1. 네이버 클라우드 플랫폼(NCP) 콘솔의 **[Application Services] > [NAVER API HUB] > [Application]**(또는 **[AI·NAVER API] > [Application]**) 메뉴에서 `jinwoo` 앱의 **[수정]**을 클릭.
2. 서비스 목록에서 **[NAVER 검색 API]** 체크박스가 **체크(활성화)**되어 있는지 확인해야 함. (Application만 생성하고 서비스 체크박스를 선택하지 않으면 errorCode 200이 발생함).
3. 체크 후 저장하고 웹 대시보드에서 `[설정 저장 & 동기화]`를 누르면 즉시 200 OK와 함께 실시간 기사가 로드됨.

---

### 3.3. AI 맞춤 자격증 로드맵 (`tab-recommand`)
* **AI공학 전공 적합성 추천 랭킹 (`certData`)**:
  1. **빅데이터분석기사**: 국가공인 최고 권위 데이터 자격 (`purple-500`)
  2. **ADsP (데이터분석 준전문가)**: 데이터 기초 및 분석 기획 필수 자격 (`cyan-500`)
  3. **SQLD (SQL 개발자)**: 데이터베이스 및 SQL 쿼리 실무 자격 (`pink-500`)
  4. **정보처리기사**: IT 공채 기본 표준 국가기술자격 (`blue-500`)
* **카테고리 필터 엔진 (`filterCerts`)**: `전체 보기`, `AI/데이터`, `금융 IT`, `SW 개발` 실시간 카드/테이블 동기화.
* **2026 자격증 시험 가이드 모달 (`openModal`)**: 회차별 필기·실기 일정 및 공식 원서접수처 링크 제공.

### 3.4. 기업별 합격자 스펙 DB (`passDatabase`)
* 네이버, 카카오, 토스, 삼성증권, 현대차, 신한은행, 쿠팡, 당근 등 9개 기업 정제 데이터.
* Clearbit 로고 자동 페치 (`https://logo.clearbit.com/{domain}`) 및 실패 시 `ui-avatars.com` 원형 이니셜 아바타 대체.
* 직무에 '데이터'/'AI' 포함 시 `text-red-600 font-bold`, 자격증은 빨간색 뱃지 테마 적용.

### 3.5. 역량 진단 대시보드 (`tab-dashboard`)
* **방사형 레이더 차트 (`specRadarChart`)**: 학점, 이수학점, 어학, 자격증, 대외활동 5축 역량 스탯 (직무별 권장 기준선 비교 지원).
* **8개 학기 평점 추이 차트 (`gpaLineChart`)**: 실제 입력한 학기별 성적 꺾은선 시각화.
* **졸업 요구 학점 충족률 도넛 게이지 (`creditGaugeChart`)**: 이수 학점 vs 총 요구 학점 계산 및 잔여 학점 경고 박스.
* **맞춤형 추천 경로 (`dynamic-recommendations`)**: 미입력되거나 부족한 스펙(어학, 자격증, 대외활동) 자동 피드백.

### 3.6. 곰두리 키우기 & RPG 배틀 모드 (`tab-duri` & `pet.html`)
* **인앱 곰두리 육성**: 데이터 먹이기(-10 코인), 딥러닝 공부시키기(+EXP, +20 코인), 재우기, 쓰다듬기, 레벨업 시스템.
* **독립형 RPG 배틀 (`pet.html`)**: 내 실제 스펙(학점, 이수학점, 어학, 자격증, 대외활동)을 공식에 따라 공격력(ATK)과 체력(HP)으로 실시간 환산하여 라이벌 몬스터/학생과 배틀 시뮬레이션.

---

## 4. 로컬 환경 구동 방법 (How to Run)

현재 백엔드 서버가 백그라운드 프로세스로 동작 중입니다.

```bash
# 1. 작업 디렉토리 진입
cd /Users/jungwoojin/Downloads/TTK

# 2. 서버 실행 (포트 8000)
python3 server.py

# 3. 브라우저 접속
# 메인 대시보드: http://localhost:8000/
# 곰두리 RPG:   http://localhost:8000/pet.html
```

---

## 5. 클로드(Claude)에게 권장하는 다음 작업 과제 (Next Tasks for Claude)

1. **네이버 API 권한 점검 및 실시간 크롤링 고도화**:
   * NCP 콘솔 상에서 `jinwoo` 앱의 NAVER 검색 API 활성화가 완료되면 실시간 기사가 즉시 정상 렌더링되는지 확인.
   * 기사 본문 요약에서 AI 모델/키워드 추출(정규표현식 추가 정밀화) 로직 개선.
2. **React / Vite 기반 모던 프레임워크 컴포넌트 마이그레이션**:
   * 현재 단일 `index.html`과 `script.js`로 구축된 바닐라 SPA를 React 컴포넌트로 분리:
     * `<Sidebar />`, `<SpecRadarChart />`, `<GpaTrendChart />`, `<CertRoadmap />`, `<LiveNewsTable />`, `<PetWidget />`
   * Zustand 또는 Context API를 통한 전역 상태(`globalSpecData`, `naverApiSettings`, `duriState`) 관리.
3. **영속성 데이터베이스 연동**:
   * 현재 `sessionStorage` 기반으로 임시 보관 중인 학생 스펙 및 펫 육성 상태를 Supabase / Firebase / SQLite 등으로 영속화.
4. **모바일 반응형 UI 디테일 개선**:
   * 모바일 화면에서의 실시간 뉴스 테이블 가로 스크롤 및 카드 그리드 터치 인터랙션 최적화.
