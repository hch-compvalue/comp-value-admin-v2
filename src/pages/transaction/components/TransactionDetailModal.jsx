import { useState, useEffect } from 'react';
import { send } from '@/util/ClientUtil';
import useModalAnimation from '@/hooks/useModalAnimation';
import { fetchCurrentPriceBySymbol } from '../services/TransactionService';

/**
 * 금액 표시 – 정수부분 볼드, 소수부분 연하게
 */
function BoldInt({ text }) {
    if (!text) return null;
    const dotIdx = text.indexOf('.');
    if (dotIdx === -1) return <span className="font-bold">{text}</span>;
    return (
        <>
            <span className="font-bold">{text.substring(0, dotIdx)}</span>
            <span className="font-normal opacity-50">{text.substring(dotIdx)}</span>
        </>
    );
}

/**
 * 가격 비교 차트 컴포넌트
 * 매수가, 현재가, 목표가를 시각적으로 비교
 */
function PriceComparisonChart({ buyPrice, currentPrice, targetPrice }) {
    if (!buyPrice || buyPrice <= 0) return null;

    // 최대값 계산 (목표가가 없거나 0이면 현재가와 매수가 중 큰 값 기준)
    const prices = [buyPrice, currentPrice];
    if (targetPrice > 0) prices.push(targetPrice);
    const maxPrice = Math.max(...prices) * 1.1; // 10% 여유

    const buyPercent = (buyPrice / maxPrice) * 100;
    const curPercent = (currentPrice / maxPrice) * 100;
    const targetPercent = targetPrice > 0 ? (targetPrice / maxPrice) * 100 : 0;

    const isProfit = currentPrice >= buyPrice;
    const isTargetHit = targetPrice > 0 && currentPrice >= targetPrice;

    return (
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
            <h4 className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-4">가격 비교</h4>
            <div className="space-y-3">
                {/* 매수가 */}
                <div className="flex items-center gap-3">
                    <div className="w-14 text-xs text-slate-500 dark:text-slate-400">매수가</div>
                    <div className="flex-1 relative h-6 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                        <div
                            className="absolute left-0 top-0 h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${buyPercent}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-end pr-2">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                ${buyPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 현재가 */}
                <div className="flex items-center gap-3">
                    <div className="w-14 text-xs text-slate-500 dark:text-slate-400">현재가</div>
                    <div className="flex-1 relative h-6 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                        <div
                            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
                                isProfit ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${curPercent}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-end pr-2">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 목표가 */}
                {targetPrice > 0 && (
                    <div className="flex items-center gap-3">
                        <div className="w-14 text-xs text-slate-500 dark:text-slate-400">목표가</div>
                        <div className="flex-1 relative h-6 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                            <div
                                className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
                                    isTargetHit ? 'bg-amber-500' : 'bg-purple-500'
                                }`}
                                style={{ width: `${targetPercent}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-end pr-2">
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                    ${targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 범례 */}
            <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-slate-200 dark:border-slate-600">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">매수가</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full ${isProfit ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        현재가 ({isProfit ? '수익' : '손실'})
                    </span>
                </div>
                {targetPrice > 0 && (
                    <div className="flex items-center gap-1.5">
                        <div className={`w-3 h-3 rounded-full ${isTargetHit ? 'bg-amber-500' : 'bg-purple-500'}`} />
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            목표가 {isTargetHit && '(도달!)'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

/** 종목 메모 최대 길이 (백엔드 SymbolMemoEntity.MEMO_MAX_LENGTH 와 동일) */
const SYMBOL_MEMO_MAX_LENGTH = 1000;

/** 상세 보기의 메모 한 줄 (줄바꿈 유지, 없으면 -) */
function MemoLine({ label, value }) {
    return (
        <div className="col-span-2 flex justify-between gap-4">
            <span className="shrink-0 text-slate-500 dark:text-slate-400">{label}</span>
            <span className="text-right whitespace-pre-line break-words text-slate-900 dark:text-white font-medium">{value || '-'}</span>
        </div>
    );
}

/**
 * 종목 상세정보 모달
 * - 더블클릭으로 열림
 * - 현재 정보 표시 + 수정 가능 (일반 행만)
 * - "분석" 버튼으로 기업가치계산결과 모달 열기
 */
export default function TransactionDetailModal({
    isOpen,
    onClose,
    row,
    fx,
    onSave,
    onGroupSave,
    onAnalyze,
    onRefreshSyncTarget,
    symbolMemo = '',
    onSaveMemo,
    onSell,
    onRemove,
    onOpenAlert,
    saving,
    isGroupRow = false, // 그룹 합계 행 여부
}) {
    const [formData, setFormData] = useState({});
    const [isEditing, setIsEditing] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [companyProfile, setCompanyProfile] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [copiedName, setCopiedName] = useState(false);
    const [syncingTarget, setSyncingTarget] = useState(false);

    // row 데이터로 폼 초기화
    useEffect(() => {
        if (isOpen && row) {
            setFormData({
                symbol: row.symbol || '',
                companyName: row.companyName || '',
                buyDate: row.buyDate || '',
                buyPrice: row.buyPrice || '',
                totalBuyAmount: row.totalBuyAmount || row.totalQty || '',
                currentPrice: row.currentPrice || '',
                targetPrice: row.targetPrice || '',
                targetPriceSync: row.targetPriceSync || false,
                buyExchangeRateAtTrade: row.buyExchangeRateAtTrade || '',
                rmk: (() => {
                    if (isGroupRow && row.groupRows) {
                        const rmks = row.groupRows.map(r => r.rmk || '');
                        return rmks.every(r => r === rmks[0]) ? rmks[0] : '';
                    }
                    return row.rmk || '';
                })(),
                symbolMemo,
            });
            setIsEditing(false);
            setCompanyProfile(null);
            setIsAnalyzing(false);
            // 프로파일 + 현재가 자동 조회
            if (row.symbol) {
                fetchCompanyProfile(row.symbol);
                fetchCurrentPriceBySymbol(row.symbol).then((result) => {
                    if (result?.currentPrice) {
                        setFormData(prev => ({ ...prev, currentPrice: Number(result.currentPrice) }));
                    }
                });
            }
        }
    }, [isOpen, row]);

    // 동기화 목표가 캐시 만료 종목이면 해당 종목만 재계산 (목록은 DB의 마지막 동기화 값 표시)
    useEffect(() => {
        if (!isOpen || !row?.symbol || !onRefreshSyncTarget) return;
        const targetRows = isGroupRow ? row.groupRows || [] : [row];
        if (!targetRows.some((r) => r.targetPriceSync && r.targetPriceCached === false)) return;

        let cancelled = false;
        setSyncingTarget(true);
        onRefreshSyncTarget(row.symbol)
            .then((target) => {
                if (cancelled || !target) return;
                // 그룹은 동기화 행만 새 목표가로 바꿔 평균 재계산 (grouping.js 와 동일 기준)
                const tgtList = targetRows
                    .map((r) => (r.targetPriceSync ? target : Number(r.targetPrice) || 0))
                    .filter((v) => v > 0);
                const next = tgtList.reduce((a, b) => a + b, 0) / tgtList.length;
                setFormData((prev) => (prev.targetPriceSync ? { ...prev, targetPrice: next } : prev));
            })
            .catch((e) => console.error('목표가 갱신 실패:', e))
            .finally(() => {
                if (!cancelled) setSyncingTarget(false);
            });
        return () => {
            cancelled = true;
            setSyncingTarget(false);
        };
        // onRefreshSyncTarget 은 부모에서 매 렌더 새로 생성되므로 제외 (포함 시 반복 호출)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, row, isGroupRow]);

    // 종목 메모가 나중에 로드·저장되면 보기 모드 값만 갱신 (편집 중 입력은 보존)
    useEffect(() => {
        if (!isEditing) setFormData((prev) => ({ ...prev, symbolMemo }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbolMemo]);

    const fetchCompanyProfile = async (symbol) => {
        if (!symbol) return;
        setLoadingProfile(true);
        try {
            const { data, error } = await send(
                `/dart/abroad/company/search/profile?symbol=${encodeURIComponent(symbol.trim())}`,
                {},
                'GET'
            );
            if (!error && data?.success && data?.response?.length > 0) {
                setCompanyProfile(data.response[0]);
            }
        } catch (e) {
            console.error('프로파일 조회 실패:', e);
        } finally {
            setLoadingProfile(false);
        }
    };

    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);

    if (!shouldRender || !row) return null;

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    // 종목 메모 저장 (변경 없으면 통과) — 실패 시 알림 후 false
    const saveMemoIfChanged = async () => {
        const memo = (formData.symbolMemo || '').trim();
        if (memo === (symbolMemo || '') || !onSaveMemo) return true;
        try {
            await onSaveMemo(row.symbol, memo);
            return true;
        } catch (e) {
            onOpenAlert?.(e.message);
            return false;
        }
    };

    const handleSave = async () => {
        // 변경된 필드만 저장
        const updates = {};
        if (formData.symbol !== row.symbol) updates.symbol = formData.symbol.trim().toUpperCase();
        if (formData.companyName !== row.companyName) updates.companyName = formData.companyName.trim();
        if (formData.buyDate !== row.buyDate) updates.buyDate = formData.buyDate;
        if (String(formData.buyPrice) !== String(row.buyPrice)) updates.buyPrice = formData.buyPrice;
        if (String(formData.totalBuyAmount) !== String(row.totalBuyAmount)) updates.totalBuyAmount = formData.totalBuyAmount;
        if (Boolean(formData.targetPriceSync) !== Boolean(row.targetPriceSync)) updates.targetPriceSync = formData.targetPriceSync;
        // 동기화 ON이면 targetPrice는 백엔드(Redis)에서 관리하므로 전송하지 않음
        if (!formData.targetPriceSync && String(formData.targetPrice) !== String(row.targetPrice)) updates.targetPrice = formData.targetPrice;
        if (String(formData.buyExchangeRateAtTrade) !== String(row.buyExchangeRateAtTrade)) updates.buyExchangeRateAtTrade = formData.buyExchangeRateAtTrade;
        if (formData.rmk !== row.rmk) updates.rmk = formData.rmk.trim();

        // 메모 먼저 저장 (티커도 바꾸면 백엔드가 새 티커로 메모를 옮김)
        if (!(await saveMemoIfChanged())) return;
        if (Object.keys(updates).length === 0) {
            setIsEditing(false);
            return;
        }

        const success = await onSave(row.id, updates);
        if (success) {
            setIsEditing(false);
        }
    };

    const handleGroupSave = async () => {
        const updates = {};
        const newSymbol = formData.symbol.trim().toUpperCase();
        const newCompanyName = formData.companyName.trim();

        if (newSymbol !== (row.symbol || '').toUpperCase()) updates.symbol = newSymbol;
        if (newCompanyName !== (row.companyName || '').trim()) updates.companyName = newCompanyName;
        if (Boolean(formData.targetPriceSync) !== Boolean(row.targetPriceSync)) updates.targetPriceSync = formData.targetPriceSync;
        // 동기화 ON이면 targetPrice는 백엔드(Redis)에서 관리하므로 전송하지 않음
        if (!formData.targetPriceSync && String(formData.targetPrice) !== String(row.targetPrice || '')) updates.targetPrice = formData.targetPrice;

        // 그룹 메모는 종목 메모로 저장 (매수 건별 비고는 건드리지 않음)
        if (!(await saveMemoIfChanged())) return;
        if (Object.keys(updates).length === 0) {
            setIsEditing(false);
            return;
        }

        const success = await onGroupSave(row.groupRows, updates);
        if (success) {
            setIsEditing(false);
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleAnalyzeClick = async () => {
        if (onAnalyze && formData.symbol) {
            setIsAnalyzing(true);
            try {
                await onAnalyze(formData.symbol.trim());
            } finally {
                setIsAnalyzing(false);
            }
        }
    };

    // 계산값
    const buyPrice = parseFloat(formData.buyPrice) || 0;
    const qty = parseInt(formData.totalBuyAmount) || 0;
    const curPrice = parseFloat(formData.currentPrice) || 0;
    const targetPrice = parseFloat(formData.targetPrice) || 0;
    const buyExchangeRate = parseFloat(formData.buyExchangeRateAtTrade) || 0;
    const fxRate = fx || 0;
    // 매수금액 원화 계산: 매수당시환율 우선, 없으면 현재환율
    const buyPriceRate = buyExchangeRate || fxRate;

    const totalBuy = buyPrice * qty;
    const totalCurrent = curPrice * qty;
    const diff = totalCurrent - totalBuy;
    const diffPct = totalBuy > 0 ? ((totalCurrent - totalBuy) / totalBuy) * 100 : 0;
    const isProfit = diff >= 0;
    const isTargetHit = targetPrice > 0 && curPrice >= targetPrice;

    return (
        <div
            className={`fixed inset-0 z-[90] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
            style={{ animationDuration: '0.25s' }}
            onClick={handleOverlayClick}
        >
            <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-xl bg-white shadow-2xl dark:bg-slate-800 animate__animated ${isAnimatingOut ? 'animate__fadeOutDown' : 'animate__fadeInUp'}`} style={{ animationDuration: '0.25s', scrollbarGutter: 'stable' }}>
                {/* 헤더 */}
                <div className="sticky top-0 z-10 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-6 py-4 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {companyProfile?.image && !companyProfile?.defaultImage && (
                                <img
                                    src={companyProfile.image}
                                    alt={formData.symbol}
                                    className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200 dark:border-slate-600"
                                    onError={(e) => (e.target.style.display = 'none')}
                                />
                            )}
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    {formData.symbol}
                                    {isGroupRow && (
                                        <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full dark:bg-indigo-900/50 dark:text-indigo-400">
                                            합계
                                        </span>
                                    )}
                                    {isTargetHit && (
                                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full dark:bg-amber-900/50 dark:text-amber-400">
                                            목표가 도달
                                        </span>
                                    )}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    {formData.companyName}
                                    {formData.companyName && (
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(formData.companyName);
                                                setCopiedName(true);
                                                setTimeout(() => setCopiedName(false), 1500);
                                            }}
                                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                            title="기업명 복사"
                                        >
                                            {copiedName ? (
                                                <svg className="w-3.5 h-3.5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            )}
                                        </button>
                                    )}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition-colors"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* 본문 */}
                <div className="p-6 space-y-6">
                    {/* 수익/손실 요약 카드 */}
                    <div className={`rounded-xl p-5 ${isProfit ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">평가손익</span>
                            <span className={`text-2xl font-bold ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {isProfit ? '+' : ''}{diffPct.toFixed(2)}%
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">매수금액</div>
                                <div className="text-slate-900 dark:text-white">
                                    <BoldInt text={`$${totalBuy.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                                </div>
                                {buyPriceRate > 0 && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        ₩{(totalBuy * buyPriceRate).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">평가금액</div>
                                <div className="text-slate-900 dark:text-white">
                                    <BoldInt text={`$${totalCurrent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                                </div>
                                {fxRate > 0 && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        ₩{(totalCurrent * fxRate).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">손익금액</div>
                                <div className={`${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    <BoldInt text={`${isProfit ? '+' : ''}$${diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                                </div>
                                {fxRate > 0 && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {isProfit ? '+' : ''}₩{(diff * fxRate).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 가격 정보 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">매수가</div>
                            <div className="text-slate-900 dark:text-white">
                                <BoldInt text={`$${buyPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
                            </div>
                            {buyPriceRate > 0 && buyPrice > 0 && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    ₩{Math.round(buyPrice * buyPriceRate).toLocaleString()}
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">현재가</div>
                            <div className={`${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                <BoldInt text={`$${curPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
                            </div>
                            {fxRate > 0 && curPrice > 0 && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    ₩{Math.round(curPrice * fxRate).toLocaleString()}
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-xs text-slate-500 dark:text-slate-400">목표가</span>
                                {formData.targetPriceSync && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 ${syncingTarget ? 'animate-pulse' : ''}`}>{syncingTarget ? '갱신 중' : '동기화'}</span>
                                )}
                            </div>
                            <div className={`${isTargetHit ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                                {targetPrice > 0 ? <BoldInt text={`$${targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} /> : '-'}
                            </div>
                            {fxRate > 0 && targetPrice > 0 && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    ₩{Math.round(targetPrice * fxRate).toLocaleString()}
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">보유수량</div>
                            <div className="font-semibold text-slate-900 dark:text-white">{qty}주</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 col-span-2">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">매수당시환율</div>
                            <div className="text-slate-900 dark:text-white">
                                {buyExchangeRate > 0 ? <BoldInt text={`₩${buyExchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}`} /> : '-'}
                            </div>
                        </div>
                    </div>

                    {/* 가격 비교 차트 */}
                    <PriceComparisonChart
                        buyPrice={buyPrice}
                        currentPrice={curPrice}
                        targetPrice={targetPrice}
                    />

                    {/* 편집 폼 */}
                    {isGroupRow ? (
                        <>
                            {isEditing ? (
                                <div className="border border-indigo-200 dark:border-indigo-700/50 rounded-lg p-4 space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-medium text-slate-900 dark:text-white">그룹 정보 수정</h3>
                                        <span className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-full">
                                            그룹 내 {row.groupRows?.length || 0}개 항목에 적용
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">티커</label>
                                            <input
                                                type="text"
                                                value={formData.symbol}
                                                onChange={(e) => handleChange('symbol', e.target.value.toUpperCase())}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">기업명</label>
                                            <input
                                                type="text"
                                                value={formData.companyName}
                                                onChange={(e) => handleChange('companyName', e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">목표가 ($)</label>
                                                <button
                                                    type="button"
                                                    onClick={() => handleChange('targetPriceSync', !formData.targetPriceSync)}
                                                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                                                        formData.targetPriceSync ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
                                                    }`}
                                                    title="동기화: 기업가치 분석 목표매도가 자동 적용"
                                                >
                                                    <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
                                                        formData.targetPriceSync ? 'translate-x-[14px]' : 'translate-x-[2px]'
                                                    }`} />
                                                </button>
                                            </div>
                                            {formData.targetPriceSync ? (
                                                <div className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 text-blue-600 dark:text-blue-400">
                                                    자동 동기화
                                                </div>
                                            ) : (
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.targetPrice}
                                                    onChange={(e) => handleChange('targetPrice', e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">종목 메모</label>
                                        <textarea
                                            value={formData.symbolMemo}
                                            onChange={(e) => handleChange('symbolMemo', e.target.value)}
                                            rows={2}
                                            maxLength={SYMBOL_MEMO_MAX_LENGTH}
                                            placeholder="이 종목 전체에 대한 메모 (매수 건별 비고는 펼친 행에서 수정)"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white resize-none"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    symbol: row.symbol || '',
                                                    companyName: row.companyName || '',
                                                    targetPrice: row.targetPrice || '',
                                                    targetPriceSync: row.targetPriceSync || false,
                                                    symbolMemo,
                                                }));
                                                setIsEditing(false);
                                            }}
                                            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={handleGroupSave}
                                            disabled={saving}
                                            className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {saving ? '저장 중...' : '일괄 저장'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-indigo-200 dark:border-indigo-700/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-medium text-slate-900 dark:text-white">그룹 정보</h3>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            그룹 수정
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                목표가
                                                {formData.targetPriceSync && (
                                                    <span className={`text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 ${syncingTarget ? 'animate-pulse' : ''}`}>{syncingTarget ? '갱신 중' : '동기화'}</span>
                                                )}
                                            </span>
                                            <span className="text-slate-900 dark:text-white font-medium">
                                                {formData.targetPrice ? `$${parseFloat(formData.targetPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 dark:text-slate-400">포함 항목</span>
                                            <span className="text-slate-900 dark:text-white font-medium">{row.groupRows?.length || 0}건</span>
                                        </div>
                                        <MemoLine label="종목 메모" value={formData.symbolMemo} />
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {isEditing ? (
                                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-medium text-slate-900 dark:text-white">정보 수정</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">티커</label>
                                            <input
                                                type="text"
                                                value={formData.symbol}
                                                onChange={(e) => handleChange('symbol', e.target.value.toUpperCase())}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">기업명</label>
                                            <input
                                                type="text"
                                                value={formData.companyName}
                                                onChange={(e) => handleChange('companyName', e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">매수일</label>
                                            <input
                                                type="date"
                                                value={formData.buyDate}
                                                onChange={(e) => handleChange('buyDate', e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">매수가 ($)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.buyPrice}
                                                onChange={(e) => handleChange('buyPrice', e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">수량</label>
                                            <input
                                                type="number"
                                                value={formData.totalBuyAmount}
                                                onChange={(e) => handleChange('totalBuyAmount', e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">목표가 ($)</label>
                                                <button
                                                    type="button"
                                                    onClick={() => handleChange('targetPriceSync', !formData.targetPriceSync)}
                                                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                                                        formData.targetPriceSync ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
                                                    }`}
                                                    title="동기화: 기업가치 분석 목표매도가 자동 적용"
                                                >
                                                    <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
                                                        formData.targetPriceSync ? 'translate-x-[14px]' : 'translate-x-[2px]'
                                                    }`} />
                                                </button>
                                            </div>
                                            {formData.targetPriceSync ? (
                                                <div className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 text-blue-600 dark:text-blue-400">
                                                    자동 동기화
                                                </div>
                                            ) : (
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.targetPrice}
                                                    onChange={(e) => handleChange('targetPrice', e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">매수당시환율 (₩)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.buyExchangeRateAtTrade}
                                                onChange={(e) => handleChange('buyExchangeRateAtTrade', e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">종목 메모</label>
                                        <textarea
                                            value={formData.symbolMemo}
                                            onChange={(e) => handleChange('symbolMemo', e.target.value)}
                                            rows={2}
                                            maxLength={SYMBOL_MEMO_MAX_LENGTH}
                                            placeholder="이 종목 전체에 대한 메모"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">매수 비고</label>
                                        <textarea
                                            value={formData.rmk}
                                            onChange={(e) => handleChange('rmk', e.target.value)}
                                            rows={2}
                                            placeholder="이 매수 건에 대한 메모"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white resize-none"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => {
                                                setFormData({
                                                    symbol: row.symbol || '',
                                                    companyName: row.companyName || '',
                                                    buyDate: row.buyDate || '',
                                                    buyPrice: row.buyPrice || '',
                                                    totalBuyAmount: row.totalBuyAmount || '',
                                                    currentPrice: row.currentPrice || '',
                                                    targetPrice: row.targetPrice || '',
                                                    targetPriceSync: row.targetPriceSync || false,
                                                    buyExchangeRateAtTrade: row.buyExchangeRateAtTrade || '',
                                                    rmk: row.rmk || '',
                                                    symbolMemo,
                                                });
                                                setIsEditing(false);
                                            }}
                                            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {saving ? '저장 중...' : '저장'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-medium text-slate-900 dark:text-white">상세 정보</h3>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            수정
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 dark:text-slate-400">매수일</span>
                                            <span className="text-slate-900 dark:text-white font-medium">{formData.buyDate || '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 dark:text-slate-400">매수당시환율</span>
                                            <span className="text-slate-900 dark:text-white">
                                                {formData.buyExchangeRateAtTrade ? <BoldInt text={`₩${parseFloat(formData.buyExchangeRateAtTrade).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}`} /> : '-'}
                                            </span>
                                        </div>
                                        <MemoLine label="종목 메모" value={formData.symbolMemo} />
                                        <MemoLine label="매수 비고" value={formData.rmk} />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* 기업 프로파일 - 로딩/성공/실패 모두 동일한 높이를 유지해 모달 shift 방지 */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-600 rounded-lg p-4 border border-blue-100 dark:border-slate-600">
                        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">기업 정보</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            {loadingProfile ? (
                                [0, 1, 2, 3].map((i) => (
                                    <div key={i} className="animate-pulse">
                                        <div className="h-3 w-12 bg-slate-200 dark:bg-slate-600 rounded mb-1.5" />
                                        <div className="h-4 w-16 bg-slate-200 dark:bg-slate-600 rounded" />
                                    </div>
                                ))
                            ) : companyProfile ? (
                                <>
                                    {companyProfile.exchange && (
                                        <div>
                                            <div className="text-slate-500 dark:text-slate-400">거래소</div>
                                            <div className="font-medium text-slate-900 dark:text-white">{companyProfile.exchange}</div>
                                        </div>
                                    )}
                                    {companyProfile.sector && (
                                        <div>
                                            <div className="text-slate-500 dark:text-slate-400">섹터</div>
                                            <div className="font-medium text-slate-900 dark:text-white">{companyProfile.sector}</div>
                                        </div>
                                    )}
                                    {companyProfile.marketCap && (
                                        <div>
                                            <div className="text-slate-500 dark:text-slate-400">시가총액</div>
                                            <div className="font-medium text-slate-900 dark:text-white">
                                                ${(companyProfile.marketCap / 1e9).toFixed(2)}B
                                            </div>
                                        </div>
                                    )}
                                    {companyProfile.beta && (
                                        <div>
                                            <div className="text-slate-500 dark:text-slate-400">베타</div>
                                            <div className="font-medium text-slate-900 dark:text-white">{companyProfile.beta.toFixed(2)}</div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="col-span-full text-center text-slate-400 dark:text-slate-500">기업 정보를 불러올 수 없습니다</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 푸터 */}
                <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/80">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-white transition-colors dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                        닫기
                    </button>
                    <div className="flex items-center gap-2">
                        {!isGroupRow && onRemove && (
                            <button
                                onClick={() => {
                                    if (onOpenAlert) {
                                        onOpenAlert('정말 삭제하시겠습니까?', async () => {
                                            const success = await onRemove(row.id);
                                            if (success) {
                                                onClose();
                                            }
                                        });
                                    }
                                }}
                                disabled={saving}
                                className="px-4 py-2 text-sm border border-rose-300 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors
                                    dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/30
                                    disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                삭제
                            </button>
                        )}
                        {onSell && (
                            <button
                                onClick={() => onSell(row)}
                                disabled={saving}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors
                                    disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                매도
                            </button>
                        )}
                        <button
                            onClick={handleAnalyzeClick}
                            disabled={!formData.symbol || isAnalyzing}
                            className="px-5 py-2 text-sm bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isAnalyzing ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    분석 중...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    기업가치 분석
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
