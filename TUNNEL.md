# 내 노트북에서 Cloudflare Tunnel 로 서빙하기 (도메인·계정 없이)

`server.py` 가 화면(`public/`)과 `/api` 를 한 서버에서 모두 서비스하므로, 터널 하나로 앱 전체가 공개됩니다.
(Vercel / Render 는 사용하지 않습니다.)

```
인터넷 ─▶ Cloudflare ─▶ cloudflared (내 노트북) ─▶ server.py (127.0.0.1:8080)
```

## 1. cloudflared 설치 (최초 1회)

Homebrew 가 없으므로 공식 파일을 내려받습니다. (Apple Silicon 기준)

```bash
cd ~/Downloads
curl -L -o cloudflared.tgz https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz
tar xzf cloudflared.tgz
mkdir -p ~/.local/bin && mv cloudflared ~/.local/bin/
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
cloudflared --version
```

> macOS 가 "확인되지 않은 개발자" 경고를 띄우면 시스템 설정 → 개인정보 보호 및 보안 → "그래도 허용" 을 누르세요.
> Homebrew 를 이미 쓰신다면 `brew install cloudflared` 한 줄이면 됩니다.

## 2. 실행

기존에 `python3 server.py` 로 켜 둔 터미널이 있다면 먼저 종료(Ctrl+C)합니다.

```bash
cd ~/Downloads/TTK
./start-tunnel.sh
```

출력 중에 아래와 같은 줄이 나옵니다. **이 주소가 공개 주소**입니다.

```
https://무작위-단어-조합.trycloudflare.com
```

- 서버와 터널이 함께 켜지고, `Ctrl+C` 를 누르면 함께 꺼집니다.
- 터널이 켜져 있는 동안 Mac 이 잠자기에 들어가지 않도록 `caffeinate` 를 같이 실행합니다. (노트북 덮개를 닫으면 잠자기에 들어가 사이트가 끊깁니다)
- 서버는 `127.0.0.1` 에만 열려 있어 같은 와이파이의 다른 기기에서는 직접 접근할 수 없고, 터널을 통해서만 들어옵니다.

## 3. 확인

1. 공개 주소로 접속 → 스펙 입력 창이 뜨는지 확인
2. 성적관리에서 저장 → 새로고침해도 유지되는지 확인
3. 자격증 추천 탭의 "AI 채용정보 인사이트"에 기사가 나오는지 확인 (네이버 키는 `.env` 의 값을 그대로 씁니다)

## 알아둘 점

| 항목 | 내용 |
| --- | --- |
| 주소 | Quick Tunnel 은 **실행할 때마다 주소가 바뀝니다.** 고정 주소는 Cloudflare 에 등록한 도메인이 있어야 가능합니다. |
| 가동 | 노트북이 켜져 있고 `start-tunnel.sh` 가 실행 중일 때만 접속됩니다. |
| 용도 | Cloudflare 는 Quick Tunnel 을 테스트·데모용으로 안내하며 가동 시간을 보장하지 않습니다 (동시 요청 200개 제한). 시연·발표·팀 공유용에 적합합니다. |
| 로컬 접속 | 터널 실행 중에는 보안 쿠키(`COOKIE_SECURE=1`)가 켜지므로, 이 노트북에서도 `http://localhost:8080` 대신 **공개 주소**로 접속해 주세요. |
| API 키 수정 | "API 설정" 버튼은 보안상 터널(공개) 접속에서는 보이지 않습니다. 키를 바꾸려면 터널을 끄고 `python3 server.py` 로 로컬에서 접속하세요. |
| 게스트 기록 | 페이지를 닫으면 삭제되는 기존 동작이 그대로입니다. |

## 문제 해결

- `포트 8080 를 이미 사용 중` → 기존 서버 종료 후 다시 실행 (`lsof -iTCP:8080 -sTCP:LISTEN` 으로 확인)
- 접속은 되는데 저장이 안 됨 → 공개 주소가 아니라 `localhost` 로 접속 중인지 확인
- 주소가 열리지 않음 → 터미널에서 `cloudflared` 가 계속 실행 중인지, 오류 문구가 없는지 확인
