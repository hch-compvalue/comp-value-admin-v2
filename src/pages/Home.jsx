import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'react-router-dom';
import MarketIndexCharts from '@/component/feature/home/MarketIndexCharts';
import { useFxRate } from '@/pages/transaction/hooks/useFxRate';
import TopPicks from '@/component/feature/home/TopPicks';

export default function Home() {
    const location = useLocation();
    const { isLoggedIn } = useAuth();
    const { fxRate, fxUpdatedAt } = useFxRate({ enabled: isLoggedIn });

    useEffect(() => {
        document.title = 'CompValue — 기업가치 분석';
    }, []);

    const reason = location.state?.reason;

    return (
        <div className="min-h-[calc(100vh-120px)] px-6 py-6">
            <div className="max-w-7xl mx-auto">
                {/* 로그아웃/인증만료 알림 — 로그인 상태에서는 표시하지 않음 */}
                {!isLoggedIn && reason === 'logout' && (
                    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        로그아웃되었습니다.
                    </div>
                )}
                {!isLoggedIn && reason === '401' && (
                    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        인증이 만료되어 로그아웃되었습니다. 다시 로그인해 주세요.
                    </div>
                )}

                {isLoggedIn ? (
                    <>
                        {/* 오늘 날짜 + 환율 */}
                        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-700">
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                                {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                            </h1>
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                                <span className="text-slate-400">USD/KRW</span>{' '}
                                <span className="font-semibold">
                                    {fxRate
                                        ? Number(fxRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                        : '불러오는 중'}
                                </span>
                                {fxUpdatedAt && (
                                    <span className="ml-2 text-xs text-slate-400">
                                        {fxUpdatedAt.toLocaleString('ko-KR')} 기준
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 투자 순위 상위 종목 */}
                        <div className="mb-8">
                            <TopPicks />
                        </div>

                        {/* 미국 3대 지수 차트 */}
                        <MarketIndexCharts />
                    </>
                ) : (
                    /* 소개 — 비로그인 */
                    <div className="max-w-2xl py-12">
                        <h1 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">CompValue</h1>
                        <p className="mb-6 leading-relaxed text-slate-600 dark:text-slate-300">
                            미국 주식의 내재가치를 계산하고 투자 순위·보유종목·자동매매를 한곳에서 관리합니다.
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">상단의 로그인 버튼으로 시작하세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
