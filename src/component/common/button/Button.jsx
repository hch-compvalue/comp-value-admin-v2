function Button({ children, onClick, type = 'button', variant = 'primary', size = 'md', disabled = false, fullWidth = false, className = '', ...rest }) {

    const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
        primary: 'bg-brand text-white hover:bg-brand-hover',
        secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
        danger: 'bg-orange-500 text-white hover:bg-orange-600',
        success: 'bg-sky-600 text-white hover:bg-sky-700',
        ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700',
    }

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-2.5 text-base',
    }

    return (
        <button
            type={type}
            onClick={!disabled && typeof onClick === 'function' ? onClick : undefined}
            disabled={disabled}
            className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${fullWidth ? 'w-full' : ''} ${className}`}
            {...rest}
        >
            {children}
        </button>
    )
}

export default Button