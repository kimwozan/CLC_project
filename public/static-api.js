/**
 * 서버 없이(Vercel 정적 배포) 동작하기 위한 브라우저 내 대체 API
 *
 * - 실제 서버(server.py / 터널)가 응답하면 아무것도 바꾸지 않고 그대로 통과시킨다.
 * - 서버가 없으면(/api/me 가 JSON 이 아니거나 404/5xx) 게스트 데이터(스펙·곰두리)를
 *   이 탭의 sessionStorage 에 저장한다 → 탭(홈페이지)을 닫으면 기록이 사라지고,
 *   다시 열면 처음부터 정보를 입력하게 된다.
 * - /api/jobs (채용정보)는 Vercel 서버리스 함수가 있으면 그것을 쓰고, 없거나 실패하면 빈 결과로 대체한다.
 * 반드시 다른 스크립트(presence.js, script.js 등)보다 먼저 로드할 것.
 */
(function () {
    if (window.__clcShim) return;
    window.__clcShim = true;

    const realFetch = window.fetch.bind(window);
    const KEY = 'clc.session.v1';
    const MAX_BODY = 64 * 1024;
    let mem = {};            // sessionStorage 를 쓸 수 없을 때의 임시 저장소
    let hasBackend = null;   // null = 아직 모름
    let probing = null;
    let jobsEnabledP = null;

    const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
        status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
    const emptyJobs = (enabled) => ({ items: [], filteredOut: 0, updatedAt: null, nextUpdateAt: null, enabled: !!enabled });

    function read() {
        try { const raw = sessionStorage.getItem(KEY); return raw ? JSON.parse(raw) : {}; } catch (e) { return mem; }
    }
    function write(obj) {
        mem = obj;
        try { sessionStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) { /* 저장소 차단: 메모리만 사용 */ }
    }

    // 실제 서버가 있는지 한 번만 확인
    async function detect() {
        if (hasBackend !== null) return hasBackend;
        if (!probing) {
            probing = realFetch('/api/me', { credentials: 'same-origin' }).then((r) => {
                const ct = r.headers.get('content-type') || '';
                hasBackend = ct.includes('application/json') && r.status !== 404 && r.status < 500;
            }).catch(() => { hasBackend = false; });
        }
        await probing;
        window.__clcStatic = !hasBackend;
        return hasBackend;
    }

    async function fetchJobs(input, init) {
        try {
            const r = await realFetch(input, init);
            const ct = r.headers.get('content-type') || '';
            if (r.ok && ct.includes('application/json')) return r;
        } catch (e) { /* 아래에서 빈 결과 */ }
        return json(emptyJobs(false));
    }

    // 채용정보 함수가 켜져 있는지(네이버 키 설정 여부)로 "실시간 뉴스 연동" 표시를 결정
    function jobsEnabled() {
        if (!jobsEnabledP) {
            jobsEnabledP = fetchJobs('/api/jobs', { credentials: 'same-origin' })
                .then((r) => r.json()).then((d) => !!d.enabled).catch(() => false);
        }
        return jobsEnabledP;
    }

    async function staticApi(path, init) {
        const method = ((init && init.method) || 'GET').toUpperCase();
        if (path === '/api/me') return json({ email: null, guest: true, newsEnabled: await jobsEnabled() });
        if (path === '/api/data') {
            const st = read();
            if (method === 'GET') return json({ ...(st.spec ? { spec: st.spec } : {}), ...(st.pet ? { pet: st.pet } : {}) });
            if (method === 'PUT') {
                let body = null;
                try {
                    const raw = String((init && init.body) || '');
                    if (raw.length > MAX_BODY) throw new Error('too large');
                    body = JSON.parse(raw);
                } catch (e) { return json({ error: '잘못된 데이터입니다.' }, 400); }
                if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: '잘못된 데이터입니다.' }, 400);
                const saved = [];
                const next = { ...st };
                ['spec', 'pet'].forEach((k) => {
                    if (body[k] && typeof body[k] === 'object' && !Array.isArray(body[k])) { next[k] = body[k]; saved.push(k); }
                });
                write(next);
                return json({ ok: true, saved });
            }
        }
        if (path === '/api/guest/ping' || path === '/api/guest/leave') return json({ ok: true });
        if (path === '/api/admin/naver-keys') {
            if (method === 'GET') return json({ canEdit: false, configured: false, clientIdMasked: '', authType: 'ncp' });
            return json({ error: '이 배포에서는 API 키를 화면에서 바꿀 수 없습니다. Vercel 환경변수로 설정하세요.' }, 403);
        }
        return json({ error: 'not found' }, 404);
    }

    window.fetch = async function (input, init) {
        let path;
        try {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            path = new URL(url, location.origin).pathname;
        } catch (e) { return realFetch(input, init); }
        if (!path.startsWith('/api/')) return realFetch(input, init);

        const backend = await detect();
        if (backend) return realFetch(input, init);            // 서버가 있으면 그대로 통과
        if (path === '/api/jobs') return fetchJobs(input, init);
        return staticApi(path, init);
    };
})();
