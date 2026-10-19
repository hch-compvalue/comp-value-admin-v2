/** 캔들 색 — 국내 관행(상승 빨강 / 하락 파랑), 적록색약도 구분 가능 */
const UP_COLOR = 'var(--color-rose-500)';
const DOWN_COLOR = 'var(--color-blue-500)';
const BODY_WIDTH_RATIO = 0.7;
const MAX_BODY_WIDTH = 18;
const MIN_PX = 1;

/**
 * Recharts <Bar dataKey={candleRange} shape={<CandleShape />} /> 용 캔들 모양
 * - Bar 값은 [저가, 고가] → y = 고가 위치, height = 고가~저가 픽셀 → 시가·종가 위치는 비례로 계산
 */
export function CandleShape({ x, y, width, height, payload }) {
    const { open, close, high, low } = payload || {};
    if ([open, close, high, low].some((v) => v == null)) return null;

    const range = high - low;
    const toY = (v) => (range === 0 ? y : y + ((high - v) / range) * height);
    const color = close >= open ? UP_COLOR : DOWN_COLOR;
    const cx = x + width / 2;
    const bodyW = Math.max(MIN_PX, Math.min(MAX_BODY_WIDTH, width * BODY_WIDTH_RATIO));
    const bodyTop = toY(Math.max(open, close));
    const bodyH = Math.max(MIN_PX, Math.abs(toY(open) - toY(close)));

    return (
        <g>
            <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
            <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={color} />
        </g>
    );
}
