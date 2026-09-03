# 그리스·이탈리아 신혼여행 (2026.10.10–24)

아테네 · 산토리니 · 로마 14일 일정. **폰으로 보는 오프라인 PWA.**

## 열기

- 웹: `https://johun204.github.io/greece-italy/`
- 폰에서 **홈 화면에 추가**하면 앱처럼 실행되고, 한 번 열어두면 **비행기 모드에서도 100% 동작**합니다.

## 구성

| 파일 | 설명 |
| :-- | :-- |
| `index.html` | 앱 본체 (일정·준비·식당·쇼핑·회화 5개 탭, 날짜별 아코디언, 지도) |
| `manifest.webmanifest` | PWA 매니페스트 |
| `sw.js` | 서비스워커 — 앱 셸·Leaflet·아이콘·PDF 프리캐시, 지도 타일은 본 곳만 캐시 |
| `icon-192.png` / `icon-512.png` | 앱 아이콘 |
| `greece-italy-honeymoon.pdf` | 지도 포함 인쇄본 (오프라인 백업) |

## 오프라인 동작

- 모든 텍스트·체크리스트·회화·**날짜별 개략 동선도(SVG)**는 네트워크 없이 그대로 표시.
- 온라인일 때 연 지도(OpenStreetMap 타일)는 그 구역만 캐시되어 이후 오프라인에서도 보임.
- 상단 **⬇︎PDF** 버튼 → 모든 탭 펼친 인쇄본 저장 (지도 포함). `greece-italy-honeymoon.pdf`는 미리 만들어 둔 백업본.

## 갱신

`index.html`은 `transform.js`로 원본(`greece-italy-honeymoon-2026.html`)에서 생성됩니다.
서비스워커 캐시 버전은 `sw.js`의 `APP_CACHE` 값을 올리면 강제 갱신됩니다.
