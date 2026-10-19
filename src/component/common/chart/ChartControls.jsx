import { CHART_INTERVALS } from '@/util/chartInterval';
import { CHART_STYLES } from '@/hooks/useChartPreference';

const STYLE_OPTIONS = [
    { value: CHART_STYLES.LINE, label: '선' },
    { value: CHART_STYLES.CANDLE, label: '캔들' },
];

function Segmented({ options, value, onChange, disabled, ariaLabel }) {
    return (
        <div role="group" aria-label={ariaLabel} className="inline-flex shrink-0 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-700/60">
            {options.map((opt) => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        disabled={disabled}
                        onClick={() => onChange(opt.value)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                            active
                                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

/** 봉 단위(일·주·월·년봉) + 선/캔들 전환 */
export function ChartControls({ interval, onIntervalChange, style, onStyleChange, disabled }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Segmented
                ariaLabel="봉 단위"
                options={CHART_INTERVALS.map((i) => ({ value: i.key, label: i.label }))}
                value={interval}
                onChange={onIntervalChange}
                disabled={disabled}
            />
            <Segmented ariaLabel="차트 모양" options={STYLE_OPTIONS} value={style} onChange={onStyleChange} disabled={disabled} />
        </div>
    );
}
