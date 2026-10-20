# CompValue 디자인 시스템

## 디자인 방향
- **장식 대신 데이터** (2026-10-20 개편): 차분한 업무용 도구 톤. 색은 의미(손익·상태·선택)가 있을 때만, 위계는 굵기·크기·여백·얇은 테두리로
- **금지**: 그라데이션(`bg-gradient-*`), 장식용 이모지(📊💱📈 등 — 아이콘이 필요하면 lucide-react), 글자 넣은 그라데이션 아이콘 박스, `backdrop-blur` 유리 효과, 화면마다 다른 브랜드 색(보라·분홍·에메랄드 등), 한글 라벨에 `uppercase tracking-*`
- **미니멀리즘**: 불필요한 장식 요소 제거, 여백 넉넉하게, 콘텐츠에 집중
- **부드러운 인터랙션**: hover/클릭/페이지 전환에 자연스러운 애니메이션
- **사용감 우선**: 직관적인 피드백, 명확한 상태 변화, 로딩/에러 상태 처리

## 색상

### Primary
- Brand (주요 버튼, 로고, 링크): **단색** `bg-brand` / `hover:bg-brand-hover` / `text-brand` (= blue-600 / blue-700, `src/index.css` 토큰 — 색 변경은 토큰만)
- Accent (링크, 강조): blue-600 / dark:blue-400

### 시맨틱 컬러 (접근성: 적록색약 고려 — 빨강↔초록 대비 금지)
| 상태 | Light | Dark | 배경 (Light) | 배경 (Dark) |
|------|-------|------|-------------|-------------|
| Info | blue-600 | blue-400 | blue-100 | blue-900/30 |
| Success | sky-600 | sky-400 | sky-100 | sky-900/30 |
| Warning | amber-500 | amber-400 | amber-100 | amber-900/30 |
| Error/Danger | orange-500 | orange-400 | orange-100 | orange-900/30 |
| Selected/Active | blue-600 | blue-400 | blue-50 | blue-900/30 |

### Neutral (slate 계열로 통일 — gray 사용 금지, 다크모드는 회색으로 자동 교체)
- 텍스트: slate-900 / 700 / 500 / 400
- 배경: white / slate-50 / slate-100
- 본문 바닥: `bg-canvas` (`src/styles/surfaces.css`) — 라이트 흰색 / 다크 slate-900. 2026-10-20 라이트 연회색(무채색) 시도했으나 slate(푸른 회색) 요소와 색 온도가 안 맞고 눈 피로도 비슷해 흰색 유지로 결정
- Border: slate-200 / slate-300

### 다크모드 매핑
| Light | Dark |
|-------|------|
| bg-white | dark:bg-slate-800 |
| bg-slate-50 | dark:bg-slate-900 |
| text-slate-900 | dark:text-white |
| text-slate-700 | dark:text-slate-300 |
| text-slate-500 | dark:text-slate-400 |
| border-slate-200 | dark:border-slate-700 |
| border-slate-300 | dark:border-slate-600 |

- 다크모드: 모든 컴포넌트에 `dark:` variant 필수

### 다크모드 팔레트 (2026-10-19: 남색 → 중립 회색)
- 클래스는 **slate 그대로** 사용. 다크모드에서만 `src/styles/theme-dark.css`가 `--color-slate-*` 값을 Tailwind neutral(무채색)로 교체 → 화면은 회색, 라이트모드는 기존 slate
- **다크 톤 변경은 `theme-dark.css` 값만 교체** (컴포넌트 수정 불필요)
- Tailwind 클래스를 못 쓰는 곳(Recharts props, SVG 속성, 인라인 style)은 `@/config/themeColors`의 `SLATE[N]` / `withAlpha(SLATE[N], %)` 사용, CSS-in-JS 문자열은 `var(--color-slate-N)` 사용
- **slate hex(`#1e293b` 등) 하드코딩 금지** — 다크 팔레트 변경이 반영되지 않음
- `gray`/`zinc`/`neutral` 클래스 직접 사용 금지 (slate 하나로 통일해야 팔레트 교체가 한 곳에서 됨)

## 타이포그래피

### 폰트
- 글자: BinggraeMelona.otf (기본 weight: 400, Bold 700)
- **숫자: Inter (`public/fonts/Inter-Num-*.woff2`)** — `NumFont` 의 `unicode-range` 로 숫자·숫자 기호(0-9 $ % + , - . / : ₩ −)만 Inter 로 그림. 별도 클래스 불필요
- `html` 에 `font-variant-numeric: tabular-nums` 전역 적용 → 표·금액 자릿수 자동 정렬

### 텍스트 계층
| 용도 | 크기 | Weight | 예시 |
|------|------|--------|------|
| 페이지 제목 | text-2xl ~ text-3xl | font-bold | 페이지 최상단 타이틀 |
| 섹션 제목 | text-lg ~ text-xl | font-semibold | 카드/섹션 헤더 |
| 본문 | text-sm (14px) | 기본(400) | 일반 텍스트, 테이블 셀 |
| 라벨 | text-sm | font-medium | 폼 라벨, 필터 라벨 |
| 캡션/보조 | text-xs | font-medium | 뱃지, 태그, 부가 정보 |

## 컴포넌트 스타일

### 공통 원칙
- 둥근 모서리: `rounded-lg` 기본 (모달은 `rounded-2xl`, 뱃지/태그는 `rounded-full`)
- 그림자: 용도별 차등 — 카드 `shadow-sm`, 드롭다운 `shadow-lg`, 모달 `shadow-xl`
- Border: 얇고 연하게 (`border-slate-200` / `dark:border-slate-700`)
- 여백: 넉넉하게 (`p-4` 이상, `gap-4` 이상)

### 버튼
| Variant | 스타일 | 용도 |
|---------|--------|------|
| Primary | `bg-brand` 단색, 흰색 텍스트, 그림자 없음 | 주요 액션 (저장, 확인) |
| Secondary | 흰색 배경, slate border, hover:bg-slate-50 | 보조 액션 (취소, 닫기) |
| Danger | orange 배경, 흰색 텍스트 | 삭제, 위험 액션 |
| Ghost | 배경 없음, hover 시 slate-50 | 부가 액션 |

- 크기: `sm`(px-3 py-1.5 text-sm) / `md`(px-4 py-2 text-sm) / `lg`(px-6 py-2.5 text-base)
- 공통: `rounded-lg`, `disabled:opacity-50 disabled:cursor-not-allowed` — 알약형(`rounded-full`) 버튼 금지 (배지·아바타·점만 `rounded-full`)
- 새 버튼은 `@/component/common/button/Button` 사용 (직접 `<button>`에 색 클래스 조합 지양)

### 입력 필드
- 높이: `h-10`
- Border: `border-slate-300` / `dark:border-slate-600`
- Focus: `ring-2 ring-blue-500 border-blue-500`
- Disabled: `bg-slate-100 cursor-not-allowed` / `dark:bg-slate-800`
- 라벨: `text-sm text-slate-700` / `dark:text-slate-300`
- Placeholder: `placeholder-slate-400` / `dark:placeholder-slate-400`

### 카드/패널
- 배경: `bg-white` / `dark:bg-slate-800`
- Border: `border border-slate-200` / `dark:border-slate-700`
- 모서리: `rounded-xl`
- 그림자: `shadow-sm`

### 테이블
- 헤더: `bg-slate-50` / `dark:bg-slate-900`, `border-b border-slate-200`, 글자 `text-xs font-semibold text-slate-600` (짙은 그라데이션 헤더·uppercase 금지)
- 행 hover: `hover:bg-slate-50` / `dark:hover:bg-slate-700/50`
- 선택된 행: `bg-blue-50` / `dark:bg-blue-900/20`
- 헤더 정렬 = 셀 정렬 (숫자 컬럼은 헤더도 오른쪽 정렬, 정렬 아이콘은 제목 왼쪽)
- 금액·수량은 `tabular-nums`, 한 셀 1줄 원칙 (보조 정보는 `text-xs text-slate-400` 한 줄까지)
- 행 배경 토큰 (`src/styles/surfaces.css`): `bg-row-base` / `bg-row-hover` / `bg-row-nested`(펼친 하위 행) / `bg-row-hit`(목표 도달 등 강조 행) — 불투명색이라 고정 첫 열은 `sticky left-0 bg-inherit` 로 행 배경을 그대로 받음, `dark:` 변형 불필요
- 통계/요약 카드: 흰 바탕 + `border-slate-200` 테두리, 라벨 `text-xs text-slate-500` + 값 `text-xl font-bold` — 카드마다 다른 배경색 금지 (색은 값의 손익에만)
- 투자판정 표시: `@/util/SignalStyleUtil` 의 `SIGNAL_STYLE` + `<SignalDot />` (🔵🟡⚪ 이모지 금지)
- 강조 행은 행 전체 원색 칠 대신 `bg-row-hit` + 첫 셀 왼쪽 3px 강조선
- 손익 색: 상승 rose / 하락 blue (전일 대비 등락도 동일), 수익률은 연한 배경 배지
- 참고 구현: 보유종목 `pages/transaction/components/holdings/` (컬럼 정의 `constants/index.js` TABLE_COLUMNS + 셀 렌더러 `cells.jsx`)

### 주가 차트
- 봉 단위(일·주·월·년봉) + 선/캔들 전환: `@/component/common/chart/ChartControls`, 설정 저장 `@/hooks/useChartPreference(차트별 키)`
- 일별 시세 → 봉 집계·표시 개수·조회 기간·축/툴팁 포맷: `@/util/chartInterval` (FMP 일별 1회 최대 5,000행 ≈ 20년)
- 캔들: `<Bar dataKey={candleRange} shape={<CandleShape />} />`, 툴팁 `OhlcTooltip`, 격자선 `CHART_GRID`
- 캔들·등락 색: 상승 rose / 하락 blue
- Recharts 2 는 차트 안 `<>...</>` Fragment 를 인식 못함 → 시리즈는 개별 조건 렌더링
- 지표 필요 봉 수는 `technicalIndicators.INDICATOR_LOOKBACK` 단일 출처. 받을 수 있는 데이터를 다 받아도 봉이 모자라면(년봉 ~20개, 신규 상장) 지표 버튼 비활성 + 사유 툴팁, 선택 상태는 유지

### 모달
- 배경: `bg-white shadow-xl` / `dark:bg-slate-800`
- 모서리: `rounded-2xl`
- 백드롭: `bg-slate-900/40` / `dark:bg-black/60`

### 뱃지/태그
- 구조: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold`
- 색상: 시맨틱 컬러 배경 + 텍스트 조합 (예: `bg-blue-100 text-blue-700`)

## z-index 레이어
| z-index | 용도 |
|---------|------|
| 20 | 모바일 오버레이 배경 |
| 30 | SideBar |
| 35 | TabBar |
| 40 | Header |
| 50 | 드롭다운, 툴팁 |
| 90 | 모달 |

## 애니메이션

### 라이브러리
- Animate.css + 커스텀 훅 `useModalAnimation()`

### 패턴
| 대상 | 애니메이션 | 시간 |
|------|-----------|------|
| 모달 진입/퇴장 | fadeIn / fadeOut | 0.2s |
| 토스트 알림 | fadeInDown / fadeOutDown | 0.3s |
| 콘텐츠 진입 | fadeIn / fadeInUp | 0.2s |
| hover 효과 | transition-colors | 150ms |
| easing | ease-out 기본 | — |

- **과도한 애니메이션 금지, 목적 있는 모션만 사용**

### 상호작용 요소 전역 처리 (`src/index.css` @layer base)
- `button`, `[role="button"]`, `a[href]`, `select`, `summary`, `label[for]`, 체크박스/라디오/파일 입력 → `cursor: pointer` 자동 (Tailwind v4 preflight는 button 커서가 default라 보완)
- 버튼·링크 hover 색/배경/테두리/그림자 전환 150ms ease-out 자동, 버튼 눌림 시 `scale: 0.97` (`w-full` 버튼·disabled 제외)
- disabled / `aria-disabled="true"` → `cursor: not-allowed` 자동, `prefers-reduced-motion` 시 전환·눌림 끔
- `:where()` 명시도 0 이라 컴포넌트에 붙인 `cursor-*`, `transition-*`, `scale-*` 유틸리티가 항상 우선 → 새 버튼에 `cursor-pointer` 따로 안 붙여도 됨
- 버튼이 아닌 요소(div/tr 등)에 onClick을 걸면 `cursor-pointer`는 직접 붙일 것 (모달 백드롭은 제외)

## 반응형
| Breakpoint | 너비 |
|------------|------|
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
