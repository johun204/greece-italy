/* 원본 일정 HTML → 일자 가로 스와이프 덱 구조 index.html 생성
   - 회화/식당/준비 탭 제거, 각 일자 페이지에 식당선택·체크리스트 포함
   - 상단: 나라별(그리스/이탈리아) 그룹 + 도시 소그룹 + 일자 칩
   - PWA/서비스워커/지도 캡처(img)/PDF 버튼 유지 */
const fs = require("fs");
const path = require("path");
const SRC = path.join(__dirname, "greece-italy-honeymoon-2026.src.html");
const OUT = path.join(__dirname, "index.html");
const s = fs.readFileSync(SRC, "utf8");

/* ---------- 1) 원본 조각 추출 ---------- */
const baseCss = s.slice(s.indexOf("<style>") + 7, s.indexOf("</style>"));

// 14개 일자 블록
const planStart = s.indexOf('id="view-plan"');
const planRegion = s.slice(planStart, s.indexOf('id="view-prep"'));
const dayBlocks = planRegion.split(/\r?\n    <!-- 10\/\d+ -->\r?\n/).slice(1).map((b) => {
  let inner = b.slice(b.indexOf('<div class="day">') + '<div class="day">'.length);
  // 마지막 날 블록은 뒤에 note-card(예산)가 붙어 있음 → 잘라냄
  const cut = inner.search(/\r?\n\r?\n    <div class="note-card">/);
  if (cut >= 0) inner = inner.slice(0, cut);
  inner = inner.replace(/\s*<\/div>\s*$/, ""); // .day 닫는 태그 제거
  return inner.trim();
});
if (dayBlocks.length !== 14) throw new Error("일자 블록 수 이상: " + dayBlocks.length);

// 예산 note-card
const budgetCard = "<div class=\"note-card\">" + s.slice(s.indexOf("💰 <b>여행 전체 경비 합계"), s.indexOf("</div>", s.indexOf("💰 <b>여행 전체 경비 합계"))) + "</div>";

// 긴급 정보 note-card
const emergCard = s.slice(s.indexOf('<div class="note-card">', s.indexOf("🚨 긴급 정보")), s.indexOf("</div>", s.indexOf("여권 사진·사본 폰에 저장")) + 6);

// DAYS / FOOD 배열 리터럴 + buildSvg + 지도주입 스크립트 원본
const mapScript = s.slice(s.indexOf("<script>", s.indexOf('id="view-phrase"')));
const daysLit = mapScript.match(/var DAYS = \[[\s\S]*?\n    \];/)[0];
const foodLit = mapScript.match(/var FOOD = \[[\s\S]*?\n    \];/)[0];
const buildSvgFn = mapScript.match(/function buildSvg\(pts\) \{[\s\S]*?\n    \}/)[0];
let FOODARR = [];
try { eval("FOODARR = " + foodLit.replace(/^var FOOD = /, "").replace(/;\s*$/, "")); } catch (e) { FOODARR = []; }

// 식당 탭 label 항목들 → 날짜별 그룹
const foodRegion = s.slice(s.indexOf('id="view-food"'), s.indexOf('id="view-phrase"'));
const foodItems = [...foodRegion.matchAll(/<label class="item">[\s\S]*?<\/label>/g)].map((m) => m[0]);
const foodByDate = {}; // "11" -> [labelHtml,...]
foodItems.forEach((lab) => {
  const nm = (lab.match(/<span class="name">([\s\S]*?)<\/span>/) || [, ""])[1].replace(/<[^>]+>/g, " ");
  const dd = (nm.match(/10\/(\d\d)/) || [])[1];
  if (dd) (foodByDate[dd] = foodByDate[dd] || []).push(lab);
});

/* ---------- 2) 일자 메타 ---------- */
const DOW = ["토", "일", "월", "화", "수", "목", "금", "토", "일", "월", "화", "수", "목", "금"];
const dd = (i) => String(10 + i).padStart(2, "0");

const GROUPS = [
  { flag: "🇬🇷", label: "그리스", subs: [
    { city: "아테네", idx: [0, 1, 2, 3] },
    { city: "산토리니", idx: [4, 5, 6, 7, 8] },
  ]},
  { flag: "🇮🇹", label: "이탈리아", subs: [
    { city: "로마", idx: [9, 10, 11, 12, 13] },
  ]},
];

/* ---------- 3) 일자별 체크리스트 (예약 재분배 + 당일 할 일) ---------- */
const item = (k, name, desc) =>
  `<label class="item"><input type="checkbox" data-k="${k}" /><span class="box"><svg viewBox="0 0 14 14"><path d="M2 7.5 L6 11 L12 3" /></svg></span><span class="txt"><span class="name">${name}</span><span class="desc">${desc}</span></span></label>`;

const CHECK = [
  // 0 · 10/10 인천→아테네
  [
    item("p-flight-oz-intl", "OZ521+A3603 연결편 수하물·환승 확인 <span class='tag hot'>확인 안 됨</span>", "ICN→LHR(OZ521)→ATH(A3603), 히드로 환승 약 2시간15분(입국심사 없음). 수하물이 ATH까지 through-check 되는 단일 예약인지 지금 확인 — 별도 발권이면 환승시간 부족"),
    item("p-athens-transfer", "아테네 스튜디오 심야 픽업 확인 <span class='tag hot'>출발 전</span>", "22:15 도착·심야 체크인 가능 메일. 픽업 제공되면 예약(심야 택시 흥정 방지)"),
    item("d10-esim", "eSIM 활성화 확인", "착륙 직후 데이터 켜지게. 안 되면 공항 와이파이로 재설정"),
    item("d10-cash", "공항 ATM에서 소액 유로 인출", "택시비용. 은행계열 ATM, ‘원화 환산(DCC)’ 뜨면 거부"),
  ],
  // 1 · 10/11 아테네 한국어 투어
  [
    item("p-guide-reply", "가이드에게 회신 <span class='tag hot'>급함</span>", "“10/11 14:00~18:00 확정” 답장 + 정확한 집합 장소·시간, 필요한 입장권 시간대 재확인"),
    item("p-acropolis-tour", "마이리얼트립 한국어 투어 예약 <span class='tag hot'>출발 전</span>", "‘인문학의 원조, 고대 그리스 문화산책’ #3852663 · 10/11 14:00~18:00 · ₩70,000/인"),
    item("p-acropolis-ticket-check", "아크로폴리스 통합권 예매 (hhticket.gr) <span class='tag hot'>필수</span>", "통합권 €30/인, 날짜 10/11, 시간대는 가이드 확정 슬롯. 5일권이라 제우스신전·로만아고라도 커버"),
    item("d11-qr", "투어 바우처·통합권 QR 폰 저장", "오프라인에서도 열리게 스크린샷"),
    item("d11-gear", "오후 투어 준비물", "모자·물·선크림·운동화 (오후 뙤약볕 구간)"),
  ],
  // 2 · 10/12 아크로폴리스 박물관
  [
    item("d12-museum", "아크로폴리스 박물관 월요일 09:00~17:00 확인", "단축 운영. 오전에 여유 있게"),
    item("d12-lunch", "Meat the Greek 12:15 도착", "돼지 기로스는 13시 전 소진. 일요일 휴무라 오늘"),
    item("d12-brew", "🍺 브루어리 투어 집합 시각·장소 확인", "업체가 정한 집합 시각에 맞춰 <b>리카비토스 시각을 조정</b>(18:00 집합이면 리카비토스 16:30). 예약 실패·피곤하면 플랜B = Strange Brew 탭룸(Falirou 86, 숙소 도보 5분·예약 불필요)"),
    item("d12-nap", "오후 낮잠", "저녁이 23시까지 길어짐. 내일 수니온 일몰까지 가니 과음 금물"),
  ],
  // 3 · 10/13 박물관+수니온
  [
    item("d13-nam", "국립고고학박물관 화요일 13:00 개관 유의", "오전은 파나티나이코 경기장·국립정원"),
    item("d13-sounion", "수니온 선셋 투어 픽업 시각 확인", "DIY면 KTEL 필렐리논街 승차. ⚠️ 막차는 여름 ~21:00/겨울 ~18:00로 계절차 큼, 10월은 애매하니 출발 전 공식시간표 재확인"),
    item("d13-pack", "오늘 밤 산토리니行 짐 미리 싸기", "내일은 오후 비행(GQ350), 아침은 여유"),
  ],
  // 4 · 10/14 →산토리니 오이아
  [
    item("p-flight-athjtr", "GQ350 시각·수하물·온라인 체크인 <span class='tag hot'>확인</span>", "티켓상 ATH 14:00 출발. ⚠️ 2026-09-13 재확인해도 공개 시간표는 여전히 17:15 — e-티켓 실제 시각 지금 재확인. SKY Basic·Joy+=15kg / Enjoy=23kg"),
    item("p-santorini-transfers", "JTR→오이아 트랜스퍼/택시 사전 콜", "숙소 픽업 가능 여부 메일. 섬 택시 40대뿐이라 미리"),
    item("p-dinner-ammoudi", "Dimitris Ammoudi 예약", "이메일 예약, 물가 자리 요청 (10/14 저녁)"),
    item("d14-checkout", "코코맷 10:45 체크아웃 → 택시로 ATH", "메트로는 Syntagma 환승, 짐 있으면 택시 €40"),
  ],
  // 5 · 10/15 와인투어
  [
    item("p-wine-tour", "산토리니 반일 와인 투어 예약 <span class='tag hot'>선셋 슬롯 3~5일전 마감</span>", "소그룹(≤10) €60~95/인 또는 프라이빗. 와이너리 3곳 + (브루어리 포함 상품이면 당나귀 맥주) + 로컬 안주. 오이아 호텔 픽업"),
    item("d15-pickup", "와인투어 픽업 시각 확인 + 호텔명 전달", "예약 후 업체에 Armenaki 이름 전달"),
    item("d15-water", "시음 전 물·간단한 요기", "12~14잔 시음. 점심은 가볍게"),
  ],
  // 6 · 10/16 Cavo Tagoo 입성
  [
    item("p-cavo-spa", "Cavo Tagoo 얼리 체크인 + 커플 스파 예약", "10/16 오후 일찍 도착 → 얼리 체크인·레이트 체크아웃(10/19) 문의. <b>10/18</b> 커플 스파(2인 €200~350) — 시즌 종료(10/19) 직전이라 운영 여부부터 확인"),
    item("p-dinner-ammoudi-metaxi", "Metaxi Mas 예약 <span class='tag hot'>필수</span>", "☎ +30 22860 31323, 며칠 전 (10/16 점심)"),
    item("d16-taxi", "오이아→(아크로티리)→Cavo Tagoo 택시 사전 콜", "직행 €30~35 / 아크로티리 경유 대절 €80~90"),
    item("d16-cavo", "체크인 시 인피니티풀·케이브 레스토랑 예약", "컨시어지에"),
  ],
  // 7 · 10/17 요트투어 (10/18에서 당김 — 10/18이 예비일)
  [
    item("p-cruise", "선셋 요트투어 예약 <span class='tag hot'>출발 전</span>", "세미프라이빗(8~12인) 5h · 픽업·식사·음료·주류·장비 포함 · 2인 약 ₩430,000 · 업체 Vista Yachting. <b>10/17로 잡고 10/18을 예비일로</b> — 예약 시 ‘기상취소 시 다음 날 같은 시간 대체 가능한지’와 전액환불 조건을 반드시 확인"),
    item("d17-windcall", "당일 오전 ‘윈드 콜’ 확인 <span class='tag hot'>10월 필수</span>", "10월엔 전날 저녁·당일 오전에 기상 판단 연락이 옵니다. 연락 없으면 먼저 전화. <b>취소 통보 시 그 자리에서 내일(10/18) 같은 시간으로 재예약</b>"),
    item("d17-pickup", "요트 픽업 시각 통보 확인", "예약 후 호텔명(Cavo Tagoo, 이메로비글리) 전달 → 픽업 시각 안내"),
    item("d17-pack", "수영복·선크림·멀미약", "타월·스노클·구명조끼는 배에서 제공"),
  ],
  // 8 · 10/18 리조트 데이 (요트 예비일)
  [
    item("d18-backup", "요트 취소됐으면 오늘 재시도 <span class='tag hot'>예비일</span>", "14:00 픽업. 그 경우 커플 스파를 <b>10:00으로 당기고</b> 점심은 가볍게 — 저녁은 선상 디너로 해결"),
    item("d18-spa", "커플 스파 트리트먼트 시간 재확인", "체크인일(10/16) 예약분. ⚠️ Cavo Tagoo 시즌 종료(10/19) 직전이라 스파 운영 여부를 출발 전 메일로 확정해 둘 것"),
    item("f-jtr-1018-resv", "Mylos 또는 Anogi 저녁 예약", "칼데라뷰. 호텔 다이닝도 가능"),
    item("d18-prepack", "내일 오전 출발 대비 짐 정리", "10/19 12:00 체크아웃 → 14:30 공항"),
  ],
  // 9 · 10/19 →로마
  [
    item("p-flight-fr3021", "FR3021 온라인 체크인 (24h 전) <span class='tag hot'>필수</span>", "JTR 17:30 → FCO 18:55(T1). 공항 발권 수수료 큼. 위탁 부치면 수속 마감 40분 전"),
    item("r-ryanair-bag", "기내가방 규정 재확인", "무료 40×20×25cm 1개. 초과·위탁은 온라인 선결제가 쌈"),
    item("d19-checkout", "Cavo Tagoo 12:00 체크아웃 · 짐 보관", "마지막 칼데라 브런치·수영"),
    item("d19-taxi", "택시 사전 콜", "이메로비글리→JTR 14:30(€30~35) · FCO→Casa Guttmann 정액택시 €50"),
  ],
  // 10 · 10/20 바티칸
  [
    item("p-vatican", "바티칸 가이드 투어 예약 <span class='tag hot'>1~2주 전</span>", "유로자전거나라 프리미엄 / 마이리얼트립 8인 소규모 / 프라이빗 중 택. <b>총액(투어비+입장료+현장비)</b> 확인. 공식 규정상 발권 후 환불·변경 불가"),
    item("d20-dress", "성 베드로 대성당 복장", "무릎·어깨 가리는 옷 (남녀 모두)"),
    item("d20-qr", "투어 바우처·집합 시각·장소 확인", "집합 15분 전 도착"),
  ],
  // 11 · 10/21 남부투어(포지타노·아말피)
  [
    item("p-southtour", "남부투어 예약 완료 확인 <span class='tag hot'>예약완료</span>", "우노트래블 #3440846, 06:20 Hotel Galles 픽업. 해산 시각 미공지 → 확정서 확인"),
    item("d21-early", "06:00 기상 · 전날 밤 요기거리 준비", "숙소 조식 불가. 20일 밤 일찍 취침"),
    item("d21-pack", "수영복·선글라스·편한 신발", "폼페이입장·점심·미니버스·페리는 현장 별도 결제(2인 약 €130)"),
  ],
  // 12 · 10/22 고대 로마+판테온+트라스테베레 (21일에서 이동)
  [
    item("p-colosseum", "콜로세움 통합권 예약 <span class='tag hot'>30일 전 오픈·날짜변경</span>", "21일→22일로 이동. <b>ticketing.colosseo.it</b>(CoopCulture 아님 — 공식 창구가 바뀌었음) €18, 포로·팔라티노 24h 포함. <b>9/22(월) 오픈 즉시</b>, 전날 남부투어 피로 감안해 <b>09:30 슬롯</b>"),
    item("p-pantheon", "판테온 시간지정 티켓 €7 <span class='tag hot'>가격 인상·날짜변경</span>", "21일→22일로 이동. 2026.7.1부 €7/인(구 €5). museiitaliani.it"),
    item("p-roscioli", "Roscioli 점심 예약 (14:30)", "salumeriaroscioli.com. 오전 콜로세움 일정 감안해 14:30 슬롯. 노쇼 €20/인, 취소는 메일로만"),
    item("p-michelin", "마지막 만찬(미슐랭) 예약", "Aroma(콜로세움 야경) 또는 Per Me(음식 중심), 2~3개월 전. 낮 Roscioli와 겹치니 저녁은 가볍게 조절"),
  ],
  // 13 · 10/23 귀국
  [
    item("d23-checkout", "Casa Guttmann 체크아웃 · 짐 보관", "숙소 or Radical Storage 앱(€5~6/개)"),
    item("d23-taxrefund", "택스리펀 서류 → FCO 세관", "출국심사 전 세관 승인/키오스크. 시간 걸리니 공항 일찍"),
    item("d23-fco", "15:30~15:45 FCO 이동", "정액택시 €50 / 레오나르도 익스프레스 €14. 18:20 도착 목표(OZ562 21:25 → ICN 10/24 15:40)"),
  ],
];

/* ---------- 4) 준비 페이지 ---------- */
const prepGeneral = [
  item("p-cavo-season", "Cavo Tagoo <b>10/19 시즌 종료</b> 메일 확인 <span class='tag hot'>최우선</span>", "2026 시즌이 <b>4/30~10/19</b>로 공지돼 있어 <b>체크아웃 날이 시즌 마지막 날</b>입니다. 막바지엔 스파·레스토랑을 먼저 닫는 사례가 있고 드물게 폐관일을 앞당깁니다. 메일 4문항: ① 10/16~19 예약 유효 ② <b>10/18 커플 스파 운영</b> ③ 인피니티풀·케이브 레스토랑 10/19까지 정상 ④ 10/19 레이트 체크아웃"),
  item("p-brewtour", "🍺 아테네 브루어리 홉핑 투어 예약 (10/12 저녁)", "그리스 법상 브루어리 상설 탭룸 금지 → <b>Noctua는 가이드 투어로만 내부 진입</b>. 3~3.5h, 2인 €100~150, 시음+안주(저녁 겸용). GetYourGuide·Viator·gastronomytours.com. 플랜B = Strange Brew 탭룸(숙소 도보 5분, 예약 불필요)"),
  item("p-passport", "여권 3개월+ 유효 · 사본 폰 저장 <span class='tag hot'>필수</span>", "솅겐 출국(10/23) 기준 잔여 3개월 이상 + 발급 10년 이내. 갱신 2~3주. 여권 사진·사본 클라우드 저장"),
  item("p-etias", "솅겐 ETIAS 시행 여부 확인", "travel-europe.europa.eu. 시행됐으면 신청(€7, 몇 분). 한국 여권 90일 무비자는 유지"),
  item("p-insurance", "여행자보험 가입 (2인, 10/10~10/24)", "의료+휴대품+항공지연. 증권 PDF 폰 저장"),
  item("p-esim", "EU 전역 eSIM", "Airalo/Holafly 등 10~15GB. 그리스·이탈리아 공용"),
  item("p-strike-check", "출발 1주 전 유적 개장시간·파업 재확인", "그리스는 유적·박물관 노조 파업으로 당일 휴관 생김. culture.gov.gr 공지. 아크로폴리스 2026년 10월 개장(확인 완료): 10/1~10/15 08:00~18:30(마감 18:00), 10/16~10/31 08:00~18:00(마감 17:30)"),
  item("r-cards-cash", "해외결제 카드 2장 + 유로 현금 2인 €700~900", "€50 이하 지폐로. 산토리니 버스·택시·소형 식당은 현금"),
  item("r-adapter", "C타입 유럽 플러그(220V)", "한국과 같은 C형이라 어댑터 불필요할 수 있음, 멀티탭 1개"),
  item("r-shoes", "편한 운동화 + 미끄럼 없는 신발", "대리석·자갈길·돌바닥. 저녁용 신발 따로"),
  item("r-layers", "10월 옷차림 낮 22~26℃ / 밤 15~18℃", "얇은 겉옷, 산토리니 저녁 바람막이, 성당용 어깨·무릎 가리는 옷, 수영복"),
  item("r-sun", "선크림·선글라스·모자", "아크로폴리스·포로 로마노·산토리니 능선 그늘 없음"),
  item("r-meds", "상비약 + 멀미약", "진통·지사·밴드·물집밴드. FR3021·요트 멀미약"),
  item("r-daybag", "보안 크로스백 + 물통", "로마 지하철·트라스테베레·나보나 소매치기. 유럽 수돗물·분수 식수 가능"),
];
const prepCalendar = `<div class="note-card">📅 <b>예약 캘린더 (역산)</b><br>
· <b>지금</b>: 가이드 회신 · 마이리얼트립 아테네 투어 · hhticket 통합권 · ATH/FR/국제선 항공 확인 · 여권/보험/eSIM · 10/21 남부투어 확정서 확인(예약완료)<br>
· <b>미슐랭</b>(Aroma 또는 Per Me, 10/22 저녁): 2~3개월 전<br>
· <b>콜로세움·판테온</b>(10/22로 이동): 콜로세움 30일 전(9/22) 오픈 즉시, 판테온은 여유<br>
· <b>산토리니 와인투어 · 요트투어(10/17) · Roscioli · 아테네 브루어리 투어</b>: 3주~1주 전<br>
· <b>Cavo Tagoo 시즌 종료(10/19) 확인</b>: 지금 바로 메일<br>
· <b>바티칸 가이드투어</b>: 1~2주 전<br>
· <b>출발 1주 전</b>: 유적 개장시간·파업 재확인</div>`;

/* ---------- 5) 페이지 HTML 조립 ---------- */
function daysec(title, listHtml) {
  return `<div class="sec daysec"><div class="sec-h"><h2>${title}</h2></div><div class="list">${listHtml}</div></div>`;
}
function dayPage(i) {
  const block = dayBlocks[i]; // day-h / day-intro / stats / rows / alts
  const foodList = (foodByDate[dd(i)] || []).join("");
  const foodSum = FOODARR[i] ? `<div class="note-card" style="margin:0 0 8px">🍽️ ${FOODARR[i]}</div>` : "";
  const foodSec = foodList ? daysec("🍽️ 오늘 식당 선택", foodSum + foodList) : "";
  const checkSec = daysec("✅ 오늘 체크리스트", (CHECK[i] || []).join(""));
  // rows 뒤, alts 앞에 식당+체크리스트 삽입
  const altIdx = block.indexOf('<div class="alts">');
  const head = altIdx >= 0 ? block.slice(0, altIdx) : block;
  const alts = altIdx >= 0 ? block.slice(altIdx) : "";
  return `<section class="daypage" id="pg-${i}" data-day="${i}">
${head}
${foodSec}
${checkSec}
${alts}
</section>`;
}
const prepPage = `<section class="daypage" id="pg-prep">
  <div class="day-h"><div class="daytag" style="--c: var(--teal)"><div><span class="dow">준비</span><div class="dt">D-day</div></div></div><div><div class="title">출발 전 준비</div><div class="sub">여권·비자·보험·현금 · 예약 캘린더 · 긴급정보</div></div></div>
  ${daysec("🧳 챙길 것 · 확인", prepGeneral.join(""))}
  ${prepCalendar}
  ${budgetCard}
  <div class="sec daysec"><div class="sec-h"><h2>🚨 긴급 정보 · 필수 회화</h2></div>
  ${emergCard}
  <div class="note-card">🗣️ <b>필수 회화</b><br>
  [GR] 안녕 <b>야 사스</b> · 감사 <b>에프하리스토</b> · 계산서 <b>토 로가리아즈모 파라칼로</b> · 카드돼요? <b>데헤스테 카르타?</b><br>
  [IT] 안녕 <b>본조르노/차오</b> · 감사 <b>그라찌에</b> · 계산서 <b>일 콘토 페르 파보레</b> · 2명 자리 <b>운 타볼로 페르 두에</b> · 카드돼요? <b>포소 파가레 콘 라 카르타?</b></div>
  </div>
</section>`;

const pagesHtml = [prepPage].concat(dayBlocks.map((_, i) => dayPage(i))).join("\n");

/* 상단 네비 */
function chip(target, label) {
  return `<button class="chip" data-go="${target}">${label}</button>`;
}
let navHtml = `<div class="navrow"><span class="grp">📋</span>${chip("prep", "준비")}</div>`;
GROUPS.forEach((g) => {
  let inner = "";
  g.subs.forEach((sub) => {
    inner += `<span class="sub">${sub.city}</span>` + sub.idx.map((i) => chip(String(i), `${10 + i}일<small>${DOW[i]}</small>`)).join("");
  });
  navHtml += `<div class="navrow"><span class="grp">${g.flag} ${g.label}</span>${inner}</div>`;
});

/* ---------- 6) CSS ---------- */
const NEW_CSS = `
  /* --- 덱(가로 스와이프) --- */
  html, body { height: 100%; }
  body { overflow: hidden; }
  .hdr { position: sticky; top: 0; z-index: 30; background: color-mix(in srgb, var(--paper) 92%, transparent); backdrop-filter: saturate(1.4) blur(12px); -webkit-backdrop-filter: saturate(1.4) blur(12px); border-bottom: 1px solid var(--line); padding: 10px 12px 8px; }
  .hdr h1 { font-size: 16px; margin: 0; font-weight: 800; letter-spacing: -0.02em; }
  .hdr h1 .k { color: var(--accent); }
  .hdr-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .hdr-btns { display: flex; gap: 6px; flex: none; }
  .navwrap { margin-top: 8px; max-height: 40vh; overflow-y: auto; }
  .navrow { display: flex; align-items: center; gap: 5px; overflow-x: auto; padding: 3px 0; scrollbar-width: none; }
  .navrow::-webkit-scrollbar { display: none; }
  .navrow .grp { flex: none; font-size: 11px; font-weight: 800; color: var(--ink); padding: 2px 6px 2px 0; white-space: nowrap; }
  .navrow .sub { flex: none; font-size: 10px; font-weight: 700; color: var(--faint); padding: 0 2px 0 6px; white-space: nowrap; }
  .chip { flex: none; border: 1px solid var(--line-strong); background: var(--card); color: var(--sub); font: inherit; font-weight: 700; font-size: 12px; padding: 4px 9px; border-radius: 99px; cursor: pointer; white-space: nowrap; }
  .chip small { font-size: 9px; opacity: .7; margin-left: 2px; }
  .chip.on { background: var(--indigo); color: #fff; border-color: var(--indigo); }
  .emerg { margin-top: 8px; }
  .emerg[hidden] { display: none; }

  .deck { display: flex; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; height: calc(100vh - var(--hdrH, 132px)); scrollbar-width: none; }
  .deck::-webkit-scrollbar { display: none; }
  .daypage { flex: 0 0 100%; width: 100%; scroll-snap-align: start; scroll-snap-stop: always; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 12px 14px 80px; }
  @media (min-width: 720px) { .daypage { padding-left: max(14px, calc(50% - 340px)); padding-right: max(14px, calc(50% - 340px)); } }

  .deck-arrow { position: fixed; top: 50%; transform: translateY(-50%); z-index: 25; width: 40px; height: 56px; border: 1px solid var(--line-strong); background: color-mix(in srgb, var(--card) 92%, transparent); color: var(--ink); font-size: 20px; font-weight: 800; border-radius: 12px; cursor: pointer; display: none; }
  @media (min-width: 720px) { .deck-arrow { display: block; } .deck-arrow.prev { left: 10px; } .deck-arrow.next { right: 10px; } }

  .daypage .day-h { border: 1px solid var(--line); border-radius: 16px; background: var(--card); box-shadow: var(--shadow); margin-bottom: 4px; }
  .daysec { margin-top: 16px; }
  .daysec .sec-h { display: flex; margin: 0 4px 8px; }
  .daysec .sec-h h2 { font-size: 14px; margin: 0; font-weight: 800; }
  .pagecount { text-align: center; font-size: 11px; color: var(--faint); margin: 10px 0 0; }

  /* --- 지도 --- */
  .daymap-wrap { margin: 14px 0 0; }
  .daymap { height: 220px; border-radius: 12px; border: 1px solid var(--line); overflow: hidden; background: #e8e5dd; }
  .daymap-img { display: none; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--line); }
  .daymap-svg { display: none; margin-top: 8px; }
  .daymap-svg svg { width: 100%; height: auto; display: block; border-radius: 12px; }
  .daymap-svg .cap { font-size: 10.5px; color: var(--faint); margin-top: 3px; }
  .daymap-static { display: block; font-size: 12px; color: var(--sub); line-height: 2; padding: 8px 2px 0; }
  .daymap-static .rt-label { font-weight: 700; color: var(--ink); margin-right: 2px; }
  .rt-item { display: inline-block; color: var(--teal); font-weight: 600; cursor: pointer; padding: 1px 6px; margin: 2px 0; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--teal) 32%, transparent); -webkit-tap-highlight-color: transparent; }
  .rt-item:hover, .rt-item:focus-visible { background: color-mix(in srgb, var(--teal) 14%, transparent); outline: none; }
  .rt-sep { margin: 0 3px; color: var(--faint); }
  .dayroute-link { display: inline-block; margin-top: 8px; font-size: 11.5px; font-weight: 700; color: var(--teal); text-decoration: none; border: 1px solid color-mix(in srgb, var(--teal) 38%, transparent); padding: 3px 9px; border-radius: 7px; }
  .mk-num { background: var(--accent); color: #fff; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.45); }
  .leaflet-popup-content { font-size: 12px; font-weight: 600; margin: 8px 12px; }
  .leaflet-container { font: inherit; }

  /* --- 오늘 / 지금 할 일 --- */
  .chip.today { border-color: var(--accent); color: var(--accent); }
  .chip.today.on { background: var(--accent); color: #fff; }
  .row.now { background: color-mix(in srgb, var(--accent) 9%, transparent); border-radius: 10px; box-shadow: inset 3px 0 0 var(--accent); padding-left: 9px; margin-left: -9px; }
  .row.now .time::after { content: "지금"; display: block; font-size: 9px; font-weight: 800; color: #fff; background: var(--accent); border-radius: 4px; padding: 0 4px; margin-top: 3px; width: fit-content; letter-spacing: .02em; }
  .nowbtn { flex: none; border: 1px solid var(--accent); background: var(--accent); color: #fff; font: inherit; font-weight: 800; font-size: 12px; border-radius: 8px; padding: 3px 9px; cursor: pointer; white-space: nowrap; }

  /* --- 내 위치 --- */
  .maptools { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; }
  .geobtn { border: 1px solid color-mix(in srgb, var(--indigo) 45%, transparent); background: var(--card); color: var(--indigo); font: inherit; font-weight: 700; font-size: 11.5px; border-radius: 7px; padding: 3px 9px; cursor: pointer; white-space: nowrap; }
  .geobtn.on { background: var(--indigo); color: #fff; }
  .geonote { font-size: 11.5px; color: var(--sub); font-weight: 600; }
  .rt-item i { font-style: normal; color: var(--indigo); font-weight: 700; margin-left: 4px; font-size: 10.5px; }
  .me-dot { width: 16px; height: 16px; border-radius: 50%; background: #1a73e8; border: 3px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.25), 0 1px 5px rgba(0,0,0,.4); }
  .map.nav { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
  .leaflet-popup-content a { color: var(--accent); font-weight: 700; text-decoration: none; }

  /* --- 폴드: 펼치면 2단(좌 일정 / 우 고정 지도) --- */
  @media (min-width: 700px) {
    .daypage { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); column-gap: 18px; align-content: start; }
    .daypage > * { grid-column: 1; min-width: 0; }
    .daypage > .daymap-wrap { grid-column: 2; grid-row: 1 / span 99; position: sticky; top: 0; align-self: start; margin-top: 0; }
    .daypage > .daymap-wrap .daymap { height: min(56vh, 480px); }
  }
  /* 폴더블 힌지: 두 화면 세그먼트면 가운데를 비워 접힘선에 글자가 안 걸리게 */
  @media (horizontal-viewport-segments: 2) {
    .daypage { column-gap: 44px; }
  }
  /* 펼침/접힘 전환 시 주소창 높이 변화 대응 */
  @supports (height: 100dvh) { .deck { height: calc(100dvh - var(--hdrH, 132px)); } }

  @media print {
    body { overflow: visible; height: auto; }
    .hdr, .deck-arrow, #pdfbtn, .fontbtn, .emerg-btn { display: none !important; }
    .emerg { display: block !important; }
    .deck { display: block !important; overflow: visible !important; height: auto !important; scroll-snap-type: none; }
    .daypage { display: block !important; width: auto !important; min-width: 0 !important; height: auto !important; overflow: visible !important; page-break-after: always; scroll-snap-align: none; padding: 0 0 12px; }
    .daymap, .dayroute-link { display: none !important; }
    .daymap-img { display: block !important; }
    .daymap-static { display: block !important; }
    .day, .list, .note-card, .sec, .daymap-wrap { break-inside: avoid; page-break-inside: avoid; }
    a { color: #000; text-decoration: none; }
  }
`;

/* ---------- 7) 런타임 스크립트 ---------- */
const RUNTIME = `
${daysLit}
${foodLit}
${buildSvgFn}
  var MAPS = [];
  function ll(p) { return p[0] + "," + p[1]; }
  var DRIVE = { 0: 1, 3: 1, 4: 1, 6: 1, 7: 1, 9: 1, 13: 1 };
  /* --- 실시간 내 위치 --- */
  function distM(a, b) {
    var R = 6371000, r = Math.PI / 180;
    var dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(a[0] * r) * Math.cos(b[0] * r);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function fmtD(m) { return m < 1000 ? Math.round(m / 10) * 10 + "m" : (m / 1000).toFixed(m < 10000 ? 1 : 0) + "km"; }
  var GEO = {
    pos: null, acc: 0, watch: null, panels: [], layers: [],
    start: function () {
      if (this.watch != null || !navigator.geolocation) return;
      var self = this;
      this.watch = navigator.geolocation.watchPosition(function (p) {
        self.pos = [p.coords.latitude, p.coords.longitude];
        self.acc = p.coords.accuracy || 0;
        self.render();
      }, function (err) {
        self.panels.forEach(function (pn) { pn.note.textContent = err && err.code === 1 ? "위치 권한 거부됨" : "위치를 못 잡음"; });
      }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
      try { localStorage.setItem("gi_geo_on", "1"); } catch (e) {}
    },
    attach: function (map) {
      var dot = L.marker([0, 0], { icon: L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false, zIndexOffset: 1000 });
      var ring = L.circle([0, 0], { radius: 0, color: "#1a73e8", weight: 1, fillColor: "#1a73e8", fillOpacity: 0.12, interactive: false });
      this.layers.push({ map: map, dot: dot, ring: ring, on: false });
      this.render();
    },
    render: function () {
      var me = this.pos;
      if (!me) return;
      this.layers.forEach(function (L2) {
        if (!L2.on) { L2.dot.addTo(L2.map); L2.ring.addTo(L2.map); L2.on = true; }
        L2.dot.setLatLng(me); L2.ring.setLatLng(me).setRadius(Math.max(8, this.acc));
      }, this);
      this.panels.forEach(function (pn) {
        pn.btn.classList.add("on");
        var best = null, bi = 0;
        pn.pts.forEach(function (p, n) { var d = distM(me, [p[0], p[1]]); if (best === null || d < best) { best = d; bi = n; } });
        pn.note.textContent = "가장 가까운 곳: " + (bi + 1) + ". " + pn.pts[bi][2].split(" · ")[0] + " " + fmtD(best);
        Array.prototype.forEach.call(pn.list.querySelectorAll(".rt-item"), function (el) {
          var n = +el.dataset.i, d = distM(me, [pn.pts[n][0], pn.pts[n][1]]);
          var tag = el.querySelector("i");
          if (!tag) { tag = document.createElement("i"); el.appendChild(tag); }
          tag.textContent = fmtD(d);
        });
      });
    }
  };
  try { if (localStorage.getItem("gi_geo_on") === "1") setTimeout(function () { GEO.start(); }, 400); } catch (e) {}

  var pages = Array.prototype.slice.call(document.querySelectorAll(".deck .daypage[data-day]"));
  pages.forEach(function (pg) {
    var i = +pg.dataset.day;
    var rows = pg.querySelector(".rows");
    if (!rows) return;
    var pts = DAYS[i];
    if (!pts || !pts.length) return;
    var wrap = document.createElement("div");
    wrap.className = "daymap-wrap";
    var mapDiv = document.createElement("div"); mapDiv.className = "daymap"; mapDiv.id = "daymap-" + i;
    var imgEl = document.createElement("img"); imgEl.className = "daymap-img"; imgEl.loading = "lazy"; imgEl.alt = "이 날 지도"; imgEl.src = "map-" + i + ".png";
    var svgDiv = document.createElement("div"); svgDiv.className = "daymap-svg";
    svgDiv.innerHTML = buildSvg(pts) + '<div class="cap">오프라인·인쇄용 개략 동선도</div>';
    var listDiv = document.createElement("div"); listDiv.className = "daymap-static";
    listDiv.innerHTML = '<span class="rt-label">🗺️ 동선</span> ' + pts.map(function (p, n) {
      return '<a class="rt-item" data-i="' + n + '" role="button" tabindex="0">' + (n + 1) + ". " + p[2].split(" · ")[0] + "</a>";
    }).join('<span class="rt-sep">→</span>');
    var mode = DRIVE[i] ? "driving" : "walking";
    var gm = "https://www.google.com/maps/dir/?api=1&travelmode=" + mode + "&origin=" + ll(pts[0]) + "&destination=" + ll(pts[pts.length - 1]);
    if (pts.length > 2) gm += "&waypoints=" + pts.slice(1, -1).map(ll).join("|");
    var link = document.createElement("a"); link.className = "dayroute-link"; link.href = gm; link.target = "_blank"; link.rel = "noopener"; link.textContent = "🗺️ 이 날 동선 전체 길찾기";
    var tools = document.createElement("div"); tools.className = "maptools";
    var geoBtn = document.createElement("button"); geoBtn.type = "button"; geoBtn.className = "geobtn"; geoBtn.textContent = "📍 내 위치";
    var geoNote = document.createElement("span"); geoNote.className = "geonote";
    tools.appendChild(link); tools.appendChild(geoBtn); tools.appendChild(geoNote);
    wrap.appendChild(imgEl); wrap.appendChild(mapDiv); wrap.appendChild(svgDiv); wrap.appendChild(listDiv); wrap.appendChild(tools);
    rows.parentNode.insertBefore(wrap, rows);
    var map = null, markers = [], built = false, latlngs = pts.map(function (p) { return [p[0], p[1]]; });
    svgDiv.style.display = "block";
    function buildLeaflet() {
      if (built || !window.L || !navigator.onLine || /pdf=1/.test(location.search)) return;
      built = true;
      try {
        map = L.map(mapDiv, { scrollWheelZoom: false, zoomControl: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
        pts.forEach(function (p, n) {
          markers.push(L.marker([p[0], p[1]], { icon: L.divIcon({ className: "", html: '<div class="mk-num">' + (n + 1) + "</div>", iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(map).bindPopup(
            (n + 1) + ". " + p[2] +
            '<br><a href="https://www.google.com/maps/dir/?api=1&travelmode=' + mode + "&destination=" + ll(p) + '" target="_blank" rel="noopener">🧭 여기로 길찾기</a>'
          ));
        });
        L.polyline(latlngs, { color: "#bf5137", weight: 3, opacity: 0.85, dashArray: "6 5" }).addTo(map);
        var applyView = function () {
          var z = map.getBoundsZoom(L.latLngBounds(latlngs), false, L.point(34, 34));
          map.setView(latlngs[0], Math.min(15, Math.max(3, z - 1)));
        };
        map._fit = applyView; MAPS.push(map); GEO.attach(map);
        mapDiv.style.display = "block"; svgDiv.style.display = "none";
        setTimeout(function () { map.invalidateSize(); applyView(); }, 60);
      } catch (e) { built = false; map = null; mapDiv.style.display = "none"; svgDiv.style.display = "block"; }
    }
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { if (en.isIntersecting) { buildLeaflet(); if (map) setTimeout(function () { map.invalidateSize(); if (map._fit) map._fit(); }, 60); } });
      }, { root: document.querySelector(".deck"), threshold: 0.2 });
      io.observe(pg);
    } else { buildLeaflet(); }
    Array.prototype.forEach.call(listDiv.querySelectorAll(".rt-item"), function (el) {
      var go = function (ev) { if (ev) ev.preventDefault(); var n = +el.dataset.i; if (map && markers[n]) { map.panTo(markers[n].getLatLng()); markers[n].openPopup(); } };
      el.addEventListener("click", go);
      el.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") go(ev); });
    });
    geoBtn.addEventListener("click", function () {
      GEO.start();
      buildLeaflet();
      if (GEO.pos && map) map.setView(GEO.pos, 16);
      geoNote.textContent = GEO.pos ? "" : "위치 잡는 중…";
    });
    GEO.panels.push({ pts: pts, list: listDiv, note: geoNote, btn: geoBtn, getMap: function () { return map; } });
  });

  /* --- 모든 장소에 구글지도 길찾기 링크 추가 --- */
  Array.prototype.forEach.call(document.querySelectorAll('a.map[href*="maps/search"]'), function (a) {
    var q = (a.href.split("query=")[1] || "").split("&")[0];
    if (!q) return;
    var b = document.createElement("a");
    b.className = "map nav"; b.target = "_blank"; b.rel = "noopener";
    b.href = "https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=" + q;
    b.textContent = "🧭 길찾기";
    a.parentNode.insertBefore(b, a.nextSibling);
  });

  /* --- 체크리스트 저장 --- */
  var KEY = "trip_checks_greece_italy_honeymoon_2026_v1";
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  Array.prototype.forEach.call(document.querySelectorAll(".item input[type=checkbox]"), function (b) {
    if (saved[b.dataset.k]) b.checked = true;
    b.addEventListener("change", function () { saved[b.dataset.k] = b.checked; try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {} });
  });

  /* --- 덱 네비 --- */
  var deck = document.querySelector(".deck");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  function pageEls() { return Array.prototype.slice.call(deck.children); }
  function goto(target, instant) {
    var el = target === "prep" ? document.getElementById("pg-prep") : document.getElementById("pg-" + target);
    if (el) deck.scrollTo({ left: el.offsetLeft, behavior: instant ? "auto" : "smooth" });
  }
  chips.forEach(function (c) { c.addEventListener("click", function () { goto(c.dataset.go); }); });
  function curIndex() {
    var els = pageEls(), x = deck.scrollLeft, best = 0, bd = 1e9;
    els.forEach(function (el, n) { var d = Math.abs(el.offsetLeft - x); if (d < bd) { bd = d; best = n; } });
    return best;
  }
  function syncChips() {
    var el = pageEls()[curIndex()];
    var go = el && el.id === "pg-prep" ? "prep" : el ? el.id.replace("pg-", "") : null;
    chips.forEach(function (c) { c.classList.toggle("on", c.dataset.go === go); });
    var on = document.querySelector(".chip.on");
    if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
  }
  var st;
  deck.addEventListener("scroll", function () { clearTimeout(st); st = setTimeout(syncChips, 90); }, { passive: true });
  document.querySelector(".deck-arrow.prev").addEventListener("click", function () { var els = pageEls(), i = Math.max(0, curIndex() - 1); deck.scrollTo({ left: els[i].offsetLeft, behavior: "smooth" }); });
  document.querySelector(".deck-arrow.next").addEventListener("click", function () { var els = pageEls(), i = Math.min(els.length - 1, curIndex() + 1); deck.scrollTo({ left: els[i].offsetLeft, behavior: "smooth" }); });
  document.addEventListener("keydown", function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === "ArrowRight") document.querySelector(".deck-arrow.next").click();
    if (e.key === "ArrowLeft") document.querySelector(".deck-arrow.prev").click();
  });

  /* --- 헤더 높이 → 덱 높이 --- */
  function setH() { document.documentElement.style.setProperty("--hdrH", document.querySelector(".hdr").offsetHeight + "px"); }
  setH();
  // 폴드 접기/펼치기 = viewport 변경 → 헤더 높이·지도 크기·현재 페이지 위치를 다시 잡는다
  var rzT;
  function onResize() {
    clearTimeout(rzT);
    rzT = setTimeout(function () {
      var keep = pageEls()[curIndex()];
      setH();
      MAPS.forEach(function (m) { m.invalidateSize(); if (m._fit) m._fit(); });
      if (keep) deck.scrollTo({ left: keep.offsetLeft, behavior: "auto" });
    }, 160);
  }
  window.addEventListener("resize", onResize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", onResize);

  /* --- 긴급정보 토글 --- */
  var eb = document.getElementById("emerg-btn"), ebx = document.getElementById("emerg");
  if (eb) eb.addEventListener("click", function () { ebx.hidden = !ebx.hidden; setH(); });

  /* --- 글자 크게 --- */
  var FKEY = KEY + "_big", big = false;
  try { big = localStorage.getItem(FKEY) === "1"; } catch (e) {}
  function applyFont(v) { document.documentElement.toggleAttribute("data-big", v); }
  applyFont(big);
  var fb = document.getElementById("fontbtn");
  if (fb) fb.addEventListener("click", function () { big = !big; applyFont(big); try { localStorage.setItem(FKEY, big ? "1" : "0"); } catch (e) {} setH(); });

  /* --- PDF --- */
  var pb = document.getElementById("pdfbtn");
  if (pb) pb.addEventListener("click", function () { window.print(); });
  if (location.search.indexOf("pdf=1") >= 0) document.documentElement.setAttribute("data-pdf", "1");

  /* --- 서비스워커 --- */
  if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });

  /* --- 오늘 / 지금 할 일 --- */
  var TRIP0 = new Date(2026, 9, 10); // 10/10(토) = day 0
  function todayIdx() {
    var t = new Date(), d = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    var n = Math.round((d - TRIP0) / 86400000);
    return (n >= 0 && n <= 13) ? n : null;
  }
  function markNow() {
    var i = todayIdx();
    Array.prototype.forEach.call(document.querySelectorAll(".row.now"), function (r) { r.classList.remove("now"); });
    if (i === null) return null;
    var pg = document.getElementById("pg-" + i);
    if (!pg) return null;
    var t = new Date(), mins = t.getHours() * 60 + t.getMinutes(), hit = null;
    Array.prototype.forEach.call(pg.querySelectorAll(".rows .row"), function (r) {
      var el = r.querySelector(".time"); if (!el) return;
      var m = (el.textContent || "").match(/(\\d{1,2}):(\\d{2})/);
      if (!m) return;
      if (+m[1] * 60 + +m[2] <= mins) hit = r;
    });
    if (hit) hit.classList.add("now");
    return hit;
  }
  function goToday(scrollRow, instant) {
    var i = todayIdx();
    goto(i === null ? "prep" : String(i), instant);
    var hit = markNow();
    if (hit && scrollRow) setTimeout(function () { hit.scrollIntoView({ block: "center", behavior: instant ? "auto" : "smooth" }); }, instant ? 60 : 420);
  }
  var tb = document.getElementById("todaybtn");
  if (tb) tb.addEventListener("click", function () { goToday(true, false); });
  // 여행 기간이면 오늘 칩을 강조
  (function () {
    var i = todayIdx();
    var c = document.querySelector('.chip[data-go="' + (i === null ? "prep" : i) + '"]');
    if (c) c.classList.add("today");
  })();
  setInterval(markNow, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) markNow(); });

  setTimeout(function () { goToday(true, true); syncChips(); }, 50);
`;

/* ---------- 8) 최종 HTML ---------- */
const html = `<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>아테네·산토리니·로마 14일</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="manifest" href="manifest.webmanifest" />
<meta name="theme-color" content="#12141b" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="신혼여행" />
<link rel="apple-touch-icon" href="icon-192.png" />
<style>${baseCss}${NEW_CSS}</style>

<header class="hdr">
  <div class="hdr-top">
    <h1>아테네·산토리니·로마 <span class="k">14일</span></h1>
    <div class="hdr-btns">
      <button class="nowbtn" id="todaybtn" title="오늘 일정으로">오늘</button>
      <button class="fontbtn emerg-btn" id="emerg-btn" title="긴급정보">🚨</button>
      <button class="fontbtn" id="pdfbtn" title="PDF로 저장/인쇄">⬇︎PDF</button>
      <button class="fontbtn" id="fontbtn" title="글자 크게">가A</button>
    </div>
  </div>
  <div class="emerg" id="emerg" hidden>${emergCard}</div>
  <div class="navwrap">${navHtml}</div>
</header>

<button class="deck-arrow prev" aria-label="이전 날">‹</button>
<button class="deck-arrow next" aria-label="다음 날">›</button>

<main class="deck" id="deck">
${pagesHtml}
<section class="daypage" id="pg-end">
  <div class="day-h"><div class="daytag" style="--c: var(--gold)"><div><span class="dow">토</span><div class="dt">10/24</div></div></div><div><div class="title">인천 도착</div><div class="sub">OZ562 FCO 21:25 → ICN 15:40</div></div></div>
  <div class="note-card">집으로. 수고했어요 ✈️<br>지도는 인터넷 필요(오프라인은 각 날 ‘동선’ 텍스트 + 캡처 이미지). 값(영업시간·요금·시각)은 예약 전 공식 사이트 재확인.</div>
</section>
</main>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function () {
${RUNTIME}
})();
</script>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, "utf8");
console.log("OK ->", OUT, "(" + html.length + " bytes)");
console.log("pages:", (html.match(/class="daypage"/g) || []).length, " chips:", (html.match(/class="chip"/g) || []).length);
console.log("food days:", Object.keys(foodByDate).sort().join(","));
console.log("checklists:", CHECK.map((c) => c.length).join(","));
