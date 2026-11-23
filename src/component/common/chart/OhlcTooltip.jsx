const PRICE_DIGITS = 2;
const PCT_DIGITS = 2;
// 상승·하락 색 — 캔들(CandleShape)과 같은 빨강/파랑 (색각이상 친화: 초록 안 씀)
const UP_TEXT = 'text-rose-600 dark:text-rose-400';
const DOWN_TEXT = 'text-blue-600 dark:text-blue-400';
const FLAT_TEXT = 'text-slate-400';
const OHLC_ROWS = [{ key: 'open', label: '시가' }, { key: 'high', label: '고가' }, { key: 'low', label: '저가' }, { key: 'close', label: '종가' }];

/** 직전 봉 종가 대비 등락률(%) — 기준이 없으면 null */
const changePct = (value, base) => (value == null || !base ? null : (value / base - 1) * 100);

const ChangeText = ({ pct }) => {
    if (pct == null) return <span className={FLAT_TEXT}>-</span>;
    const color = pct > 0 ? UP_TEXT : pct < 0 ? DOWN_TEXT : FLAT_TEXT;
    return <span className={color}>{pct > 0 ? '+' : ''}{pct.toFixed(PCT_DIGITS)}%</span>;
};

/**
 * Recharts <Tooltip content={<OhlcTooltip ... />} /> — 시가·고가·저가·종가 + 추가 항목 (선/캔들 공통)
 * @param labelFmt    날짜 라벨 포매터 (봉 단위별)
 * @param extraRows   [{ key, label }] 함께 보여줄 값 (오버레이 지표 등)
 * @param prefix      가격 앞 기호 (주식 '$', 지수 '')
 * @param formatValue 가격 표시 함수 (지정 시 prefix 대신 사용 — 국내 원화 등)
 * @param changeLabel 지정 시 시가~종가 옆에 직전 봉 종가(데이터의 prevClose) 대비 등락률 표시 (예: '전일')
 */
export function OhlcTooltip({ active, payload, label, labelFmt, extraRows = [], prefix = '', formatValue, changeLabel }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const fmt = formatValue || ((v) => (v == null ? '-' : `${prefix}${Number(v).toLocaleString('en-US', { minimumFractionDigits: PRICE_DIGITS, maximumFractionDigits: PRICE_DIGITS })}`));
    const showChange = Boolean(changeLabel);
    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <div className="mb-1 flex justify-between gap-4 font-medium">
                <span>{labelFmt ? labelFmt(label) : label}</span>
                {showChange && <span className="font-normal text-slate-400">{changeLabel} 종가 대비</span>}
            </div>
            {OHLC_ROWS.map((r) => (
                <div key={r.key} className="flex justify-between gap-4 tabular-nums">
                    <span className="text-slate-500 dark:text-slate-400">{r.label}</span>
                    <span>
                        {fmt(d[r.key])}
                        {showChange && <span className="ml-2 inline-block w-16 text-right"><ChangeText pct={changePct(d[r.key], d.prevClose)} /></span>}
                    </span>
                </div>
            ))}
            {extraRows.map((r) => (
                <div key={r.key} className="flex justify-between gap-4 tabular-nums">
                    <span className="text-slate-500 dark:text-slate-400">{r.label}</span>
                    <span>{fmt(d[r.key])}{showChange && <span className="ml-2 inline-block w-16" />}</span>
                </div>
            ))}
        </div>
    );
}
