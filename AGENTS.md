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

## 2. 이모지(Emoji) 완전 제거 원칙 (No-Emoji)
- UI 화면, 버튼, 라벨, 메뉴, 테이블, 모달, 안내 문구 등 시스템 전반에서 **이모지(🎪, 👑, 💡, 🏠, 👧, 👦, 🌱, 🌟 등) 사용을 전면 금지**합니다.
- 시각적 구분이 필요한 경우 텍스트 태그(`[안내]`, `[행사]`, `[대표]` 등) 또는 단색 심볼 아이콘(Lucide React 아이콘)을 정갈하게 사용합니다.

## 3. 색상 팔레트 제한 (녹색 · 흰색 · 검정 계열의 농도 중심)
- 형형색색의 원색 남발을 금지하며, 시각적 피로를 줄이고 단정함을 유지하기 위해 **녹색, 흰색, 검정(먹색)** 계열의 명도·농도 차이만으로 UI를 구현합니다:
  - **주 색상(Primary)**: 녹색 계열 (연한 연두빛 배경 `emerald-50`부터 진한 녹색 `emerald-800`까지 농도 조절)
  - **배경 및 카드(Surface)**: 흰색 (`white`, `#ffffff`) 및 아주 옅은 미색(`slate-50`)
  - **텍스트 및 테두리(Neutral)**: 검정 및 먹색 계열 (`slate-900`, `slate-700`, `slate-400`, 테두리 `slate-200/300`)
  - **예외적 상태 표시**: 미입금, 삭제 등 반드시 주의가 필요한 경우에만 톤다운된 단일 보조색(연한 회갈색/레드)을 최소한으로 허용합니다.

## 4. 글씨 크기(Font Size) 통일 원칙
- 화면마다 글꼴 크기가 들쭉날쭉하지 않도록 표준 규격 스케일로 엄격히 통일합니다:
  - **화면 대제목**: `text-xl` (20px, Bold)
  - **섹션/카드 소제목**: `text-base` (16px, Bold)
  - **입력 필드, 버튼, 테이블 본문**: `text-sm` (14px, Regular/Bold)
  - **뱃지, 부가 설명, 캡션 텍스트**: `text-xs` (12px, Regular/Semi-bold)
