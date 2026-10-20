
function TextArea({ id, label = '', placeholder = '', className = '', value = '', onChange = {}, labelNewLine = false, disabled = false, wdfull = false, rows = 6 }) {

    const baseClassName = 'border border-slate-300 rounded-md shadow-sm px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400';

    return (
        <>
            <label htmlFor={id} className={`${labelNewLine ? 'block' : 'mr-2'} mb-1 text-sm text-slate-700 dark:text-slate-300`}>{label}</label>
            <textarea id={id} placeholder={placeholder}
                rows={rows}
                className={`${baseClassName} ${className} ${disabled ? 'cursor-not-allowed bg-slate-100 dark:bg-slate-800 dark:text-slate-500' : ''} ${wdfull ? 'w-full' : ''}`}
                value={value}
                onChange={onChange}
                disabled={disabled}
            />
        </>
    )
}

export default TextArea;