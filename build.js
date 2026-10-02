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
    item("p-flight-oz-intl", "🔴 OZ521 변경 → LHR 환승 95분, 구매처에 접수 <span class='tag hot'>최우선</span>", "<b>2026-09-18 통보: OZ521 07:50 → 08:30.</b> LHR 도착 약 15:00 → A3603(16:35) 환승이 <b>2h15 → 1h35</b>. 둘 다 히드로 T2라 터미널 이동은 없지만 여유가 5~35분뿐. <b>① e-티켓 자가진단</b>: 구간별 Ticket Number가 <b>988</b> 한 종류면 단일 발권(through-check 보장), A3603에 <b>390</b> 별도 번호면 별도 발권이라 95분으로 불가. <b>② 어디로 보내나</b> — 먼저 <b>e-티켓의 발행처(Issuing Agent)</b>를 보세요. <b>여행사 이름</b>이면 아시아나는 손을 못 대니 그 여행사로. <b>ASIANA AIRLINES</b>면 아시아나 <b>‘고객의 말씀’</b> 폼이 사실상의 메일 창구입니다(아시아나는 공개 문의 이메일이 없고, 비로그인 접수 시 입력한 주소로 답변 회신) — <b>m.flyasiana.com/C/KR/KO/customer/voc</b>. 평일 업무시간에 처리돼 회신은 며칠 걸리니, 급하면 <b>1588-8000</b>(09:00~18:00) 병행. A3603이 <b>별도 발권</b>으로 판명되면 아에게안에 따로 — <b>contact@aegeanair.com</b> / en.aegeanair.com/contact/Form/ / 영국 +44 208 759 3800 / 그리스 +30 210 626 1000(긴급 변경은 24시간). <b>③ 요구</b>: single ticket 여부 · MCT 충족 여부 · <b>항공사 귀책이므로 무상 재조정</b> + A3609(22:15→ATH 03:50) 보호 확약"),
    item("p-flight-oz562", "🟢 OZ562 변경 → 귀국 후 일정 재확인", "<b>10/23 FCO 출발 21:25 → 22:45.</b> 인천 도착 10/24(토) 15:40 → <b>약 17:00</b>. 10/24 공항 픽업·귀가 교통 등이 잡혀 있으면 다시 잡을 것"),
    item("p-athens-transfer", "아테네 스튜디오 심야 픽업 확인 <span class='tag hot'>출발 전</span>", "22:15 도착·심야 체크인 가능 메일. 픽업 제공되면 예약(심야 택시 흥정 방지)"),
    item("d10-icn", "ICN 05:30 도착 (OZ521 08:30 출발)", "출발 3시간 전. 변경된 시각 기준 — 예전 07:50 기준으로 알람 맞춰두지 말 것"),
    item("d10-lhr", "LHR 내리자마자 게이트 확인 후 직행", "환승 1시간 35분뿐. 라운지·면세는 시간 남을 때만. A3603 탑승 마감은 16:15가 실질 마감선. 도착 게이트가 T2B(위성)면 셔틀 5~10분 추가"),
    item("d10-esim", "eSIM 활성화 확인", "착륙 직후 데이터 켜지게. 안 되면 공항 와이파이로 재설정"),
    item("d10-cash", "공항 ATM에서 소액 유로 인출", "택시비용. 은행계열 ATM, ‘원화 환산(DCC)’ 뜨면 거부"),
  ],
  // 1 · 10/11 아테네 한국어 투어
  [
    item("p-guide-reply", "가이드에게 회신 <span class='tag hot'>급함</span>", "“10/11 14:00~18:00 확정” 답장 + 정확한 집합 장소·시간, 필요한 입장권 시간대 재확인"),
    item("p-acropolis-tour", "마이리얼트립 한국어 투어 예약 <span class='tag hot'>출발 전</span>", "‘인문학의 원조, 고대 그리스 문화산책’ #3852663 · 10/11 14:00~18:00 · ₩70,000/인"),
    item("p-acropolis-ticket-check", "아크로폴리스 통합권 구매완료 (hhticket.gr) <span class='tag hot'>구매완료</span>", "통합권 €30/인, 날짜 10/11. 5일권이라 제우스신전·로만아고라도 커버 — QR 폰에 저장해두기"),
    item("d11-qr", "투어 바우처·통합권 QR 폰 저장", "오프라인에서도 열리게 스크린샷"),
    item("d11-gear", "오후 투어 준비물", "모자·물·선크림·운동화 (오후 뙤약볕 구간)"),
  ],
  // 2 · 10/12 아크로폴리스 박물관
  [
    item("d12-museum", "아크로폴리스 박물관 월요일 09:00~17:00 확인", "단축 운영. 오전에 여유 있게"),
    item("d12-lunch", "Meat the Greek 12:15 도착", "돼지 기로스는 13시 전 소진. 일요일 휴무라 오늘"),
    item("d12-nolan", "Nolan 저녁 예약 (선택)", "신타그마 Voulis 31-33 · 미슐랭 빕구르망 · 월요일 19:00~ 영업. 예약 없이 가려면 O Lolos(쿠카키, 숙소 옆)"),
    item("d12-brew", "🍻 Blame The Sun 탭룸 (21:15경)", "Veikou 60, 숙소 도보 약 8분·예약 불필요. 월요일 17:00~24:00. 근처 Strange Brew(Falirou 86, ~01:00)도 도보 10분"),
    item("d12-nap", "오후 낮잠", "저녁이 길어짐. 내일 저녁 CTC 11코스가 있으니 과음 금물"),
  ],
  // 3 · 10/13 박물관 + CTC 디너
  [
    item("d13-nam", "국립고고학박물관 화요일 13:00 개관 유의", "오전은 파나티나이코 경기장·국립정원"),
    item("d13-ctc", "CTC Urban Gastronomy 19:15 예약 확인 <span class='tag hot'>예약완료</span>", "확인 메일 폰 저장 · 알레르기/식이 제한 미리 전달 · 18:30 숙소 출발(택시 약 10분 / 도보 약 30분) · 늦으면 ☎ +30 210 722 8812"),
    item("d13-pack", "저녁 전에 산토리니行 짐 미리 싸기", "내일은 오후 비행(GQ350), 10:45 체크아웃. CTC는 밤늦게 끝남"),
  ],
  // 4 · 10/14 →산토리니 오이아
  [
    item("p-flight-athjtr", "GQ350 시각·수하물·온라인 체크인 <span class='tag hot'>확인</span>", "티켓상 ATH 14:00 출발. ⚠️ 2026-09-13 재확인해도 공개 시간표는 여전히 17:15 — e-티켓 실제 시각 지금 재확인. SKY Basic·Joy+=15kg / Enjoy=23kg"),
    item("p-santorini-transfers", "아르메나키에 셔틀 선택 회신 <span class='tag hot'>회신 필요</span>", "호텔이 가격 확정: 합승 2인 €45 / 프라이빗 2인 €80(편도, 추가인원 +€10). <b>선택안 + 항공편명(GQ350)을 회신</b>해야 예약 진행"),
    item("p-dinner-ammoudi", "암무디 저녁 예약 — Sunset Ammoudi(저장)", "온라인 예약, 보증금 1인 €20(계산서서 차감) · 19:30 물가 자리 요청. 대안 Dimitris Ammoudi(이메일)"),
    item("d14-checkout", "코코맷 10:45 체크아웃 → 택시로 ATH", "메트로는 Syntagma 환승, 짐 있으면 택시 €40"),
  ],
  // 5 · 10/15 와인투어
  [
    item("p-wine-tour", "🍷 와이너리 미식 투어 예약완료 — 바우처 확인 <span class='tag hot'>예약완료</span>", "마이리얼트립 #5824247 · <b>10/15 16:00 호텔(Armenaki) 픽업 → 투어 후 호텔 하차</b>. 와인 10종 + 5코스 정찬(페어링) 포함, 약 5h, 영어 진행, 최대 8명"),
    item("d15-pickup", "픽업 장소 재확인 — 오이아 우체국", "호텔 하차가 아니라 <b>픽업은 오이아 우체국(Hellenic Post Oia)</b>. 숙소에서 도보 이동 필요, 16:00 시작이라 늦어도 15:45엔 도착"),
    item("d15-water", "점심은 가볍게 · 편한 신발", "10종 시음 + 5코스 정찬이 투어에 포함(저녁 예약 없음). 와이너리 도보·동굴 저장고. 팁 불포함이라 소액 현금"),
  ],
  // 6 · 10/16 Cavo Tagoo 입성
  [
    item("p-cavo-spa", "Cavo Tagoo 커플 스파 트리트먼트·시간 회신", "호텔이 10/18 스파 가능 여부·가격을 확인해주겠다고 회신 — <b>원하는 트리트먼트·시간대를 답장</b>(대략 2인 €200~350). 얼리 체크인(10/16 13:00~13:30)은 최선을 다하겠다는 답변(확정 아님)"),
    item("p-dinner-ammoudi-metaxi", "Metaxi Mas 예약 <span class='tag hot'>필수</span>", "☎ +30 22860 31323, 며칠 전 (10/16 점심)"),
    item("d16-taxi", "오이아→(아크로티리)→Cavo Tagoo 택시 사전 콜", "직행 €30~35 / 아크로티리 경유 대절 €80~90"),
    item("d16-tasos", "저녁 Tasos Tavern (도보 10분, 예약 불필요)", "18:00~23:00. 호텔 레스토랑은 시즌 종료라 이용 불가 — 대안 Father and Son(피로스테파니)"),
    item("d16-cavo", "체크인 시 조식 제공 방식 확인 · 기념 세팅 문의", "컨시어지에. 원하면 꽃(€140)·샴페인(€170~650)·케이크(€70) 등 기념 세팅도 유료로 가능"),
  ],
  // 7 · 10/17 이메로비글리↔피라 · 피르고스
  [
    item("d17-museum", "선사시대 티라 박물관 개관 확인", "10월 08:30~15:30, 화요일 휴관(10/17은 토요일). 입장 약 €10/인 — 개관 시간·요금은 출발 전 공식 사이트로 재확인"),
    item("d17-bus", "피라 → 피르고스 버스 시간표 확인 (안 맞으면 택시)", "피라 중앙 버스터미널 출발. 시간표는 현장·KTEL에서 확인"),
    item("d17-dinner", "피르고스 저녁 예약 (Selene 등) <span class='tag hot'>예약</span>", "Selene는 예약 필수(테이스팅 €80~120/인) — 영업 여부·시각 확인. 안 잡으면 피르고스 타베르나 워크인(호텔 레스토랑은 시즌 종료)"),
    item("d17-taxi", "피르고스 → 숙소 복귀 택시 콜 (컨시어지)", "밤엔 택시 잡기 어려움 — 호텔 컨시어지에 21:00경 콜 요청. 겉옷(피르고스 저녁은 쌀쌀), 편한 신발"),
  ],
  // 8 · 10/18 리조트 데이
  [
    item("d18-spa", "커플 스파 트리트먼트 시간 확정", "호텔 확인: 10/18까지 스파 정상 운영. 회신한 시간대로 진행되는지 도착 후 재확인"),
    item("f-jtr-1018-resv", "Mylos 또는 Anogi 저녁 예약", "칼데라뷰. 호텔 레스토랑은 시즌 종료라 저녁은 꼭 밖에서"),
    item("d18-prepack", "내일 오전 출발 대비 짐 정리", "10/19 12:00 체크아웃 → 14:30 공항"),
  ],
  // 9 · 10/19 →로마
  [
    item("p-flight-fr3021", "FR3021 온라인 체크인 (24h 전) <span class='tag hot'>필수</span>", "JTR 17:30 → FCO 18:55(T1). 공항 발권 수수료 큼. 위탁 부치면 수속 마감 40분 전"),
    item("r-ryanair-bag", "기내가방 규정 재확인", "무료 40×20×25cm 1개. 초과·위탁은 온라인 선결제가 쌈"),
    item("d19-checkout", "Cavo Tagoo 정오 완전 폐장 전 체크아웃 <span class='tag hot'>12:00 하드마감</span>", "브런치·수영은 체크아웃 전(오전)에 끝내기 — 정오 이후 호텔 전체 이용 불가. 짐 보관 가능 여부 출발 전 재확인"),
    item("d19-guttmann-docs", "Casa Guttmann에 여권 사본 미리 전송 <span class='tag hot'>출발 전</span>", "리셉션이 20:00에 닫아 셀프체크인으로 진행 — 여권(전원) 사본을 이메일 또는 왓츠앱(+39 331 178 2972)으로 미리 전달해야 체크인 당일 낮 12시경 접속 안내를 받음"),
    item("d19-taxi", "택시 사전 콜", "이메로비글리→JTR 14:30(€30~35) · FCO→Casa Guttmann 정액택시 €50"),
  ],
  // 10 · 10/20 바티칸
  [
    item("p-vatican", "🇰🇷 바티칸 투어 + 입장권 구매완료 <span class='tag hot'>구매완료</span>", "마이리얼트립 #3415360(약 5h) + 입장권 별도 구매완료. <b>시작 시각은 옵션에 따라 08·09·10시(박물관 배정) 또는 06:15</b> — 바우처로 정확한 시각 확인. 집합 = 오타비아노역 맞은편 OKAIDI 매장"),
    item("d20-dress", "성 베드로 대성당 복장", "무릎·어깨 가리는 옷 (남녀 모두)"),
    item("p-armando", "Armando al Pantheon 저녁 예약 <span class='tag hot'>지금</span>", "몇 주 전 마감되는 곳 — 10/20(화) 19:00. ☎ +39 06 6880 3034 / 홈페이지. 안 되면 Osteria da Fortunata(예약 불가, 19시 전 줄)"),
    item("p-rionexiv", "Rione XIV Bistrot 점심 예약 (14:00경)", "보르고 피오 18석, 화요일 점심 15:30까지 — 투어 종료 시각 보고 14:00~14:15로. 대안 La Cantina di Cesare(매일)"),
    item("d20-qr", "바우처·입장권 QR 폰에 저장", "정확한 시작 시각(08/09/10시 또는 06:15) 재확인. 집합은 배정 시각 20분 전. 성 베드로 대성당 내부는 투어 후 개별 입장(무료)"),
  ],
  // 11 · 10/21 남부투어(포지타노·아말피)
  [
    item("p-southtour", "남부투어 예약 완료 확인 <span class='tag hot'>예약완료</span>", "우노트래블 #3440846, 06:20 Hotel Galles 픽업. 해산 시각 미공지 → 확정서 확인"),
    item("d21-early", "06:00 기상 · 전날 밤 요기거리 준비", "숙소 조식 불가. 20일 밤 일찍 취침"),
    item("d21-pack", "수영복·선글라스·편한 신발", "폼페이입장·점심·미니버스·페리는 현장 별도 결제(2인 약 €130)"),
  ],
  // 12 · 10/22 고대 로마+판테온+트라스테베레 (21일에서 이동)
  [
    item("p-colosseum", "콜로세움 취소표 시도 → 없으면 외관만 <span class='tag hot'>매진</span>", "<b>ticketing.colosseo.it</b> — 방문 약 7일 전(10/15경) 추가 물량, 취소표는 <b>로마 자정 무렵(한국 아침 7시경)</b>에 가장 많이 올라옴. 10/22 15:00~15:30 슬롯이 동선에 맞음(€18/인, 포로·팔라티노 24h 포함). 끝내 없으면 외관 + 캄피돌리오 포로 전망(무료)"),
    item("p-pantheon", "판테온 시간지정 티켓 €7 <span class='tag hot'>가격 인상·날짜변경</span>", "21일→22일로 이동. 2026.7.1부 €7/인(구 €5). museiitaliani.it"),
    item("p-roscioli", "Roscioli 점심 12:00 <span class='tag hot'>예약완료</span>", "보르게세에서 11:10 택시 출발(15~20분). 노쇼 €20/인 — 늦으면 ☎ +39 06 687 5287"),
    item("p-borghese", "🎟️ 보르게세 09:00 현장 선착순 도전 <span class='tag hot'>오픈런</span>", "<b>08:20까지 매표소 줄</b>. 공식은 전원 예약제라 현장분은 노쇼·취소 소량뿐(보장 없음) → 전날 밤·당일 07시 공식 사이트(galleriaborghese.cultura.gov.it) 취소표 새로고침 병행. 백팩 반입 불가(클로크룸). 10:20까지 안 되면 포기하고 공원·핀초 테라스"),
    item("p-lastdinner", "마지막 만찬 예약 — Le Mani in Pasta (트라스테베레)", "☎ +39 06 581 6017 (전화 예약, 월요일 휴무 — 10/22는 목요일). 저녁 19:30~23:30, 20:00 권장. 낮 Roscioli가 묵직하니 저녁은 파스타 위주로 가볍게"),
  ],
  // 13 · 10/23 귀국
  [
    item("d23-babette", "Babette 점심 예약 (선택)", "Via Margutta 1d · ☎ +39 06 321 1559 · 금요일 영업. 대안 Il Vero Alfredo(12:30~) · Tartufi&Friends(브레이크 없음)"),
    item("d23-checkout", "Casa Guttmann 체크아웃 · 짐 보관", "숙소 or Radical Storage 앱(€5~6/개)"),
    item("d23-taxrefund", "택스리펀 서류 → FCO 세관", "출국심사 전 세관 승인/키오스크. 시간 걸리니 공항 일찍"),
    item("d23-massimo", "(선택) 팔라초 마시모 15:00", "<b>안 가도 됨.</b> OZ562가 밀려 생긴 1h25를 쓰고 싶을 때만. 테르미니역 옆이라 공항 동선 위. 금 09:00~19:00(마지막 입장 18:00), €8/인, 예약 불필요. 지치면 생략하고 카페에서 쉬기"),
    item("d23-fco", "17:00~17:15 FCO 이동", "정액택시 €50 / 레오나르도 익스프레스 €14. <b>19:45 도착 목표</b>(OZ562 <b>22:45</b> → ICN 10/24 <b>약 17:00</b>). 금요일 퇴근시간대 감안"),
  ],
];

/* ---------- 4) 준비 페이지 ---------- */
const prepGeneral = [
  item("p-cavo-season", "Cavo Tagoo 시즌 종료 확인 완료 <span class='tag hot'>확인 완료</span>", "호텔 회신: <b>레스토랑은 시즌 종료로 이용 불가</b>, 스파·인피니티풀 등 나머지 서비스는 정상. <b>10/19 체크아웃(12:00) 이후 영업 종료</b>(레이트 체크아웃 불가) — 10/16~18 점심·저녁은 이메로비글리·피로스테파니 식당으로, 조식 제공 방식은 체크인 때 확인. 체크아웃 후 짐 보관 여부는 미확인"),
  item("p-passport", "여권 3개월+ 유효 · 사본 폰 저장 <span class='tag hot'>필수</span>", "솅겐 출국(10/23) 기준 잔여 3개월 이상 + 발급 10년 이내. 갱신 2~3주. 여권 사진·사본 클라우드 저장"),
  item("p-etias", "솅겐 ETIAS 시행 여부 확인", "travel-europe.europa.eu. 시행됐으면 신청(€7, 몇 분). 한국 여권 90일 무비자는 유지"),
  item("p-insurance", "여행자보험 가입 (2인, 10/10~10/24)", "의료+휴대품+항공지연. 증권 PDF 폰 저장"),
  item("p-esim", "EU 전역 eSIM (구매완료)", "런던 히드로 도착 직후 개통 시작. 그리스·이탈리아 공용"),
  item("p-strike-check", "출발 1주 전 유적 개장시간·파업 재확인", "그리스는 유적·박물관 노조 파업으로 당일 휴관 생김. culture.gov.gr 공지. 아크로폴리스 2026년 10월 개장(확인 완료): 10/1~10/15 08:00~18:30(마감 18:00), 10/16~10/31 08:00~18:00(마감 17:30)"),
  item("r-cards-cash", "해외결제 카드 2장 + 유로 현금 2인 €700~900", "€50 이하 지폐로. 산토리니 버스·택시·소형 식당은 현금"),
  item("r-adapter", "C타입 유럽 플러그(220V)", "한국과 같은 C형이라 어댑터 불필요할 수 있음, 멀티탭 1개"),
  item("r-shoes", "편한 운동화 + 미끄럼 없는 신발", "대리석·자갈길·돌바닥. 저녁용 신발 따로"),
  item("r-layers", "10월 옷차림 낮 22~26℃ / 밤 15~18℃", "얇은 겉옷, 산토리니 저녁 바람막이, 성당용 어깨·무릎 가리는 옷, 수영복"),
  item("r-sun", "선크림·선글라스·모자", "아크로폴리스·포로 로마노·산토리니 능선 그늘 없음"),
  item("r-meds", "상비약 + 멀미약", "진통·지사·밴드·물집밴드. FR3021 멀미약"),
  item("r-daybag", "보안 크로스백 + 물통", "로마 지하철·트라스테베레·나보나 소매치기. 유럽 수돗물·분수 식수 가능"),
];
const prepCalendar = `<div class="note-card">📅 <b>예약 캘린더 (역산)</b><br>
· <b>🔴 오늘 당장</b>: <b>OZ521 스케줄 변경(07:50→08:30) → LHR 환승 95분</b> 구매처에 전화  · GQ350 실제 시각 확정<br>
· <b>지금</b>: 아르메나키에 셔틀 선택 회신 · Cavo Tagoo 스파 시간 회신 · Casa Guttmann 여권 사본 전송 · 여권/보험 확인<br>
· <b>10/22</b>: 보르게세는 당일 08:20 현장 줄(+공식 사이트 취소표), 콜로세움은 매진 → 취소표(로마 자정 무렵) 시도, 판테온은 여유<br>
· <b>10/22 마지막 만찬(Le Mani in Pasta, 전화)</b>: 예약 가능해지는 대로 (Roscioli 12:00은 예약완료)<br>
· <b>Cavo Tagoo 시즌 종료(10/19) 확인</b>: 지금 바로 메일<br>
· <b>출발 1주 전</b>: 유적 개장시간·파업 재확인<br>
· <b>🔴 10/1 점검 기준 아직 ⏳인 예약</b>: 콜로세움 취소표 · Armando al Pantheon(몇 주 전 마감) · Le Mani in Pasta(전화) · Sunset Ammoudi(온라인)</div>`;

/* ---------- 5) 페이지 HTML 조립 ---------- */
function daysec(title, listHtml) {
  return `<div class="sec daysec"><div class="sec-h"><h2>${title}</h2></div><div class="list">${listHtml}</div></div>`;
}
/* 소개문: 첫 문단만 보이고 나머지(배경 설명·오늘 경비)는 접기 — 여행 중엔 시간표가 먼저 보이게 */
function foldIntro(block) {
  return block.replace(/<div class="day-intro">([\s\S]*?)<\/div>/, (m, body) => {
    const parts = body.split(/<br>\s*<br>/);
    if (parts.length < 2) return m;
    const rest = parts.slice(1);
    const hasCost = rest.some((p) => /오늘 경비/.test(p));
    const label = hasCost ? (rest.length > 1 ? "배경 설명 · 오늘 경비" : "오늘 경비") : "배경 설명";
    return `<div class="day-intro">${parts[0]}<details class="more"><summary>${label} 더보기</summary>${rest.join("<br><br>")}</details></div>`;
  });
}
function dayPage(i) {
  const block = foldIntro(dayBlocks[i]).replace('<div class="day-intro">', '<div class="nowcard" hidden></div><div class="day-intro">'); // day-h / day-intro / stats / rows / alts
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
/* 한눈에 보기 데이터: [일자, 굵직한 일정, 예약완료[], 예약 필요[], 확인 필요]
   예약완료 → '한눈에 보기' 페이지, 예약 필요·확인 필요 → '준비' 페이지. 예약하면 예약 필요에서 예약완료로 옮길 것 */
const OV = [
  [0, "인천 → 런던(환승) → 아테네 도착 22:15", ["OZ521 08:30 ICN→LHR", "A3603 16:35 LHR→ATH"], ["심야 공항 픽업 확인"], "런던 환승 95분 — 항공사 문의"],
  [1, "제우스 신전·플라카·모나스티라키 + 오후 아크로폴리스 투어", ["14:00~18:00 한국어 아크로폴리스 투어(마이리얼트립)", "아크로폴리스 통합권 구매완료"], [], ""],
  [2, "아크로폴리스 박물관·로만 아고라·Meat the Greek·리카비토스 일몰 · 밤엔 Blame The Sun 탭룸", [], ["Nolan 저녁 예약(선택)"], ""],
  [3, "파나티나이코·국립고고학 박물관", ["19:15 CTC Urban Gastronomy(미슐랭 1스타)"], [], ""],
  [4, "아테네 → 산토리니(오이아) · 첫 일몰", ["GQ350 ATH 14:00 → JTR"], ["Sunset Ammoudi 저녁 예약(온라인, 보증금 €20/인)", "아르메나키 셔틀 선택 회신(합승 €45/프라이빗 €80)"], "GQ350 실제 출발 시각 재확인"],
  [5, "오이아 슬로우 모닝 · 오후 와이너리 투어", ["16:00 와이너리 미식 투어(호텔 픽업·하차, 5코스 정찬 포함)"], [], ""],
  [6, "Cavo Tagoo 입성 · 인피니티풀·선셋", [], ["Metaxi Mas 점심 예약(전화 필수)", "10/18 커플 스파 시간 회신"], ""],
  [7, "이메로비글리→피라 산책(약 4km) · 선사시대 티라 박물관 · 피르고스 일몰", [], ["피르고스 저녁 예약(Selene 등)", "귀가 택시 콜(컨시어지)"], ""],
  [8, "리조트 데이 · 커플 스파", [], ["스파 시간 재확인", "Mylos/Anogi 저녁 예약"], ""],
  [9, "체크아웃 → 산토리니 → 로마 · 트레비 야경", ["FR3021 JTR 17:30 → FCO 18:55"], ["Casa Guttmann에 여권 사본 사전 전송"], "Cavo Tagoo 12:00 완전 폐장 — 체크아웃 후 짐 보관 가능 여부 재확인"],
  [10, "바티칸 박물관·시스티나 · 성 베드로 대성당", ["바티칸 오전 한국어 투어(마이리얼트립, 약 5h)", "입장권 구매완료"], ["Armando al Pantheon 저녁 예약(지금 — 몇 주 전 마감)", "Rione XIV Bistrot 점심 예약(18석)"], "투어 바우처의 정확한 시작 시각(08/09/10시 또는 06:15) 확인"],
  [11, "남부투어 — 폼페이·소렌토·아말피·포지타노", ["06:20 Hotel Galles 픽업(우노트래블)"], [], ""],
  [12, "보르게세 오픈런·Roscioli·판테온·콜로세움(취소표/외관)·트라스테베레 · 마지막 만찬", ["12:00 Roscioli 점심"], ["보르게세 09:00 현장 선착순(취소표 새로고침 병행)", "콜로세움 취소표(로마 자정 무렵) — 없으면 외관", "판테온 시간지정 티켓", "마지막 만찬 예약(Le Mani in Pasta, 전화)"], ""],
  [13, "로마 마지막 날 → 귀국", ["OZ562 FCO 22:45 → ICN (10/24 약 17:00 도착)"], ["Babette 점심 예약(선택)"], ""],
];
const STAY = ["아테네 스튜디오", "코코맷 BC", "코코맷 BC", "코코맷 BC", "Armenaki(오이아)", "Armenaki(오이아)", "Cavo Tagoo", "Cavo Tagoo", "Cavo Tagoo", "Casa Guttmann", "Casa Guttmann", "Casa Guttmann", "Casa Guttmann", "체크아웃 → 22:45 출국"];
const ovRow = ([i, main, ok]) =>
  `<button class="ov-row" type="button" data-go="${i}"><span class="ov-d"><b>10/${10 + i}</b><small>${DOW[i]}</small></span><span class="ov-b"><span class="ov-t">${main}</span>` +
  ok.map((x) => `<span class="ov-ok">✅ ${x}</span>`).join("") + `<span class="ov-h">🏨 ${STAY[i]}</span></span></button>`;
let ovBody = "";
GROUPS.forEach((g) => g.subs.forEach((sub) => {
  ovBody += `<div class="ov-band">${g.flag} ${sub.city}</div>` + sub.idx.map((i) => ovRow(OV[i])).join("");
}));
const prepTodo = `<div class="note-card">🗓️ <b>날짜별 예약·확인 필요</b><br>` + OV.filter((r) => r[3].length || r[4]).map((r) =>
  `· <b>10/${10 + r[0]}</b> ` + r[3].map((x) => "⏳ " + x).concat(r[4] ? ["⚠️ " + r[4]] : []).join(" · ")).join("<br>") + `</div>`;
const prepPage = `<section class="daypage" id="pg-prep">
  <div class="day-h"><div class="daytag" style="--c: var(--teal)"><div><span class="dow">준비</span><div class="dt">D-day</div></div></div><div><div class="title">출발 전 준비</div><div class="sub">여권·비자·보험·현금 · 예약 캘린더 · 긴급정보</div></div></div>
  <div class="note-card dday" id="dday" hidden></div>
  ${prepTodo}
  ${prepCalendar}
  ${daysec("🧳 챙길 것 · 확인", prepGeneral.join(""))}
  ${budgetCard}
  <div class="sec daysec"><div class="sec-h"><h2>🚨 긴급 정보 · 필수 회화</h2></div>
  ${emergCard}
  <div class="note-card">🗣️ <b>필수 회화</b><br>
  [GR] 안녕 <b>야 사스</b> · 감사 <b>에프하리스토</b> · 계산서 <b>토 로가리아즈모 파라칼로</b> · 카드돼요? <b>데헤스테 카르타?</b><br>
  [IT] 안녕 <b>본조르노/차오</b> · 감사 <b>그라찌에</b> · 계산서 <b>일 콘토 페르 파보레</b> · 2명 자리 <b>운 타볼로 페르 두에</b> · 카드돼요? <b>포소 파가레 콘 라 카르타?</b></div>
  </div>
</section>`;

const ovPage = `<section class="daypage" id="pg-ov">
  <div class="day-h"><div class="daytag" style="--c: var(--indigo)"><div><span class="dow">전체</span><div class="dt">14일</div></div></div><div><div class="title">한눈에 보기</div><div class="sub">날짜별 굵직한 일정 · 예약완료 항목 (누르면 그날 상세로)</div></div></div>
  <div class="ov-legend">✅ 예약완료 항목만 표시 · 예약·확인이 필요한 것은 ‘준비’ 페이지</div>
  ${ovBody}
  <div class="ov-band">🏠 10/24 토 · 인천 도착 (약 17:00)</div>
</section>`;

/* 저장해 둔 장소(구글맵 리스트 3개) — saved-places.json: [도시, 이름, 위도, 경도, 분류, 일정태그, 메모, 검색어] */
const CITIES = ["아테네", "산토리니", "로마"];
const SAVED = JSON.parse(fs.readFileSync(path.join(__dirname, "saved-places.json"), "utf8"));
const svRank = (p) => (/숙소/.test(p[4]) ? 0 : (p[5].match(/10\/(\d+)/) || [])[1] ? +p[5].match(/10\/(\d+)/)[1] : 99);
SAVED.sort((a, b) => CITIES.indexOf(a[0]) - CITIES.indexOf(b[0]) || svRank(a) - svRank(b)); // 도시 내 순서: 숙소 → 일정 날짜 순 → 일정 외(위치 켜면 가까운 순)
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const svItem = ([city, name, lat, lng, cat, plan, memo, q], n) =>
  `<div class="sv-item" data-city="${city}" data-i="${n}" data-ll="${lat},${lng}"><div class="sv-main"><b>${esc(name)}</b><span class="sv-cat">${esc(cat)}</span>` +
  (plan ? `<span class="sv-plan">📅 ${esc(plan)}</span>` : "") + (memo ? `<span class="sv-note">${esc(memo)}</span>` : "") +
  `</div><div class="sv-act"><span class="sv-dist"></span><a class="sv-btn nav" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener">🧭 길찾기</a><a class="sv-btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}" target="_blank" rel="noopener">🗺️ 지도</a></div></div>`;
const savedPage = `<section class="daypage" id="pg-saved">
  <div class="day-h"><div class="daytag" style="--c: var(--gold)"><div><span class="dow">저장</span><div class="dt">${SAVED.length}곳</div></div></div><div><div class="title">📌 저장해 둔 곳</div><div class="sub">구글맵 리스트(아테네·산토리니·로마) · 📅 = 일정에 넣은 날 · 내 위치 켜면 가까운 순</div></div></div>
  <div class="sv-bar"><div class="seg" role="tablist">${CITIES.map((c, k) => `<button type="button" class="seg-b${k ? "" : " on"}" data-city="${c}">${c}</button>`).join("")}</div>
  <button type="button" class="geobtn" id="sv-geo">📍 가까운 순</button><label class="sv-only"><input type="checkbox" id="sv-plan" /> 일정에 넣은 곳만</label></div>
  <div class="geonote" id="sv-note"></div>
  <div class="sv-list" id="sv-list">${SAVED.map(svItem).join("")}</div>
</section>`;

const pagesHtml = [ovPage, prepPage, savedPage].concat(dayBlocks.map((_, i) => dayPage(i))).join("\n");

/* 상단 네비 — 한 줄 가로 스크롤 */
function chip(target, label, cls) {
  return `<button class="chip${cls ? " " + cls : ""}" data-go="${target}">${label}</button>`;
}
let navHtml = `<div class="navrow">${chip("ov", "한눈에")}${chip("prep", "준비")}${chip("saved", "📌 저장")}`;
GROUPS.forEach((g) => {
  g.subs.forEach((sub, k) => {
    navHtml += `<span class="sub">${k === 0 ? g.flag + " " : ""}${sub.city}</span>` + sub.idx.map((i) => chip(String(i), `${10 + i}<small>${DOW[i]}</small>`, "d")).join("");
  });
});
navHtml += `</div>`;

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
  .ov-legend { font-size: 12px; color: var(--sub); margin: 10px 2px 0; }
  .ov-band { font-size: 12.5px; font-weight: 800; margin: 14px 2px 6px; }
  .ov-row { display: flex; gap: 10px; width: 100%; text-align: left; font: inherit; color: inherit; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 9px 10px; margin: 0 0 6px; cursor: pointer; box-shadow: var(--shadow); -webkit-tap-highlight-color: transparent; }
  .ov-d { flex: none; width: 44px; text-align: center; }
  .ov-d b { display: block; font-size: 14px; }
  .ov-d small { font-size: 10.5px; color: var(--faint); }
  .ov-b { flex: 1; min-width: 0; }
  .ov-b > span { display: block; }
  .ov-t { font-weight: 700; font-size: 13.5px; line-height: 1.4; }
  .ov-ok, .ov-todo, .ov-warn { font-size: 12px; line-height: 1.5; margin-top: 2px; }
  .ov-ok { color: var(--teal); font-weight: 700; }
  .ov-todo { color: var(--sub); }
  .ov-warn { color: var(--accent); font-weight: 600; }
  .ov-h { font-size: 11px; color: var(--faint); margin-top: 3px; }
  .fxbox { font-size: 13px; line-height: 2.1; }
  .fxbox[hidden] { display: none; }
  .fxbox input { width: 5.6em; font: inherit; font-weight: 700; text-align: right; padding: 2px 6px; border: 1px solid var(--line-strong); border-radius: 7px; background: var(--card); color: var(--ink); }
  .fxbox button { font: inherit; font-size: 11.5px; font-weight: 700; padding: 2px 8px; border: 1px solid var(--line-strong); border-radius: 7px; background: var(--card); color: var(--sub); cursor: pointer; }
  .krw { color: var(--teal); font-weight: 600; font-size: .9em; white-space: nowrap; }

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
    #emerg { display: block !important; }
    .deck { display: block !important; overflow: visible !important; height: auto !important; scroll-snap-type: none; }
    .daypage { display: block !important; width: auto !important; min-width: 0 !important; height: auto !important; overflow: visible !important; page-break-after: always; scroll-snap-align: none; padding: 0 0 12px; }
    .daymap, .dayroute-link { display: none !important; }
    .daymap-img { display: block !important; }
    .daymap-static { display: block !important; }
    .day, .list, .note-card, .sec, .daymap-wrap { break-inside: avoid; page-break-inside: avoid; }
    a { color: #000; text-decoration: none; }
  }

  /* ===== 여행 중 사용성 개편 (2026-10) ===== */
  .hdr { padding: calc(6px + env(safe-area-inset-top)) 12px 6px; }
  .hdr h1 { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .hdr h1 .k { font-size: 13px; margin-left: 4px; }
  .hdr-btns .fontbtn { min-width: 34px; min-height: 30px; }
  .navwrap { margin-top: 6px; max-height: none; overflow: visible; }
  .navrow { gap: 4px; padding: 2px 0 1px; scroll-padding: 0 40%; }
  .navrow .sub { font-size: 10.5px; color: var(--sub); padding: 0 1px 0 8px; border-left: 1px solid var(--line-strong); margin-left: 3px; }
  .chip { min-height: 34px; padding: 4px 11px; font-size: 12.5px; }
  .chip.d { padding: 4px 8px; min-width: 40px; }
  .chip.d small { display: block; font-size: 9px; line-height: 1; margin: 1px 0 0; }

  /* 하단 빠른 메뉴 — 엄지로 닿는 곳 */
  .bbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; display: flex; justify-content: space-around; gap: 2px;
    padding: 4px 6px calc(4px + env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--card) 94%, transparent);
    backdrop-filter: saturate(1.4) blur(12px); -webkit-backdrop-filter: saturate(1.4) blur(12px); border-top: 1px solid var(--line); }
  .bb { flex: 1; max-width: 92px; display: flex; flex-direction: column; align-items: center; gap: 1px; border: 0; background: none; color: var(--ink);
    font: inherit; padding: 5px 0 3px; border-radius: 10px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .bb span { font-size: 19px; line-height: 1.1; font-weight: 800; }
  .bb small { font-size: 10px; font-weight: 700; color: var(--sub); }
  .bb:active, .bb.on { background: color-mix(in srgb, var(--indigo) 12%, transparent); }
  .bb.today small { color: var(--accent); }
  .daypage { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
  @media (min-width: 720px) { .deck-arrow { top: auto; bottom: calc(80px + env(safe-area-inset-bottom)); transform: none; } }

  /* 시트(환율·긴급) — 헤더를 밀지 않고 하단 위로 */
  .sheet { position: fixed; left: 8px; right: 8px; bottom: calc(64px + env(safe-area-inset-bottom)); z-index: 45; max-height: 70vh; overflow-y: auto;
    background: var(--card); border: 1px solid var(--line-strong); border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,.28); padding: 12px 14px; margin: 0; }
  .sheet[hidden] { display: none; }
  .sheet .note-card { margin: 0; border: 0; padding: 0; background: none; }
  .sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 14px; }
  .sheet-x { border: 0; background: var(--paper); color: var(--sub); width: 32px; height: 32px; border-radius: 50%; font-size: 15px; cursor: pointer; }
  @media (min-width: 720px) { .sheet { left: auto; right: 16px; width: 380px; } }

  /* 지금 / 다음 카드 */
  .nowcard { margin: 10px 0 2px; border-radius: 14px; padding: 10px 12px; background: color-mix(in srgb, var(--accent) 10%, var(--card)); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); }
  .nowcard[hidden] { display: none; }
  .nc-row { display: flex; gap: 8px; align-items: baseline; font-size: 13.5px; line-height: 1.45; }
  .nc-row + .nc-row { margin-top: 4px; }
  .nc-k { flex: none; font-size: 10.5px; font-weight: 800; color: #fff; background: var(--accent); border-radius: 5px; padding: 1px 6px; }
  .nc-k.n { background: var(--indigo); }
  .nc-t { font-weight: 800; flex: none; }
  .nc-a { min-width: 0; }
  .nc-left { color: var(--sub); font-size: 12px; white-space: nowrap; }
  .nc-go { display: inline-block; margin-top: 8px; font-size: 12.5px; font-weight: 800; color: #fff; background: var(--accent); border-radius: 9px; padding: 6px 12px; text-decoration: none; }
  .nc-jump { margin: 8px 0 0 6px; font: inherit; font-size: 12.5px; font-weight: 700; color: var(--accent); background: none; border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); border-radius: 9px; padding: 5px 10px; cursor: pointer; }
  .dday { font-size: 14px; }
  .dday b { font-size: 18px; color: var(--accent); }

  /* 소개문 접기 */
  details.more { margin-top: 6px; }
  details.more > summary { cursor: pointer; font-size: 12px; font-weight: 700; color: var(--teal); list-style: none; padding: 4px 0; }
  details.more > summary::-webkit-details-marker { display: none; }
  details.more > summary::before { content: "▸ "; }
  details.more[open] > summary::before { content: "▾ "; }

  /* 일정 행: 시각을 더 굵게, 지도/길찾기 버튼은 손가락 크기로 */
  .row .time { font-variant-numeric: tabular-nums; }
  .row a.map, .item a.map { display: inline-flex; align-items: center; min-height: 32px; padding: 3px 10px; margin-top: 6px; }
  .item a.map { font-size: 11.5px; min-height: 28px; margin-top: 4px; }
  .tag.sv { background: color-mix(in srgb, var(--gold) 16%, transparent); color: var(--gold); border-color: color-mix(in srgb, var(--gold) 40%, transparent); }

  /* 저장 장소 */
  .sv-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 12px 0 4px; }
  .seg { display: inline-flex; border: 1px solid var(--line-strong); border-radius: 10px; overflow: hidden; }
  .seg-b { flex: none; white-space: nowrap; border: 0; background: var(--card); color: var(--sub); font: inherit; font-weight: 700; font-size: 13px; padding: 7px 12px; min-height: 36px; cursor: pointer; }
  .seg-b + .seg-b { border-left: 1px solid var(--line-strong); }
  .seg-b.on { background: var(--indigo); color: #fff; }
  .sv-bar .geobtn { min-height: 36px; font-size: 12.5px; }
  .sv-only { font-size: 12px; color: var(--sub); display: inline-flex; gap: 4px; align-items: center; }
  .sv-list { margin-top: 8px; }
  .sv-item { display: flex; gap: 10px; align-items: center; justify-content: space-between; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 9px 10px; margin-bottom: 6px; }
  .sv-item[hidden] { display: none; }
  .sv-main { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .sv-main b { font-size: 14px; }
  .sv-cat { font-size: 11.5px; color: var(--sub); }
  .sv-plan { font-size: 11.5px; font-weight: 700; color: var(--teal); }
  .sv-note { font-size: 11.5px; color: var(--faint); }
  .sv-act { flex: none; display: flex; flex-direction: column; gap: 4px; align-items: stretch; text-align: center; }
  .sv-dist { font-size: 11px; font-weight: 800; color: var(--indigo); min-height: 0; }
  .sv-btn { font-size: 11.5px; font-weight: 700; text-decoration: none; color: var(--teal); border: 1px solid color-mix(in srgb, var(--teal) 38%, transparent); border-radius: 8px; padding: 5px 8px; white-space: nowrap; }
  .sv-btn.nav { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }

  @media print {
    .bbar, .nowcard, .sheet-x, .sv-bar, .sv-act a { display: none !important; }
    .sheet { position: static !important; box-shadow: none; max-height: none; border: 0; }
    .sheet#fxbox { display: none !important; }
    .sv-item[hidden] { display: flex !important; }
  }
`;

/* ---------- 7) 런타임 스크립트 ---------- */
const RUNTIME = `
${daysLit}
${foodLit}
${buildSvgFn}
  var MAPS = [];
  var TRIP0 = new Date(2026, 9, 10); // 10/10(토) = day 0
  function ll(p) { return p[0] + "," + p[1]; }
  var DRIVE = { 0: 1, 4: 1, 6: 1, 7: 1, 9: 1, 13: 1 };
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
    cbs: [],
    render: function () {
      var me = this.pos;
      if (!me) return;
      this.cbs.forEach(function (f) { f(me); });
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
    rows.parentNode.insertBefore(wrap, rows.nextSibling); // 여행 중엔 시간표가 먼저, 지도는 그 아래(넓은 화면은 오른쪽 고정)
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
    var cur = document.getElementById("hdr-cur");
    if (cur) cur.textContent = go === "ov" ? "· 한눈에" : go === "prep" ? "· 준비" : go === "saved" ? "· 저장한 곳" : go === "end" ? "· 10/24" : (go != null ? "· 10/" + (10 + +go) + " " + "토일월화수목금토일월화수목금".charAt(+go) : "");
    var bs = document.getElementById("bb-saved"); if (bs) bs.classList.toggle("on", go === "saved");
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

  /* --- 📌 저장 장소: 도시 탭 · 일정만 · 가까운 순 --- */
  (function () {
    var list = document.getElementById("sv-list"); if (!list) return;
    var items = Array.prototype.slice.call(list.querySelectorAll(".sv-item"));
    var segs = Array.prototype.slice.call(document.querySelectorAll(".seg-b"));
    var only = document.getElementById("sv-plan"), note = document.getElementById("sv-note"), gb = document.getElementById("sv-geo");
    var city = "아테네", sorted = false;
    function apply() {
      segs.forEach(function (b) { b.classList.toggle("on", b.dataset.city === city); });
      items.forEach(function (el) { el.hidden = el.dataset.city !== city || (only.checked && !el.querySelector(".sv-plan")); });
    }
    function cityOf(i) { return i == null ? null : i <= 3 ? "아테네" : i <= 8 ? "산토리니" : "로마"; }
    function near(me) {
      var best = null;
      items.forEach(function (el) {
        var ll = el.dataset.ll.split(",").map(Number), d = distM(me, ll);
        el._d = d; el.querySelector(".sv-dist").textContent = fmtD(d);
        if (!best || d < best._d) best = el;
      });
      if (sorted) {
        items.slice().sort(function (a, b) { return a._d - b._d; }).forEach(function (el) { list.appendChild(el); });
        if (best && best._d < 60000 && best.dataset.city !== city && !list._picked) { city = best.dataset.city; list._picked = 1; apply(); }
        note.textContent = "가까운 순 정렬 · 가장 가까운 곳: " + best.querySelector("b").textContent + " " + fmtD(best._d);
      }
    }
    GEO.cbs.push(near);
    segs.forEach(function (b) { b.addEventListener("click", function () { city = b.dataset.city; apply(); }); });
    only.addEventListener("change", apply);
    gb.addEventListener("click", function () { sorted = true; gb.classList.add("on"); GEO.start(); if (GEO.pos) near(GEO.pos); else note.textContent = "위치 잡는 중…"; });
    // 하단 ‘근처 저장’: 지금 보고 있는 날의 도시로 열고, 위치를 켜면 가까운 순
    document.getElementById("bb-saved").addEventListener("click", function () {
      var el = pageEls()[curIndex()], d = el && el.dataset.day != null ? +el.dataset.day : todayIdx();
      if (el && el.id !== "pg-saved") city = cityOf(d) || city;
      apply(); goto("saved");
      if (GEO.watch != null || GEO.pos) { sorted = true; gb.classList.add("on"); if (GEO.pos) near(GEO.pos); }
    });
    city = cityOf(todayIdx()) || city; apply();
  })();

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
  function sheet(el, show) {
    Array.prototype.forEach.call(document.querySelectorAll(".sheet"), function (x) { if (x !== el) x.hidden = true; });
    el.hidden = show === undefined ? !el.hidden : !show;
    document.getElementById("emerg-btn").classList.toggle("on", !document.getElementById("emerg").hidden);
    document.getElementById("fxbtn").classList.toggle("on", !document.getElementById("fxbox").hidden);
  }
  if (eb) eb.addEventListener("click", function () { sheet(ebx); });
  Array.prototype.forEach.call(document.querySelectorAll(".sheet-x"), function (b) { b.addEventListener("click", function () { sheet(document.getElementById(b.dataset.close), false); }); });
  deck.addEventListener("click", function () { Array.prototype.forEach.call(document.querySelectorAll(".sheet"), function (x) { if (!x.hidden) sheet(x, false); }); });

  /* --- 환율 · 본문의 €금액 옆에 원화 병기 --- */
  var FXKEY = KEY + "_fx", FXDEF = 1591, fx = FXDEF; // 1€=₩1,591 (2026-09-20 시장환율)
  try { var fxs = parseFloat(localStorage.getItem(FXKEY)); if (fxs > 0) fx = fxs; } catch (e) {}
  function won(e) { return "₩" + (Math.round(e * fx / 1000) * 1000).toLocaleString("en-US"); }
  function fxRender() {
    Array.prototype.forEach.call(document.querySelectorAll(".krw"), function (s) {
      s.textContent = " (" + won(+s.dataset.lo) + (s.dataset.hi ? "~" + won(+s.dataset.hi).slice(1) : "") + ")";
    });
  }
  (function () {
    var w = document.createTreeWalker(document.getElementById("deck"), NodeFilter.SHOW_TEXT), ns = [], n;
    while ((n = w.nextNode())) if (n.nodeValue.indexOf("€") >= 0) ns.push(n);
    var re = /€(\\d[\\d,]*)(?:~(\\d[\\d,]*))?/g;
    ns.forEach(function (n) {
      var t = n.nodeValue, f = document.createDocumentFragment(), last = 0, m, hit = false;
      re.lastIndex = 0;
      while ((m = re.exec(t))) {
        if (m[0] === "€0" || /\\(약 $/.test(t.slice(0, m.index))) continue; // €0은 병기 안 함 // "₩140,000(약 €88)" 처럼 원화가 원가인 환산값은 그대로
        var end = m.index + m[0].length, s = document.createElement("span");
        f.appendChild(document.createTextNode(t.slice(last, end)));
        s.className = "krw"; s.dataset.lo = m[1].replace(/,/g, ""); if (m[2]) s.dataset.hi = m[2].replace(/,/g, "");
        f.appendChild(s); last = end; hit = true;
      }
      if (!hit) return;
      f.appendChild(document.createTextNode(t.slice(last)));
      n.parentNode.replaceChild(f, n);
    });
    fxRender();
    var fr = document.getElementById("fx-rate"), fe = document.getElementById("fx-eur"), fk = document.getElementById("fx-krw");
    function conv(fromEur) {
      if (fromEur) fk.value = fe.value === "" ? "" : Math.round(fe.value * fx);
      else fe.value = fk.value === "" ? "" : (fk.value / fx).toFixed(2);
    }
    function setRate(v) {
      fx = v; fr.value = v; fxRender(); conv(true);
      try { if (v === FXDEF) localStorage.removeItem(FXKEY); else localStorage.setItem(FXKEY, v); } catch (e) {}
    }
    fr.value = fx;
    fr.addEventListener("input", function () { var v = parseFloat(fr.value); if (v > 0) { fx = v; fxRender(); conv(true); try { localStorage.setItem(FXKEY, v); } catch (e) {} } });
    document.getElementById("fx-reset").addEventListener("click", function () { setRate(FXDEF); });
    fe.addEventListener("input", function () { conv(true); });
    fk.addEventListener("input", function () { conv(false); });
    var fb2 = document.getElementById("fxbtn"), fbx = document.getElementById("fxbox");
    fb2.addEventListener("click", function () { sheet(fbx); if (!fbx.hidden) setTimeout(function () { fe.focus(); }, 50); });
  })();

  /* --- 상단 메뉴바(일자 칩) 접기/펴기 --- */
  var HKEY = KEY + "_hdr", hc = false, nw = document.querySelector(".navwrap"), hbtn = document.getElementById("hdrbtn");
  try { hc = localStorage.getItem(HKEY) === "1"; } catch (e) {}
  function applyHdr() { nw.hidden = hc; hbtn.textContent = hc ? "▼" : "▲"; hbtn.title = hc ? "메뉴 펴기" : "메뉴 접기"; setH(); }
  applyHdr();
  hbtn.addEventListener("click", function () { hc = !hc; applyHdr(); try { localStorage.setItem(HKEY, hc ? "1" : "0"); } catch (e) {} });

  /* --- 글자 크게 --- */
  var FKEY = KEY + "_big", big = false;
  try { big = localStorage.getItem(FKEY) === "1"; } catch (e) {}
  function applyFont(v) { document.documentElement.toggleAttribute("data-big", v); }
  applyFont(big);
  var fb = document.getElementById("fontbtn");
  if (fb) fb.addEventListener("click", function () { big = !big; applyFont(big); try { localStorage.setItem(FKEY, big ? "1" : "0"); } catch (e) {} setH(); });

  /* --- PDF --- */
  var pb = document.getElementById("pdfbtn");
  function openAll() { Array.prototype.forEach.call(document.querySelectorAll("details.more"), function (d) { d.open = true; }); }
  window.addEventListener("beforeprint", openAll);
  if (pb) pb.addEventListener("click", function () { openAll(); window.print(); });
  if (location.search.indexOf("pdf=1") >= 0) openAll();
  if (location.search.indexOf("pdf=1") >= 0) document.documentElement.setAttribute("data-pdf", "1");

  /* --- 서비스워커 --- */
  if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });

  /* --- 오늘 / 지금 할 일 --- */
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
    nowCard(pg, hit, mins);
    return hit;
  }
  /* 오늘 페이지 맨 위 ‘지금 / 다음’ 카드 — 시간표를 스크롤하지 않고 바로 다음 행동과 길찾기 */
  function rowTitle(r) {
    var a = r.querySelector(".act").cloneNode(true);
    Array.prototype.forEach.call(a.querySelectorAll(".note,.addr,a,.pill,.krw"), function (x) { x.remove(); });
    var t = a.textContent.replace(/\\s+/g, " ").trim();
    return t.length > 70 ? t.slice(0, 68) + "…" : t;
  }
  function rowMin(r) {
    var m = ((r.querySelector(".time") || {}).textContent || "").match(/(\\d{1,2}):(\\d{2})/);
    return m ? +m[1] * 60 + +m[2] : null;
  }
  function nowCard(pg, hit, mins) {
    Array.prototype.forEach.call(document.querySelectorAll(".nowcard"), function (c) { if (c.parentNode !== pg) c.hidden = true; });
    var card = pg.querySelector(".nowcard");
    if (!card) return;
    var rows = Array.prototype.slice.call(pg.querySelectorAll(".rows .row")), next = null;
    rows.forEach(function (r) { var m = rowMin(r); if (next === null && m !== null && m > mins) next = r; });
    var h = "", hh = function (m) { var d = m - mins; return d < 60 ? d + "분 후" : Math.floor(d / 60) + "시간 " + (d % 60 ? (d % 60) + "분 " : "") + "후"; };
    if (hit) h += '<div class="nc-row"><span class="nc-k">지금</span><span class="nc-a">' + rowTitle(hit) + "</span></div>";
    if (next) {
      var nm = rowMin(next);
      h += '<div class="nc-row"><span class="nc-k n">다음</span><span class="nc-t">' + next.querySelector(".time").textContent.replace(/선택/, "").trim() + '</span><span class="nc-a">' + rowTitle(next) + ' <span class="nc-left">' + hh(nm) + "</span></span></div>";
      var nav = next.querySelector("a.map.nav") || next.querySelector("a.map");
      if (nav) h += '<a class="nc-go" href="' + nav.href + '" target="_blank" rel="noopener">🧭 다음 장소 길찾기</a>';
    } else if (hit) {
      h += '<div class="nc-row"><span class="nc-k n">끝</span><span class="nc-a">오늘 시간표는 여기까지 — 푹 쉬세요</span></div>';
    }
    if (hit) h += '<button type="button" class="nc-jump">시간표에서 보기</button>';
    card.innerHTML = h;
    card.hidden = !h;
    var j = card.querySelector(".nc-jump");
    if (j) j.addEventListener("click", function () { hit.scrollIntoView({ block: "center", behavior: "smooth" }); });
  }
  /* 여행 전: 준비 페이지에 D-day */
  (function () {
    var el = document.getElementById("dday"); if (!el) return;
    var t = new Date(), d0 = new Date(t.getFullYear(), t.getMonth(), t.getDate()), n = Math.round((TRIP0 - d0) / 86400000);
    if (n > 0) { el.innerHTML = "✈️ 출발까지 <b>D-" + n + "</b> · 10/10(토) 08:30 인천 OZ521 — 05:30 공항 도착. 아래 ⏳ 예약부터 처리하세요"; el.hidden = false; }
  })();
  function goToday(scrollRow, instant) {
    var i = todayIdx();
    goto(i === null ? "prep" : String(i), instant);
    var hit = markNow();
    // 맨 위 ‘지금/다음’ 카드가 보이게 페이지 처음으로. 카드의 ‘시간표에서 보기’로 지금 행까지 이동
    var pg = document.getElementById(i === null ? "pg-prep" : "pg-" + i);
    if (pg && (scrollRow || !hit)) pg.scrollTo({ top: 0, behavior: instant ? "auto" : "smooth" });
  }
  /* --- 한눈에 보기: 행을 누르면 그날 상세로 --- */
  Array.prototype.forEach.call(document.querySelectorAll(".ov-row"), function (r) { r.addEventListener("click", function () { goto(r.dataset.go); }); });
  document.getElementById("bb-prev").addEventListener("click", function () { document.querySelector(".deck-arrow.prev").click(); });
  document.getElementById("bb-next").addEventListener("click", function () { document.querySelector(".deck-arrow.next").click(); });
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
    <h1>🇬🇷🇮🇹 신혼여행 <span class="k" id="hdr-cur"></span></h1>
    <div class="hdr-btns">
      <button class="fontbtn" id="fontbtn" title="글자 크게" aria-label="글자 크게">가A</button>
      <button class="fontbtn" id="pdfbtn" title="PDF로 저장/인쇄" aria-label="PDF 저장">⬇︎</button>
      <button class="fontbtn" id="hdrbtn" title="메뉴 접기">▲</button>
    </div>
  </div>
  <div class="navwrap">${navHtml}</div>
</header>

<div class="sheet" id="emerg" hidden><div class="sheet-h"><b>🚨 긴급 정보</b><button type="button" class="sheet-x" data-close="emerg" aria-label="닫기">✕</button></div>${emergCard}</div>
<div class="sheet note-card fxbox" id="fxbox" hidden>
  <div class="sheet-h"><b>💶 환율 계산기</b><button type="button" class="sheet-x" data-close="fxbox" aria-label="닫기">✕</button></div>
  1€ = ₩<input id="fx-rate" type="number" inputmode="decimal" min="1" step="any" aria-label="1유로당 원화" /> <button id="fx-reset" type="button">기본값</button><br>
  <input id="fx-eur" type="number" inputmode="decimal" min="0" step="any" aria-label="유로" /> € = ₩<input id="fx-krw" type="number" inputmode="numeric" min="0" step="any" aria-label="원화" /><br>
  <span class="en">기본값은 2026-09-20 기준 시장환율. 카드·환전소 환율은 보통 1~3% 다르니 실제 값으로 고쳐 입력하세요. 이 기기에 저장됩니다.</span>
</div>

<nav class="bbar" aria-label="빠른 메뉴">
  <button type="button" class="bb" id="bb-prev" aria-label="이전 날"><span>‹</span><small>이전</small></button>
  <button type="button" class="bb today" id="todaybtn" title="오늘 일정으로"><span>📍</span><small>오늘</small></button>
  <button type="button" class="bb" id="bb-saved"><span>📌</span><small>근처 저장</small></button>
  <button type="button" class="bb" id="fxbtn" title="환율 계산기"><span>💶</span><small>환율</small></button>
  <button type="button" class="bb emerg-btn" id="emerg-btn" title="긴급정보"><span>🚨</span><small>긴급</small></button>
  <button type="button" class="bb" id="bb-next" aria-label="다음 날"><span>›</span><small>다음</small></button>
</nav>

<button class="deck-arrow prev" aria-label="이전 날">‹</button>
<button class="deck-arrow next" aria-label="다음 날">›</button>

<main class="deck" id="deck">
${pagesHtml}
<section class="daypage" id="pg-end">
  <div class="day-h"><div class="daytag" style="--c: var(--gold)"><div><span class="dow">토</span><div class="dt">10/24</div></div></div><div><div class="title">인천 도착</div><div class="sub">OZ562 FCO 22:45 → ICN 약 17:00</div></div></div>
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
