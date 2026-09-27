<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 프로젝트 필수 지침 (Must-Follow Rules)

## 1. 메뉴·버튼 및 테이블 데이터 한 줄(단일 행) 표시 원칙 (No-Wrap)
- **메뉴 & 버튼 그룹**:
  - 모든 메뉴, 탭, 필터 툴바, 액션 버튼은 텍스트가 줄바꿈되거나 세로로 쪼개지지 않고 **한 줄로 표시**되어야 합니다 (`whitespace-nowrap`, `flex-nowrap`, `shrink-0`).
  - 공간이 좁아질 경우 어설프게 개행되거나 찌그러지지 않고, 가로 스크롤(`overflow-x-auto`)을 제공해야 합니다.
- **데이터 테이블 셀 & 뱃지**:
  - 수량(`N박스`), 입금 뱃지(`입금`/`미입금`), 상태 뱃지(`접수완료`/`포장대기`/`발송완료` 등), 금액, 날짜 등의 텍스트가 자음/모음/글자 단위로 세로로 쪼개지는 현상(`1박\n스`, `미\n입\n금`, `포\n장\n대\n기`)을 **절대 금지**합니다.
  - 모든 관련 `th`, `td`, 뱃지 `span`에 `whitespace-nowrap`을 필수 적용하고, 테이블 컨테이너에 `overflow-x-auto`를 적용합니다.
