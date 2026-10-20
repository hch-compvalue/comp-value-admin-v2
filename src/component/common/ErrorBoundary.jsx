import { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo);
    }

    handleReload = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
                    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500 dark:bg-amber-900/30 dark:text-amber-400">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-7 w-7">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                        </div>
                        <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
                            페이지를 표시할 수 없습니다
                        </h2>
                        <p className="mb-6 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                            세션이 만료되었거나 일시적인 오류가 발생했습니다.
                            <br />
                            아래 버튼을 눌러 새로고침 해주세요.
                        </p>
                        <button
                            type="button"
                            onClick={this.handleReload}
                            className="inline-flex items-center justify-center rounded-lg bg-brand px-6 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
                        >
                            홈으로 이동
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
