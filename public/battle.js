/**
 * 곰두리 전투 스탯 공식 (곰두리 키우기 / 성적관리 화면에서 공통 사용)
 *
 * 체력(HP)   = 평균학점 × 이수학점 → 소수점 첫째 자리에서 반올림  (예: 4.36 × 60 = 261.6 → 262)
 * 공격력(ATK) = 어학점수 × 0.05 + 자격증 점수                      (예: 600점 + 운전면허 = 35)
 * 자격증 점수: 운전면허 +5, SQLD +10 (그 외 0점)
 */
const LANG_RATE = 0.05;

function certPoint(name) {
    const n = String(name).replace(/\s+/g, '').toUpperCase();
    if (n.startsWith('운전면허')) return 5;
    if (n === 'SQLD') return 10;
    return 0;
}

function calcStats({ gpa, credits, langScore, certs }) {
    const raw = String(langScore == null ? '' : langScore).trim();
    const langNum = /^\d+(\.\d+)?$/.test(raw) ? parseFloat(raw) : 0;   // 숫자가 아닌 성적(OPIc 등)은 0점
    const langPoint = langNum * LANG_RATE;
    const certTotal = (certs || []).reduce((sum, c) => sum + certPoint(c), 0);
    return { hp: Math.round(gpa * (Number(credits) || 0)), langPoint, certTotal, atk: langPoint + certTotal };
}

function fmtNum(n) { return String(+n.toFixed(1)); }
