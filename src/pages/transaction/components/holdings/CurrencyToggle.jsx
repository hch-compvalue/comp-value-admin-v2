import { CURRENCIES } from '../../constants';

const OPTIONS = [
    { value: CURRENCIES.USD, label: '$ 달러' },
    { value: CURRENCIES.KRW, label: '₩ 원화' },
];

/** 테이블 금액 통화 전환 (원화는 환율이 있어야 선택 가능) */
export function CurrencyToggle({ value, onChange, fxAvailable }) {
    return (
        <div role="group" aria-label="표시 통화" className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-700/60">
            {OPTIONS.map((opt) => {
                const active = value === opt.value;
                const disabled = opt.value === CURRENCIES.KRW && !fxAvailable;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        disabled={disabled}
                        title={disabled ? '환율 정보를 불러오지 못했습니다' : undefined}
                        onClick={() => onChange(opt.value)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${
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
