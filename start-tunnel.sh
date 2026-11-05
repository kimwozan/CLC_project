#!/bin/bash
# 내 노트북에서 서버를 켜고 Cloudflare Quick Tunnel 로 인터넷에 공개합니다.
#   사용:  ./start-tunnel.sh        (종료: Ctrl+C → 서버와 터널이 함께 꺼짐)
cd "$(dirname "$0")" || exit 1

PORT="${PORT:-8080}"

if ! command -v cloudflared >/dev/null 2>&1; then
    echo "❌ cloudflared 가 설치되어 있지 않습니다. TUNNEL.md 의 1단계를 먼저 진행해 주세요."
    exit 1
fi
if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "❌ 포트 $PORT 를 이미 사용 중입니다. 기존 서버(python3 server.py)를 먼저 종료해 주세요."
    exit 1
fi

# 서버는 이 컴퓨터(127.0.0.1)에만 열고, 터널만 접근하게 합니다.
export HOST=127.0.0.1 PORT TRUST_PROXY=1 COOKIE_SECURE=1

python3 server.py &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT INT TERM
sleep 1.5

# 터널이 켜져 있는 동안 Mac 이 잠자기에 들어가지 않게 합니다 (덮개를 닫으면 소용없음)
caffeinate -i -w $$ &

echo "🌐 아래에 출력되는 https://....trycloudflare.com 주소가 공개 주소입니다. (실행할 때마다 바뀝니다)"
cloudflared tunnel --url "http://localhost:$PORT"
