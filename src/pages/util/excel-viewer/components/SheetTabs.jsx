export default function SheetTabs({ sheetNames, activeSheet, onChangeSheet }) {
    if (!sheetNames || sheetNames.length <= 1) return null;

    return (
        <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 dark:border-slate-700">
            {sheetNames.map((name) => (
                <button
                    key={name}
                    onClick={() => onChangeSheet(name)}
                    className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeSheet === name
                            ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-500'
                    }`}
                >
                    {name}
                </button>
            ))}
        </div>
    );
}
