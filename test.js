/* 빌드 산출물 자체 점검 — node test.js
   일정 스왑(10/17 요트 ↔ 10/18 휴양)과 새 런타임 로직이 깨지면 여기서 걸린다 */
const assert = require("assert");
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");

/* 1. 일자 스왑이 데이터·본문·식당 전부에 반영됐는지 */
const d17 = html.slice(html.indexOf('id="pg-7"'), html.indexOf('id="pg-8"'));
const d18 = html.slice(html.indexOf('id="pg-8"'), html.indexOf('id="pg-9"'));
assert(/10\/17/.test(d17) && /요트투어/.test(d17), "10/17 = 요트투어여야 함");
assert(/10\/18/.test(d18) && /커플 스파/.test(d18), "10/18 = 휴양·스파여야 함");
assert(!/커플 스파 트리트먼트/.test(d17), "스파가 10/17에 남아 있음");
assert(/예비일/.test(d18), "10/18이 예비일로 표시돼야 함");

/* 2. 좌표 배열도 같이 스왑됐는지 (요트 = 화산온천 좌표 포함) */
const DAYS = eval(html.match(/var DAYS = (\[[\s\S]*?\n {4}\]);/)[1]);
assert.strictEqual(DAYS.length, 14);
assert(DAYS[7].some((p) => /화산온천/.test(p[2])), "DAYS[7]이 요트 동선이어야 함");
assert(DAYS[8].every((p) => p[0] === 36.4290 || /Skaros/.test(p[2])), "DAYS[8]은 호텔 주변이어야 함");
const DRIVE = eval("(" + html.match(/var DRIVE = (\{[^}]*\});/)[1] + ")");
assert(DRIVE[7] && !DRIVE[8], "차량 이동 플래그가 요트 날(7)로 옮겨져야 함");

/* 3. 10/12 브루어리 + 플랜B */
const d12 = html.slice(html.indexOf('id="pg-2"'), html.indexOf('id="pg-3"'));
assert(/브루어리 홉핑 투어/.test(d12) && /Strange Brew/.test(d12), "10/12에 브루어리 투어+플랜B");

/* 4. 항공 스케줄 변경(2026-09-18 통보) 반영 — 옛 시각이 안내문 밖에 남아 있으면 안 됨 */
const d10 = html.slice(html.indexOf('id="pg-0"'), html.indexOf('id="pg-1"'));
const d23 = html.slice(html.indexOf('id="pg-13"'), html.indexOf('id="pg-end"'));
assert(/08:30/.test(d10) && /~15:00/.test(d10), "OZ521 08:30 출발 / LHR ~15:00 도착 반영");
assert(/1시간 35분/.test(d10) && /A3609/.test(d10), "LHR 환승 95분 경고 + 미스커넥트 플랜B");
assert(/22:45/.test(d23) && /19:45/.test(d23), "OZ562 22:45 출발 / FCO 19:45 하드마감 반영");
assert(/팔라초 마시모/.test(d23) && /안 가도 됩니다/.test(d23), "10/23 선택 일정 + '안 가도 됨' 명시");
// 옛 시각은 "07:50 → 08:30" 같은 변경 안내 문맥에서만 허용
for (const [day, old] of [[d10, "07:50"], [d23, "21:25"]]) {
  const bare = day.replace(/<[^>]*>/g, " ").split(old).slice(1)
    .filter((t) => !/^\s*(→|기준)/.test(t));
  assert.strictEqual(bare.length, 0, "옛 시각 " + old + " 이 변경 안내 밖에 남아 있음");
}
assert(!/OZ562 FCO 21:25/.test(html), "마지막 페이지 OZ562 시각이 옛날 그대로");

/* 5. 모든 장소 링크가 길찾기로 확장되는지 (원본은 search 링크) */
assert(html.includes('a.map[href*="maps/search"]'), "길찾기 변환 코드 누락");
assert(html.includes("maps/dir/?api=1&travelmode="), "길찾기 딥링크 누락");

/* 5. 런타임 문법 + 로직 */
const body = html.match(/<script>\n\(function \(\) \{\n([\s\S]*)\n\}\)\(\);/)[1];
new Function(body); // 문법 오류면 throw
// RUNTIME은 build.js 안에서 템플릿 리터럴이라 백슬래시가 한 번 먹힌다 — 시각 파싱 정규식이 살아있는지
assert(html.includes(".match(/(\\d{1,2}):(\\d{2})/)"), "'지금 할 일' 시각 정규식이 이스케이프를 잃었음(build.js는 템플릿 리터럴이라 \\\\d 로 써야 함)");

/* 위 런타임과 동일한 구현으로 순수 로직만 검증 */
const TRIP0 = new Date(2026, 9, 10);
const todayIdx = (y, m, d) => {
  const n = Math.round((new Date(y, m - 1, d) - TRIP0) / 86400000);
  return n >= 0 && n <= 13 ? n : null;
};
assert.strictEqual(todayIdx(2026, 10, 10), 0);
assert.strictEqual(todayIdx(2026, 10, 17), 7);
assert.strictEqual(todayIdx(2026, 10, 23), 13);
assert.strictEqual(todayIdx(2026, 10, 24), null);
assert.strictEqual(todayIdx(2026, 9, 18), null);

const distM = (a, b) => {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(a[0] * r) * Math.cos(b[0] * r);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};
// 코코맷 BC → Strange Brew 탭룸: 도보 5분(약 400m)이라고 본문에 썼으니 실제로 그 정도여야 함
const d = distM([37.9668, 23.7286], [37.9645, 23.7255]);
assert(d > 250 && d < 550, "코코맷↔Strange Brew 거리 이상: " + Math.round(d) + "m");

const fmtD = (m) => (m < 1000 ? Math.round(m / 10) * 10 + "m" : (m / 1000).toFixed(m < 10000 ? 1 : 0) + "km");
assert.strictEqual(fmtD(0), "0m");
assert.strictEqual(fmtD(384), "380m");
assert.strictEqual(fmtD(1240), "1.2km");
assert.strictEqual(fmtD(42000), "42km");

/* 6. 폴드 2단 레이아웃 + 오프라인 캐시 버전 */
assert(/@media \(min-width: 700px\)[\s\S]*?grid-column: 2/.test(html), "펼침 2단 레이아웃 CSS 누락");
assert(/horizontal-viewport-segments: 2/.test(html), "힌지 대응 미디어쿼리 누락");
assert(/APP_CACHE = "gi-app-v\d+"/.test(fs.readFileSync("sw.js", "utf8")), "서비스워커 캐시 이름 형식(index.html을 고쳤으면 번호를 올릴 것)");

console.log("모두 통과 ✅");
