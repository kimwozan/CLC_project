"""Vercel 서버리스 함수: AI 채용정보 인사이트 (/api/jobs)

- 서버(server.py)와 같은 수집·신뢰도 판별 로직(collect_jobs)을 그대로 재사용한다.
- DB가 없으므로 '주 1회 갱신'은 Vercel CDN 캐시 7일(s-maxage)로 구현한다.
  (캐시가 만료된 뒤 첫 요청이 새로 수집하며, 그 사이에는 이전 결과를 계속 보여준다 = stale-while-revalidate)
- 네이버 키(NAVER_CLIENT_ID / NAVER_CLIENT_SECRET / NAVER_AUTH_TYPE)는 Vercel 프로젝트 환경변수로만 설정한다.
"""
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import server  # noqa: E402  (collect_jobs 등 공용 로직)

WEEK = 7 * 24 * 3600


def build_payload():
    enabled = bool(server.NAVER_CLIENT_ID and server.NAVER_CLIENT_SECRET)
    if not enabled:
        return {"items": [], "filteredOut": 0, "updatedAt": None, "nextUpdateAt": None, "enabled": False}, False
    collected = server.collect_jobs()
    if collected is None:  # 네이버 호출 실패: 결과를 캐시하지 않는다
        return {"items": [], "filteredOut": 0, "updatedAt": None, "nextUpdateAt": None, "enabled": True, "error": True}, False
    now = int(time.time())
    rows = sorted(collected.items(), key=lambda kv: -kv[1]["score"])
    items = [{
        "title": v["title"], "company": v["company"], "role": v["role"], "certs": v["certs"],
        "passer": bool(v["passer"]), "pubDate": v["pub_date"], "source": v["host"], "score": v["score"],
        "verdict": v["verdict"], "reasons": v["reasons"], "link": link,
    } for link, v in rows if v["verdict"] != "rejected"][:100]
    rejected = sum(1 for _, v in rows if v["verdict"] == "rejected")
    return {"items": items, "filteredOut": rejected, "updatedAt": now, "nextUpdateAt": now + WEEK, "enabled": True}, True


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            payload, cacheable = build_payload()
            status = 200
        except Exception:  # noqa: BLE001  (내부 오류 내용은 응답에 싣지 않는다)
            payload, cacheable, status = {"items": [], "filteredOut": 0, "updatedAt": None,
                                          "nextUpdateAt": None, "enabled": True, "error": True}, False, 200
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if cacheable:
            self.send_header("Cache-Control", f"public, s-maxage={WEEK}, stale-while-revalidate=86400")
        else:
            self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
