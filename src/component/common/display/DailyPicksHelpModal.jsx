import useModalAnimation from '@/hooks/useModalAnimation';

/**
 * 오늘의 매수후보 페이지 설명 모달
 * - 데이터 생성 경로(일별 전수평가), 투자판정/가치등급/타이밍 산출 기준, 컬럼 의미 설명
 *
 * ⚠️ 아래 수치는 백엔드 상수를 사람이 옮겨 적은 값이라 자동 동기화되지 않는다.
 *    해당 상수를 바꾸면 이 파일도 함께 고칠 것 (comp-value-service 기준 원본 위치):
 *    - Step 배점(12/18/20/15/17/18), 게이트($300M·200%·2000%), 타이밍 상한(77/65),
 *      타이밍 폴백(13/9) → EvaluationConst
 *    - 가치등급 임계값(92/83/73/63/50)  → StockEvaluationService.calculateGrade()
 *    - 타이밍 신호 임계값(70/50/30)     → TechnicalAnalysisService (진입 타이밍 점수)
 *    - 배치 크기(50종목)                → RecommendedStocksEvaluator.EVAL_BATCH_SIZE
 *    - 실행 시각(매일 00:00)            → RecommendedStocks @Scheduled(cron)
 *    주당가치 계산 버전(V8 등)은 버전업 시 문구가 상하지 않도록 의도적으로 표기하지 않는다.
 */
export default function DailyPicksHelpModal({ isOpen, onClose }) {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen, 250);

    if (!shouldRender) return null;

    return (
        <div
            className={`fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
            style={{ animationDuration: '0.25s' }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className={`bg-white dark:bg-slate-800 rounded-2xl shadow-xl ring-1 ring-slate-900/5 dark:ring-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto animate__animated ${isAnimatingOut ? 'animate__zoomOut' : 'animate__zoomIn'}`}
                style={{ animationDuration: '0.25s' }}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 sticky top-0">
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
                            매일 밤 자동으로 돌린 <strong>추천 종목 전수 평가 결과</strong>를 아침에 확인하는 화면입니다.
                            내가 직접 종목을 넣고 분석하는 게 아니라, <strong>이미 저장된 최신 평가 스냅샷을 그대로 읽어옵니다</strong>
                            (조회 시점에 재계산하지 않음).
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
                                        기본값은 <strong>가장 최근 평가일</strong>이며, 투자판정 → 가치점수 내림차순으로 정렬해 보여줍니다.
                                    </div>
                                </div>
                            </li>
                        </ol>
                    </section>

                    {/* 투자판정 */}
                    <section>
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                            투자판정 = 가치등급 × 타이밍 (2축 매트릭스)
                        </h4>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="min-w-full text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-900/40">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-300">판정</th>
                                        <th className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-300">조건</th>
                                        <th className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-300">의미</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">🔵 매수 후보</span>
                                        </td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">가치등급 S/A/B <strong>+</strong> 타이밍 양호</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">펀더멘털도 좋고 진입 시점도 괜찮음 → 오늘 볼 종목</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">🟡 관심목록</span>
                                        </td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">가치등급 S/A/B <strong>+</strong> 타이밍 미흡(대기/하락/관망)</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">기업은 좋은데 지금 사기엔 시점이 아쉬움 → 대기</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">⚪ 관망</span>
                                        </td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">가치등급 C/D/F (타이밍 무관)</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">펀더멘털이 기준 미달 → 타이밍이 좋아도 제외</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            요약 타일(🔵/🟡/⚪/전체)을 클릭하면 해당 판정만 필터링됩니다. 기본 화면은 <strong>매수 후보</strong>만 보여줍니다.
                        </p>
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
                                            모멘텀/기술적 분석 (18점) — <strong>가치등급에는 미포함</strong>, 아래 타이밍 신호로 분리
                                        </td>
                                        <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-500">—</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3 text-xs">
                            <span className="px-2 py-1 rounded font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">S ≥ 92</span>
                            <span className="px-2 py-1 rounded font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">A ≥ 83</span>
                            <span className="px-2 py-1 rounded font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">B ≥ 73</span>
                            <span className="px-2 py-1 rounded font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">C ≥ 63</span>
                            <span className="px-2 py-1 rounded font-bold bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">D ≥ 50</span>
                            <span className="px-2 py-1 rounded font-bold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">F &lt; 50</span>
                            <span className="text-slate-500 dark:text-slate-400 self-center">— S/A/B만 "가치 양호"로 인정</span>
                        </div>
                    </section>

                    {/* 타이밍 */}
                    <section>
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">타이밍 신호 (진입 시점)</h4>
                        <div className="text-slate-700 dark:text-slate-300 mb-3">
                            기술적 분석으로 <strong>0~100점의 진입 타이밍 점수</strong>를 계산합니다.
                            이동평균(SMA5/20/50/200), RSI, MACD, 스토캐스틱, 볼린저밴드, 거래량 추세에 가점하고,
                            과매수·연속 상승 과열·20일 고점 근접 등에는 감점합니다.
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="min-w-full text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-900/40">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-300">표시</th>
                                        <th className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-300">타이밍 점수</th>
                                        <th className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-300">의미</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-semibold text-blue-600 dark:text-blue-400">양호</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">70점 이상 (매수 적기)</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">과매도 반등·추세 회복 구간 → 매수 후보 승격 조건</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-500 dark:text-slate-400">관망</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">50~69점</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">뚜렷한 신호 없음</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-amber-600 dark:text-amber-400">대기</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">30~49점 (대기 권장)</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">진입 불리 — 총점 상한 77점(B등급 한도) 적용</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-semibold text-orange-600 dark:text-orange-400">하락</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">30점 미만 (하락 구간)</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">하락 추세 진행 중 — 총점 상한 65점(C등급 한도) 적용</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            * 가격 히스토리 부족 등으로 타이밍 분석에 실패하면 Step6(모멘텀) 점수로 대체 판정합니다 (13점 이상 양호 / 9점 이상 대기 / 그 외 하락).
                        </p>
                    </section>

                    {/* 품질 게이트 */}
                    <section>
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">품질 게이트 (매수후보 강등 규칙)</h4>
                        <div className="text-slate-700 dark:text-slate-300 mb-3">
                            밸류에이션 계산이 부정확해지기 쉬운 종목이 매수후보로 새어 나가지 않도록, 판정 후 한 번 더 걸러냅니다.
                        </div>
                        <div className="space-y-2">
                            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">매수 후보 → 관심목록으로 강등</div>
                                <div className="text-xs text-slate-600 dark:text-slate-400">
                                    시가총액 <strong>$300M 미만(초소형주)</strong> 이거나, 적정가와 현재가의 <strong>괴리가 ±200% 이상</strong>인 경우
                                    (계산 신뢰도가 낮아 실제 매수 리스트에서 제외)
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">무조건 관망으로 강등</div>
                                <div className="text-xs text-slate-600 dark:text-slate-400">
                                    <strong>채권·특수증권</strong>(일반 주식이 아닌 종목)이거나, 괴리가 <strong>±2000% 이상</strong>인 이상치
                                </div>
                            </div>
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
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">투자판정</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">가치등급 × 타이밍 매트릭스 + 품질 게이트를 거친 최종 결론</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">가치등급</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">등급 배지(S~F)와 오른쪽 작은 숫자는 100점 환산 가치점수</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">타이밍</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">기술적 분석 기반 진입 시점 판정 (양호/관망/대기/하락)</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">현재가</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400"><strong>평가 시점(오전 10시 배치)의 주가</strong>. 실시간 가격이 아닙니다</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">적정가</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">주당가치 계산 로직이 산출한 내재가치</td>
                                    </tr>
                                    <tr className="bg-white dark:bg-slate-800">
                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">매수적정가</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                                            적정가 × (1 − 안전마진율). <strong>현재가 &lt; 매수적정가</strong>면 안전마진을 확보한 가격대
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            헤더를 클릭하면 해당 컬럼 기준으로 정렬됩니다(▲ 오름차순 / ▼ 내림차순).
                            행을 더블클릭하면 해당 종목의 기업가치를 실시간으로 다시 계산해 결과 팝업을 띄웁니다(평가 시점 적정가와 다를 수 있음).
                        </p>
                    </section>

                    {/* 주의사항 */}
                    <section className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 mb-2">읽을 때 주의할 점</div>
                        <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                            <li>표가 비어 있다면 오전 10시 스케줄이 아직 실행되지 않았거나, 활성 추천 프로파일이 없는 경우입니다.</li>
                            <li>평가 대상은 <strong>추천 프로파일이 뽑아낸 종목</strong>뿐입니다. 전 종목을 평가하는 화면이 아닙니다.</li>
                            <li>가격·판정 모두 평가 시점(오전 10시) 기준이므로, 장중 급변한 종목은 실제와 다를 수 있습니다.</li>
                            <li>"매수 후보"는 최종 매수 지시가 아니라 <strong>1차 선별 결과</strong>입니다. 실제 성과는 성과 추적 페이지에서 검증하세요.</li>
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
