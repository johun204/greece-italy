// 원본 HTML에서 DAYS 배열을 뽑아 스크린샷용 mapshot.html 생성
const fs = require("fs");
const src = fs.readFileSync("C:/Claude/greece-italy-honeymoon-2026.html", "utf8");
const m = src.match(/var DAYS = \[[\s\S]*?\n    \];/);
if (!m) throw new Error("DAYS 배열 못 찾음");
const DAYS_SRC = m[0];

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html,body{margin:0;padding:0;background:#fff}
  #m{position:fixed;inset:0}
  .mk-num{background:#bf5137;color:#fff;width:24px;height:24px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;font:700 13px/1 -apple-system,"Malgun Gothic",sans-serif;
    border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)}
  .leaflet-container{font:13px/1.3 -apple-system,"Malgun Gothic",sans-serif}
</style></head><body>
<div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
${DAYS_SRC}
var d = +(new URLSearchParams(location.search).get("d") || 0);
var pts = DAYS[d] || DAYS[0];
var map = L.map("m", { zoomControl:false, attributionControl:true });
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);
var ll = pts.map(function(p){return [p[0],p[1]];});
pts.forEach(function(p,n){
  L.marker([p[0],p[1]],{icon:L.divIcon({className:"",html:'<div class="mk-num">'+(n+1)+'</div>',iconSize:[24,24],iconAnchor:[12,12]})})
   .addTo(map);
});
L.polyline(ll,{color:"#bf5137",weight:4,opacity:.9,dashArray:"8 6"}).addTo(map);
// 대륙 넘어가는 이동일(4=아테네→산토리니, 9=산토리니→로마)은 도착지 위주로 화면을 맞춘다(마커 번호는 유지)
var fitPts = d===4 ? ll.slice(2) : d===9 ? ll.slice(3) : ll;
map.fitBounds(fitPts,{padding:[46,46]});
setTimeout(function(){ map.invalidateSize(); map.fitBounds(fitPts,{padding:[46,46]}); }, 250);
</script>
</body></html>`;
fs.writeFileSync("C:/Claude/gi-build/mapshot.html", html, "utf8");
console.log("mapshot.html 생성, DAYS 항목:", (DAYS_SRC.match(/\n      \[ \[/g) || []).length);
