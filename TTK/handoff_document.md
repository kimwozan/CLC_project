# Project Handoff: 캠퍼스 스펙 트래커 (AI 자격증 추천 시스템)
**최종 업데이트:** 구현 완료 버전 (프로토타입 SPA)

---

## 1. 프로젝트 개요
* **프로젝트명**: 캠퍼스 스펙 트래커 (Campus Spec Tracker)
* **목적**: 학생의 전공(AI공학)과 실제 합격자 데이터를 기반으로 최적의 자격증을 추천하고 취업 스펙을 트래킹하는 대시보드
* **타겟 유저**: 강원대학교 AI공학 전공생 등 IT/데이터 직무 취업 준비생
* **개발 형태**: Single Page Application (단일 `index.html` 기반 바닐라 JS)

---

## 2. 디자인 시스템 (Design System)
Tailwind CSS 기반으로 구축된 커스텀 디자인 가이드라인입니다.

### 2.1. 타이포그래피 (Typography)
* **기본 폰트**: `Pretendard` (sans-serif)
* **폰트 굵기**: 300(Light) ~ 800(ExtraBold)
* **텍스트 색상**:
  * 메인 텍스트: `text-slate-800` / `text-slate-700`
  * 보조 텍스트 (설명, 날짜 등): `text-slate-500` / `text-slate-400`
  * 강조 텍스트 (AI/데이터 직무): `text-red-600`

### 2.2. 컬러 팔레트 (Color Palette)
* **배경색**: `bg-slate-100` (앱 전체 배경), `bg-white` (컴포넌트 배경)
* **프라이머리 (브랜드)**: `blue-600` ~ `cyan-500` (그라데이션 및 메인 포인트 컬러)
* **시맨틱 컬러 (자격증 카드별 테마)**:
  * 빅데이터분석기사: `purple-500`
  * ADsP: `cyan-500`
  * SQLD: `pink-500`
  * 정보처리기사: `blue-500`
* **강조/경고 (Highlighter)**: `red-500` ~ `red-600` (전공 적합 직무 및 보유 자격증 뱃지)

### 2.3. 공통 UI 컴포넌트 클래스
* **Card Panel (`.card-panel`)**: 
  * 속성: `background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); rounded-3xl`
  * 용도: 자격증 추천 카드, 데이터 테이블 래퍼 등 주요 컨텐츠 블록
* **Custom Scrollbar**:
  * 너비/높이: 6px, 트랙: `bg-slate-100`, 썸(Thumb): `bg-slate-300` (hover 시 `bg-slate-400`)
* **Badges (뱃지)**:
  * 난이도/태그 뱃지: `px-2 py-0.5 rounded-full text-[10px] font-bold` (테마 컬러 적용)
  * 자격증 보유 뱃지: `bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded font-bold text-[10px]`
* **Buttons (버튼)**:
  * 필터 비활성: `bg-slate-100 text-slate-600 hover:bg-slate-200`
  * 필터 활성: `bg-slate-800 text-white`

---

## 3. 핵심 데이터 구조 (Data Models)
현재 Vanilla JS 변수로 관리되며, 추후 RDBMS 또는 NoSQL(Firebase 등)로 마이그레이션 할 구조입니다.

### 3.1. `certData` (자격증 메타데이터)
배열 내 객체 순서가 **'AI공학 전공 적합성 순위'**를 결정합니다.
```javascript
{
  id: "bigdata",               // 고유 ID (모달 매핑용)
  name: "빅데이터분석기사",     // 자격증명
  tags: ["data", "all"],       // 필터링 카테고리 태그
  color: "purple",             // UI 테마 컬러
  level: "전문가",             // 난이도/분류
  icon: "fa-brain",            // FontAwesome 아이콘 클래스
  desc: "데이터 사이언티스트 직무...", // 상세 설명 (모달 및 카드 노출)
  dates: ["제 12회 필기:...", ...]     // 2026년 시험 일정 배열
}
```

### 3.2. `passDatabase` (합격자 스펙 DB)
실제 엑셀 데이터를 바탕으로 정제된 합격 사례 데이터입니다.
```javascript
{
  company: "삼성증권",          // 기업명
  domain: "samsungpop.com",   // 기업 공식 도메인 (Clearbit 로고 API용)
  role: "IT",                 // 합격 직무
  certs: "ADsP, SQLD",        // 보유 자격증 (문자열, 쉼표 구분)
  date: "2024 하반기 신입",     // 합격 시기 및 전형
  category: "finance"         // 필터링 카테고리 태그
}
```

---

## 4. 기능 구현 상세 명세 (Features)

### 4.1. 메인 레이아웃 및 사이드바 (Sidebar)
* **반응형 처리**: 모바일에서는 `transform -translate-x-full`로 숨겨지며, 데스크톱(`md:`)에서 고정 노출.
* **유저 프로필 컴포넌트**: '정우진, 강원대학교, AI공학 전공' 정보 하드코딩 렌더링.
* **네비게이션**: AI 자격증 추천 탭 활성화 상태 구현.

### 4.2. 동적 자격증 필터링 시스템 (Filtering Engine)
* **동작 트리거**: 카테고리 버튼('전체 보기', 'AI/데이터', '금융 IT', 'SW 개발') 클릭 시 `filterCerts(category, btnElement)` 호출.
* **상태 변경**: 
  1. 클릭된 버튼의 클래스를 토글하여 활성화 스타일(`bg-slate-800 text-white`) 적용.
  2. `certData`와 `passDatabase`의 `tags`/`category`를 순회하여 필터링된 배열 생성.
  3. `certCardsContainer`와 `successCasesBody`의 DOM을 초기화(`innerHTML = ''`)한 후 리렌더링.

### 4.3. 자격증 추천 카드 (Certificate Cards)
* **렌더링 로직 (`renderCertCards`)**: 전공 적합성 순서로 정렬된 `certData`를 기반으로 카드 생성.
* **상호작용**: 카드 하단의 '가이드 보기' 버튼 클릭 시 `openModal(certId)` 호출.
* **UI 처리**: 템플릿 리터럴을 활용해 동적 컬러 클래스(예: `border-t-${cert.color}-500`) 주입.

### 4.4. 기업별 합격자 스펙 테이블 (Data Table)
* **렌더링 로직 (`renderSuccessCases`)**: `passDatabase`를 순회하며 테이블 Row(`<tr>`) 동적 생성.
* **조건부 하이라이팅 (Conditional Styling)**:
  * **전공 적합도 강조**: `data.role`에 '데이터' 또는 'AI' 문자열이 포함(`includes`)된 경우 직무 텍스트를 빨간색 굵은 글씨(`text-red-600 font-bold`)로 렌더링.
  * **보유 자격증 분리 및 강조**: `data.certs.split(', ')`로 배열화한 뒤, 맵핑하여 무조건 빨간색 뱃지 테마로 렌더링.
* **기업 로고 자동화 (Clearbit API)**:
  * `<img src="https://logo.clearbit.com/${data.domain}">` 활용.
  * **에러 핸들링**: 로고 페치 실패 시 `onerror` 이벤트를 통해 `ui-avatars.com` API를 호출, 기업 이름의 첫 글자로 된 원형 아이콘을 대체재(Fallback)로 표시.

### 4.5. 자격증 가이드 모달 (Modal System)
* **구조**: 고정 레이어(`fixed inset-0 z-[100]`), 백드롭 블러(`backdrop-blur-sm`).
* **동적 데이터 바인딩**: `openModal(certId)` 실행 시, `certData`에서 해당 `id`를 찾아 제목(`modalCertName`), 설명(`modalCertDesc`), 일정 리스트(`modalCertDates`)를 교체한 후 `hidden` 클래스 제거.
* **닫기 기능**: X 버튼 또는 닫기 버튼 클릭 시 `hidden` 클래스 재적용.

---

## 5. 외부 연동 리소스 (External APIs & CDN)
1. **스타일링 프레임워크**: `https://cdn.tailwindcss.com` (Tailwind CSS 3.x Script)
2. **아이콘 팩**: `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css` (FontAwesome)
3. **웹 폰트**: Google Fonts API (`Pretendard` 웹폰트)
4. **기업 로고 API**: `https://logo.clearbit.com/{domain}` (Clearbit)
5. **대체 로고 프로필 API**: `https://ui-avatars.com/api/?name={name}&background=random&color=fff&rounded=true`

---

## 6. 향후 프레임워크(React/Vue 등) 이관 시 가이드
단일 파일에 구현된 이 로직들을 컴포넌트 단위로 분리할 것을 권장합니다.
1. **Components**:
   * `<Sidebar />`: 유저 데이터 Props 주입.
   * `<FilterGroup />`: 현재 선택된 필터 State 관리 (`activeCategory`).
   * `<CertCard />`: `certData` Object를 Props로 받아 렌더링.
   * `<SuccessTable />`: `passDatabase` Array를 렌더링. 로고 렌더링을 위한 별도 훅 혹은 이미지 컴포넌트 `<CompanyLogo domain={...} name={...} />` 생성 권장.
   * `<Modal />`: Portal을 활용한 전역 모달 컴포넌트로 분리.
2. **State Management**: `certData`와 `passDatabase`는 별도의 JSON 파일이나 Store(Redux, Zustand)로 분리 관리.