import Button from '@/component/common/button/Button';
import useModalAnimation from '@/hooks/useModalAnimation';

export default function AlertModal({ open, title = '알림', message, children, onClose, onConfirm, onAfterClose }) {
    const { shouldRender, isAnimatingOut } = useModalAnimation(open);

    if (!shouldRender) return null;

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        }
        onClose();
        if (onAfterClose) {
            onAfterClose();
        }
    };

    const handleCancel = () => {
        onClose();
    };

    return (
        <div className={`fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 px-4 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }}>
            <div className={`relative w-full max-w-sm rounded-2xl bg-white p-5 text-slate-900 shadow-xl ring-1 ring-slate-900/5 dark:bg-slate-800 dark:text-white dark:ring-slate-700 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }}>
                <h2 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
                {children ? (
                    <div className="mb-5 text-sm text-slate-600 dark:text-slate-300">
                        {children}
                    </div>
                ) : (
                    <p className="mb-5 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{message}</p>
                )}
                <div className="flex justify-end gap-2">
                    {onConfirm && (
                        <button
                            onClick={handleCancel}
                            className="px-4 py-1.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                        >
                            취소
                        </button>
                    )}
                    <Button
                        children="확인"
                        onClick={handleConfirm}
                        className="px-4 py-1.5"
                    />
                </div>
            </div>
        </div>
    );
}



