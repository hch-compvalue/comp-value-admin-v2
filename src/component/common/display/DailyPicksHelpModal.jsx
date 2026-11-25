import { GRADE_STYLE } from '@/util/GradeStyleUtil';
import useModalAnimation from '@/hooks/useModalAnimation';

/**
 * 오늘의 매수후보 페이지 설명 모달
 * - 보는 법과 근거, 데이터 생성 경로(일별 전수평가), 가치등급 산출 기준, 컬럼 의미 설명
 *
 * ⚠️ 아래 수치는 백엔드 상수를 사람이 옮겨 적은 값이라 자동 동기화되지 않는다.
 *    해당 상수를 바꾸면 이 파일도 함께 고칠 것 (comp-value-service 기준 원본 위치):
 *    - Step 배점(12/18/20/15/17/18) → EvaluationConst
 *    - 가치등급 임계값(92/83/73/63/50)  → StockEvaluationService.calculateGrade()
 *    - 배치 크기(50종목)                → RecommendedStocksEvaluator.EVAL_BATCH_SIZE
 *    - 실행 시각(매일 00:00)            → RecommendedStocks @Scheduled(cron)
 *    주당가치 계산 버전(V8 등)은 버전업 시 문구가 상하지 않도록 의도적으로 표기하지 않는다.
 */
export default function DailyPicksHelpModal({ isOpen, onClose }) {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen, 250);

    if (!shouldRender) return null;

    return (
        <div
            className={`fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 p-4 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
            style={{ animationDuration: '0.25s' }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className={`bg-white dark:bg-slate-800 rounded-2xl shadow-xl ring-1 ring-slate-900/5 dark:ring-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
                style={{ animationDuration: '0.25s' }}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 sticky top-0">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        오늘의 매수후보 — 페이지 설명
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                        aria-label="닫기"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 콘텐츠 */}
                <div className="p-6 space-y-6 text-sm">
                    {/* 한 줄 요약 */}
                    <section className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">이 페이지는?</div>
                        <div className="text-slate-700 dark:text-slate-300">
                            매일 오전 자동으로 돌린 <strong>추천 종목 전수 평가 결과</strong>를 <strong>가치점수</strong> 순으로 보는 화면입니다.
                            내가 직접 종목을 넣고 분석하는 게 아니라, <strong>이미 저장된 최신 평가 스냅샷을 그대로 읽어옵니다</strong>
                            (조회 시점에 재계산하지 않음).
                        </div>
                    </section>

                    {/* 보는 법과 근거 — test/factor-screen-2026-11, test/rank-model-2026-11 (2026-11-25) */}
                    <section>
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">보는 법과 근거 (검증 중)</h4>
                        <div className="space-y-2 text-slate-600 dark:text-slate-400 text-xs">
                            <p>
                                <strong>순위</strong>는 후보 안에서 가치점수가 높은 순서입니다. 파란 배지는 상위 30위입니다.
                                사용 규칙: 매달 첫 주 상위 30 중 10종목 이상을 같은 금액으로 사고, 한 달 뒤 30위 밖으로 밀려난 종목만 바꿉니다.
                            </p>
                            <p>과거 데이터로 이 규칙을 그대로 따라 했을 때(그날 후보 목록 안, 거래 비용 포함, 전체 종목을 같은 금액으로 산 경우와 비교):</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li><strong>국내</strong>(2024-04~2026-09): 상위 30 연 +15%p, 앞·뒤 기간 모두 우위. 단 대형주 장세였던 2025-07 이후 KOSPI에는 크게 뒤짐(누적 +50% vs +142%)</li>
                                <li><strong>미국</strong>(2018-01~2026-08): 상위 30 연 +4%p, 2020년 이후만 보면 +6%p. 이긴 달 비율이 기준(55%)에 경계선이라 효과가 작습니다</li>
                                <li><strong>10종목만</strong> 사면 결과가 크게 흔들립니다(국내는 뒤 기간 손해). 상위 30 안에서 나눠 고르는 쪽이 손해 볼 확률이 낮았습니다</li>
                            </ul>
                            <p>
                                여러 지표(이익·장부가·영업이익 대비 기업가치·ROE·변동성)를 섞은 점수와 AI 학습 점수도 같은 규칙으로 시험했지만 <strong>가치점수를 넘지 못했습니다</strong>.
                                또 순위가 높든 낮든 <strong>종목 하나가 한 달 뒤 오를 확률은 거의 반반</strong>이었습니다 — 차이는 여러 종목을 묶어 여러 달 반복할 때만 쌓입니다.
                            </p>
                            <p>
                                투자 순위 점수(수익성·가치·1주 눌림), 투자판정, 타이밍, 매수 대상은 같은 시험에서 근거가 없거나 실전 성과 추적에서 뒤져 화면에서 뺐습니다(성과 추적에는 계속 기록).
                                이전 연구에 쓴 데이터로 고른 규칙이라 앞으로의 성과 추적으로 확인합니다.
                            </p>
                        </div>
                    </section>

                    {/* 데이터 생성 흐름 */}
                    <section>
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">데이터가 만들어지는 순서</h4>
                        <ol className="space-y-2 text-slate-700 dark:text-slate-300">
                            <li className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-bold flex items-center justify-center">1</span>
                                <div>
                                    <div className="font-semibold">매일 00:00 추천 스케줄 실행</div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">활성 상태(Y)인 추천 프로파일들이 저평가 종목을 추려냅니다.</div>
                                </div>
                            </li>
                            <li className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-bold flex items-center justify-center">2</span>
                                <div>
                                    <div className="font-semibold">추천 종목 전수 평가</div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">
                                        모든 활성 프로파일의 추천 종목을 <strong>중복 제거</strong>한 뒤, 50종목씩 배치로 6단계 평가(주당가치 계산 + 기술적 분석)를 돌립니다.
                                    </div>
                                </div>
                            </li>
                            <li className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-bold flex items-center justify-center">3</span>
                                <div>
                                    <div className="font-semibold">일자별 스냅샷으로 DB 저장</div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">
                                        평가 실패(ERROR) 종목은 제외하고 저장하며, 같은 날 다시 실행하면 그날 데이터를 <strong>교체</strong>합니다(중복 없음).
                                        이 스냅샷이 <strong>성과 추적 페이지의 기준 데이터</strong>가 됩니다.
                                    </div>
                                </div>
                            </li>
                            <li className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-bold flex items-center justify-center">4</span>
                                <div>
                                    <div className="font-semibold">이 화면에서 최신 스냅샷 조회</div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">
                                        기본값은 <strong>가장 최근 평가일</strong>이며, <strong>가치점수</strong> 내림차순으로 정렬해 보여줍니다(열 제목을 누르면 다른 기준으로 정렬).
                                    </div>
                                </div>
                            </li>
                        </ol>
                    </section>

                    {/* 가치등급 */}
                    <section>
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">가치등급 (펀더멘털 점수)</h4>
                        <div className="text-slate-700 dark:text-slate-300 mb-3">
                            6단계 평가 중 <strong>Step 1~5(펀더멘털, 82점 만점)</strong>만 합산해 100점으로 환산한 점수입니다.
                            타이밍 관련 감점·상한(게이트)은 <strong>반영하지 않아</strong>, 순수하게 "기업 자체가 좋은가"만 봅니다.
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="min-w-full text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-900/40">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Step</th>
                                        <th className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-300">평가 내용</th>
                                        <th className="px-4 py-2 text-right font-medium text-slate-700 dark:text-slate-300">배점</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Step 1</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">위험 신호 (수익가치 계산불가, 적자, 매출기반 평가 등 치명적 결함)</td>
                                        <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">12</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Step 2</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">신뢰도 (PER, 순부채, 영업이익 안정성)</td>
                                        <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">18</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Step 3</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">밸류에이션 (PEG, 가격 괴리, 성장률)</td>
                                        <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">20</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Step 4</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">영업이익 추세 (최근 3년 성장 지속성)</td>
                                        <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">15</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Step 5</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">투자 적합성 (매수적정가 대비 현재가, 그레이엄 기준)</td>
                                        <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">17</td>
                                    </tr>
                                    <tr className="bg-slate-50 dark:bg-slate-900/40">
                                        <td className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-300" colSpan={2}>합계 (→ 100점 환산 후 등급 산정)</td>
                                        <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">82</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Step 6</td>
                                        <td className="px-4 py-2 text-slate-500 dark:text-slate-500">
                                            모멘텀/기술적 분석 (18점) — <strong>가치등급에는 미포함</strong>, 타이밍 점수로 분리(이 화면에서는 쓰지 않음)
                                        </td>
                                        <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-500">—</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3 text-xs">
                            <span className={`px-2 py-1 rounded font-bold ${GRADE_STYLE.S}`}>S ≥ 92</span>
                            <span className={`px-2 py-1 rounded font-bold ${GRADE_STYLE.A}`}>A ≥ 83</span>
                            <span className={`px-2 py-1 rounded font-bold ${GRADE_STYLE.B}`}>B ≥ 73</span>
                            <span className={`px-2 py-1 rounded font-bold ${GRADE_STYLE.C}`}>C ≥ 63</span>
                            <span className={`px-2 py-1 rounded font-bold ${GRADE_STYLE.D}`}>D ≥ 50</span>
                            <span className={`px-2 py-1 rounded font-bold ${GRADE_STYLE.F}`}>F &lt; 50</span>
                            <span className="text-slate-500 dark:text-slate-400 self-center">— S/A/B만 "가치 양호"로 인정</span>
                        </div>
                    </section>

                    {/* 컬럼 설명 */}
                    <section>
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">컬럼 설명</h4>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="min-w-full text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-900/40">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-300">컬럼</th>
                                        <th className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-300">설명</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">순위</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">후보 안 가치점수 순위. 파란 배지 = 상위 30</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">기업명 옆 경고</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">주황 칩 — <strong>고평가 구간</strong>(현재가가 적정가보다 36% 넘게 높음, 금융주는 11%), <strong>적정가 극단값</strong>(괴리 ±200% 이상, 적정가 계산을 믿기 어려움). 순위에는 반영하지 않습니다</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">가치등급</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">등급 배지(S~F)와 오른쪽 작은 숫자는 100점 환산 가치점수(순위 기준)</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">현재가</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400"><strong>평가 시점의 주가</strong>. 실시간 가격이 아닙니다</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">적정가·매수적정가 (상세)</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">행을 누르면 나오는 상세에서 확인. 보수적 추정이라 대부분 종목이 적정가보다 비싸게 거래되므로 표에서는 뺐습니다</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            헤더를 클릭하면 해당 컬럼 기준으로 정렬됩니다(▲ 오름차순 / ▼ 내림차순).
                            행을 누르면 해당 종목의 기업가치를 실시간으로 다시 계산해 결과 팝업을 띄웁니다(평가 시점 적정가와 다를 수 있음).
                        </p>
                    </section>

                    {/* 주의사항 */}
                    <section className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 mb-2">읽을 때 주의할 점</div>
                        <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                            <li>표가 비어 있다면 오전 10시 스케줄이 아직 실행되지 않았거나, 활성 추천 프로파일이 없는 경우입니다.</li>
                            <li>평가 대상은 <strong>추천 프로파일이 뽑아낸 종목</strong>뿐입니다. 전 종목을 평가하는 화면이 아닙니다.</li>
                            <li>가격·판정 모두 평가 시점(오전 10시) 기준이므로, 장중 급변한 종목은 실제와 다를 수 있습니다.</li>
                            <li>순위는 매수 지시가 아니라 <strong>여러 종목을 나눠 담을 때의 우선순위</strong>입니다. 실제 성과는 성과 추적 페이지에서 확인하세요.</li>
                        </ul>
                    </section>
                </div>

                {/* 푸터 */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
}
