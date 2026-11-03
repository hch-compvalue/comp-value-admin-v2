import { useMarket } from '@/context/MarketContext';
import { MARKET_OPTIONS } from '@/util/MarketUtil';

/**
 * 시장 선택 (미국주식 / 국내주식) — MarketProvider 안에서 사용
 */
export default function MarketToggle() {
    const { market, setMarket } = useMarket();
    return (
        <div role="radiogroup" aria-label="시장 선택"
             className="inline-flex shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
            {MARKET_OPTIONS.map((opt) => {
                const active = opt.value === market;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setMarket(opt.value)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${active
                            ? 'bg-blue-600 text-white dark:bg-blue-500'
                            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
