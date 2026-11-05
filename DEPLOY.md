# 배포 가이드 (Vercel 화면 + 별도 API 서버)

이 앱의 `server.py`는 SQLite 파일과 계속 실행되는 백그라운드 작업(주 1회 채용정보 갱신, 게스트 기록 삭제)을
쓰기 때문에 Vercel(서버리스)에는 올릴 수 없습니다. 그래서 두 곳에 나눠 올립니다.

```
브라우저 ──▶ Vercel (public/ 화면)
                └─ /api/*  ──(rewrite)──▶ API 서버 (server.py, 예: Render)
```

브라우저는 Vercel 주소 하나만 보므로 쿠키·로그인 동작이 지금과 똑같습니다.

## 1. API 서버 올리기 (예: Render)
1. 이 저장소를 GitHub에 올립니다. (`.env`, `data/`는 `.gitignore`로 제외돼 있어 올라가지 않습니다)
2. Render → New → Blueprint 로 저장소를 연결하면 `render.yaml` 설정이 적용됩니다.
3. 환경변수 입력
   - `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` : 네이버 API 키 (여기서만 입력)
   - `ALLOWED_ORIGINS` : 2단계에서 정해지는 Vercel 주소 (이 프로젝트는 `https://clcproject.vercel.app`)
4. 배포가 끝나면 API 주소(예: `https://clc-api.onrender.com`)를 확인합니다.

> 무료 플랜은 15분 이상 접속이 없으면 잠들고 첫 요청이 느립니다. 디스크가 초기화되어도
> 게스트 기록은 원래 지워지는 데이터이고, 채용정보는 서버가 시작될 때 다시 수집합니다.

## 2. 화면 올리기 (Vercel)
1. `vercel.json` 의 `clc-api-not-configured.invalid` 를 1단계의 API 주소(예: `clc-api.onrender.com`)로 바꿉니다.
   (배포 전에는 일부러 존재하지 않는 주소를 넣어 두어, API 요청이 다른 서버로 가지 않습니다.)
2. Vercel → Add New Project → 같은 GitHub 저장소 선택 (Framework: Other).
   `vercel.json` 에 `outputDirectory: public` 이 설정돼 있어 별도 빌드 설정은 필요 없습니다.
3. 배포 후 나온 주소를 Render 의 `ALLOWED_ORIGINS` 에 넣고 서비스를 다시 시작합니다.

CLI 로 올릴 때: `npm i -g vercel` → `vercel` → `vercel --prod`

## 3. 확인
- Vercel 주소로 접속 → 스펙 입력 창이 뜨면 `/api/me` 연결이 정상입니다.
- 저장(성적관리) 시 403 이 나면 `ALLOWED_ORIGINS` 가 Vercel 주소와 정확히 같은지 확인합니다.

## 알아둘 점
- **API 키 수정 버튼**은 보안상 서버를 실행 중인 PC(로컬)에서만 보입니다. 배포 환경에서는 Render 환경변수로 바꿉니다.
- 게스트 기록은 페이지를 닫으면 삭제되는 기존 동작이 그대로 유지됩니다.
- Vercel 에는 `.vercelignore` 로 `.env`, DB, `server.py`, 원본 이미지가 업로드되지 않습니다.
