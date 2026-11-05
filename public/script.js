/**
 * 캠퍼스 스펙 트래커 (Campus Spec Tracker) - 클라이언트
 * - 학교 이메일(@kangwon.ac.kr) 인증 로그인
 * - 스펙 / 곰두리 상태는 서버(SQLite)에 저장
 * - 채용 뉴스는 서버 프록시(/api/news)만 사용, API 키는 브라우저에 존재하지 않음
 */

// ==========================================
// 1. 자격증 DB (입력 검증용)
// ==========================================
const VALID_CERTIFICATES = [
    "정보처리기사", "정보처리산업기사", "정보처리기능사",
    "SQLD", "SQLP", "ADsP", "ADP", "AICE",
    "컴퓨터활용능력1급", "컴퓨터활용능력2급", "컴활1급", "컴활2급",
    "빅데이터분석기사", "리눅스마스터1급", "리눅스마스터2급",
    "네트워크관리사", "네트워크관리사2급", "정보보안기사", "정보보안산업기사",
    "AWS SAA", "AWS DVA", "AWS SAP", "AWS CLF",
    "CKA", "CKAD", "CCNA", "CCNP",
    "전기기사", "전자기사", "무선설비기사", "통신기사",
    "한국사능력검정시험", "한국사1급", "한국사2급", "한국사3급",
    "GTQ", "GTQi", "전산회계1급", "전산회계2급", "전산세무1급", "전산세무2급",
    "PMP", "CISA", "CISSP", "MOS"
];

// ==========================================
// 2. 추천 자격증 메타데이터
// ※ 시험 일정은 수기 입력값입니다. 공식 사이트 확인 안내를 함께 표시합니다.
// ==========================================
const certData = [
    {
        id: "bigdata", name: "빅데이터분석기사", tags: ["data", "all"], level: "국가기술",
        badgeBg: "bg-purple-100", badgeText: "text-purple-700", borderClass: "border-t-purple-500", icon: "fa-brain",
        desc: "빅데이터 수집·전처리, 통계 및 머신러닝 기반 분석 역량을 검증하는 국가기술자격입니다.",
        officialUrl: "https://www.dataq.or.kr",
        dates: [
            "2026 제 12회 필기: 2026.04.04 (원서접수: 02.23 ~ 02.27)",
            "2026 제 12회 실기: 2026.06.20 (원서접수: 05.11 ~ 05.15)",
            "2026 제 13회 필기: 2026.09.12 (원서접수: 08.03 ~ 08.07)",
            "2026 제 13회 실기: 2026.11.28 (원서접수: 10.19 ~ 10.23)"
        ]
    },
    {
        id: "adsp", name: "ADsP (데이터분석 준전문가)", tags: ["data", "finance", "all"], level: "국가공인",
        badgeBg: "bg-cyan-100", badgeText: "text-cyan-700", borderClass: "border-t-cyan-500", icon: "fa-chart-pie",
        desc: "데이터 이해, 분석 기획, 데이터 분석 기초를 검증하는 한국데이터산업진흥원 자격입니다.",
        officialUrl: "https://www.dataq.or.kr",
        dates: [
            "2026 제 44회 시험: 2026.02.21 (원서접수: 01.19 ~ 01.23)",
            "2026 제 45회 시험: 2026.05.16 (원서접수: 04.13 ~ 04.17)",
            "2026 제 46회 시험: 2026.08.22 (원서접수: 07.20 ~ 07.24)",
            "2026 제 47회 시험: 2026.10.24 (원서접수: 09.21 ~ 09.25)"
        ]
    },
    {
        id: "sqld", name: "SQLD (SQL 개발자)", tags: ["data", "finance", "dev", "all"], level: "국가공인",
        badgeBg: "bg-pink-100", badgeText: "text-pink-700", borderClass: "border-t-pink-500", icon: "fa-database",
        desc: "데이터 모델링 이해와 SQL 작성 능력을 검증하는 한국데이터산업진흥원 자격입니다.",
        officialUrl: "https://www.dataq.or.kr",
        dates: [
            "2026 제 56회 시험: 2026.03.07 (원서접수: 02.02 ~ 02.06)",
            "2026 제 57회 시험: 2026.05.23 (원서접수: 04.20 ~ 04.24)",
            "2026 제 58회 시험: 2026.08.29 (원서접수: 07.27 ~ 07.31)",
            "2026 제 59회 시험: 2026.11.14 (원서접수: 10.12 ~ 10.16)"
        ]
    },
    {
        id: "qnet", name: "정보처리기사", tags: ["dev", "finance", "all"], level: "국가기술",
        badgeBg: "bg-blue-100", badgeText: "text-blue-700", borderClass: "border-t-blue-500", icon: "fa-code",
        desc: "소프트웨어 설계·개발, 데이터베이스, 시스템 보안 등 IT 전반을 다루는 국가기술자격입니다.",
        officialUrl: "https://www.q-net.or.kr",
        dates: [
            "2026 정기 1회 필기: 2026.02.14 ~ 03.03 (실기: 04.18 ~ 05.06)",
            "2026 정기 2회 필기: 2026.05.09 ~ 05.28 (실기: 07.18 ~ 08.02)",
            "2026 정기 3회 필기: 2026.08.01 ~ 08.20 (실기: 10.17 ~ 11.01)"
        ]
    }
];

// ==========================================
// 3. 상태
// ==========================================
const EMPTY_SPEC = {
    name: '', major: '', maxGpa: 4.5, semesterGrades: [null, null, null, null, null, null, null, null],
    credits: 0, totalCredits: 130, langType: '', langScore: '', certs: [], extra: ''
};
let currentUser = null;      // { email, newsEnabled }
let globalSpecData = null;   // 서버 저장 스펙 (없으면 null)
let duriState = { level: 1, fullness: 80, exp: 0, coins: 50 };
let currentCertCategory = 'all';
let pendingLoginEmail = '';

let radarChartInstance = null;
let lineChartInstance = null;
let gaugeChartInstance = null;

// ==========================================
// 4. 유틸
// ==========================================
function esc(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function api(path, options = {}) {
    const opts = { credentials: 'same-origin', ...options, headers: { ...(options.headers || {}) } };
    if (opts.body && typeof opts.body !== 'string') {
        opts.body = JSON.stringify(opts.body);
        opts.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(path, opts);
    let data = {};
    try { data = await res.json(); } catch (e) { /* 빈 응답 */ }
    if (res.status === 401 && path !== '/api/me') showLogin();
    return { ok: res.ok, status: res.status, data };
}

function $(id) { return document.getElementById(id); }

function showToast(message) {
    const toast = $('toastNotification');
    const toastMsg = $('toastMessage');
    if (!toast || !toastMsg) return;
    toastMsg.innerText = message;
    toast.classList.remove('translate-y-16', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-16', 'opacity-0');
    }, 3000);
}

function toggleMobileSidebar() {
    const sidebar = $('sidebar');
    const overlay = $('sidebarOverlay');
    if (!sidebar || !overlay) return;
    const isOpen = !sidebar.classList.contains('-translate-x-full');
    sidebar.classList.toggle('-translate-x-full', isOpen);
    overlay.classList.toggle('hidden', isOpen);
}

function switchTab(tabName) {
    ['dashboard', 'duri', 'recommand'].forEach(name => {
        const tabEl = $('tab-' + name);
        const navEl = $('nav-' + name);
        if (tabEl) tabEl.classList.add('hidden');
        if (navEl) navEl.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition text-slate-600 hover:bg-slate-50";
    });
    const targetTab = $('tab-' + tabName);
    const targetNav = $('nav-' + tabName);
    if (targetTab) targetTab.classList.remove('hidden');
    if (targetNav) targetNav.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition bg-blue-50 text-blue-600";

    const sidebar = $('sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) toggleMobileSidebar();

    if (tabName === 'dashboard') {
        setTimeout(() => [radarChartInstance, lineChartInstance, gaugeChartInstance].forEach(c => c && c.resize()), 50);
    } else if (tabName === 'recommand') {
        filterCerts(currentCertCategory);
    }
}

// ==========================================
// 5. 로그인 (학교 이메일 인증코드)
// ==========================================
function showLogin() {
    $('screen-login').classList.remove('hidden');
    $('screen-spec-input').classList.add('hidden');
}

function resetLoginStep() {
    pendingLoginEmail = '';
    $('loginStepEmail').classList.remove('hidden');
    $('loginStepCode').classList.add('hidden');
    $('loginError').classList.add('hidden');
}

function showLoginError(msg) {
    const el = $('loginError');
    el.innerText = msg;
    el.classList.remove('hidden');
}

async function requestLoginCode(event) {
    event.preventDefault();
    $('loginError').classList.add('hidden');
    let email = $('loginEmail').value.trim().toLowerCase();
    if (email && !email.includes('@')) email += '@kangwon.ac.kr';
    const btn = $('btnRequestCode');
    btn.disabled = true;
    try {
        const r = await api('/api/auth/request-code', { method: 'POST', body: { email } });
        if (!r.ok) return showLoginError(r.data.error || '인증코드 요청에 실패했습니다.');
        pendingLoginEmail = email;
        $('loginCodeTarget').innerText = email;
        $('loginStepEmail').classList.add('hidden');
        $('loginStepCode').classList.remove('hidden');
        $('loginCode').value = '';
        $('loginCode').focus();
        showToast('인증코드를 학교 메일로 보냈습니다.');
    } catch (e) {
        showLoginError('서버와 통신할 수 없습니다.');
    } finally {
        btn.disabled = false;
    }
}

async function verifyLoginCode(event) {
    event.preventDefault();
    $('loginError').classList.add('hidden');
    const code = $('loginCode').value.trim();
    const r = await api('/api/auth/verify', { method: 'POST', body: { email: pendingLoginEmail, code } });
    if (!r.ok) return showLoginError(r.data.error || '인증에 실패했습니다.');
    $('screen-login').classList.add('hidden');
    resetLoginStep();
    await bootstrap();
}

async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    location.reload();
}

// ==========================================
// 6. 채용 뉴스 (서버 프록시)
// ==========================================
function filterCerts(category, btnElement) {
    currentCertCategory = category;
    document.querySelectorAll('.cert-filter-btn').forEach(btn => {
        btn.className = "cert-filter-btn px-4 py-2 rounded-xl text-xs font-bold transition bg-slate-100 text-slate-600 hover:bg-slate-200";
    });
    const active = btnElement || document.querySelector(`[data-category="${category}"]`);
    if (active) active.className = "cert-filter-btn px-4 py-2 rounded-xl text-xs font-bold transition bg-slate-800 text-white shadow-sm";

    renderCertCards(category === 'all' ? certData : certData.filter(c => c.tags.includes(category)));
    fetchNews();
}

function setNewsStatus(ok, text) {
    const dot = $('sidebarApiDot');
    const mini = $('apiStatusTextMini');
    if (dot) dot.className = `w-2.5 h-2.5 rounded-full ${ok ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`;
    if (mini) {
        mini.className = `text-[11px] font-bold inline-flex items-center gap-1.5 ${ok ? 'text-emerald-600' : 'text-rose-600'}`;
        if (ok) {
            // 고정 문구만 사용 (사용자 입력 없음)
            mini.innerHTML = '<span class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span> 실시간 네이버 뉴스 연동됨';
        } else {
            mini.innerText = text;
        }
    }
}

async function fetchNews() {
    // 채용정보 카드 하나로 통합: 연동 상태 표시 + 채용정보 로드
    if (!currentUser) return;
    if (!currentUser.newsEnabled) {
        setNewsStatus(false, '뉴스 API 미설정');
        fetchJobs();
        return;
    }
    setNewsStatus(true);
    fetchJobs();
}

// ==========================================
// 6-1. 채용정보 (기업·직무·언급 자격증, 주 1회 갱신) + API 설정
// ==========================================
function fmtDateTime(sec) {
    if (!sec) return '-';
    const d = new Date(sec * 1000);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchJobs() {
    const body = $('jobsBody');
    if (!body) return;
    const r = await api('/api/jobs');
    if (!r.ok) return;
    const d = r.data;
    $('jobsUpdatedText').innerText = d.updatedAt
        ? `마지막 갱신 ${fmtDateTime(d.updatedAt)} · 다음 갱신 ${fmtDateTime(d.nextUpdateAt)}`
        : (d.enabled ? '첫 수집 중입니다. 잠시 후 새로고침해 주세요.' : 'API 설정 후 수집됩니다.');
    $('jobsCount').innerText = `${d.items.length}건`;
    const fb = $('jobsFilteredBadge');
    fb.classList.toggle('hidden', !d.filteredOut);
    fb.innerText = `🛡️ 신뢰도 낮은 기사 ${d.filteredOut}건 자동 제외`;
    if (!d.items.length) {
        body.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-500 text-xs">표시할 채용정보가 없습니다.</td></tr>';
        return;
    }
    body.innerHTML = d.items.map(it => {
        const trusted = it.verdict === 'trusted';
        const badge = trusted
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-amber-50 text-amber-700 border-amber-200';
        const label = trusted ? '신뢰' : '검토 필요';
        const certs = it.certs.map(c => `<span class="bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded font-bold text-[10px] inline-block mr-1 my-0.5">${esc(c)}</span>`).join('')
            + (it.passer ? '<span class="text-[10px] text-indigo-500 font-bold ml-1">합격자 언급</span>' : '');
        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                <td class="py-3.5 px-4 font-bold text-slate-800">${it.company ? esc(it.company) : '<span class="text-slate-300">-</span>'}</td>
                <td class="py-3.5 px-4">${it.role ? esc(it.role) : '<span class="text-slate-300">-</span>'}</td>
                <td class="py-3.5 px-4">${certs || '<span class="text-slate-300">-</span>'}</td>
                <td class="py-3.5 px-4"><span title="${esc(it.reasons.join(' / '))}" class="inline-block border ${badge} px-2 py-0.5 rounded-full font-bold text-[10px] cursor-help">${label} ${it.score}</span></td>
                <td class="py-3.5 px-4 max-w-xs"><a href="${esc(it.link)}" target="_blank" rel="noopener noreferrer" class="text-blue-700 hover:underline font-semibold">${esc(it.title)}</a><div class="text-[10px] text-slate-400 mt-0.5">${esc(it.source)} · ${esc(formatPubDate(it.pubDate))}</div></td>
            </tr>`;
    }).join('');
}

async function loadApiKeyStatus() {
    const r = await api('/api/admin/naver-keys');
    const btn = $('btnApiSettings');
    if (btn) btn.classList.toggle('hidden', !(r.ok && r.data.canEdit));
    return r;
}

async function openApiSettings() {
    const r = await loadApiKeyStatus();
    if (!r.ok || !r.data.canEdit) return showToast('서버를 실행 중인 PC에서만 수정할 수 있습니다.');
    $('apiCurrentInfo').innerText = r.data.configured
        ? `현재 설정됨: ${r.data.clientIdMasked} (${r.data.authType}). 키는 보안상 다시 표시되지 않습니다.`
        : '아직 설정되지 않았습니다.';
    $('apiAuthType').value = r.data.authType;
    $('apiClientId').value = '';
    $('apiClientSecret').value = '';
    $('apiSettingsError').classList.add('hidden');
    $('apiSettingsModal').classList.remove('hidden');
}

function closeApiSettings() {
    $('apiSettingsModal').classList.add('hidden');
    $('apiClientSecret').value = '';
}

async function saveApiSettings() {
    const err = $('apiSettingsError');
    const btn = $('btnSaveApi');
    err.classList.add('hidden');
    btn.disabled = true; btn.innerText = '검증 중...';
    const r = await api('/api/admin/naver-keys', { method: 'POST', body: {
        authType: $('apiAuthType').value,
        clientId: $('apiClientId').value.trim(),
        clientSecret: $('apiClientSecret').value.trim(),
    }});
    btn.disabled = false; btn.innerText = '검증 후 저장';
    if (!r.ok) {
        err.innerText = r.data.error || '저장에 실패했습니다.';
        err.classList.remove('hidden');
        return;
    }
    closeApiSettings();
    currentUser.newsEnabled = true;
    showToast('API 키가 저장되었습니다.');
    fetchNews();
    setTimeout(fetchJobs, 4000);
}

function formatPubDate(s) {
    const d = new Date(s);
    if (isNaN(d)) return '';
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ==========================================
// 7. 자격증 카드 & 모달
// ==========================================
function renderCertCards(certs) {
    const container = $('certCardsContainer');
    if (!container) return;
    const owned = new Set(((globalSpecData && globalSpecData.certs) || []).map(normalizeCert));
    container.innerHTML = certs.map(cert => {
        const has = owned.has(normalizeCert(cert.name.split(' ')[0]));
        return `
        <div class="card-panel p-6 rounded-3xl space-y-4 border-t-4 ${cert.borderClass} flex flex-col justify-between hover:shadow-lg transition-all duration-300">
            <div class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] ${cert.badgeBg} ${cert.badgeText} px-2.5 py-1 rounded-full font-bold">${esc(cert.level)}</span>
                    ${has ? '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold"><i class="fa-solid fa-check"></i> 보유</span>' : ''}
                </div>
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg ${cert.badgeBg} ${cert.badgeText} flex items-center justify-center text-sm"><i class="fa-solid ${cert.icon}"></i></div>
                    <h3 class="text-base sm:text-lg font-bold text-slate-800 leading-snug">${esc(cert.name)}</h3>
                </div>
                <p class="text-xs text-slate-500 leading-relaxed min-h-[48px]">${esc(cert.desc)}</p>
            </div>
            <button onclick="openModal('${cert.id}')" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2">
                <i class="fa-solid fa-circle-info text-blue-500"></i><span>2026 시험 일정 보기</span>
            </button>
        </div>`;
    }).join('') || `<div class="col-span-full p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">해당 카테고리의 추천 자격증이 없습니다.</div>`;
}

function openModal(certId) {
    const cert = certData.find(c => c.id === certId);
    if (!cert) return;
    $('modalCertName').innerText = cert.name;
    $('modalCertLevel').innerText = cert.level;
    $('modalCertLevel').className = `text-[10px] ${cert.badgeBg} ${cert.badgeText} px-2.5 py-0.5 rounded-full font-bold`;
    $('modalCertDesc').innerText = cert.desc;
    $('modalCertDates').innerHTML = cert.dates.map(d => `
        <li class="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
            <i class="fa-solid fa-calendar-check text-blue-500 mt-0.5"></i><span class="leading-relaxed font-medium">${esc(d)}</span>
        </li>`).join('');
    $('modalCertLink').href = cert.officialUrl;
    $('certGuideModal').classList.remove('hidden');
}

function closeModal() { $('certGuideModal').classList.add('hidden'); }

// ==========================================
// 8. 스펙 입력 / 저장
// ==========================================
const SEMESTER_KEYS = ['gpa_1_1', 'gpa_1_2', 'gpa_2_1', 'gpa_2_2', 'gpa_3_1', 'gpa_3_2', 'gpa_4_1', 'gpa_4_2'];

function normalizeCert(s) { return String(s).replace(/\s+/g, '').toUpperCase(); }

function updateGpaMaxLimit(val) {
    const max = parseFloat(val) || 4.5;
    SEMESTER_KEYS.forEach(k => { const el = $(k); if (el) el.max = max; });
}

function openSpecModal() {
    const s = globalSpecData || EMPTY_SPEC;
    $('inputName').value = s.name || '';
    $('inputMajor').value = s.major || '';
    $('inputMaxGpa').value = String(s.maxGpa || 4.5);
    updateGpaMaxLimit(s.maxGpa);
    SEMESTER_KEYS.forEach((k, i) => { $(k).value = s.semesterGrades[i] == null ? '' : s.semesterGrades[i]; });
    $('inputCredits').value = s.credits || '';
    $('inputTotalCredits').value = s.totalCredits || 130;
    $('inputLangType').value = s.langType || '';
    $('inputLangScore').value = s.langScore || '';
    $('inputCert').value = (s.certs || []).join(', ');
    $('inputExtra').value = s.extra || '';
    $('certErrorMessage').classList.add('hidden');
    $('screen-spec-input').classList.remove('hidden');
}

async function handleSpecSubmit(event) {
    event.preventDefault();
    const certErrorElem = $('certErrorMessage');
    certErrorElem.classList.add('hidden');

    const maxGpa = parseFloat($('inputMaxGpa').value) || 4.5;
    const semesterGrades = [];
    for (const key of SEMESTER_KEYS) {
        const raw = $(key).value.trim();
        if (raw === '') { semesterGrades.push(null); continue; }
        const val = parseFloat(raw);
        if (isNaN(val) || val < 0 || val > maxGpa) {
            showToast(`학점은 0 ~ ${maxGpa} 사이로 입력해주세요.`);
            $(key).focus();
            return;
        }
        semesterGrades.push(val);
    }
    if (semesterGrades.every(g => g == null)) {
        showToast('최소 1개 학기의 평점을 입력해주세요.');
        $('gpa_1_1').focus();
        return;
    }

    const langType = $('inputLangType').value;
    const langScore = $('inputLangScore').value.trim();
    if (langType && langScoreToPercent(langType, langScore) == null) {
        showToast('어학 점수 형식을 확인해주세요. (예: TOEIC 850 / OPIc IH)');
        $('inputLangScore').focus();
        return;
    }

    const certs = $('inputCert').value.split(/[,/]/).map(c => c.trim()).filter(Boolean);
    const invalid = certs.filter(c => !VALID_CERTIFICATES.some(v => normalizeCert(v) === normalizeCert(c)));
    if (invalid.length) {
        certErrorElem.querySelector('span').innerText = `[${invalid.join(', ')}]은(는) 목록에 없는 자격증입니다. 정확한 명칭으로 입력해 주세요. (예: SQLD, ADsP, 정보처리기사)`;
        certErrorElem.classList.remove('hidden');
        $('inputCert').focus();
        return;
    }

    const spec = {
        name: $('inputName').value.trim(),
        major: $('inputMajor').value.trim(),
        maxGpa, semesterGrades,
        credits: Math.max(0, parseInt($('inputCredits').value, 10) || 0),
        totalCredits: Math.max(1, parseInt($('inputTotalCredits').value, 10) || 130),
        langType, langScore: langType ? langScore : '',
        certs, extra: $('inputExtra').value.trim()
    };

    const r = await api('/api/data', { method: 'PUT', body: { spec } });
    if (!r.ok) return showToast(r.data.error || '저장에 실패했습니다.');
    globalSpecData = spec;
    $('screen-spec-input').classList.add('hidden');
    showToast('스펙 정보가 저장되었습니다.');
    renderAll();
}

// ==========================================
// 9. 역량 점수 (공개 산출 기준)
// ==========================================
const OPIC_LEVELS = { AL: 100, IH: 90, IM3: 80, IM2: 70, IM1: 60, IL: 40, NH: 25, NM: 15, NL: 5 };

function langScoreToPercent(type, raw) {
    const s = String(raw || '').trim().toUpperCase();
    if (!type) return 0;
    if (type === 'TOEIC') { const n = parseInt(s, 10); return n >= 10 && n <= 990 ? Math.round(n / 990 * 100) : null; }
    if (type === 'TEPS') { const n = parseInt(s, 10); return n >= 0 && n <= 600 ? Math.round(n / 600 * 100) : null; }
    if (type === 'TOEIC Speaking') { const m = s.match(/(\d)/); const n = m ? +m[1] : NaN; return n >= 1 && n <= 8 ? Math.round(n / 8 * 100) : null; }
    if (type === 'OPIc') return OPIC_LEVELS[s.replace(/\s/g, '')] ?? null;
    return null;
}

function computeScores(spec) {
    const valid = spec.semesterGrades.filter(g => g != null);
    const gpa = valid.length ? +(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2) : 0;
    const extraCount = spec.extra ? spec.extra.split(/[,/]/).map(e => e.trim()).filter(Boolean).length : 0;
    return {
        gpa,
        gpaScore: Math.min(100, Math.round(gpa / spec.maxGpa * 100)),
        creditScore: Math.min(100, Math.round(spec.credits / spec.totalCredits * 100)),
        langScore: langScoreToPercent(spec.langType, spec.langScore) || 0,
        certScore: Math.min(100, spec.certs.length * 30),
        extraScore: Math.min(100, extraCount * 25),
        extraCount
    };
}

// ==========================================
// 10. 렌더링
// ==========================================
function renderAll() {
    renderProfile();
    initChartsWithData();
    renderRecommendations();
    updateDuriUI();
    if (!$('tab-recommand').classList.contains('hidden')) filterCerts(currentCertCategory);
}

function renderProfile() {
    const s = globalSpecData || EMPTY_SPEC;
    const email = currentUser && currentUser.email ? currentUser.email : '';
    const displayName = s.name || (email ? email.split('@')[0] : '학생');
    $('profileName').innerText = displayName;
    $('profileId').innerText = email || '이 브라우저에 저장됨';
    $('profileMajor').innerText = s.major || '전공 미입력';
    $('welcomeMessage').innerText = `${displayName}님, 환영합니다!`;
}

function renderRecommendations() {
    const container = $('dynamic-recommendations');
    if (!container) return;
    const s = globalSpecData || EMPTY_SPEC;
    const item = (done, icon, color, title, desc) => done
        ? `<div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3"><div class="text-emerald-500"><i class="fa-solid fa-circle-check text-lg"></i></div><p class="text-xs font-bold text-slate-800">${title}</p></div>`
        : `<div class="p-3 bg-${color}-50 border border-${color}-200 rounded-2xl flex items-start gap-3"><div class="mt-0.5 text-${color}-500"><i class="fa-solid ${icon} text-lg"></i></div><div><p class="text-xs font-bold text-slate-800">${title}</p><p class="text-[11px] text-slate-600 mt-0.5">${desc}</p></div></div>`;
    container.innerHTML =
        item(!!s.langType, 'fa-language', 'blue', s.langType ? `어학: ${esc(s.langType)} ${esc(s.langScore)}` : '어학: 단기 목표 설정', '토익 700점 이상 또는 OPIc IM2 이상을 목표로 해보세요.') +
        item(s.certs.length > 0, 'fa-certificate', 'purple', s.certs.length ? `자격증: ${esc(s.certs.join(', '))}` : '자격증: 준비 시작', '자격증 추천 탭에서 직무별 자격증을 확인해보세요.') +
        item(!!s.extra, 'fa-users', 'amber', s.extra ? `대외활동: ${esc(s.extra)}` : '대외활동: 경험 쌓기', '교내 학술 동아리, 공모전, 해커톤 참가를 고려해보세요.');
}

function initChartsWithData() {
    const s = globalSpecData || EMPTY_SPEC;
    const sc = computeScores(s);
    const remainCredits = Math.max(0, s.totalCredits - s.credits);

    $('badgeGpa').innerHTML = `<i class="fa-solid fa-star"></i> GPA ${esc(sc.gpa)} / ${esc(s.maxGpa)}`;
    $('overallAchievement').innerText = Math.round((sc.gpaScore + sc.creditScore + sc.langScore + sc.certScore + sc.extraScore) / 5) + '%';
    $('display-credits').innerText = s.credits;
    $('display-total-credits').innerText = `/ ${s.totalCredits}`;
    if (remainCredits === 0) {
        $('creditAlertTitle').innerHTML = `<i class="fa-solid fa-circle-check"></i> 졸업 이수 학점을 모두 채웠습니다!`;
        $('creditAlertDesc').innerText = '총 요구 학점을 충족했습니다.';
    } else {
        $('creditAlertTitle').innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> 졸업까지 ${remainCredits}학점이 남았습니다.`;
        $('creditAlertDesc').innerText = '잔여 학기 수강 계획을 확인하세요. (졸업 요건은 학과 사무실 기준이 우선합니다)';
    }

    if (typeof Chart === 'undefined') return;

    if (radarChartInstance) radarChartInstance.destroy();
    radarChartInstance = new Chart($('specRadarChart').getContext('2d'), {
        type: 'radar',
        data: {
            labels: ['학점(GPA)', '이수학점', '어학성적', '자격증', '대외활동'],
            datasets: [
                { label: '내 역량', data: [sc.gpaScore, sc.creditScore, sc.langScore, sc.certScore, sc.extraScore],
                  backgroundColor: 'rgba(6,182,212,0.25)', borderColor: '#06b6d4', borderWidth: 2.5, pointBackgroundColor: '#06b6d4' },
                { label: '목표 기준선', data: [80, 85, 75, 60, 50],
                  backgroundColor: 'rgba(245,158,11,0.12)', borderColor: '#f59e0b', borderWidth: 2, borderDash: [4, 4], pointBackgroundColor: '#f59e0b' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { r: { min: 0, max: 100, ticks: { display: false }, angleLines: { color: '#e2e8f0' }, grid: { color: '#cbd5e1' },
                pointLabels: { color: '#334155', font: { size: 11, weight: 'bold' } } } },
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }
        }
    });

    if (lineChartInstance) lineChartInstance.destroy();
    lineChartInstance = new Chart($('gpaLineChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'],
            datasets: [{ label: `학기별 평점 (만점 ${s.maxGpa})`, data: s.semesterGrades, borderColor: '#3b82f6', borderWidth: 3,
                fill: true, backgroundColor: 'rgba(59,130,246,0.08)', tension: 0.35, pointRadius: 5, pointBackgroundColor: '#2563eb', spanGaps: true }]
        },
        options: { responsive: true, maintainAspectRatio: false,
            scales: { y: { min: 0, max: s.maxGpa, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } },
            plugins: { legend: { display: false } } }
    });

    if (gaugeChartInstance) gaugeChartInstance.destroy();
    gaugeChartInstance = new Chart($('creditGaugeChart').getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['이수 완료', '남은 학점'], datasets: [{ data: [s.credits, remainCredits], backgroundColor: ['#06b6d4', '#e2e8f0'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, rotation: -90, circumference: 180, cutout: '78%', plugins: { legend: { display: false } } }
    });
}

function updateRadarChart(val) {
    if (!radarChartInstance) return;
    const presets = {
        default: { data: [80, 85, 75, 60, 50], label: '목표 기준선' },
        ai: { data: [85, 85, 80, 60, 75], label: '목표 기준선 (AI/데이터)' },
        backend: { data: [75, 85, 70, 60, 75], label: '목표 기준선 (SW 백엔드)' }
    };
    const p = presets[val] || presets.default;
    radarChartInstance.data.datasets[1].data = p.data;
    radarChartInstance.data.datasets[1].label = p.label;
    radarChartInstance.update();
}

// ==========================================
// 11. 곰두리 (서버 저장)
// ==========================================
function saveDuri() {
    clearTimeout(saveDuri._t);
    saveDuri._t = setTimeout(() => api('/api/data', { method: 'PUT', body: { pet: duriState } }), 400);
}

function updateDuriUI() {
    $('fullnessVal').innerText = duriState.fullness + '%';
    $('fullnessBar').style.width = duriState.fullness + '%';
    $('expVal').innerText = duriState.exp + '%';
    $('expBar').style.width = duriState.exp + '%';
    $('duriLevel').innerText = `(Lv. ${duriState.level})`;
    $('coinCount').innerText = `${duriState.coins} COIN`;
}

function triggerSpeech(text) {
    const bubble = $('speechBubble');
    bubble.innerText = text;
    bubble.classList.replace('opacity-0', 'opacity-100');
    clearTimeout(triggerSpeech._t);
    triggerSpeech._t = setTimeout(() => bubble.classList.replace('opacity-100', 'opacity-0'), 2500);
}

function feedDuri() {
    if (duriState.coins < 10) return showToast('코인이 부족합니다! 공부를 해서 코인을 모아보세요.');
    duriState.coins -= 10;
    duriState.fullness = Math.min(100, duriState.fullness + 15);
    updateDuriUI(); saveDuri();
    triggerSpeech('냠냠! 데이터가 아주 맛있어! 🍬');
}

function studyDuri() {
    if (duriState.fullness < 10) return showToast('곰두리가 배고파요! 먼저 먹이를 주세요.');
    duriState.exp += 15;
    duriState.fullness = Math.max(0, duriState.fullness - 10);
    duriState.coins += 20;
    if (duriState.exp >= 100) {
        duriState.level += 1;
        duriState.exp -= 100;
        triggerSpeech('🎉 레벨 업! 더 똑똑해졌어!');
        showToast(`곰두리가 Lv.${duriState.level}(으)로 성장했습니다!`);
    } else {
        triggerSpeech('열심히 공부 중... 💻');
    }
    updateDuriUI(); saveDuri();
}

function sleepDuri() {
    duriState.fullness = Math.min(100, duriState.fullness + 5);
    triggerSpeech('쿨쿨... 💤');
    updateDuriUI(); saveDuri();
}

function petDuri() {
    const avatar = $('duriAvatar');
    avatar.classList.add('scale-125', 'rotate-6');
    setTimeout(() => avatar.classList.remove('scale-125', 'rotate-6'), 300);
    triggerSpeech('기분 좋아! 💛');
}


// ==========================================
// 11. AI 스펙 진단 챗봇 (입력된 스펙을 규칙 기반으로 분석, 외부 전송 없음)
// ==========================================
const CHAT_CHIPS = ['부족한 부분 분석해줘', '학점', '어학성적', '대외활동', '자격증'];
let chatInitialized = false;

function analyzeSpec(spec) {
    const sc = computeScores(spec);
    const hasGrades = spec.semesterGrades.some(g => g != null);
    const langPct = spec.langType ? langScoreToPercent(spec.langType, spec.langScore) : 0;
    const held = spec.certs.map(normalizeCert);
    const missingCerts = certData.filter(c => {
        const key = normalizeCert(c.name.split(' ')[0]);
        return !held.some(h => h.includes(key) || key.includes(h));
    }).map(c => c.name.split(' ')[0]);
    // 입문 난이도 순으로 추천
    const EASY_ORDER = ['SQLD', 'ADsP', '정보처리기사', '빅데이터분석기사'];
    missingCerts.sort((a, b) => EASY_ORDER.indexOf(a) - EASY_ORDER.indexOf(b));
    const areas = [];

    // 학점
    const gpaRatio = hasGrades ? sc.gpa / spec.maxGpa : 0;
    if (!hasGrades) areas.push({ key: 'gpa', label: '학점', level: 0, score: 0,
        msg: '학기별 학점이 입력되지 않았어요.', tip: '스펙 정보 재설정에서 학기별 학점을 입력하면 정확히 진단할 수 있어요.' });
    else if (gpaRatio < 0.78) areas.push({ key: 'gpa', label: '학점', level: 0, score: sc.gpaScore,
        msg: `평균 ${sc.gpa} / ${spec.maxGpa} 로 학점이 부족한 편이에요.`,
        tip: '전공 필수 과목 위주로 성적을 올리고, 재수강 제도를 활용해 보세요. 남은 학기 평점 목표를 학기당 +0.2로 잡아보세요.' });
    else if (gpaRatio < 0.89) areas.push({ key: 'gpa', label: '학점', level: 1, score: sc.gpaScore,
        msg: `평균 ${sc.gpa} / ${spec.maxGpa} 로 무난한 수준이에요.`,
        tip: '대기업·금융권을 노린다면 3.5(4.5 기준 약 3.9) 이상을 목표로 한 학기만 더 끌어올려 보세요.' });
    else areas.push({ key: 'gpa', label: '학점', level: 2, score: sc.gpaScore,
        msg: `평균 ${sc.gpa} / ${spec.maxGpa} 로 우수해요.`, tip: '지금 학점을 유지하면서 다른 영역에 시간을 쓰세요.' });

    // 어학
    if (!spec.langType) areas.push({ key: 'lang', label: '어학성적', level: 0, score: 0,
        msg: '어학 성적이 없어요.', tip: '토익 700점 이상 또는 OPIc IM2 이상을 1차 목표로 잡고 접수부터 해보세요.' });
    else if (langPct == null) areas.push({ key: 'lang', label: '어학성적', level: 0, score: 0,
        msg: `${spec.langType} 점수 형식을 인식하지 못했어요.`, tip: '스펙 정보 재설정에서 점수를 다시 확인해 주세요.' });
    else if (langPct < 71) areas.push({ key: 'lang', label: '어학성적', level: 0, score: langPct,
        msg: `${spec.langType} ${spec.langScore} 로 기준(토익 약 700점 상당)에 못 미쳐요.`,
        tip: '하루 1~2시간씩 8주 계획으로 단기 점수 향상을 노려보세요. 정기 시험 일정에 먼저 접수해 두면 도움이 돼요.' });
    else if (langPct < 86) areas.push({ key: 'lang', label: '어학성적', level: 1, score: langPct,
        msg: `${spec.langType} ${spec.langScore} 로 기본 기준은 충족했어요.`,
        tip: '지원 기업에 따라 800점대 이상을 요구하기도 하니, 여력이 되면 한 번 더 올려보세요. OPIc/스피킹도 추가하면 좋아요.' });
    else areas.push({ key: 'lang', label: '어학성적', level: 2, score: langPct,
        msg: `${spec.langType} ${spec.langScore} 로 충분히 높아요.`, tip: '어학은 충분해요. 다른 영역에 집중하세요.' });

    // 대외활동
    if (sc.extraCount === 0) areas.push({ key: 'extra', label: '대외활동', level: 0, score: 0,
        msg: '대외활동 기록이 없어요.', tip: '학술 동아리, 공모전, 해커톤, 인턴 중 한 가지를 이번 학기 안에 시작해 보세요. 직무 관련 프로젝트 경험이 가장 효과적이에요.' });
    else if (sc.extraCount < 3) areas.push({ key: 'extra', label: '대외활동', level: 1, score: sc.extraScore,
        msg: `대외활동 ${sc.extraCount}개로 보통 수준이에요.`,
        tip: '직무와 직접 연결되는 활동(프로젝트·공모전·인턴)을 1개 더 추가하고, 성과를 수치로 정리해 두세요.' });
    else areas.push({ key: 'extra', label: '대외활동', level: 2, score: sc.extraScore,
        msg: `대외활동 ${sc.extraCount}개로 풍부해요.`, tip: '각 활동의 역할과 성과를 한 줄씩 정리해 두면 자기소개서에 바로 쓸 수 있어요.' });

    // 자격증
    const suggest = missingCerts.slice(0, 3).join(', ');
    if (spec.certs.length === 0) areas.push({ key: 'cert', label: '자격증', level: 0, score: 0,
        msg: '보유한 자격증이 없어요.', tip: `가장 접근하기 쉬운 ${suggest || 'SQLD, ADsP'} 부터 도전해 보세요. 자격증 추천 탭에서 시험 일정을 확인할 수 있어요.` });
    else if (spec.certs.length < 2) areas.push({ key: 'cert', label: '자격증', level: 1, score: sc.certScore,
        msg: `자격증 ${spec.certs.length}개(${spec.certs.join(', ')})로 보통 수준이에요.`,
        tip: suggest ? `${suggest} 중 직무와 맞는 것을 하나 더 취득해 보세요.` : '직무 관련 자격증을 하나 더 취득해 보세요.' });
    else areas.push({ key: 'cert', label: '자격증', level: 2, score: sc.certScore,
        msg: `자격증 ${spec.certs.length}개(${spec.certs.join(', ')})로 충분해요.`,
        tip: suggest ? `더 보강한다면 ${suggest} 를 고려해 보세요.` : '이미 주요 자격증을 갖추고 있어요.' });
    return areas;
}

function chatFmt(text) {
    return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

function chatAdd(role, html) {
    const box = $('chatMessages');
    const wrap = document.createElement('div');
    wrap.className = role === 'user' ? 'flex justify-end' : 'flex justify-start';
    const bubble = document.createElement('div');
    bubble.className = role === 'user'
        ? 'max-w-[85%] bg-blue-600 text-white px-3 py-2 rounded-2xl rounded-br-md'
        : 'max-w-[90%] bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-2xl rounded-bl-md leading-relaxed';
    bubble.innerHTML = html;
    wrap.appendChild(bubble);
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
}

const LEVEL_ICON = ['🔴', '🟡', '🟢'];

function chatReply(question) {
    const q = question.replace(/\s/g, '').toLowerCase();
    if (/^(안녕|하이|hi|hello)/.test(q)) return chatFmt('안녕하세요! 저는 스펙 진단 챗봇이에요. "부족한 부분 분석해줘"라고 물어보세요.');
    if (!globalSpecData) return chatFmt('아직 스펙 정보가 없어요. 왼쪽 아래 "스펙 정보 재설정"에서 학점·어학·자격증·대외활동을 입력하면 바로 분석해 드릴게요.');

    const areas = analyzeSpec(globalSpecData);
    const pick = (key) => areas.find(a => a.key === key);
    const one = (a) => `${LEVEL_ICON[a.level]} **${a.label}**: ${a.msg}\n👉 ${a.tip}`;

    if (/학점|gpa|성적표|평점/.test(q)) return chatFmt(one(pick('gpa')));
    if (/어학|토익|toeic|오픽|opic|텝스|teps|영어/.test(q)) return chatFmt(one(pick('lang')));
    if (/대외|활동|동아리|공모전|인턴|경험/.test(q)) return chatFmt(one(pick('extra')));
    if (/자격증|자격|sqld|adsp|정보처리|빅데이터/.test(q)) return chatFmt(one(pick('cert')));
    if (/부족|약점|분석|진단|뭐|어떻|보완|노력|스펙|추천/.test(q)) {
        const lacking = areas.filter(a => a.level === 0);
        const mid = areas.filter(a => a.level === 1);
        if (!lacking.length && !mid.length) return chatFmt('🎉 네 가지 영역(학점·어학·대외활동·자격증) 모두 우수해요! 지금 상태를 유지하면서 지원할 직무에 맞는 포트폴리오를 다듬어 보세요.');
        let out = '';
        if (lacking.length) {
            out += `지금 가장 부족한 부분은 **${lacking.map(a => a.label).join(', ')}** 이에요. 이 부분을 채우는 데 먼저 노력해 보세요!\n\n` + lacking.map(one).join('\n\n');
        }
        if (mid.length) {
            out += (out ? '\n\n' : '') + `조금만 더 보강하면 좋은 영역:\n\n` + mid.map(one).join('\n\n');
        }
        const good = areas.filter(a => a.level === 2).map(a => a.label);
        if (good.length) out += `\n\n🟢 잘하고 있는 영역: ${good.join(', ')}`;
        return chatFmt(out);
    }
    return chatFmt('질문을 잘 이해하지 못했어요. "부족한 부분 분석해줘"처럼 물어보거나 아래 버튼을 눌러 보세요.');
}

function sendChatText(text) {
    const t = text.trim();
    if (!t) return;
    chatAdd('user', esc(t));
    chatAdd('bot', '<span class="text-slate-400">분석 중<span class="animate-pulse">...</span></span>');
    const last = $('chatMessages').lastChild;
    setTimeout(() => {
        last.remove();
        chatAdd('bot', chatReply(t));
    }, 450);
}

function sendChat(event) {
    event.preventDefault();
    const input = $('chatInput');
    const v = input.value;
    input.value = '';
    sendChatText(v);
}

function toggleChatbot() {
    const pop = $('chatbotPopup');
    const open = pop.classList.toggle('hidden') === false;
    if (open && !chatInitialized) {
        chatInitialized = true;
        $('chatChips').innerHTML = CHAT_CHIPS.map(c =>
            `<button type="button" class="chat-chip px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-full text-[11px] font-bold">${esc(c)}</button>`).join('');
        $('chatChips').querySelectorAll('.chat-chip').forEach(b => b.addEventListener('click', () => sendChatText(b.innerText)));
        chatAdd('bot', chatFmt('안녕하세요! 👋 입력해 두신 스펙을 바탕으로 **학점, 어학성적, 대외활동, 자격증** 중 부족한 부분을 분석해 드려요.\n"내가 부족한 게 뭐야?"라고 물어보세요.'));
    }
    if (open) $('chatInput').focus();
}

// ==========================================
// 12. 초기화
// ==========================================
async function bootstrap() {
    let me;
    try {
        me = await api('/api/me');
    } catch (e) {
        showToast('서버와 통신할 수 없습니다.');
        return;
    }
    if (!me.ok) return showLogin();
    currentUser = me.data;
    $('screen-login').classList.add('hidden');
    $('btnLogout').classList.toggle('hidden', !!currentUser.guest);

    const d = await api('/api/data');
    globalSpecData = d.ok && d.data.spec ? { ...EMPTY_SPEC, ...d.data.spec } : null;
    if (d.ok && d.data.pet) duriState = d.data.pet;

    renderAll();
    loadApiKeyStatus();
    if (!globalSpecData) {
        openSpecModal();
        showToast('처음 오셨네요! 스펙 정보를 입력해주세요.');
    }
    if (location.hash === '#recommand') switchTab('recommand');
}

window.addEventListener('DOMContentLoaded', bootstrap);
