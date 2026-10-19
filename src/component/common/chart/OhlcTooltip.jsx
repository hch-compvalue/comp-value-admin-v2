const PRICE_DIGITS = 2;

/**
 * Recharts <Tooltip content={<OhlcTooltip ... />} /> — 시가·고가·저가·종가 + 추가 항목 (선/캔들 공통)
 * @param labelFmt    날짜 라벨 포매터 (봉 단위별)
 * @param extraRows   [{ key, label }] 함께 보여줄 값 (오버레이 지표 등)
 * @param prefix      가격 앞 기호 (주식 '$', 지수 '')
 */
export function OhlcTooltip({ active, payload, label, labelFmt, extraRows = [], prefix = '' }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const fmt = (v) => (v == null ? '-' : `${prefix}${Number(v).toLocaleString('en-US', { minimumFractionDigits: PRICE_DIGITS, maximumFractionDigits: PRICE_DIGITS })}`);
    const rows = [
        { key: 'open', label: '시가' }, { key: 'high', label: '고가' }, { key: 'low', label: '저가' }, { key: 'close', label: '종가' },
        ...extraRows,
    ];
    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <div className="mb-1 font-medium">{labelFmt ? labelFmt(label) : label}</div>
            {rows.map((r) => (
                <div key={r.key} className="flex justify-between gap-4 tabular-nums">
                    <span className="text-slate-500 dark:text-slate-400">{r.label}</span>
                    <span>{fmt(d[r.key])}</span>
                </div>
            ))}
        </div>
    );
}
