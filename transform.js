// 원본 일정 HTML → PWA + 아코디언 index.html 로 변환
const fs = require("fs");
const path = require("path");
const SRC = "C:/Claude/greece-italy-honeymoon-2026.html";
const OUT = "C:/Claude/gi-build/index.html";
let s = fs.readFileSync(SRC, "utf8");
const before = s.length;

// 1) head 상당 부분: manifest / theme-color / apple-touch-icon
s = s.replace(
  '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />',
  '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />\n' +
  '<link rel="manifest" href="manifest.webmanifest" />\n' +
  '<meta name="theme-color" content="#12141b" />\n' +
  '<meta name="apple-mobile-web-app-capable" content="yes" />\n' +
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n' +
  '<meta name="apple-mobile-web-app-title" content="\uc2e0\ud63c\uc5ec\ud589" />\n' +
  '<link rel="apple-touch-icon" href="icon-192.png" />'
);

// 2) .day -> <details>  /  .day-h -> <summary>
let dayIdx = 0;
s = s.replace(/<div class="day">\n      <div class="day-h">/g, function () {
  const openAttr = dayIdx === 0 ? " open" : "";
  dayIdx++;
  return '<details class="day"' + openAttr + '>\n      <summary class="day-h">';
});
s = s.replace(/\n      <\/div>\n      <div class="day-intro">/g, '\n      </summary>\n      <div class="day-intro">');
s = s.split('\n    </div>\n\n    <!-- 10/').join('\n    </details>\n\n    <!-- 10/');
s = s.replace('\n    </div>\n\n    <div class="note-card">\n      \ud83d\udcb0', '\n    </details>\n\n    <div class="note-card">\n      \ud83d\udcb0');

if (dayIdx !== 14) throw new Error("day \uce74\ub4dc \ubcc0\ud658 \uac1c\uc218 \uc774\uc0c1: " + dayIdx);
if ((s.match(/<details class="day"/g) || []).length !== 14) throw new Error("details.day \uac1c\uc218 \uc774\uc0c1");
if ((s.match(/<\/details>/g) || []).length !== 14) throw new Error("</details> \uac1c\uc218 \uc774\uc0c1: " + (s.match(/<\/details>/g) || []).length);

// 3) 상단바: PDF 버튼 + 날짜 네비 컨테이너
s = s.replace(
  '<button class="fontbtn" id="fontbtn" title="\uae00\uc790 \ud06c\uac8c">\uac00A</button>',
  '<button class="fontbtn" id="pdfbtn" title="PDF\ub85c \uc800\uc7a5/\uc778\uc1c4">\u2b07\ufe0ePDF</button><button class="fontbtn" id="fontbtn" title="\uae00\uc790 \ud06c\uac8c">\uac00A</button>'
);
s = s.replace(
  '<div class="progwrap" id="progwrap" hidden>',
  '<div class="daynav" id="daynav" hidden></div>\n    <div class="progwrap" id="progwrap" hidden>'
);

// 4) 지도 초기화 → 지연(deferred) + 오프라인 안전 : 두 조각으로 치환
const r4a_old = '      var map = null, markers = [], latlngs = pts.map(function (p) { return [p[0], p[1]]; });\n      if (window.L) {\n        try {';
const r4a_new = '      var map = null, markers = [], built = false, latlngs = pts.map(function (p) { return [p[0], p[1]]; });\n      svgDiv.style.display = "block";\n      function buildLeaflet() {\n        if (built || !window.L || !navigator.onLine || /pdf=1/.test(location.search)) return;\n        built = true;\n        try {';
if (s.indexOf(r4a_old) < 0) throw new Error("r4a \ubbf8\ubc1c\uacac");
s = s.replace(r4a_old, r4a_new);

const r4b_old = '          applyView();\n          MAPS.push(map);\n          setTimeout(function () { map.invalidateSize(); applyView(); }, 250);\n        } catch (e) { map = null; mapDiv.style.display = "none"; svgDiv.style.display = "block"; }\n      } else {\n        mapDiv.style.display = "none";\n        svgDiv.style.display = "block";\n      }';
const r4b_new = '          map._fit = applyView; mapDiv._lmap = map; MAPS.push(map);\n          mapDiv.style.display = "block"; svgDiv.style.display = "none";\n          applyView();\n          setTimeout(function () { map.invalidateSize(); applyView(); }, 60);\n        } catch (e) { built = false; map = null; mapDiv.style.display = "none"; svgDiv.style.display = "block"; }\n      }\n      var host = wrap.closest ? wrap.closest("details.day") : null;\n      if (!host || host.open) buildLeaflet();\n      if (host) host.addEventListener("toggle", function () {\n        if (!host.open) return;\n        buildLeaflet();\n        if (map) setTimeout(function () { map.invalidateSize(); if (map._fit) map._fit(); }, 60);\n      });';
if (s.indexOf(r4b_old) < 0) throw new Error("r4b \ubbf8\ubc1c\uacac");
s = s.replace(r4b_old, r4b_new);

// 4c) \uc2e4\uc81c \uc9c0\ub3c4 \ucea1\ucc98 \uc774\ubbf8\uc9c0 <img> \uc8fc\uc785 (PDF/\uc778\uc1c4\uc6a9)
const r4c_old = 'wrap.appendChild(mapDiv); wrap.appendChild(svgDiv); wrap.appendChild(listDiv); wrap.appendChild(link);';
const r4c_new = 'var imgEl = document.createElement("img"); imgEl.className = "daymap-img"; imgEl.loading = "lazy"; imgEl.alt = "\uc774 \ub0a0 \uc9c0\ub3c4"; imgEl.src = "map-" + i + ".png";\n      wrap.appendChild(imgEl); wrap.appendChild(mapDiv); wrap.appendChild(svgDiv); wrap.appendChild(listDiv); wrap.appendChild(link);';
if (s.indexOf(r4c_old) < 0) throw new Error("r4c \ubbf8\ubc1c\uacac");
s = s.replace(r4c_old, r4c_new);

// 5) 추가 CSS
const EXTRA_CSS = [
'<style id="app-extra">',
'  details.day { background: var(--card); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); margin-top: 12px; overflow: hidden; }',
'  details.day > summary.day-h { list-style: none; cursor: pointer; -webkit-user-select: none; user-select: none; position: relative; padding-right: 40px; }',
'  details.day > summary.day-h::-webkit-details-marker { display: none; }',
'  details.day > summary.day-h::after { content: "\\203A"; position: absolute; right: 16px; top: 50%; transform: translateY(-50%) rotate(90deg); font-size: 20px; color: var(--faint); transition: transform .2s; }',
'  details.day[open] > summary.day-h::after { transform: translateY(-50%) rotate(-90deg); }',
'  details.day:not([open]) > summary.day-h { border-bottom: 0; }',
'  details.day summary.day-h:focus-visible { outline: 2px solid var(--indigo); outline-offset: -2px; }',
'  .daynav { display: flex; gap: 6px; overflow-x: auto; padding: 8px 2px 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }',
'  .daynav[hidden] { display: none; }',
'  .daynav::-webkit-scrollbar { display: none; }',
'  .daynav button { flex: none; border: 1px solid var(--line-strong); background: var(--card); color: var(--sub); font: inherit; font-weight: 700; font-size: 12px; padding: 5px 10px; border-radius: 99px; cursor: pointer; white-space: nowrap; }',
'  .daynav button.on { background: var(--indigo); color: #fff; border-color: var(--indigo); }',
'  #pdfbtn { border-color: var(--line-strong); }',
'  .expandbar { display: flex; gap: 8px; margin: 12px 0 0; }',
'  .expandbar button { flex: 1; border: 1px solid var(--line-strong); background: var(--card); color: var(--sub); font: inherit; font-weight: 700; font-size: 12px; padding: 7px; border-radius: 9px; cursor: pointer; }',
'  .daymap-img { display: none; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--line); }',
'  @media print {',
'    details.day, details.day > * { display: block !important; }',
'    details.day > summary.day-h::after { display: none !important; }',
'    .daynav, .expandbar, #pdfbtn { display: none !important; }',
'    .daymap-img { display: block !important; }',
'    .daymap, .daymap-svg, .dayroute-link { display: none !important; }',
'  }',
'</style>',
''
].join('\n');
// \uba54\uc778 </style> "\ub4a4"\uc5d0 \uc0bd\uc785\ud574\uc57c print \uc624\ubc84\ub77c\uc774\ub4dc\uac00 \uc6b0\uc120\ud55c\ub2e4
s = s.replace('</style>', '</style>\n' + EXTRA_CSS);
if (s.indexOf('id="app-extra"') < 0) throw new Error("EXTRA_CSS \uc0bd\uc785 \uc2e4\ud328");
if ((s.match(/id="app-extra"/g) || []).length !== 1) throw new Error("EXTRA_CSS \uc911\ubcf5 \uc0bd\uc785");

// 6) 추가 JS
const EXTRA_JS = [
'<script id="app-extra-js">',
'  (function () {',
'    if ("serviceWorker" in navigator) {',
'      window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });',
'    }',
'    var nav = document.getElementById("daynav");',
'    var days = Array.prototype.slice.call(document.querySelectorAll("#view-plan details.day"));',
'    function setNavOn(i) { Array.prototype.forEach.call(nav.children, function (c, n) { c.classList.toggle("on", n === i); }); }',
'    days.forEach(function (d, i) {',
'      var dt = d.querySelector(".daytag .dt");',
'      var b = document.createElement("button");',
'      b.type = "button";',
'      b.textContent = dt ? dt.textContent.trim() : String(i + 1);',
'      b.addEventListener("click", function () {',
'        days.forEach(function (x) { x.open = false; });',
'        d.open = true; setNavOn(i);',
'        d.scrollIntoView({ behavior: "smooth", block: "start" });',
'      });',
'      nav.appendChild(b);',
'      d.addEventListener("toggle", function () { if (d.open) setNavOn(i); });',
'    });',
'    var bar = document.createElement("div");',
'    bar.className = "expandbar";',
'    bar.innerHTML = \'<button type="button" data-x="1">\ubaa8\ub450 \ud3bc\uce58\uae30</button><button type="button" data-x="0">\ubaa8\ub450 \uc811\uae30</button>\';',
'    var planView = document.getElementById("view-plan");',
'    planView.insertBefore(bar, planView.firstChild);',
'    bar.addEventListener("click", function (e) {',
'      var t = e.target.closest ? e.target.closest("button") : null; if (!t) return;',
'      var open = t.dataset.x === "1";',
'      days.forEach(function (d) { d.open = open; });',
'    });',
'    function syncNav() {',
'      var active = document.querySelector(".seg button[aria-selected=\'true\']");',
'      nav.hidden = !(active && active.dataset.view === "plan");',
'    }',
'    Array.prototype.forEach.call(document.querySelectorAll(".seg button"), function (btn) {',
'      btn.addEventListener("click", function () { setTimeout(syncNav, 0); });',
'    });',
'    syncNav(); if (days[0]) setNavOn(0);',
'    function expandAll() { document.querySelectorAll("details").forEach(function (d) { d.dataset._wo = d.open ? "1" : "0"; d.open = true; }); }',
'    function restoreAll() { document.querySelectorAll("details").forEach(function (d) { if (d.dataset._wo === "0") d.open = false; delete d.dataset._wo; }); }',
'    window.addEventListener("beforeprint", expandAll);',
'    window.addEventListener("afterprint", restoreAll);',
'    if (location.search.indexOf("pdf=1") >= 0) { expandAll(); document.documentElement.setAttribute("data-pdf", "1"); }',
'    var pdfbtn = document.getElementById("pdfbtn");',
'    if (pdfbtn) pdfbtn.addEventListener("click", function () { expandAll(); setTimeout(function () { window.print(); }, 150); });',
'  })();',
'</script>',
''
].join('\n');
if (s.indexOf('</body>') >= 0) s = s.replace('</body>', EXTRA_JS + '</body>');
else s = s.replace('</html>', EXTRA_JS + '</html>');
if (s.indexOf('id="app-extra-js"') < 0) throw new Error("EXTRA_JS \uc0bd\uc785 \uc2e4\ud328");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, s, "utf8");
console.log("OK  " + before + " -> " + s.length + " bytes  ->  " + OUT);
console.log("details.day:", (s.match(/<details class="day"/g) || []).length, "open:", (s.match(/<details class="day" open>/g) || []).length, "close:", (s.match(/<\/details>/g) || []).length);
console.log("daynav:", s.includes('id="daynav"'), "pdfbtn:", s.includes('id="pdfbtn"'), "sw:", s.includes('serviceWorker.register'), "buildLeaflet:", s.includes('function buildLeaflet'));
