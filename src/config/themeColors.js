/**
 * JS용 테마 색 토큰 — Tailwind 클래스를 못 쓰는 곳(Recharts props, SVG 속성, 인라인 style, CSS-in-JS) 전용
 * - CSS 변수 참조라 다크모드 팔레트(src/styles/theme-dark.css) 변경이 자동 반영됨 → slate hex 하드코딩 금지
 * - 라이트/다크에서 다른 단계를 쓸 때만 isDark 로 분기 (예: isDark ? SLATE[800] : SLATE[200])
 * - CSS 문자열 안에서는 var(--color-slate-N) 을 직접 사용
 */
export const SLATE = Object.freeze(
    Object.fromEntries(
        [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, `var(--color-slate-${n})`])
    )
);

/** 투명도 적용 (예: withAlpha(SLATE[400], 20) → 20% 불투명) */
export const withAlpha = (color, percent) => `color-mix(in oklab, ${color} ${percent}%, transparent)`;

/** 차트 격자선 — 라이트 slate-100 / 다크 slate-600 (src/styles/surfaces.css --chart-grid) */
export const CHART_GRID = 'var(--chart-grid)';
