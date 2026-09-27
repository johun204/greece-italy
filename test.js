/* 빌드 산출물 자체 점검 — node test.js
   일정 스왑(10/17 요트 ↔ 10/18 휴양)과 새 런타임 로직이 깨지면 여기서 걸린다 */
const assert = require("assert");
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");

/* 1. 일자 스왑이 데이터·본문·식당 전부에 반영됐는지 */
const d17 = html.slice(html.indexOf('id="pg-7"'), html.indexOf('id="pg-8"'));
const d18 = html.slice(html.indexOf('id="pg-8"'), html.indexOf('id="pg-9"'));
assert(/10\/17/.test(d17) && /피르고스/.test(d17) && /선사시대 티라 박물관/.test(d17), "10/17 = 피라·피르고스 일정이어야 함");
assert(!/선셋 요트투어|Vista|윈드 콜/.test(d17), "10/17에 요트 일정이 남아 있음");
assert(/10\/18/.test(d18) && /커플 스파/.test(d18), "10/18 = 휴양·스파여야 함");
assert(!/커플 스파 트리트먼트/.test(d17), "스파가 10/17에 남아 있음");
assert(!/예비일|요트/.test(d18), "10/18에 요트 예비일 표기가 남아 있음");

/* 2. 좌표 배열도 같이 스왑됐는지 (요트 = 화산온천 좌표 포함) */
const DAYS = eval(html.match(/var DAYS = (\[[\s\S]*?\n {4}\]);/)[1]);
assert.strictEqual(DAYS.length, 14);
assert(DAYS[7].some((p) => /피르고스/.test(p[2])) && !DAYS[7].some((p) => /요트|화산온천/.test(p[2])), "DAYS[7]이 피라·피르고스 동선이어야 함");
assert(DAYS[8].every((p) => p[0] === 36.4290 || /Skaros/.test(p[2])), "DAYS[8]은 호텔 주변이어야 함");
const DRIVE = eval("(" + html.match(/var DRIVE = (\{[^}]*\});/)[1] + ")");
assert(DRIVE[7] && !DRIVE[8], "차량 이동 플래그가 요트 날(7)로 옮겨져야 함");

/* 3. 10/12 = Strange Brew 탭룸(브루어리 투어는 뺌), 10/13 = 수니온 없이 CTC 19:15 */
const d12 = html.slice(html.indexOf('id="pg-2"'), html.indexOf('id="pg-3"'));
assert(/Strange Brew/.test(d12) && !/홉핑 투어/.test(d12), "10/12는 Strange Brew, 브루어리 투어는 없어야 함");
const d13 = html.slice(html.indexOf('id="pg-3"'), html.indexOf('id="pg-4"'));
assert(/19:15/.test(d13) && /CTC Urban Gastronomy/.test(d13), "10/13에 CTC 19:15 저녁");
assert(!/포세이돈|Sounion|필렐리논/.test(d13), "10/13에 수니온 일정이 남아 있음");
assert(DAYS[3].every((p) => p[0] > 37.9), "DAYS[3]에 수니온 좌표가 남아 있음");
assert(!DRIVE[3], "10/13은 차량 이동이 아님");
assert(DAYS[3].some((p) => /CTC/.test(p[2])) && DAYS[2].some((p) => /Strange Brew/.test(p[2])), "동선에 CTC·Strange Brew 누락");

/* 3b. 10/15 = 16:00 와이너리 미식 투어(호텔 픽업·하차, 정찬 포함 → 저녁 식당 후보 없음) */
const d15 = html.slice(html.indexOf('id="pg-5"'), html.indexOf('id="pg-6"'));
assert(/16:00/.test(d15) && /5824247/.test(d15) && /5코스 정찬/.test(d15), "10/15 와이너리 투어 16:00 반영");
assert(!/Krinaki|Kastro Oia|14:30/.test(d15), "10/15에 옛 투어/저녁 후보가 남아 있음");
assert(!DAYS[5].some((p) => /Sigalas|Argyros|Santo/.test(p[2])), "DAYS[5]에 옛 와이너리 좌표가 남아 있음");

/* 3c. 한눈에 보기: 14일 전부 + 이동 칩 */
const ov = html.slice(html.indexOf('id="pg-ov"'), html.indexOf('id="pg-prep"'));
assert.strictEqual((ov.match(/class="ov-row"/g) || []).length, 14, "한눈에 보기 행이 14개여야 함");
assert(/data-go="ov"/.test(html) && /CTC Urban Gastronomy/.test(ov) && /와이너리 미식 투어/.test(ov), "한눈에 보기 내용/칩 누락");

/* 3d. 10/20 바티칸 = 예약한 마이리얼트립 투어 + 입장권 구매완료, 10/22 마지막 만찬 = 미슐랭 아님 */
const d20 = html.slice(html.indexOf('id="pg-10"'), html.indexOf('id="pg-11"'));
const d22 = html.slice(html.indexOf('id="pg-12"'), html.indexOf('id="pg-13"'));
assert(/3415360/.test(d20) && /OKAIDI/.test(d20), "10/20 바티칸 투어 반영");
assert(/Le Mani in Pasta/.test(d22) && !/Aroma|Per Me|미슐랭 1스타/.test(d22), "10/22 마지막 만찬은 Le Mani in Pasta여야 함(미슐랭 제거)");
assert(DAYS[12].some((p) => /Le Mani/.test(p[2])), "DAYS[12]에 Le Mani in Pasta 좌표 누락");

/* 3e. 한눈에 보기 = 예약완료만(⏳·⚠️ 없음), 준비 페이지 = 예약·확인 필요, 상단 메뉴 접기 */
const ovHtml = html.slice(html.indexOf('id="pg-ov"'), html.indexOf('id="pg-prep"'));
const prepHtml = html.slice(html.indexOf('id="pg-prep"'), html.indexOf('id="pg-0"'));
assert(!/⏳|⚠️|ov-todo|ov-warn/.test(ovHtml), "한눈에 보기에 미예약/확인 항목이 표시됨");
assert(/⏳/.test(prepHtml) && /날짜별 예약·확인 필요/.test(prepHtml), "준비 페이지에 예약·확인 필요 목록 누락");
assert(!/미슐랭|Aroma|Per Me/.test(prepHtml) && !/Aroma|Per Me/.test(d22), "준비/10-22에 미슐랭 예약이 남아 있음");
assert(/id="hdrbtn"/.test(html) && /_hdr/.test(html), "상단 메뉴 접기 버튼/저장 누락");

/* 3f. 호텔 답장 반영: 아르메나키 우체국 픽업, Cavo Tagoo 정오 완전 폐장, Casa Guttmann 셀프체크인 서류 */
assert(/Hellenic Post Oia/.test(d15), "10/15 픽업지가 오이아 우체국으로 반영돼야 함");
const d19 = html.slice(html.indexOf('id="pg-9"'), html.indexOf('id="pg-10"'));
assert(/정오 완전 폐장|정확히 12:00/.test(d19), "10/19에 Cavo Tagoo 정오 폐장 반영 누락");
assert(/여권 사본/.test(d19) && /331 178 2972/.test(d19), "10/19에 Casa Guttmann 셀프체크인 서류 안내 누락");
assert(!/브런치\/수영/.test(d19), "10/19에 체크아웃 후 브런치가 옛 문구로 남아 있음");
const prepHtml2 = html.slice(html.indexOf('id="pg-prep"'), html.indexOf('id="pg-0"'));
assert(/구매완료/.test(prepHtml2), "준비 페이지에 구매완료 표시(아크로폴리스/바티칸/eSIM) 누락");

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
// 코코맷 BC → Strange Brew 탭룸: 도보 약 8분(600m)이라고 본문에 썼으니 실제로 그 정도여야 함
const d = distM([37.9668, 23.7286], [37.9626, 23.7231]);
assert(d > 450 && d < 750, "코코맷↔Strange Brew 거리 이상: " + Math.round(d) + "m");

const fmtD = (m) => (m < 1000 ? Math.round(m / 10) * 10 + "m" : (m / 1000).toFixed(m < 10000 ? 1 : 0) + "km");
assert.strictEqual(fmtD(0), "0m");
assert.strictEqual(fmtD(384), "380m");
assert.strictEqual(fmtD(1240), "1.2km");
assert.strictEqual(fmtD(42000), "42km");

/* 환율: € 금액 옆 원화 병기 — 런타임과 같은 반올림 규칙 + 배포물에 정규식/입력창이 살아있는지 */
const won = (e, fx) => "₩" + (Math.round(e * fx / 1000) * 1000).toLocaleString("en-US");
assert.strictEqual(won(5, 1591), "₩8,000");
assert.strictEqual(won(105, 1591), "₩167,000");
assert.strictEqual(won(3150, 1591), "₩5,012,000");
assert(/id="fx-rate"/.test(html) && /FXDEF = 1591/.test(html), "환율 입력/기본값 누락");
assert(html.includes("€(\\d[\\d,]*)(?:~(\\d[\\d,]*))?"), "€ 금액 정규식이 이스케이프를 잃었음(build.js는 템플릿 리터럴)");

/* 6. 폴드 2단 레이아웃 + 오프라인 캐시 버전 */
assert(/@media \(min-width: 700px\)[\s\S]*?grid-column: 2/.test(html), "펼침 2단 레이아웃 CSS 누락");
assert(/horizontal-viewport-segments: 2/.test(html), "힌지 대응 미디어쿼리 누락");
assert(/APP_CACHE = "gi-app-v\d+"/.test(fs.readFileSync("sw.js", "utf8")), "서비스워커 캐시 이름 형식(index.html을 고쳤으면 번호를 올릴 것)");

console.log("모두 통과 ✅");
