/**
 * 켜기/끄기 스위치 (role="switch")
 * @param {string} label 스크린리더·툴팁 문구 (예: "자동 실행 끄기")
 */
export default function Switch({ checked, disabled, label, onChange }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onChange}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                checked ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-600'
            }`}
        >
            <span aria-hidden="true" className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
    );
}
