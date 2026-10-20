import { useState } from 'react';
import useModalAnimation from '@/hooks/useModalAnimation';

const ToggleSection = ({ title = '상세', children }) => {
    const [open, setOpen] = useState(false);
    const { shouldRender, isAnimatingOut } = useModalAnimation(open, 150);

    return (
        <div className="mt-4">
            <button
                className="w-full text-left px-4 py-2 font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
                onClick={() => setOpen(!open)}
            >
                {title} {open ? '▲' : '▼'}
            </button>
            {shouldRender && (
                <div className={`mt-2 px-4 py-3 border border-t-0 border-slate-300 rounded-b bg-white text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 animate__animated ${isAnimatingOut ? 'animate__fadeOutUp' : 'animate__fadeInDown'}`} style={{ animationDuration: '0.15s' }}>
                    {children}
                </div>
            )}
        </div>
    );
};

export default ToggleSection;
