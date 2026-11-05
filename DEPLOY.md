# Vercel 배포 가이드 (서버 없이 Vercel 하나로)

GitHub 저장소(`kimwozan/CLC_project`)에 푸시하면 Vercel 이 자동으로 배포합니다. 별도 서버·DB 는 없습니다.

```
브라우저 ─▶ Vercel ┬─ public/            화면 (HTML·JS·이미지)
                   └─ api/jobs.py        AI 채용정보 인사이트 (서버리스 함수, 7일 캐시)
스펙·곰두리 기록 ─▶ 이 탭의 sessionStorage (서버에 저장하지 않음)
```

## 동작 방식
- **스펙·곰두리 기록**은 사용자의 브라우저 탭(sessionStorage)에만 저장됩니다.
  새로고침·페이지 이동에는 유지되고, **탭(홈페이지)을 닫으면 사라져서 다시 열면 정보를 새로 입력**합니다.
  (`public/static-api.js` 가 서버가 없을 때만 이 역할을 하고, 서버(`server.py`/터널)가 있으면 아무것도 바꾸지 않습니다)
- **AI 채용정보 인사이트**는 `api/jobs.py` 가 네이버 뉴스를 수집·신뢰도 판별(`server.py` 의 `collect_jobs` 재사용)하고,
  Vercel CDN 에 **7일간 캐시**합니다 = 주 1회 갱신. 캐시가 만료된 뒤 첫 요청이 새로 수집합니다.
- 학교 이메일 로그인, "API 설정" 버튼은 이 배포에서는 쓰이지 않습니다.

## 네이버 키 설정 (선택, 한 번)
키를 넣지 않아도 사이트는 정상 동작하며, 채용정보 영역만 비어 있습니다(“API 설정 후 수집됩니다”).
채용정보를 보이려면 Vercel → 프로젝트 → Settings → Environment Variables 에 추가하고 **Redeploy** 합니다.

| 이름 | 값 |
| --- | --- |
| `NAVER_CLIENT_ID` | 네이버 API 아이디 |
| `NAVER_CLIENT_SECRET` | 네이버 API 키 |
| `NAVER_AUTH_TYPE` | `ncp` (API HUB) 또는 `developers` (개발자센터), 기본값 `ncp` |

> 키는 저장소에 넣지 마세요. `.env` 는 `.gitignore` 로 제외되어 있습니다.

## 배포 / 업데이트
```bash
git add -A && git commit -m "메시지" && git push origin main
```
푸시하면 약 1분 안에 https://clcproject.vercel.app 에 반영됩니다.

## 다른 실행 방법
- 내 컴퓨터에서 서버로 쓰기: `python3 server.py` (http://localhost:8080)
- 내 노트북을 Cloudflare Tunnel 로 공개: [TUNNEL.md](TUNNEL.md)
