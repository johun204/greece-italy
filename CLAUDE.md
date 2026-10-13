# 작업 규칙

- **변경은 항상 `main` 브랜치에 반영**(GitHub Pages가 main에서 배포됨). 작업 브랜치에서 했더라도 테스트 통과 후 main에 fast-forward/merge 해서 push.
- 수정 후 `node build.js && node test.js` 통과 확인. `index.html`을 바꿨으면 `sw.js`의 `APP_CACHE` 번호를 올릴 것.
- **PDF(`greece-italy-honeymoon.pdf`)는 다시 만들지 않음** — 사용자 요청(2026-10-13). 일정·UI를 고쳐도 PDF는 그대로 둘 것.
