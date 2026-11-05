# 🎓 캠퍼스 스펙 트래커 (Campus Spec Tracker)
> **강원대학교 AI공학 전공생 및 IT/데이터 직무 취업 준비생을 위한 AI 자격증 추천 & 스펙 트래킹 대시보드**

---

## 📁 프로젝트 파일 구조

```bash
TTK/
├── index.html           # 메인 대시보드 및 SPA 애플리케이션
├── script.js            # 핵심 로직 (차트, 자격증 필터링 엔진, 펫, 모달)
├── style.css            # 커스텀 스타일 (Pretendard 폰트, 카드 패널, 스크롤바)
├── pet.html             # 곰두리 RPG 배틀 모드 독립 페이지
├── handoff_document.md  # 프로젝트 인수인계 및 기능 명세서
└── README.md            # 프로젝트 개요 및 실행 가이드
```

---

## 🚀 주요 기능 및 명세 (`handoff_document.md` 반영 완료)

### 1. AI 자격증 추천 시스템 (`tab-recommand`)
* **AI공학 전공 적합성 추천 순위 (`certData`)**:
  1. **빅데이터분석기사**: 국가공인 최고 권위 데이터 자격 (`purple-500`)
  2. **ADsP (데이터분석 준전문가)**: 데이터 기초 및 분석 기획 필수 자격 (`cyan-500`)
  3. **SQLD (SQL 개발자)**: 데이터베이스 및 SQL 쿼리 실무 자격 (`pink-500`)
  4. **정보처리기사**: IT 공채 기본 표준 국가기술자격 (`blue-500`)
* **동적 카테고리 필터링 엔진 (`filterCerts`)**:
  * `전체 보기`, `AI/데이터`, `금융 IT`, `SW 개발` 필터 버튼을 통한 실시간 카드/테이블 리렌더링
* **2026 자격증 시험 가이드 모달 (`openModal`, `closeModal`)**:
  * 2026년 정기 시험 및 원서접수 일정 안내, 공식 원서접수처 바로가기 연동

### 2. 주요 기업 합격자 스펙 DB (`passDatabase`)
* **실제 채용 전형 기반 데이터**: 네이버, 카카오, 토스, 삼성증권, 현대자동차, 신한은행, 쿠팡, 당근 등
* **Clearbit 기업 로고 자동화**: `logo.clearbit.com` API를 통해 기업 공식 로고 자동 페치, 실패 시 `ui-avatars.com` 대체 아바타 표시
* **전공 적합 직무 & 자격증 강조**:
  * AI/데이터 직무 텍스트: `text-red-600 font-bold` 하이라이팅
  * 보유 자격증: 빨간색 뱃지 스타일 렌더링

### 3. 역량 진단 대시보드 (`tab-dashboard`)
* **5각형 종합 역량 레이더 차트 (`specRadarChart`)**: 학점, 이수학점, 어학, 자격증, 대외활동 진단 (목표 직무별 기준선 변경 지원)
* **8개 학기 평점 추이 꺾은선 차트 (`gpaLineChart`)**: 실제 입력한 학기별 GPA 그래프 시각화
* **졸업 요구 학점 충족률 도넛 차트 (`creditGaugeChart`)**: 이수 학점 대비 잔여 학점 자동 계산 및 알림

### 4. 곰두리 키우기 & RPG 배틀 모드 (`tab-duri` & `pet.html`)
* **대시보드 인앱 육성**: 데이터 먹이기, 딥러닝 공부시키기(+EXP, +COIN), 재우기, 쓰다듬기
* **RPG 배틀 모드 (`pet.html`)**: 내 스펙(학점, 어학, 자격증, 대외활동)이 공격력(ATK)과 체력(HP)으로 실시간 환산되어 라이벌과 배틀 시뮬레이션

---

## 💻 로컬 실행 방법

별도의 복잡한 빌드 과정 없이 정적 웹 서버나 브라우저에서 바로 실행할 수 있습니다.

### 방법 1. 브라우저로 바로 열기
* Finder에서 `index.html` 파일을 더블 클릭하여 크롬(Chrome) 또는 Safari에서 실행

### 방법 2. Python 로컬 웹 서버 실행 (권장)
```bash
# 터미널에서 TTK 디렉토리 진입
cd /Users/jungwoojin/Downloads/TTK

# Python 3 로컬 서버 실행
python3 -m http.server 8000
```
브라우저에서 [http://localhost:8000](http://localhost:8000) 접속

---

## 🛠️ 기술 스택 (Tech Stack)
* **Frontend**: HTML5, Vanilla JavaScript (ES6+)
* **Styling**: Tailwind CSS (CDN 3.x), Custom CSS
* **Typography**: Pretendard Web Font
* **Icons**: FontAwesome 6.4.0
* **Data Visualization**: Chart.js
* **External APIs**: Clearbit Logo API, UI-Avatars Fallback API
