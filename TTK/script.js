/**
 * 캠퍼스 스펙 트래커 (Campus Spec Tracker)
 * AI 자격증 추천 시스템 & 스펙 진단 대시보드
 */

// ==========================================
// 1. 실존 국가/민간 자격증 DB (유효성 검증용)
// ==========================================
const VALID_CERTIFICATES = [
    "정보처리기사", "정보처리산업기사", "정보처리기능사",
    "SQLD", "SQLP", "ADsP", "ADP", "AICE",
    "컴퓨터활용능력1급", "컴퓨터활용능력2급", "컴활1급", "컴활2급",
    "빅데이터분석기사", "리눅스마스터", "리눅스마스터1급", "리눅스마스터2급",
    "네트워크관리사", "네트워크관리사2급", "정보보안기사", "정보보안산업기사",
    "AWS", "AWS SAA", "AWS DVA", "AWS SAP", "AWS CLF",
    "CKA", "CKAD", "CCNA", "CCNP",
    "전기기사", "전자기사", "무선설비기사", "통신기사",
    "한국사능력검정시험", "한국사1급", "한국사2급", "한국사3급",
    "GTQ", "GTQi", "전산회계1급", "전산회계2급", "전산세무1급", "전산세무2급",
    "PMP", "CISA", "CISSP", "MOS"
];

// ==========================================
// 2. 자격증 메타데이터 (certData)
// 배열 내 객체 순서가 'AI공학 전공 적합성 순위'를 결정합니다.
// ==========================================
const certData = [
    {
        id: "bigdata",
        name: "빅데이터분석기사",
        tags: ["data", "all"],
        color: "purple",
        level: "전문가",
        rating: "★★★★★ (전공 최우선 추천)",
        badgeBg: "bg-purple-100",
        badgeText: "text-purple-700",
        borderClass: "border-t-purple-500",
        icon: "fa-brain",
        desc: "빅데이터 수집, 전처리, 머신러닝/딥러닝 모델링 및 데이터 사이언스 분석 실무 역량을 국가기술 차원에서 정밀 검증하는 최고 권위 기사 자격입니다.",
        officialUrl: "https://www.dataq.or.kr",
        dates: [
            "2026 제 12회 필기: 2026.04.04 (원서접수: 02.23 ~ 02.27)",
            "2026 제 12회 실기: 2026.06.20 (원서접수: 05.11 ~ 05.15)",
            "2026 제 13회 필기: 2026.09.12 (원서접수: 08.03 ~ 08.07)",
            "2026 제 13회 실기: 2026.11.28 (원서접수: 10.19 ~ 10.23)"
        ]
    },
    {
        id: "adsp",
        name: "ADsP (데이터분석 준전문가)",
        tags: ["data", "finance", "all"],
        color: "cyan",
        level: "초·중급",
        rating: "★★★★☆ (취업 필수 기초)",
        badgeBg: "bg-cyan-100",
        badgeText: "text-cyan-700",
        borderClass: "border-t-cyan-500",
        icon: "fa-chart-pie",
        desc: "데이터 이해, 데이터 분석 기획, 정형 데이터 마이닝 및 통계적 기초 개념을 종합 검증하는 한국데이터산업진흥원 공인 자격증입니다.",
        officialUrl: "https://www.dataq.or.kr",
        dates: [
            "2026 제 44회 시험: 2026.02.21 (원서접수: 01.19 ~ 01.23)",
            "2026 제 45회 시험: 2026.05.16 (원서접수: 04.13 ~ 04.17)",
            "2026 제 46회 시험: 2026.08.22 (원서접수: 07.20 ~ 07.24)",
            "2026 제 47회 시험: 2026.10.24 (원서접수: 09.21 ~ 09.25)"
        ]
    },
    {
        id: "sqld",
        name: "SQLD (SQL 개발자)",
        tags: ["data", "finance", "dev", "all"],
        color: "pink",
        level: "실무형",
        rating: "★★★★★ (전 직무 범용)",
        badgeBg: "bg-pink-100",
        badgeText: "text-pink-700",
        borderClass: "border-t-pink-500",
        icon: "fa-database",
        desc: "관계형 데이터베이스(RDBMS) 설계 구조 이해, 테이블 모델링 및 대용량 데이터 추출·가공 SQL 질의문 작성 능력을 정밀 검증하는 필수 자격입니다.",
        officialUrl: "https://www.dataq.or.kr",
        dates: [
            "2026 제 56회 시험: 2026.03.07 (원서접수: 02.02 ~ 02.06)",
            "2026 제 57회 시험: 2026.05.23 (원서접수: 04.20 ~ 04.24)",
            "2026 제 58회 시험: 2026.08.29 (원서접수: 07.27 ~ 07.31)",
            "2026 제 59회 시험: 2026.11.14 (원서접수: 10.12 ~ 10.16)"
        ]
    },
    {
        id: "qnet",
        name: "정보처리기사",
        tags: ["dev", "finance", "all"],
        color: "blue",
        level: "국가기술",
        rating: "★★★★★ (IT 공채 기본 표준)",
        badgeBg: "bg-blue-100",
        badgeText: "text-blue-700",
        borderClass: "border-t-blue-500",
        icon: "fa-code",
        desc: "소프트웨어 아키텍처 설계, 프로그래밍 언어 활용, 데이터베이스 및 시스템 운영 보안을 망라하는 대한민국 IT 분야의 대표 공인 국가기술자격입니다.",
        officialUrl: "https://www.q-net.or.kr",
        dates: [
            "2026 정기 1회 필기: 2026.02.14 ~ 03.03 (실기: 04.18 ~ 05.06)",
            "2026 정기 2회 필기: 2026.05.09 ~ 05.28 (실기: 07.18 ~ 08.02)",
            "2026 정기 3회 필기: 2026.08.01 ~ 08.20 (실기: 10.17 ~ 11.01)"
        ]
    }
];

// ==========================================
// 3. 합격자 스펙 DB (passDatabase)
// 실제 채용 전형 기반 정제 데이터
// ==========================================
const passDatabase = [
    {
        company: "삼성증권",
        domain: "samsungpop.com",
        role: "IT/디지털 금융",
        certs: "ADsP, SQLD",
        date: "2024 하반기 신입",
        category: "finance"
    },
    {
        company: "네이버",
        domain: "navercorp.com",
        role: "AI/데이터 엔지니어",
        certs: "빅데이터분석기사, SQLD",
        date: "2024 하반기 신입",
        category: "data"
    },
    {
        company: "카카오",
        domain: "kakaocorp.com",
        role: "데이터 사이언티스트",
        certs: "빅데이터분석기사, ADsP",
        date: "2024 상반기 신입",
        category: "data"
    },
    {
        company: "토스",
        domain: "toss.im",
        role: "서버/데이터 개발",
        certs: "정보처리기사, SQLD",
        date: "2024 하반기 신입",
        category: "finance"
    },
    {
        company: "현대자동차",
        domain: "hyundai.com",
        role: "AI 모델링 및 R&D",
        certs: "빅데이터분석기사, ADsP",
        date: "2024 하반기 수시",
        category: "data"
    },
    {
        company: "신한은행",
        domain: "shinhan.com",
        role: "디지털/ICT",
        certs: "ADsP, SQLD, 정보처리기사",
        date: "2024 상반기 신입",
        category: "finance"
    },
    {
        company: "라인",
        domain: "linepluscorp.com",
        role: "SW 개발",
        certs: "정보처리기사, SQLD",
        date: "2024 하반기 공채",
        category: "dev"
    },
    {
        company: "쿠팡",
        domain: "coupang.com",
        role: "데이터 플랫폼 엔지니어",
        certs: "빅데이터분석기사, SQLD",
        date: "2024 상반기 공채",
        category: "data"
    },
    {
        company: "당근",
        domain: "daangn.com",
        role: "백엔드/SW 개발",
        certs: "정보처리기사",
        date: "2024 하반기 신입",
        category: "dev"
    }
];

// ==========================================
// 4. 전역 애플리케이션 상태 변수
// ==========================================
let globalSpecData = {
    maxGpa: 4.5,
    gpa: 3.82,
    credits: 108,
    totalCredits: 130,
    lang: '',
    cert: '',
    extra: '',
    semesterGrades: [3.6, 3.75, 3.8, 3.85, 3.9, 4.0, 4.05, null]
};

let duriState = {
    level: 5,
    fullness: 80,
    exp: 65,
    coins: 120
};

let currentCertCategory = 'all';

let radarChartInstance = null;
let lineChartInstance = null;
let gaugeChartInstance = null;

// ==========================================
// 5. 유틸리티 & 알림 함수
// ==========================================
function showToast(message) {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    if (!toast || !toastMsg) return;
    toastMsg.innerText = message;
    toast.classList.remove('translate-y-16', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-16', 'opacity-0');
    }, 3000);
}

// 모바일 사이드바 토글
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!sidebar || !overlay) return;
    const isOpen = !sidebar.classList.contains('-translate-x-full');

    if (isOpen) {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    } else {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    }
}

// 탭 전환 로직
function switchTab(tabName) {
    const tabs = ['dashboard', 'duri', 'recommand'];
    tabs.forEach(name => {
        const tabEl = document.getElementById('tab-' + name);
        const navEl = document.getElementById('nav-' + name);
        if (tabEl) tabEl.classList.add('hidden');
        if (navEl) {
            navEl.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition text-slate-600 hover:bg-slate-50";
        }
    });

    const targetTab = document.getElementById('tab-' + tabName);
    const targetNav = document.getElementById('nav-' + tabName);
    if (targetTab) targetTab.classList.remove('hidden');
    if (targetNav) {
        targetNav.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition bg-blue-50 text-blue-600";
    }

    // 모바일 사이드바 열려있으면 닫기
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) {
        toggleMobileSidebar();
    }

    if (tabName === 'dashboard') {
        setTimeout(() => {
            if (radarChartInstance) radarChartInstance.resize();
            if (lineChartInstance) lineChartInstance.resize();
            if (gaugeChartInstance) gaugeChartInstance.resize();
        }, 50);
    } else if (tabName === 'recommand') {
        // 자격증 탭 진입 시 현재 카테고리 재렌더링
        filterCerts(currentCertCategory);
    }
}

// ==========================================
// 6. AI 자격증 추천 및 합격자 DB 렌더링 엔진
// ==========================================

// 카테고리 필터링 트리거
function filterCerts(category, btnElement) {
    currentCertCategory = category;

    // 1. 필터 버튼 스타일 토글
    const filterButtons = document.querySelectorAll('.cert-filter-btn');
    filterButtons.forEach(btn => {
        btn.className = "cert-filter-btn px-4 py-2 rounded-xl text-xs font-bold transition bg-slate-100 text-slate-600 hover:bg-slate-200";
    });

    if (btnElement) {
        btnElement.className = "cert-filter-btn px-4 py-2 rounded-xl text-xs font-bold transition bg-slate-800 text-white shadow-sm";
    } else {
        const matchingBtn = document.querySelector(`[data-category="${category}"]`);
        if (matchingBtn) {
            matchingBtn.className = "cert-filter-btn px-4 py-2 rounded-xl text-xs font-bold transition bg-slate-800 text-white shadow-sm";
        }
    }

    // 2. certData 필터링
    const filteredCerts = (category === 'all')
        ? certData
        : certData.filter(item => item.tags.includes(category));

    // 3. passDatabase 필터링
    const filteredCases = (category === 'all')
        ? passDatabase
        : passDatabase.filter(item => item.category === category);

    // 4. DOM 리렌더링
    renderCertCards(filteredCerts);
    renderSuccessCases(filteredCases);
}

// 자격증 카드 렌더링
function renderCertCards(certs) {
    const container = document.getElementById('certCardsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (certs.length === 0) {
        container.innerHTML = `
            <div class="col-span-full p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400">
                <i class="fa-solid fa-circle-question text-3xl mb-2"></i>
                <p class="text-xs">해당 카테고리의 추천 자격증이 없습니다.</p>
            </div>
        `;
        return;
    }

    certs.forEach(cert => {
        const card = document.createElement('div');
        card.className = `card-panel p-6 rounded-3xl space-y-4 border-t-4 ${cert.borderClass} flex flex-col justify-between hover:shadow-lg transition-all duration-300`;
        
        card.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] ${cert.badgeBg} ${cert.badgeText} px-2.5 py-1 rounded-full font-bold">
                        ${cert.level}
                    </span>
                    <span class="text-[11px] text-slate-400 font-medium">
                        ${cert.rating}
                    </span>
                </div>
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg ${cert.badgeBg} ${cert.badgeText} flex items-center justify-center text-sm">
                        <i class="fa-solid ${cert.icon}"></i>
                    </div>
                    <h3 class="text-base sm:text-lg font-bold text-slate-800 leading-snug">${cert.name}</h3>
                </div>
                <p class="text-xs text-slate-500 leading-relaxed min-h-[48px]">${cert.desc}</p>
            </div>
            <button onclick="openModal('${cert.id}')" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 group">
                <i class="fa-solid fa-circle-info text-blue-500 group-hover:scale-110 transition-transform"></i>
                <span>2026 준비 가이드 및 시험 일정</span>
            </button>
        `;
        container.appendChild(card);
    });
}

// 기업별 합격자 스펙 테이블 렌더링
function renderSuccessCases(cases) {
    const tbody = document.getElementById('successCasesBody');
    const caseCountElem = document.getElementById('successCasesCount');
    if (caseCountElem) {
        caseCountElem.innerText = `총 ${cases.length}건`;
    }
    if (!tbody) return;
    tbody.innerHTML = '';

    if (cases.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="p-8 text-center text-slate-400 text-xs">
                    해당 분야의 합격 사례 데이터가 없습니다.
                </td>
            </tr>
        `;
        return;
    }

    cases.forEach(item => {
        const isAiDataRole = item.role.includes('데이터') || item.role.includes('AI');
        const roleStyle = isAiDataRole 
            ? 'text-red-600 font-bold flex items-center gap-1.5' 
            : 'text-slate-700 font-semibold';
        
        const certBadges = item.certs.split(', ').map(c => {
            return `<span class="bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded font-bold text-[10px] inline-block mr-1 my-0.5">${c.trim()}</span>`;
        }).join('');

        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-100 hover:bg-slate-50/80 transition-colors";
        
        tr.innerHTML = `
            <td class="py-3.5 px-4">
                <div class="flex items-center gap-3">
                    <img 
                        src="https://logo.clearbit.com/${item.domain}" 
                        alt="${item.company}"
                        onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=' + encodeURIComponent('${item.company}') + '&background=e2e8f0&color=475569&rounded=true&bold=true'" 
                        class="w-7 h-7 rounded-lg object-contain bg-white p-0.5 border border-slate-200 shadow-2xs flex-shrink-0"
                    />
                    <span class="font-bold text-slate-800 text-xs sm:text-sm">${item.company}</span>
                </div>
            </td>
            <td class="py-3.5 px-4">
                <div class="${roleStyle} text-xs">
                    ${isAiDataRole ? '<i class="fa-solid fa-sparkles text-[10px]"></i>' : ''}
                    ${item.role}
                </div>
            </td>
            <td class="py-3.5 px-4">
                <div class="flex flex-wrap items-center">
                    ${certBadges}
                </div>
            </td>
            <td class="py-3.5 px-4 text-xs text-slate-500 font-medium">
                ${item.date}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 7. 자격증 상세 모달 시스템
// ==========================================
function openModal(certId) {
    const cert = certData.find(c => c.id === certId);
    if (!cert) return;

    const modal = document.getElementById('certGuideModal');
    const modalName = document.getElementById('modalCertName');
    const modalLevel = document.getElementById('modalCertLevel');
    const modalDesc = document.getElementById('modalCertDesc');
    const modalDates = document.getElementById('modalCertDates');
    const modalLink = document.getElementById('modalCertLink');

    if (modalName) modalName.innerText = cert.name;
    if (modalLevel) {
        modalLevel.innerText = cert.level;
        modalLevel.className = `text-[10px] ${cert.badgeBg} ${cert.badgeText} px-2.5 py-0.5 rounded-full font-bold`;
    }
    if (modalDesc) modalDesc.innerText = cert.desc;
    
    if (modalDates) {
        modalDates.innerHTML = cert.dates.map(date => {
            return `
                <li class="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                    <i class="fa-solid fa-calendar-check text-blue-500 mt-0.5"></i>
                    <span class="leading-relaxed font-medium">${date}</span>
                </li>
            `;
        }).join('');
    }

    if (modalLink) {
        modalLink.href = cert.officialUrl || "#";
    }

    if (modal) modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('certGuideModal');
    if (modal) modal.classList.add('hidden');
}

// ==========================================
// 8. 스펙 입력 및 차트 초기화 로직
// ==========================================

// 만점 기준 변경 핸들러
function updateGpaMaxLimit(val) {
    const max = parseFloat(val) || 4.5;
    const semesterKeys = ['gpa_1_1', 'gpa_1_2', 'gpa_2_1', 'gpa_2_2', 'gpa_3_1', 'gpa_3_2', 'gpa_4_1', 'gpa_4_2'];
    semesterKeys.forEach(key => {
        const input = document.getElementById(key);
        if (input) input.max = max;
    });
}

// (로그인/인증 단계 제거됨 — 첫 화면에서 바로 스펙을 입력합니다)

// 스펙 정보 제출 처리 핸들러
function handleSpecSubmit(event) {
    event.preventDefault();

    const certErrorElem = document.getElementById('certErrorMessage');
    if (certErrorElem) certErrorElem.classList.add('hidden');

    const maxGpa = parseFloat(document.getElementById('inputMaxGpa').value) || 4.5;

    // 8개 학기 학점 수집
    const semesterKeys = ['gpa_1_1', 'gpa_1_2', 'gpa_2_1', 'gpa_2_2', 'gpa_3_1', 'gpa_3_2', 'gpa_4_1', 'gpa_4_2'];
    let semesterGrades = [];
    let validSum = 0;
    let validCount = 0;

    for (let key of semesterKeys) {
        const valStr = document.getElementById(key).value.trim();
        if (valStr !== "") {
            let val = parseFloat(valStr);
            if (isNaN(val) || val < 0 || val > maxGpa) {
                showToast(`학점은 0에서 ${maxGpa} 만점 사이의 수치여야 합니다.`);
                document.getElementById(key).focus();
                return;
            }
            semesterGrades.push(val);
            validSum += val;
            validCount++;
        } else {
            semesterGrades.push(null);
        }
    }

    if (validCount === 0) {
        showToast('최소 1개 이상의 학기를 입력해주세요.');
        document.getElementById('gpa_1_1').focus();
        return;
    }

    // 전체 평점 평균 산출
    let gpa = parseFloat((validSum / validCount).toFixed(2));
    let credits = parseInt(document.getElementById('inputCredits').value) || 0;
    let totalCredits = parseInt(document.getElementById('inputTotalCredits').value) || 130;

    credits = Math.max(0, credits);
    totalCredits = Math.max(1, totalCredits);

    const lang = document.getElementById('inputLang').value.trim();
    const certInput = document.getElementById('inputCert').value.trim();
    const extra = document.getElementById('inputExtra').value.trim();

    // 자격증 유효성 검증
    if (certInput !== "") {
        const enteredCerts = certInput.split(/[,/]/).map(c => c.trim()).filter(c => c.length > 0);
        const invalidCerts = enteredCerts.filter(userCert => {
            const cleanUserCert = userCert.replace(/\s+/g, '').toUpperCase();
            return !VALID_CERTIFICATES.some(validCert => {
                const cleanValidCert = validCert.replace(/\s+/g, '').toUpperCase();
                return cleanValidCert === cleanUserCert || cleanUserCert.includes(cleanValidCert);
            });
        });

        if (invalidCerts.length > 0) {
            if (certErrorElem) {
                certErrorElem.querySelector('span').innerText = `[${invalidCerts.join(', ')}]은(는) 확인되지 않는 자격증입니다. 실존하는 자격증명을 입력해 주세요!`;
                certErrorElem.classList.remove('hidden');
            }
            showToast('존재하지 않는 자격증이 포함되어 있습니다. 다시 확인해 주세요.');
            document.getElementById('inputCert').focus();
            return;
        }
    }

    globalSpecData = { maxGpa, gpa, credits, totalCredits, lang, cert: certInput, extra, semesterGrades };

    // 세션 스토리지 영속화
    sessionStorage.setItem('campus_spec_data', JSON.stringify(globalSpecData));

    const missingSpecs = [];
    if (!lang) missingSpecs.push("어학성적");
    if (!certInput) missingSpecs.push("자격증");
    if (!extra) missingSpecs.push("대외활동");

    if (missingSpecs.length > 0) {
        showToast(`선택 항목(${missingSpecs.join(', ')}) 미입력으로 맞춤 추천 경로가 자동 생성되었습니다.`);
    } else {
        showToast('모든 스펙 정보가 성공적으로 반영되었습니다.');
    }

    document.getElementById('screen-spec-input').classList.add('hidden');

    initChartsWithData();
    renderRecommendations();
}

// 스펙 진단 추천 경로 생성
function renderRecommendations() {
    const container = document.getElementById('dynamic-recommendations');
    if (!container) return;
    container.innerHTML = '';
    const { lang, cert, extra } = globalSpecData;

    let html = '';

    // 어학 추천
    if (!lang) {
        html += `
        <div class="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 shadow-xs">
            <div class="mt-0.5 text-blue-500"><i class="fa-solid fa-language text-lg"></i></div>
            <div>
                <p class="text-xs font-bold text-slate-800">어학: 단기 목표 설정</p>
                <p class="text-[11px] text-slate-600 mt-0.5">토익 700점 이상 또는 OPIc IM2 취득을 추천합니다.</p>
            </div>
        </div>`;
    } else {
        html += `
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 opacity-90">
            <div class="text-emerald-500"><i class="fa-solid fa-circle-check text-lg"></i></div>
            <p class="text-xs font-bold text-slate-800">어학: ${lang} (보유 중)</p>
        </div>`;
    }

    // 자격증 추천
    if (!cert) {
        html += `
        <div class="p-3 bg-purple-50 border border-purple-200 rounded-2xl flex items-start gap-3 shadow-xs">
            <div class="mt-0.5 text-purple-500"><i class="fa-solid fa-certificate text-lg"></i></div>
            <div>
                <p class="text-xs font-bold text-slate-800">자격증: 빅데이터분석기사 준비</p>
                <p class="text-[11px] text-slate-600 mt-0.5">AI공학 전공 맞춤 자격증 로드맵을 확인해보세요.</p>
            </div>
        </div>`;
    } else {
        html += `
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 opacity-90">
            <div class="text-emerald-500"><i class="fa-solid fa-circle-check text-lg"></i></div>
            <p class="text-xs font-bold text-slate-800">자격증: ${cert} (보유 중)</p>
        </div>`;
    }

    // 대외활동 추천
    if (!extra) {
        html += `
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 shadow-xs">
            <div class="mt-0.5 text-amber-500"><i class="fa-solid fa-users text-lg"></i></div>
            <div>
                <p class="text-xs font-bold text-slate-800">대외활동: AI 해커톤/경진대회</p>
                <p class="text-[11px] text-slate-600 mt-0.5">DACON 경진대회 또는 교내 학술 동아리 참가를 권장합니다.</p>
            </div>
        </div>`;
    } else {
        html += `
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 opacity-90">
            <div class="text-emerald-500"><i class="fa-solid fa-circle-check text-lg"></i></div>
            <p class="text-xs font-bold text-slate-800">대외활동: ${extra} (활동 중)</p>
        </div>`;
    }

    container.innerHTML = html;
}

// 차트 렌더링 함수
function initChartsWithData() {
    const { maxGpa, gpa, credits, totalCredits, lang, cert, extra } = globalSpecData;

    const gpaScore = Math.min(100, Math.round((gpa / maxGpa) * 100));
    const creditScore = Math.min(100, Math.round((credits / totalCredits) * 100));
    const langScore = lang ? 85 : 0;
    const certScore = cert ? 90 : 0;
    const extraScore = extra ? 85 : 0;

    // 상단 뱃지 & 달성도
    const badgeGpa = document.getElementById('badgeGpa');
    if (badgeGpa) badgeGpa.innerHTML = `<i class="fa-solid fa-star"></i> GPA ${gpa} / ${maxGpa}`;

    const overall = Math.round((gpaScore + creditScore + langScore + certScore + extraScore) / 5);
    const overallElem = document.getElementById('overallAchievement');
    if (overallElem) overallElem.innerText = overall + '%';

    // 졸업 학점 현황 텍스트
    const dispCredits = document.getElementById('display-credits');
    const dispTotalCredits = document.getElementById('display-total-credits');
    if (dispCredits) dispCredits.innerText = credits;
    if (dispTotalCredits) dispTotalCredits.innerText = `/ ${totalCredits}`;

    // 부족 학점 경고 박스
    const remainCredits = Math.max(0, totalCredits - credits);
    const alertTitle = document.getElementById('creditAlertTitle');
    const alertDesc = document.getElementById('creditAlertDesc');
    if (remainCredits === 0) {
        alertTitle.innerHTML = `<i class="fa-solid fa-circle-check"></i> 졸업 이수 학점을 모두 채웠습니다!`;
        alertDesc.innerText = `총 요구 학점을 완전히 충족하셨습니다. 학점 이수 완료!`;
    } else {
        alertTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> 졸업까지 ${remainCredits}학점이 부족합니다!`;
        alertDesc.innerText = `정시 졸업을 위해 계절학기 또는 잔여 학기 수강 신청을 확인하세요.`;
    }

    // 1. 역량 분석 5각형 레이더 차트
    const radarCanvas = document.getElementById('specRadarChart');
    if (radarCanvas) {
        const radarCtx = radarCanvas.getContext('2d');
        if (radarChartInstance) radarChartInstance.destroy();

        radarChartInstance = new Chart(radarCtx, {
            type: 'radar',
            data: {
                labels: ['학점(GPA)', '이수학점', '어학성적', '자격증', '대외활동'],
                datasets: [
                    {
                        label: '내 역량 진단 스탯',
                        data: [gpaScore, creditScore, langScore, certScore, extraScore],
                        backgroundColor: 'rgba(6, 182, 212, 0.25)',
                        borderColor: '#06b6d4',
                        borderWidth: 2.5,
                        pointBackgroundColor: '#06b6d4',
                        pointHoverRadius: 6
                    },
                    {
                        label: '권장 기준 스탯 (AI/데이터 직무)',
                        data: [80, 85, 75, 85, 80],
                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                        borderColor: '#f59e0b',
                        borderWidth: 2,
                        borderDash: [4, 4],
                        pointBackgroundColor: '#f59e0b'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: '#e2e8f0' },
                        grid: { color: '#cbd5e1' },
                        pointLabels: {
                            color: '#334155',
                            font: { size: 11, weight: 'bold', family: 'Pretendard' }
                        },
                        ticks: { display: false },
                        min: 0,
                        max: 100
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 10, font: { size: 11, family: 'Pretendard' } }
                    }
                }
            }
        });
    }

    // 2. 8학기 학점 추이 꺾은선 차트
    const gpaCanvas = document.getElementById('gpaLineChart');
    if (gpaCanvas) {
        const gpaCtx = gpaCanvas.getContext('2d');
        if (lineChartInstance) lineChartInstance.destroy();

        let labels = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'];
        let chartData = (globalSpecData.semesterGrades && globalSpecData.semesterGrades.length === 8)
            ? globalSpecData.semesterGrades
            : [3.5, 3.65, 3.7, 3.8, 3.85, 3.9, null, null];

        lineChartInstance = new Chart(gpaCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `학기별 평점 (만점 ${maxGpa})`,
                    data: chartData,
                    borderColor: '#3b82f6',
                    borderWidth: 3,
                    fill: true,
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    tension: 0.35,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#2563eb',
                    spanGaps: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        min: 0,
                        max: maxGpa,
                        grid: { color: '#f1f5f9' },
                        ticks: { font: { size: 10 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 } }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // 3. 졸업 이수 학점 도넛 게이지 차트
    const creditCanvas = document.getElementById('creditGaugeChart');
    if (creditCanvas) {
        const creditCtx = creditCanvas.getContext('2d');
        if (gaugeChartInstance) gaugeChartInstance.destroy();

        gaugeChartInstance = new Chart(creditCtx, {
            type: 'doughnut',
            data: {
                labels: ['이수 완료', '부족 학점'],
                datasets: [{
                    data: [credits, remainCredits],
                    backgroundColor: ['#06b6d4', '#e2e8f0'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                rotation: -90,
                circumference: 180,
                cutout: '78%',
                plugins: { legend: { display: false } }
            }
        });
    }
}

// 레이더 기준 변경 핸들러
function updateRadarChart(val) {
    if (!radarChartInstance) return;
    let targetDataset = [75, 80, 70, 70, 70];
    let label = '권장 기준 스탯';

    if (val === 'backend') {
        targetDataset = [75, 85, 70, 90, 80];
        label = '권장 기준 스탯 (SW 백엔드)';
    } else if (val === 'ai') {
        targetDataset = [85, 85, 80, 95, 85];
        label = '권장 기준 스탯 (AI/데이터 엔지니어)';
    }

    radarChartInstance.data.datasets[1].data = targetDataset;
    radarChartInstance.data.datasets[1].label = label;
    radarChartInstance.update();
    showToast(`${label}으로 기준이 변경되었습니다.`);
}

// ==========================================
// 9. 곰두리 펫 인터랙션 로직
// ==========================================
function updateDuriUI() {
    const fVal = document.getElementById('fullnessVal');
    const fBar = document.getElementById('fullnessBar');
    const eVal = document.getElementById('expVal');
    const eBar = document.getElementById('expBar');
    const dLevel = document.getElementById('duriLevel');
    const cCount = document.getElementById('coinCount');

    if (fVal) fVal.innerText = duriState.fullness + '%';
    if (fBar) fBar.style.width = duriState.fullness + '%';
    if (eVal) eVal.innerText = duriState.exp + '%';
    if (eBar) eBar.style.width = duriState.exp + '%';
    if (dLevel) dLevel.innerText = `(Lv. ${duriState.level})`;
    if (cCount) cCount.innerText = `${duriState.coins} COIN`;
}

function triggerSpeech(text) {
    const bubble = document.getElementById('speechBubble');
    if (!bubble) return;
    bubble.innerText = text;
    bubble.classList.remove('opacity-0');
    bubble.classList.add('opacity-100');
    setTimeout(() => {
        bubble.classList.remove('opacity-100');
        bubble.classList.add('opacity-0');
    }, 2500);
}

function feedDuri() {
    if (duriState.coins < 10) {
        showToast('코인이 부족합니다! 공부를 해서 코인을 모아보세요.');
        return;
    }
    duriState.coins -= 10;
    duriState.fullness = Math.min(100, duriState.fullness + 15);
    updateDuriUI();
    triggerSpeech('냠냠! 데이터가 아주 맛있어! 🍬');
    showToast('곰두리에게 데이터 먹이를 주었습니다. (-10 COIN)');
}

function studyDuri() {
    duriState.exp += 15;
    duriState.fullness = Math.max(0, duriState.fullness - 10);
    duriState.coins += 20;

    if (duriState.exp >= 100) {
        duriState.level += 1;
        duriState.exp = duriState.exp - 100;
        triggerSpeech('🎉 레벨 업! 더 똑똑해졌어!');
        showToast(`축하합니다! 곰두리가 Lv.${duriState.level}(으)로 성장했습니다!`);
    } else {
        triggerSpeech('열심히 파이썬 딥러닝 공부 중... 💻');
        showToast('공부를 완료하여 +20 COIN 및 학습 경험치를 획득했습니다.');
    }
    updateDuriUI();
}

function sleepDuri() {
    duriState.fullness = Math.min(100, duriState.fullness + 5);
    triggerSpeech('딥러닝 꿈을 꾸며 낮잠 자는 중... 💤');
    showToast('곰두리가 휴식을 취하고 에너지를 회복했습니다.');
    updateDuriUI();
}

function petDuri() {
    const avatar = document.getElementById('duriAvatar');
    if (avatar) {
        avatar.classList.add('scale-125', 'rotate-6');
        setTimeout(() => {
            avatar.classList.remove('scale-125', 'rotate-6');
        }, 300);
    }
    triggerSpeech('기분 좋아! 쓰다듬어줘서 고마워 💛');
}

// ==========================================
// 10. 초기 로딩 및 세션 복원
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    // 1. 자격증 및 합격사례 초기 렌더링
    filterCerts('all');

    // 2. 세션 스토리지 복원 (로그인 제거: 스펙 데이터만 복원)
    const savedSpec = sessionStorage.getItem('campus_spec_data');

    if (savedSpec) {
        try {
            globalSpecData = JSON.parse(savedSpec);
            // 이전에 스펙을 입력한 적이 있으면 입력 모달을 건너뛰고 대시보드로 바로 이동
            const specModal = document.getElementById('screen-spec-input');
            if (specModal) specModal.classList.add('hidden');
        } catch (e) {
            console.error('스펙 데이터 복원 오류:', e);
        }
    }

    // 3. 차트 & 추천경로 렌더링
    initChartsWithData();
    renderRecommendations();
    updateDuriUI();
});
