import { useState, useMemo, useEffect, useRef } from 'react';
import useModalAnimation from '@/hooks/useModalAnimation';
import useSessionKeepAlive from '@/hooks/useSessionKeepAlive';
import ExcelJS from 'exceljs';

import { send, API_ENDPOINTS, beginBulkOperation } from '@/util/ClientUtil';

const BATCH_SIZE = 30;
// const BATCH_DELAY_MS = 10000; // FmpRateLimiter로 대체 (2026.03.10)
const BATCH_DELAY_MS = 1000; // 배치 간 최소 간격 (백엔드 FmpRateLimiter가 rate limit 관리)

/**
 * 대량조회 모달
 * props:
 *  - open: boolean
 *  - onClose: () => void
 *  - fetcher?: (symbols: string[]) => Promise<Array<any>>
 *      // 백단 연동 함수(주입 가능). 미주입 시 defaultBulkFetcher 사용
 *  - openAlert?: (msg: string) => void
 *  - initialSymbols?: string[] // 외부에서 주입할 심볼 배열
 */
export default function BulkQueryModal({ open, onClose, fetcher, initialSymbols = [] }) {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [stopping, setStopping] = useState(false); // 중지 중 상태
    const [progress, setProgress] = useState({ current: 0, total: 0, currentSymbol: '', waiting: false, waitSeconds: 0 });
    const [internalAlert, setInternalAlert] = useState({ open: false, message: '' });

    // 중지 플래그
    const abortRef = useRef(false);

    // 대량조회 중 세션 유지
    useSessionKeepAlive(loading);

    // 내부 알림 함수 (z-index 문제 해결)
    const showAlert = (message) => {
        setInternalAlert({ open: true, message });
    };

    const closeAlert = () => {
        setInternalAlert({ open: false, message: '' });
    };

    // 중지 핸들러
    const handleStop = () => {
        abortRef.current = true;
        setStopping(true);
    };

    // 모달 열릴 때 initialSymbols 세팅
    useEffect(() => {
        if (open && initialSymbols.length > 0) {
            setInput(initialSymbols.join('\n'));
        }
    }, [open, initialSymbols]);

    // 모달 닫힐 때 상태 초기화
    useEffect(() => {
        if (!open) {
            setProgress({ current: 0, total: 0, currentSymbol: '', waiting: false, waitSeconds: 0 });
        }
    }, [open]);

    const symbols = useMemo(
        () =>
            input
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean),
        [input]
    );

    const { shouldRender, isAnimatingOut } = useModalAnimation(open);

    if (!shouldRender) return null;

    const run = async () => {
        if (symbols.length === 0) {
            showAlert('심볼을 한 줄에 하나씩 입력해주세요.');
            return;
        }
        setLoading(true);
        setProgress({ current: 0, total: symbols.length, currentSymbol: '', waiting: false, waitSeconds: 0 });
        abortRef.current = false; // 중지 플래그 초기화

        const endBulkOperation = beginBulkOperation();
        try {
            const fn = fetcher || defaultBulkFetcher;
            const items = await fn(symbols, (current, total, currentSymbol, waiting = false, waitSeconds = 0) => {
                setProgress({ current, total, currentSymbol, waiting, waitSeconds });
            }, abortRef); // 중지 플래그 전달

            if (abortRef.current) {
                // 중지된 경우에도 현재까지 조회된 데이터는 엑셀로 저장
                if (items.length > 0) {
                    await exportToExcel(Array.isArray(items) ? items : []);
                    showAlert(`중지됨: ${items.length}건의 데이터가 엑셀로 저장되었습니다.`);
                } else {
                    showAlert('조회가 중지되었습니다.');
                }
            } else {
                await exportToExcel(Array.isArray(items) ? items : []);
                showAlert(`${items.length}건의 데이터가 엑셀로 저장되었습니다.`);
            }
        } catch (e) {
            console.error(e);
            showAlert('조회/엑셀 생성 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
            setStopping(false);
            setProgress({ current: 0, total: 0, currentSymbol: '', waiting: false, waitSeconds: 0 });
            abortRef.current = false;
            endBulkOperation();
        }
    };

    return (
        <>
            {/* backdrop */}
            <div className={`fixed inset-0 z-[70] bg-black/50 dark:bg-black/70 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }} onClick={loading ? undefined : onClose} />

            {/* modal */}
            <div
                className={`fixed z-[80] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(840px,calc(100vw-24px))] max-h-[85vh] overflow-auto rounded-lg border border-slate-200 bg-white shadow-2xl dark:bg-slate-800 dark:border-slate-700 animate__animated ${isAnimatingOut ? 'animate__fadeOutDown' : 'animate__fadeInUp'}`}
                style={{ animationDuration: '0.25s' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-2.5 dark:bg-slate-800 dark:border-slate-700">
                    <div className="text-sm font-semibold text-slate-800 dark:text-white">대량 조회</div>
                    <button
                        className="text-xs rounded border px-2 py-1 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={onClose}
                        disabled={loading}
                    >
                        닫기 (Esc)
                    </button>
                </div>

                <div className="p-4 space-y-3">
                    <p className="text-[12px] text-slate-600 dark:text-slate-400">
                        심볼을 <span className="font-medium">한 줄에 하나씩</span> 입력하고 "엑셀로 내보내기"를 누르면,
                        서버 조회 후 결과를 엑셀 파일로 저장합니다.
                        {symbols.length > BATCH_SIZE && (
                            <span className="block mt-1 text-amber-600 dark:text-amber-400">
                                ⚠️ {symbols.length}개 심볼은 {BATCH_SIZE}건씩 나누어 {Math.ceil(symbols.length / BATCH_SIZE)}회 조회됩니다. (배치 간 10초 대기)
                            </span>
                        )}
                    </p>

                    {/* 엑셀 행 색상 범례 */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-medium text-slate-600 dark:text-slate-300">엑셀 행 색상 (가치등급):</span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: '#fde68a' }} />
                            S · A등급
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: '#bbf7d0' }} />
                            B등급
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: '#e0f2fe' }} />
                            C등급
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block h-3 w-3 rounded-sm border border-slate-300 dark:border-slate-500" />
                            D · F등급
                        </span>
                    </div>

                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={'예)\nAAPL\nMSFT\nGOOGL\nNVDA'}
                        className="w-full h-[220px] rounded-md border border-slate-300 bg-slate-50 p-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                        disabled={loading}
                    />

                    {/* 프로그레스 바 */}
                    {loading && progress.total > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                <span className="flex items-center gap-1.5">
                                    {progress.waiting ? (
                                        <>
                                            <span className="relative flex h-2 w-2">
                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                                                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                                            </span>
                                            <span className="text-amber-600 dark:text-amber-400">
                                                다음 배치 대기 중 <span className="font-semibold tabular-nums">{progress.waitSeconds}초</span>
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="relative flex h-2 w-2">
                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                                                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                                            </span>
                                            <span>
                                                조회 중: <span className="font-medium text-slate-800 dark:text-white">{progress.currentSymbol}</span>
                                            </span>
                                        </>
                                    )}
                                </span>
                                <span className="font-medium tabular-nums">
                                    {progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
                                </span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-600">
                                <div
                                    className="h-full rounded-full transition-all duration-500 ease-out bg-[length:20px_20px] animate-[barber-pole_0.8s_linear_infinite]"
                                    style={{
                                        width: `${(progress.current / progress.total) * 100}%`,
                                        backgroundImage: progress.waiting
                                            ? 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%)'
                                            : 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%)',
                                        backgroundColor: progress.waiting ? '#f59e0b' : '#4f46e5',
                                    }}
                                />
                            </div>
                            <style>{`@keyframes barber-pole { from { background-position: 0 0 } to { background-position: 20px 0 } }`}</style>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                        <div className="text-[12px] text-slate-500 dark:text-slate-400">{symbols.length}개 심볼</div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="px-3 py-2 rounded-md border text-sm hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => setInput('')}
                                disabled={loading}
                            >
                                초기화
                            </button>
                            {loading ? (
                                <button
                                    type="button"
                                    className={`px-3 py-2 rounded-md text-white text-sm font-medium flex items-center gap-2 whitespace-nowrap ${stopping ? 'bg-amber-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500'}`}
                                    onClick={handleStop}
                                    disabled={stopping}
                                >
                                    {stopping ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            중지 중...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            중지
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 flex items-center gap-2 whitespace-nowrap"
                                    onClick={run}
                                >
                                    엑셀로 내보내기
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 내부 알림 모달 (z-index 문제 해결) */}
            {internalAlert.open && (
                <>
                    <div className="fixed inset-0 z-[90] bg-black/30" onClick={closeAlert} />
                    <div className="fixed z-[100] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(360px,calc(100vw-32px))] rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-800">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">알림</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 whitespace-pre-line">{internalAlert.message}</p>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={closeAlert}
                                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

/**
 * 딜레이 함수 (카운트다운 콜백 지원)
 * @param {number} ms - 대기 시간 (밀리초)
 * @param {Function} [onTick] - 매초 호출되는 콜백 (남은 초)
 * @param {Object} [abortRef] - 중지 플래그
 */
const delay = (ms, onTick, abortRef) => new Promise((resolve) => {
    if (!onTick) {
        setTimeout(resolve, ms);
        return;
    }
    let remaining = Math.ceil(ms / 1000);
    onTick(remaining);
    const id = setInterval(() => {
        remaining--;
        if (remaining <= 0 || abortRef?.current) {
            clearInterval(id);
            resolve();
        } else {
            onTick(remaining);
        }
    }, 1000);
});

/**
 * 다건 조회 API를 사용하여 심볼 배열을 서버에 보내고 결과를 받음
 * @param {string[]} symbols - 조회할 심볼 배열
 * @param {Function} onProgress - 진행 상태 콜백 (current, total, currentBatch) => void
 * @param {Object} abortRef - 중지 플래그 (abortRef.current === true 이면 중지)
 */
async function defaultBulkFetcher(symbols, onProgress, abortRef) {
    const results = [];
    const total = symbols.length;

    // 배치로 나누기
    const batches = [];
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
        batches.push(symbols.slice(i, i + BATCH_SIZE));
    }

    let processed = 0;

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        // 중지 플래그 체크
        if (abortRef?.current) {
            break;
        }

        const batch = batches[batchIdx];
        const batchSymbols = batch.join(',');

        if (onProgress) {
            onProgress(processed, total, `배치 ${batchIdx + 1}/${batches.length} (${batch.length}건)`);
        }

        try {
            const sendUrl = API_ENDPOINTS.ABROAD_COMP_VALUE_ARR(batchSymbols);

            // 기업분석 먼저 호출 (Redis 캐시 저장) → 투자판단 순차 호출 (캐시 활용, FMP 추가호출 없음)
            const compResult = await send(sendUrl, {}, "GET");
            const evalResult = await send('/dart/main/evaluate/stocks', { symbols: batch }, 'POST').catch(() => ({ data: null, error: true }));

            const { data, error } = compResult;

            // 가치등급 매핑 (symbol → valueGrade) — 오늘의 매수후보/투자판단 화면과 동일 기준
            const evalMap = {};
            if (!evalResult.error && evalResult.data?.response) {
                for (const item of evalResult.data.response) {
                    if (item.symbol) evalMap[item.symbol] = item.valueGrade;
                }
            }

            if (error == null && data && data.response) {
                // 응답이 배열인지 단일 객체인지 확인
                const responseList = Array.isArray(data.response) ? data.response : [data.response];

                for (let i = 0; i < responseList.length; i++) {
                    const responseData = responseList[i];
                    // 심볼은 응답 데이터 또는 요청 순서에서 추출
                    const symbolValue = responseData.symbol || responseData.티커 || responseData.상세정보?.symbol || batch[i];
                    const resData = {
                        기업명: responseData.기업명,
                        symbol: symbolValue,
                        현재가격: responseData.현재가격,
                        주당가치: responseData.주당가치,
                        peg: responseData.상세정보?.peg,
                        valueGrade: evalMap[symbolValue] || null,
                        json: responseData,
                    };
                    results.push(resData);
                }
                processed += responseList.length;
            } else {
                // 배치 전체 실패 시 각 심볼에 대해 에러 기록
                for (const s of batch) {
                    results.push({ symbol: s, error: error ? error : '조회 실패' });
                }
                processed += batch.length;
            }
        } catch (e) {
            // 배치 전체 실패 시 각 심볼에 대해 에러 기록
            for (const s of batch) {
                results.push({ symbol: s, error: e.message });
            }
            processed += batch.length;
            console.error(`배치 ${batchIdx + 1} 조회 중 오류 발생:`, e);
        }

        if (onProgress) {
            onProgress(processed, total, `배치 ${batchIdx + 1}/${batches.length} 완료`);
        }

        // 마지막 배치가 아니고 중지되지 않았으면 대기 (카운트다운 표시)
        if (batchIdx < batches.length - 1 && !abortRef?.current) {
            await delay(BATCH_DELAY_MS, (remainSec) => {
                if (onProgress) {
                    onProgress(processed, total, `배치 ${batchIdx + 1}/${batches.length} 완료`, true, remainSec);
                }
            }, abortRef);
            // 대기 끝나면 waiting 상태 해제
            if (onProgress) {
                onProgress(processed, total, `배치 ${batchIdx + 2}/${batches.length} 준비 중...`);
            }
        }
    }

    return results;
}

/**
 * Excel 생성 (exceljs 필요: npm i exceljs)
 * 컬럼: 번호, 한글명, 영문 공식명, 티커, 현재가격, 미래가격, PEG, JSON
 * 하이라이트:
 *  - 노란색: (현재가격 < 미래가격) && (PEG < 1.0)
 *  - 하늘색(두 경우):
 *      A) (현재가격 > 미래가격 && 가격차% <= 5%) || (PEG < 1.0)
 *      B) (현재가격 < 미래가격) || (1.0 <= PEG <= 1.3)
 *    ※ “가격차이 얼마안날때”는 5%로 가정(상수로 조정 가능)
 */
async function exportToExcel(items) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Bulk');

    ws.columns = [
        { header: '번호', key: 'no', width: 6 },
        { header: '영문 공식명', key: '기업명', width: 36 },
        { header: '티커', key: 'symbol', width: 10 },
        { header: '현재가격', key: '현재가격', width: 12 },
        { header: '주당가치', key: '주당가치', width: 12 },
        { header: 'PEG', key: 'peg', width: 10 },
        { header: 'JSON', key: 'json', width: 50 },
    ];

    const toNum = (v) =>
        v == null ? NaN : typeof v === 'number' ? v : Number(String(v).replace(/[,\\s]/g, ''));

    items.forEach((it, idx) => {
        const cur = toNum(it.현재가격);
        const future = toNum(it.주당가치);
        const peg = toNum(it.peg);

        // 가치등급 기반 하이라이트 (Step1~5 펀더멘털, 타이밍/게이트 감점 미반영)
        const evalGrade = it.valueGrade;
        const yellow = evalGrade === 'S' || evalGrade === 'A';
        const green = !yellow && evalGrade === 'B';
        const sky = !yellow && !green && evalGrade === 'C';

        const row = ws.addRow({
            no: idx + 1,
            기업명: it.기업명 || '',
            symbol: it.symbol || '',
            현재가격: Number.isFinite(cur) ? cur : '',
            주당가치: Number.isFinite(future) ? future : '',
            peg: Number.isFinite(peg) ? peg : '',
            json: it.json ? JSON.stringify(it.json) : JSON.stringify(it),
        });

        const fillYellow = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } }; // amber-200
        const fillGreen = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBBF7D0' } }; // green-200
        const fillSky = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }; // sky-100

        if (yellow) row.eachCell((c) => (c.fill = fillYellow));
        else if (green) row.eachCell((c) => (c.fill = fillGreen));
        else if (sky) row.eachCell((c) => (c.fill = fillSky));

        row.getCell('현재가격').numFmt = '#,##0.00';
        row.getCell('주당가치').numFmt = '#,##0.00';
        row.getCell('peg').numFmt = '0.00';
    });

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // === 범례 시트 ===
    const legendWs = wb.addWorksheet('범례');
    legendWs.columns = [
        { header: '색상', key: 'color', width: 20 },
        { header: '가치등급', key: 'grade', width: 10 },
        { header: '의미', key: 'meaning', width: 55 },
    ];

    const legendHeader = legendWs.getRow(1);
    legendHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    legendHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };

    const fillYellowLegend = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
    const fillGreenLegend = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBBF7D0' } };
    const fillSkyLegend = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };

    const legendData = [
        { fill: fillYellowLegend, grade: 'S / A', meaning: '92점+ / 83점+ — 펀더멘털 최우수 / 우수 (저평가 + 재무 건전성)' },
        { fill: fillGreenLegend, grade: 'B', meaning: '73~82점 — 펀더멘털 양호 (S/A/B = 가치 양호, 타이밍 양호 시 매수 후보)' },
        { fill: fillSkyLegend, grade: 'C', meaning: '63~72점 — 펀더멘털 보통 (리스크 요인 존재)' },
        { fill: null, grade: 'D / F', meaning: '62점 이하 — 펀더멘털 미흡 (색상 없음)' },
        { fill: null, grade: '※', meaning: '가치등급 = 1~5단계(82점)를 100점 환산. 타이밍/모멘텀 감점 미반영 — 진입 시점은 투자판단 화면에서 확인' },
    ];

    legendData.forEach((item) => {
        const row = legendWs.addRow({
            color: item.fill ? '■ 이 색상' : '(없음)',
            grade: item.grade,
            meaning: item.meaning,
        });
        if (item.fill) {
            row.getCell('color').fill = item.fill;
        }
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
        type:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bulk_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
}