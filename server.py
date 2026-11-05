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
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "data", "app.db"))
ALLOWED_EMAIL_DOMAIN = os.environ.get("ALLOWED_EMAIL_DOMAIN", "kangwon.ac.kr").lower()
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "0") == "1"  # HTTPS 운영 시 1

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
        parts = [f"sid={token}", "Path=/", "HttpOnly", "SameSite=Lax", f"Max-Age={max_age}"]
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
        return token

    def api_me(self):
        news = bool(NAVER_CLIENT_ID and NAVER_CLIENT_SECRET)
        u = self.current_user()
        if u:
            guest = u["email"].startswith("guest-")
            return self.send_json(200, {"email": None if guest else u["email"], "guest": guest, "newsEnabled": news})
        if LOGIN_MODE == "guest":
            token = self.create_guest_session()
            if not token:
                return self.send_json(429, {"error": "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."})
            return self.send_json(200, {"email": None, "guest": True, "newsEnabled": news},
                                  [("Set-Cookie", self.session_cookie(token, SESSION_TTL))])
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
        res = call_naver_news(query)
        if res["status_code"] != 200:
            return self.send_json(502 if res["status_code"] != 503 else 503,
                                  {"error": res.get("error"), "upstreamStatus": res["status_code"]})
        payload = {"query": query, "items": structure_news(res["data"].get("items", []))}
        with _news_lock:
            _news_cache[query] = (now, payload)
        return self.send_json(200, payload)

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
