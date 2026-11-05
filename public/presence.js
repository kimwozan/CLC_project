/**
 * 게스트 접속 상태 알림 (메인 / 곰두리 키우기 공통)
 * - 페이지가 열려 있는 동안 주기적으로 서버에 신호를 보낸다
 * - 페이지를 닫으면 '떠남' 신호를 보낸다 → 서버가 곧바로 게스트 기록을 삭제
 *   (같은 사이트 안에서 페이지를 이동하거나 새로고침하면 바로 다시 열리므로 기록 유지)
 * - 서버가 기록을 이미 정리한 경우(오래 방치 등)에는 새로고침해서 처음부터 다시 시작
 */
(function () {
    const PING_MS = 4000;

    function ping() {
        fetch('/api/guest/ping', { method: 'POST', credentials: 'same-origin', keepalive: true })
            .then(async (res) => {
                if (res.status !== 401) return;
                let body = {};
                try { body = await res.json(); } catch (e) { /* 빈 응답 */ }
                if (!body.guestExpired) return;
                // 새로고침 반복 방지 (10초 안에 이미 한 번 했으면 건너뜀)
                let last = 0;
                try { last = Number(sessionStorage.getItem('guestReloadAt')) || 0; } catch (e) { /* 저장소 차단 */ }
                if (Date.now() - last < 10000) return;
                try { sessionStorage.setItem('guestReloadAt', String(Date.now())); } catch (e) { /* 무시 */ }
                location.reload();
            })
            .catch(() => { /* 서버 연결 불가: 다음 주기에 재시도 */ });
    }

    setInterval(ping, PING_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ping(); });
    window.addEventListener('pageshow', (e) => { if (e.persisted) ping(); });   // 뒤로가기 캐시 복원
    window.addEventListener('pagehide', () => {
        if (navigator.sendBeacon) navigator.sendBeacon('/api/guest/leave');
    });
})();
