#!/usr/bin/env python3
"""
캠퍼스 스펙 트래커 백엔드 (표준 라이브러리만 사용, Python 3.9+)

- public/ 폴더만 정적 서빙 (server.py, .env, DB, 문서는 외부에 노출되지 않음)
- @kangwon.ac.kr 이메일 인증코드 로그인 (HttpOnly 세션 쿠키)
- 학생 스펙 / 곰두리 상태를 SQLite에 저장
- 네이버 뉴스 검색 프록시 (로그인 사용자만, 키는 서버 환경변수에서만 읽음)

환경변수(.env 파일 지원) 목록은 .env.example 참고.
"""

import hashlib
import hmac
import http.server
import json
import os
import re
import secrets
import smtplib
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage
from http import cookies

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")


# ------------------------------------------------------------------
# 설정
# ------------------------------------------------------------------
def load_dotenv(path):
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


load_dotenv(os.path.join(BASE_DIR, ".env"))

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
# guest: 이메일 인증 없이 브라우저마다 익명 세션 자동 발급 / email: @kangwon.ac.kr 인증코드 로그인
LOGIN_MODE = os.environ.get("LOGIN_MODE", "guest").strip().lower()
GUEST_MAX_PER_HOUR_IP = 100
# 게스트 기록은 페이지를 닫으면 삭제된다:
#  - 페이지가 열려 있는 동안 클라이언트가 주기적으로 신호(ping)를 보낸다
#  - 닫을 때 '떠남' 신호(leave)를 보내고, GRACE 초 안에 다시 열리지 않으면 삭제 (페이지 이동/새로고침은 유지)
#  - 신호가 STALE 초 이상 끊긴 게스트도 삭제 (브라우저 강제 종료 등)
GUEST_LEAVE_GRACE = int(os.environ.get("GUEST_LEAVE_GRACE", "10"))
GUEST_STALE = int(os.environ.get("GUEST_STALE", "180"))
GUEST_SWEEP_SEC = int(os.environ.get("GUEST_SWEEP_SEC", "5"))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "data", "app.db"))
ALLOWED_EMAIL_DOMAIN = os.environ.get("ALLOWED_EMAIL_DOMAIN", "kangwon.ac.kr").lower()
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "0") == "1"  # HTTPS 운영 시 1
# 프록시(Vercel rewrite 등) 뒤에서 운영할 때:
#  TRUST_PROXY=1      → 요청 제한용 IP를 X-Forwarded-For 첫 번째 값(실제 접속자)으로 사용
#  ALLOWED_ORIGINS    → 쓰기 요청(POST/PUT)을 허용할 화면 주소들 (예: https://clc.vercel.app), 쉼표 구분
TRUST_PROXY = os.environ.get("TRUST_PROXY", "0") == "1"
ALLOWED_ORIGINS = {o.strip().lower().rstrip("/") for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()}
_IP_RE = re.compile(r"^[0-9a-fA-F:.]{2,45}$")

NAVER_AUTH_TYPE = os.environ.get("NAVER_AUTH_TYPE", "ncp").lower()  # ncp | developers
NAVER_CLIENT_ID = os.environ.get("NAVER_CLIENT_ID", "")
NAVER_CLIENT_SECRET = os.environ.get("NAVER_CLIENT_SECRET", "")

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER)

CODE_TTL = 10 * 60            # 인증코드 유효시간 10분
CODE_MAX_ATTEMPTS = 5         # 코드당 입력 시도 횟수
CODE_RESEND_INTERVAL = 60     # 같은 이메일 재요청 간격(초)
CODE_MAX_PER_HOUR_IP = 20     # IP당 시간당 코드 요청 수
SESSION_TTL = 7 * 24 * 3600   # 세션 7일
NEWS_CACHE_TTL = 10 * 60      # 뉴스 캐시 10분
MAX_BODY = 64 * 1024

EMAIL_RE = re.compile(r"^[a-z0-9._%+-]{1,64}@" + re.escape(ALLOWED_EMAIL_DOMAIN) + r"$")


# ------------------------------------------------------------------
# DB
# ------------------------------------------------------------------
_db_lock = threading.Lock()


def db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with db() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                created_at INTEGER NOT NULL,
                last_login_at INTEGER
            );
            CREATE TABLE IF NOT EXISTS login_codes (
                email TEXT PRIMARY KEY,
                code_hash TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS code_requests (
                ip TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                expires_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS user_data (
                user_id INTEGER NOT NULL REFERENCES users(id),
                kind TEXT NOT NULL,
                json TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (user_id, kind)
            );
            CREATE TABLE IF NOT EXISTS job_posts (
                link TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                company TEXT,
                role TEXT,
                certs TEXT NOT NULL,
                passer INTEGER NOT NULL DEFAULT 0,
                pub_date TEXT,
                source TEXT,
                score INTEGER NOT NULL,
                verdict TEXT NOT NULL,
                reasons TEXT NOT NULL,
                fetched_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS guest_presence (
                user_id INTEGER PRIMARY KEY REFERENCES users(id),
                last_seen INTEGER NOT NULL,
                leaving_at INTEGER
            );
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )


def sha256(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


# ------------------------------------------------------------------
# 이메일 발송
# ------------------------------------------------------------------
def send_login_code(email, code):
    if not SMTP_HOST:
        # 개발 모드: 실제 발송 대신 서버 콘솔에만 출력 (응답에는 절대 포함하지 않음)
        print(f"[DEV MAIL] {email} 인증코드: {code} (SMTP 미설정 - 콘솔 출력)", flush=True)
        return True
    msg = EmailMessage()
    msg["Subject"] = "[캠퍼스 스펙 트래커] 로그인 인증코드"
    msg["From"] = SMTP_FROM
    msg["To"] = email
    msg.set_content(
        f"인증코드: {code}\n\n10분 안에 입력해 주세요.\n"
        "본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다."
    )
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as s:
            s.starttls()
            if SMTP_USER:
                s.login(SMTP_USER, SMTP_PASSWORD)
            s.send_message(msg)
        return True
    except Exception as e:  # noqa: BLE001
        print(f"[MAIL ERROR] {email}: {e}", flush=True)
        return False


# ------------------------------------------------------------------
# 네이버 뉴스
# ------------------------------------------------------------------
_news_cache = {}
_news_lock = threading.Lock()

KNOWN_COMPANIES = [
    ("삼성", "finance"), ("네이버", "data"), ("카카오", "data"), ("토스", "finance"),
    ("현대자동차", "data"), ("현대차", "data"), ("신한", "finance"), ("라인", "dev"),
    ("쿠팡", "data"), ("당근", "dev"), ("SK", "dev"), ("LG", "data"),
    ("배달의민족", "dev"), ("우아한형제들", "dev"), ("한화", "finance"), ("KB", "finance"),
]
KNOWN_CERTS = ["빅데이터분석기사", "ADsP", "ADP", "SQLD", "SQLP", "정보처리기사", "AWS",
               "AICE", "리눅스마스터", "정보보안기사"]
# 뉴스 필터: 제목/요약에 이 중 하나라도 포함된 기사만 노출 (AI·데이터 관련 자격증)
NEWS_FILTER_CERTS = ["빅데이터분석기사", "ADsP", "ADP", "SQLD", "SQLP", "정보처리기사", "AICE",
                     "데이터분석 준전문가", "데이터분석준전문가"]
CATEGORY_QUERIES = {
    "all": "IT AI 데이터 채용 자격증",
    "data": "AI 데이터 사이언티스트 빅데이터분석기사 채용",
    "finance": "금융 IT 은행 증권 채용 SQLD ADsP",
    "dev": "소프트웨어 백엔드 개발자 정보처리기사 채용",
}


def call_naver_news(query, display=15, sort="date"):
    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        return {"status_code": 503, "error": "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다."}
    q = urllib.parse.urlencode({"query": query, "display": display, "start": 1, "sort": sort})
    if NAVER_AUTH_TYPE == "developers":
        url = "https://openapi.naver.com/v1/search/news.json?" + q
        headers = {"X-Naver-Client-Id": NAVER_CLIENT_ID, "X-Naver-Client-Secret": NAVER_CLIENT_SECRET}
    else:
        url = "https://naverapihub.apigw.ntruss.com/search/v1/news?" + q
        headers = {"X-NCP-APIGW-API-KEY-ID": NAVER_CLIENT_ID, "X-NCP-APIGW-API-KEY": NAVER_CLIENT_SECRET}
    headers["User-Agent"] = "CampusSpecTracker/1.0"
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=7) as r:
            return {"status_code": r.getcode(), "data": json.loads(r.read().decode("utf-8"))}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        print(f"[NAVER] HTTP {e.code}: {body[:300]}", flush=True)
        return {"status_code": e.code, "error": "네이버 API 인증 또는 요청 오류"}
    except Exception as e:  # noqa: BLE001
        print(f"[NAVER] {e}", flush=True)
        return {"status_code": 502, "error": "네이버 API 통신 실패"}


def strip_tags(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    return (s.replace("&quot;", '"').replace("&amp;", "&").replace("&lt;", "<")
             .replace("&gt;", ">").replace("&apos;", "'"))


def structure_news(items):
    """기사에서 실제로 발견된 값만 반환. 못 찾으면 비워 둔다(임의 채움 금지)."""
    out = []
    for it in items:
        title = strip_tags(it.get("title"))
        desc = strip_tags(it.get("description"))
        text = f"{title} {desc}"
        company = next((c for c, _ in KNOWN_COMPANIES if c in text), None)
        certs = [c for c in KNOWN_CERTS if c.lower() in text.lower()]
        if not any(c.lower() in text.lower() for c in NEWS_FILTER_CERTS):
            continue
        link = it.get("originallink") or it.get("link") or ""
        if not link.startswith(("http://", "https://")):
            link = ""
        out.append({
            "title": title,
            "company": company,
            "certs": certs,
            "pubDate": it.get("pubDate", ""),
            "link": link,
        })
    return out



# ------------------------------------------------------------------
# 채용정보 수집 + 신뢰도 판별 (규칙 기반, 외부 AI API 불필요)
# ------------------------------------------------------------------
JOB_REFRESH_INTERVAL = 7 * 24 * 3600   # 일주일마다 최신화
JOB_QUERIES = [
    "IT 채용 합격자 자격증", "데이터 분석가 신입 채용 자격증", "개발자 신입 채용 정보처리기사",
    "AI 엔지니어 채용 우대 자격증", "SQLD ADsP 합격 채용", "빅데이터분석기사 취득 채용",
]
HIRING_WORDS = ["채용", "공채", "신입", "인턴", "입사", "합격", "우대", "취업"]
PASSER_WORDS = ["합격자", "합격생", "합격 후기", "합격한", "보유", "취득자", "취득한", "취득 후"]
COMPANY_SUFFIX_RE = re.compile(r"([가-힣A-Za-z0-9]{2,10}(?:전자|증권|은행|카드|화재|생명|건설|제약|통신|텔레콤|그룹|랩스|테크|소프트|시스템즈|게임즈))")
ROLE_KEYWORDS = [
    ("데이터 사이언티스트", ["데이터 사이언티스트", "데이터사이언티스트", "데이터 과학자"]),
    ("데이터 분석가", ["데이터 분석가", "데이터분석가", "데이터 분석", "데이터분석"]),
    ("데이터 엔지니어", ["데이터 엔지니어", "데이터엔지니어"]),
    ("AI/ML 엔지니어", ["AI 엔지니어", "AI엔지니어", "머신러닝", "AI 개발자", "인공지능 개발"]),
    ("백엔드 개발자", ["백엔드"]),
    ("프론트엔드 개발자", ["프론트엔드"]),
    ("정보보안", ["정보보안", "보안 담당", "보안 엔지니어"]),
    ("클라우드/인프라", ["클라우드", "인프라", "DevOps", "데브옵스"]),
    ("소프트웨어 개발자", ["소프트웨어 개발", "SW 개발", "개발자"]),
]
TRUSTED_DOMAINS = {
    "yna.co.kr", "news1.kr", "newsis.com", "chosun.com", "joongang.co.kr", "donga.com", "hani.co.kr",
    "khan.co.kr", "hankyung.com", "mk.co.kr", "sedaily.com", "edaily.co.kr", "mt.co.kr", "fnnews.com",
    "etnews.com", "zdnet.co.kr", "bloter.net", "kbs.co.kr", "mbc.co.kr", "imbc.com", "sbs.co.kr",
    "ytn.co.kr", "jtbc.co.kr", "heraldcorp.com", "asiae.co.kr", "ajunews.com", "kmib.co.kr",
    "segye.com", "munhwa.com", "hankookilbo.com", "nocutnews.co.kr", "ohmynews.com", "it.chosun.com",
    "dt.co.kr", "inews24.com", "datanet.co.kr", "ddaily.co.kr", "digitaltoday.co.kr", "biz.chosun.com",
}
LOW_TRUST_DOMAINS = ("blog.naver.com", "cafe.naver.com", "tistory.com", "brunch.co.kr", "velog.io",
                     "post.naver.com", "blog.me", "modoo.at", "youtube.com", "instagram.com")
AD_PATTERNS = re.compile(r"(수강생\s*모집|수강료|학원|할인|이벤트|광고|협찬|보증|100%\s*합격|무조건\s*합격|합격\s*보장|환급|특가|선착순|무료\s*강의|\[AD\]|\(AD\))", re.I)
CLICKBAIT_PATTERNS = re.compile(r"(충격|경악|난리|알고\s*보니|헉|ㄷㄷ|ㅋㅋ|소름|대박|!{2,}|\?{2,}|\.{4,}|이럴 수가)")


def _domain(url):
    try:
        host = urllib.parse.urlparse(url).netloc.lower().split(":")[0]
    except Exception:  # noqa: BLE001
        return ""
    return host[4:] if host.startswith("www.") else host


def _domain_in(host, domains):
    return any(host == d or host.endswith("." + d) for d in domains)


def assess_credibility(text, host, company, role):
    """0~100 신뢰도 점수와 근거를 반환. 광고·낚시·개인 블로그는 낮은 점수."""
    score, reasons = 50, []
    if _domain_in(host, TRUSTED_DOMAINS):
        score += 30; reasons.append("주요 언론사 출처")
    elif any(host == d or host.endswith(d) for d in LOW_TRUST_DOMAINS):
        score -= 25; reasons.append("개인 블로그/SNS 출처")
    else:
        reasons.append("검증되지 않은 출처")
    ads = AD_PATTERNS.findall(text)
    if ads:
        score -= 40; reasons.append("광고·홍보성 표현: " + ", ".join(sorted({a if isinstance(a, str) else a[0] for a in ads})[:3]))
    if CLICKBAIT_PATTERNS.search(text):
        score -= 20; reasons.append("자극적·낚시성 표현")
    if company:
        score += 5; reasons.append("기업명 확인")
    if role:
        score += 5; reasons.append("직무 확인")
    return score, reasons


def extract_job_info(title, desc):
    text = f"{title} {desc}"
    company = next((c for c, _ in KNOWN_COMPANIES if c in text), None)
    if not company:
        m = COMPANY_SUFFIX_RE.search(text)
        company = m.group(1) if m else None
    role = next((name for name, kws in ROLE_KEYWORDS if any(k.lower() in text.lower() for k in kws)), None)
    certs = [c for c in KNOWN_CERTS if c.lower() in text.lower()]
    passer = any(w in text for w in PASSER_WORDS)
    return company, role, certs, passer


def refresh_jobs():
    """네이버 뉴스에서 채용정보를 수집해 DB에 저장. 성공한 질의가 하나라도 있으면 True."""
    if not (NAVER_CLIENT_ID and NAVER_CLIENT_SECRET):
        return False
    collected, ok_queries = {}, 0
    for q in JOB_QUERIES:
        res = call_naver_news(q, display=100)
        if res["status_code"] != 200:
            continue
        ok_queries += 1
        for it in res["data"].get("items", []):
            link = it.get("originallink") or it.get("link") or ""
            if not link.startswith(("http://", "https://")) or link in collected:
                continue
            title, desc = strip_tags(it.get("title")), strip_tags(it.get("description"))
            text = f"{title} {desc}"
            if not any(c.lower() in text.lower() for c in NEWS_FILTER_CERTS):
                continue
            if not any(w in text for w in HIRING_WORDS):
                continue
            company, role, certs, passer = extract_job_info(title, desc)
            host = _domain(link)
            score, reasons = assess_credibility(text, host, company, role)
            collected[link] = {"title": title, "company": company, "role": role, "certs": certs,
                               "passer": passer, "pub_date": it.get("pubDate", ""), "host": host,
                               "score": score, "reasons": reasons}
    if not ok_queries:
        return False
    # 교차 검증: 같은 (기업, 자격증) 조합을 서로 다른 매체 2곳 이상이 보도하면 가점
    groups = {}
    for v in collected.values():
        if v["company"]:
            for c in v["certs"]:
                groups.setdefault((v["company"], c), set()).add(v["host"])
    for v in collected.values():
        if any(v["company"] and len(groups.get((v["company"], c), ())) >= 2 for c in v["certs"]):
            v["score"] += 15; v["reasons"].append("복수 매체 교차 보도")
    now = int(time.time())
    with _db_lock, db() as conn:
        conn.execute("DELETE FROM job_posts")
        for link, v in collected.items():
            score = max(0, min(100, v["score"]))
            verdict = "trusted" if score >= 65 else ("review" if score >= 40 else "rejected")
            conn.execute(
                "INSERT INTO job_posts (link, title, company, role, certs, passer, pub_date, source, score, verdict, reasons, fetched_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (link, v["title"], v["company"], v["role"], json.dumps(v["certs"], ensure_ascii=False),
                 1 if v["passer"] else 0, v["pub_date"], v["host"], score, verdict,
                 json.dumps(v["reasons"], ensure_ascii=False), now))
        conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('jobs_last_refresh', ?)", (str(now),))
    print(f"[JOBS] 갱신 완료: {len(collected)}건 수집", flush=True)
    return True


_refresh_lock = threading.Lock()


def refresh_jobs_safe():
    if not _refresh_lock.acquire(blocking=False):
        return False
    try:
        return refresh_jobs()
    except Exception as e:  # noqa: BLE001
        print(f"[JOBS] 갱신 실패: {e}", flush=True)
        return False
    finally:
        _refresh_lock.release()


def jobs_last_refresh():
    with db() as conn:
        row = conn.execute("SELECT value FROM meta WHERE key = 'jobs_last_refresh'").fetchone()
    return int(row["value"]) if row else 0


def job_refresher_loop():
    """1시간마다 확인해 마지막 갱신 후 7일이 지났으면 최신화 (키 미설정 시 설정될 때까지 대기)."""
    while True:
        try:
            if time.time() - jobs_last_refresh() >= JOB_REFRESH_INTERVAL:
                refresh_jobs_safe()
        except Exception as e:  # noqa: BLE001
            print(f"[JOBS] {e}", flush=True)
        time.sleep(3600)


def touch_guest(conn, user_id):
    """게스트가 열려 있음을 기록하고 '떠남' 표시를 해제한다."""
    conn.execute("INSERT OR REPLACE INTO guest_presence (user_id, last_seen, leaving_at) VALUES (?, ?, NULL)",
                 (user_id, int(time.time())))


def purge_guests():
    """페이지를 닫은(또는 신호가 끊긴) 게스트의 계정·스펙·세션을 모두 삭제."""
    now = int(time.time())
    with _db_lock, db() as conn:
        rows = conn.execute(
            "SELECT u.id FROM users u LEFT JOIN guest_presence g ON g.user_id = u.id "
            "WHERE u.email LIKE 'guest-%' AND ("
            "  (g.leaving_at IS NOT NULL AND g.leaving_at < ?) "
            "  OR COALESCE(g.last_seen, u.created_at) < ?)",
            (now - GUEST_LEAVE_GRACE, now - GUEST_STALE)).fetchall()
        for r in rows:
            uid = r["id"]
            conn.execute("DELETE FROM user_data WHERE user_id = ?", (uid,))
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (uid,))
            conn.execute("DELETE FROM guest_presence WHERE user_id = ?", (uid,))
            conn.execute("DELETE FROM users WHERE id = ?", (uid,))
    if rows:
        print(f"[GUEST] 게스트 기록 {len(rows)}건 삭제", flush=True)


def guest_purge_loop():
    while True:
        try:
            purge_guests()
        except Exception as e:  # noqa: BLE001
            print(f"[GUEST] 정리 실패: {e}", flush=True)
        time.sleep(GUEST_SWEEP_SEC)


def save_env_values(values):
    """.env 의 해당 키만 갱신(다른 줄 보존). 값은 호출 전에 검증되어 있어야 한다."""
    path = os.path.join(BASE_DIR, ".env")
    lines = []
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()
    done = set()
    for i, line in enumerate(lines):
        k = line.split("=", 1)[0].strip()
        if "=" in line and not line.lstrip().startswith("#") and k in values:
            lines[i] = f"{k}={values[k]}"; done.add(k)
    for k, v in values.items():
        if k not in done:
            lines.append(f"{k}={v}")
    tmp = path + ".tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    os.replace(tmp, path)


# ------------------------------------------------------------------
# HTTP 핸들러
# ------------------------------------------------------------------
class Handler(http.server.SimpleHTTPRequestHandler):
    server_version = "CampusSpecTracker"
    sys_version = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    # ---- 공통 ----
    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        if not self.path.startswith("/api/"):
            # 배포 후 바뀐 JS/HTML이 즉시 반영되도록 매번 재검증 (변경 없으면 304)
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def client_ip(self):
        """요청 제한·로그용 접속자 IP. TRUST_PROXY=1 이면 프록시가 전달한 실제 접속자 IP를 사용."""
        if TRUST_PROXY:
            # Cloudflare 는 CF-Connecting-IP 를 항상 덮어써서 위조할 수 없다 → 우선 사용
            cf = (self.headers.get("CF-Connecting-IP") or "").strip()
            if _IP_RE.match(cf):
                return cf
            first = (self.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
            if _IP_RE.match(first):
                return first
        return self.client_address[0]

    def send_json(self, status, payload, extra_headers=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra_headers or []):
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:  # noqa: BLE001
            return None

    def same_origin(self):
        """쓰기 요청 CSRF 방어: Origin이 있으면 Host와 일치해야 함."""
        origin = self.headers.get("Origin")
        if not origin:
            return True
        if origin.lower().rstrip("/") in ALLOWED_ORIGINS:
            return True
        host = self.headers.get("Host", "")
        return urllib.parse.urlparse(origin).netloc == host

    def current_user(self):
        raw = self.headers.get("Cookie")
        if not raw:
            return None
        c = cookies.SimpleCookie()
        try:
            c.load(raw)
        except cookies.CookieError:
            return None
        if "sid" not in c:
            return None
        th = sha256(c["sid"].value)
        with db() as conn:
            row = conn.execute(
                "SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id "
                "WHERE s.token_hash = ? AND s.expires_at > ?", (th, int(time.time()))
            ).fetchone()
        return dict(row) if row else None

    def session_cookie(self, token, max_age):
        parts = [f"sid={token}", "Path=/", "HttpOnly", "SameSite=Lax"]
        if max_age is not None:          # None = 세션 쿠키 (브라우저를 닫으면 사라짐)
            parts.append(f"Max-Age={max_age}")
        if COOKIE_SECURE:
            parts.append("Secure")
        return "; ".join(parts)

    # ---- 라우팅 ----
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith("/api/"):
            if path == "/api/me":
                return self.api_me()
            if path == "/api/data":
                return self.api_get_data()
            if path == "/api/news":
                return self.api_news()
            if path == "/api/jobs":
                return self.api_jobs()
            if path == "/api/admin/naver-keys":
                return self.api_get_keys()
            return self.send_json(404, {"error": "not found"})
        if path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_HEAD(self):
        if urllib.parse.urlparse(self.path).path.startswith("/api/"):
            return self.send_json(405, {"error": "method not allowed"})
        return super().do_HEAD()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if not self.same_origin():
            return self.send_json(403, {"error": "잘못된 요청 출처입니다."})
        routes = {
            "/api/auth/request-code": self.api_request_code,
            "/api/auth/verify": self.api_verify,
            "/api/auth/logout": self.api_logout,
            "/api/admin/naver-keys": self.api_set_keys,
            "/api/guest/ping": self.api_guest_ping,
            "/api/guest/leave": self.api_guest_leave,
        }
        if path in routes:
            return routes[path]()
        return self.send_json(404, {"error": "not found"})

    def do_PUT(self):
        path = urllib.parse.urlparse(self.path).path
        if not self.same_origin():
            return self.send_json(403, {"error": "잘못된 요청 출처입니다."})
        if path == "/api/data":
            return self.api_put_data()
        return self.send_json(404, {"error": "not found"})

    # ---- 인증 ----
    def api_request_code(self):
        body = self.read_json() or {}
        email = str(body.get("email", "")).strip().lower()
        if not EMAIL_RE.match(email):
            return self.send_json(400, {"error": f"@{ALLOWED_EMAIL_DOMAIN} 학교 이메일만 사용할 수 있습니다."})
        now = int(time.time())
        with _db_lock, db() as conn:
            conn.execute("DELETE FROM code_requests WHERE created_at < ?", (now - 3600,))
            n = conn.execute("SELECT COUNT(*) FROM code_requests WHERE ip = ?", (self.client_ip(),)).fetchone()[0]
            if n >= CODE_MAX_PER_HOUR_IP:
                return self.send_json(429, {"error": "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."})
            prev = conn.execute("SELECT created_at FROM login_codes WHERE email = ?", (email,)).fetchone()
            if prev and now - prev["created_at"] < CODE_RESEND_INTERVAL:
                wait = CODE_RESEND_INTERVAL - (now - prev["created_at"])
                return self.send_json(429, {"error": f"{wait}초 후에 다시 요청해 주세요."})
            code = f"{secrets.randbelow(1000000):06d}"
            conn.execute(
                "INSERT OR REPLACE INTO login_codes (email, code_hash, expires_at, attempts, created_at) "
                "VALUES (?, ?, ?, 0, ?)", (email, sha256(email + ":" + code), now + CODE_TTL, now)
            )
            conn.execute("INSERT INTO code_requests (ip, created_at) VALUES (?, ?)", (self.client_ip(), now))
        if not send_login_code(email, code):
            return self.send_json(502, {"error": "인증 메일 발송에 실패했습니다. 관리자에게 문의해 주세요."})
        return self.send_json(200, {"ok": True, "message": "인증코드를 메일로 보냈습니다."})

    def api_verify(self):
        body = self.read_json() or {}
        email = str(body.get("email", "")).strip().lower()
        code = re.sub(r"\D", "", str(body.get("code", "")))
        if not EMAIL_RE.match(email) or len(code) != 6:
            return self.send_json(400, {"error": "이메일 또는 인증코드 형식이 올바르지 않습니다."})
        now = int(time.time())
        with _db_lock, db() as conn:
            row = conn.execute("SELECT * FROM login_codes WHERE email = ?", (email,)).fetchone()
            if not row or row["expires_at"] < now:
                return self.send_json(400, {"error": "인증코드가 만료되었습니다. 다시 요청해 주세요."})
            if row["attempts"] >= CODE_MAX_ATTEMPTS:
                conn.execute("DELETE FROM login_codes WHERE email = ?", (email,))
                return self.send_json(400, {"error": "입력 횟수를 초과했습니다. 코드를 다시 요청해 주세요."})
            if not hmac.compare_digest(row["code_hash"], sha256(email + ":" + code)):
                conn.execute("UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?", (email,))
                left = CODE_MAX_ATTEMPTS - row["attempts"] - 1
                return self.send_json(400, {"error": f"인증코드가 일치하지 않습니다. (남은 시도 {left}회)"})
            conn.execute("DELETE FROM login_codes WHERE email = ?", (email,))
            conn.execute("INSERT OR IGNORE INTO users (email, created_at) VALUES (?, ?)", (email, now))
            conn.execute("UPDATE users SET last_login_at = ? WHERE email = ?", (now, email))
            uid = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()["id"]
            conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
            token = secrets.token_urlsafe(32)
            conn.execute("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
                         (sha256(token), uid, now + SESSION_TTL))
        return self.send_json(200, {"ok": True, "email": email},
                              [("Set-Cookie", self.session_cookie(token, SESSION_TTL))])

    def api_logout(self):
        raw = self.headers.get("Cookie")
        if raw:
            c = cookies.SimpleCookie()
            try:
                c.load(raw)
                if "sid" in c:
                    with db() as conn:
                        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (sha256(c["sid"].value),))
            except cookies.CookieError:
                pass
        return self.send_json(200, {"ok": True}, [("Set-Cookie", self.session_cookie("", 0))])

    def create_guest_session(self):
        now = int(time.time())
        with _db_lock, db() as conn:
            conn.execute("DELETE FROM code_requests WHERE created_at < ?", (now - 3600,))
            n = conn.execute("SELECT COUNT(*) FROM code_requests WHERE ip = ?", ("guest:" + self.client_ip(),)).fetchone()[0]
            if n >= GUEST_MAX_PER_HOUR_IP:
                return None
            conn.execute("INSERT INTO code_requests (ip, created_at) VALUES (?, ?)", ("guest:" + self.client_ip(), now))
            guest_id = "guest-" + secrets.token_hex(8)
            conn.execute("INSERT INTO users (email, created_at, last_login_at) VALUES (?, ?, ?)", (guest_id, now, now))
            uid = conn.execute("SELECT id FROM users WHERE email = ?", (guest_id,)).fetchone()["id"]
            token = secrets.token_urlsafe(32)
            conn.execute("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
                         (sha256(token), uid, now + SESSION_TTL))
            touch_guest(conn, uid)
        return token

    def api_me(self):
        news = bool(NAVER_CLIENT_ID and NAVER_CLIENT_SECRET)
        u = self.current_user()
        if u:
            guest = u["email"].startswith("guest-")
            if guest:
                with _db_lock, db() as conn:
                    touch_guest(conn, u["id"])
            return self.send_json(200, {"email": None if guest else u["email"], "guest": guest, "newsEnabled": news})
        if LOGIN_MODE == "guest":
            token = self.create_guest_session()
            if not token:
                return self.send_json(429, {"error": "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."})
            return self.send_json(200, {"email": None, "guest": True, "newsEnabled": news},
                                  [("Set-Cookie", self.session_cookie(token, None))])
        return self.send_json(401, {"error": "로그인이 필요합니다."})

    # ---- 사용자 데이터 (spec, pet) ----
    def api_get_data(self):
        u = self.current_user()
        if not u:
            return self.send_json(401, {"error": "로그인이 필요합니다."})
        with db() as conn:
            rows = conn.execute("SELECT kind, json FROM user_data WHERE user_id = ?", (u["id"],)).fetchall()
        return self.send_json(200, {r["kind"]: json.loads(r["json"]) for r in rows})

    def api_put_data(self):
        u = self.current_user()
        if not u:
            return self.send_json(401, {"error": "로그인이 필요합니다."})
        body = self.read_json()
        if not isinstance(body, dict):
            return self.send_json(400, {"error": "잘못된 데이터입니다."})
        allowed = {"spec": validate_spec, "pet": validate_pet}
        now = int(time.time())
        saved = {}
        for kind, val in body.items():
            if kind not in allowed:
                continue
            clean = allowed[kind](val)
            if clean is None:
                return self.send_json(400, {"error": f"{kind} 데이터 형식이 올바르지 않습니다."})
            saved[kind] = clean
        with db() as conn:
            for kind, clean in saved.items():
                conn.execute(
                    "INSERT OR REPLACE INTO user_data (user_id, kind, json, updated_at) VALUES (?, ?, ?, ?)",
                    (u["id"], kind, json.dumps(clean, ensure_ascii=False), now))
        return self.send_json(200, {"ok": True, "saved": list(saved)})

    # ---- 뉴스 ----
    def api_news(self):
        u = self.current_user()
        if not u:
            return self.send_json(401, {"error": "로그인이 필요합니다."})
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        category = qs.get("category", ["all"])[0]
        custom = qs.get("q", [""])[0].strip()[:50]
        query = custom or CATEGORY_QUERIES.get(category, CATEGORY_QUERIES["all"])
        now = time.time()
        with _news_lock:
            hit = _news_cache.get(query)
            if hit and now - hit[0] < NEWS_CACHE_TTL:
                return self.send_json(200, hit[1])
        # 필터 후 남는 기사가 충분하도록 넉넉히 가져온다
        res = call_naver_news(query, display=100)
        if res["status_code"] != 200:
            return self.send_json(502 if res["status_code"] != 503 else 503,
                                  {"error": res.get("error"), "upstreamStatus": res["status_code"]})
        payload = {"query": query, "items": structure_news(res["data"].get("items", []))}
        with _news_lock:
            _news_cache[query] = (now, payload)
        return self.send_json(200, payload)

    # ---- 게스트 접속 상태 (페이지를 닫으면 기록 삭제) ----
    def api_guest_ping(self):
        u = self.current_user()
        if not u:
            # 게스트 모드에서 세션이 정리된 경우: 클라이언트가 새로고침해 새 게스트로 시작하도록 알림
            return self.send_json(401, {"error": "세션이 없습니다.", "guestExpired": LOGIN_MODE == "guest"})
        if u["email"].startswith("guest-"):
            with _db_lock, db() as conn:
                touch_guest(conn, u["id"])
        return self.send_json(200, {"ok": True})

    def api_guest_leave(self):
        u = self.current_user()
        if u and u["email"].startswith("guest-"):
            with _db_lock, db() as conn:
                conn.execute("UPDATE guest_presence SET leaving_at = ? WHERE user_id = ?", (int(time.time()), u["id"]))
        return self.send_json(200, {"ok": True})

    # ---- 채용정보 ----
    def api_jobs(self):
        if not self.current_user():
            return self.send_json(401, {"error": "로그인이 필요합니다."})
        with db() as conn:
            rows = conn.execute(
                "SELECT * FROM job_posts WHERE verdict != 'rejected' ORDER BY score DESC, fetched_at DESC LIMIT 100").fetchall()
            rejected = conn.execute("SELECT COUNT(*) FROM job_posts WHERE verdict = 'rejected'").fetchone()[0]
        last = jobs_last_refresh()
        items = [{
            "title": r["title"], "company": r["company"], "role": r["role"],
            "certs": json.loads(r["certs"]), "passer": bool(r["passer"]), "pubDate": r["pub_date"],
            "source": r["source"], "score": r["score"], "verdict": r["verdict"],
            "reasons": json.loads(r["reasons"]), "link": r["link"],
        } for r in rows]
        return self.send_json(200, {
            "items": items, "filteredOut": rejected, "updatedAt": last or None,
            "nextUpdateAt": (last + JOB_REFRESH_INTERVAL) if last else None,
            "enabled": bool(NAVER_CLIENT_ID and NAVER_CLIENT_SECRET),
        })

    # ---- 네이버 API 키 관리 (서버를 실행 중인 PC에서 접속한 경우만 허용) ----
    def is_local_admin(self):
        # 프록시 뒤(배포 환경)에서는 항상 False: 실제 소켓 주소가 로컬이고 프록시 헤더가 없을 때만 허용
        # (터널/프록시 트래픽도 소켓 주소는 127.0.0.1 로 보이므로, 프록시가 붙이는 헤더가 하나라도 있으면 거부)
        proxied = any(self.headers.get(h) for h in
                      ("X-Forwarded-For", "X-Forwarded-Host", "X-Real-IP", "Forwarded", "CF-Connecting-IP", "CF-Ray", "CDN-Loop"))
        return self.client_address[0] in ("127.0.0.1", "::1", "::ffff:127.0.0.1") and not proxied

    def api_get_keys(self):
        if not self.current_user():
            return self.send_json(401, {"error": "로그인이 필요합니다."})
        cid = NAVER_CLIENT_ID
        masked = (cid[:3] + "•" * max(0, len(cid) - 3)) if cid else ""
        return self.send_json(200, {"canEdit": self.is_local_admin(), "configured": bool(cid and NAVER_CLIENT_SECRET),
                                    "clientIdMasked": masked, "authType": NAVER_AUTH_TYPE})

    def api_set_keys(self):
        global NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_AUTH_TYPE
        if not self.current_user():
            return self.send_json(401, {"error": "로그인이 필요합니다."})
        if not self.is_local_admin():
            return self.send_json(403, {"error": "API 키는 서버를 실행 중인 PC에서만 수정할 수 있습니다."})
        body = self.read_json() or {}
        cid = str(body.get("clientId", "")).strip()
        csec = str(body.get("clientSecret", "")).strip()
        atype = str(body.get("authType", NAVER_AUTH_TYPE)).strip().lower()
        if atype not in ("ncp", "developers"):
            return self.send_json(400, {"error": "연동 방식이 올바르지 않습니다."})
        key_re = re.compile(r"^[A-Za-z0-9_\-]{4,100}$")
        if not key_re.match(cid) or not key_re.match(csec):
            return self.send_json(400, {"error": "아이디/키는 영문·숫자·_·- 4~100자로 입력해 주세요."})
        # 저장 전에 실제로 동작하는 키인지 검증
        prev = (NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_AUTH_TYPE)
        NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_AUTH_TYPE = cid, csec, atype
        res = call_naver_news("채용", display=1)
        if res["status_code"] != 200:
            NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_AUTH_TYPE = prev
            return self.send_json(400, {"error": "네이버 API 인증에 실패했습니다. 아이디/키/연동 방식을 확인해 주세요."})
        save_env_values({"NAVER_CLIENT_ID": cid, "NAVER_CLIENT_SECRET": csec, "NAVER_AUTH_TYPE": atype})
        with _news_lock:
            _news_cache.clear()
        threading.Thread(target=refresh_jobs_safe, daemon=True).start()
        return self.send_json(200, {"ok": True})

    def log_message(self, fmt, *args):
        # 쿼리스트링은 로그에 남기지 않음
        msg = re.sub(r"\?[^ \"]*", "", fmt % args)
        print(self.client_ip() + " - " + msg, flush=True)


# ------------------------------------------------------------------
# 입력 검증
# ------------------------------------------------------------------
def _num(v, lo, hi):
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        raise ValueError
    if f != f or f < lo or f > hi:
        raise ValueError
    return f


def _str(v, n):
    if v is None:
        return ""
    if not isinstance(v, str):
        raise ValueError
    return v.strip()[:n]


def validate_spec(v):
    if not isinstance(v, dict):
        return None
    try:
        max_gpa = _num(v.get("maxGpa"), 4.0, 4.5) or 4.5
        grades = v.get("semesterGrades") or []
        if not isinstance(grades, list) or len(grades) > 8:
            return None
        grades = [_num(g, 0, max_gpa) for g in grades] + [None] * (8 - len(grades))
        certs = v.get("certs") or []
        if not isinstance(certs, list) or len(certs) > 20:
            return None
        return {
            "name": _str(v.get("name"), 30),
            "major": _str(v.get("major"), 40),
            "maxGpa": max_gpa,
            "semesterGrades": grades,
            "credits": int(_num(v.get("credits"), 0, 250) or 0),
            "totalCredits": int(_num(v.get("totalCredits"), 1, 250) or 130),
            "langType": _str(v.get("langType"), 20),
            "langScore": _str(v.get("langScore"), 20),
            "certs": [_str(c, 40) for c in certs if isinstance(c, str) and c.strip()],
            "extra": _str(v.get("extra"), 300),
        }
    except ValueError:
        return None


def validate_pet(v):
    if not isinstance(v, dict):
        return None
    try:
        return {
            "level": int(_num(v.get("level"), 1, 999) or 1),
            "fullness": int(_num(v.get("fullness"), 0, 100) or 0),
            "exp": int(_num(v.get("exp"), 0, 100) or 0),
            "coins": int(_num(v.get("coins"), 0, 1_000_000) or 0),
        }
    except ValueError:
        return None


def main():
    init_db()
    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        print("⚠️  NAVER_CLIENT_ID/SECRET 미설정: 채용 뉴스 기능이 비활성화됩니다.", flush=True)
    if not SMTP_HOST:
        print("⚠️  SMTP 미설정: 인증코드가 메일 대신 이 콘솔에 출력됩니다 (개발 모드).", flush=True)
    threading.Thread(target=job_refresher_loop, daemon=True).start()
    if LOGIN_MODE == "guest":
        threading.Thread(target=guest_purge_loop, daemon=True).start()
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    httpd = http.server.ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"🚀 캠퍼스 스펙 트래커: http://{'localhost' if HOST in ('127.0.0.1', '0.0.0.0') else HOST}:{PORT}", flush=True)
    print(f"   허용 이메일 도메인: @{ALLOWED_EMAIL_DOMAIN}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
        httpd.server_close()


if __name__ == "__main__":
    main()
