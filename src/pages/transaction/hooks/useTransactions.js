import { useState, useEffect } from 'react';
import {
    fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    fetchFxRate,
    fetchCurrentPricesBySymbols,
    createSellRecord,
    syncTargetPrice,
} from '../services/TransactionService';
import { sortRowsBySymbolAndDate } from '../utils/sorting';
import { INITIAL_NEW_ROW } from '../constants';

// 심볼 → {currentPrice, previousClose} 보존 맵 생성
function buildPrevPriceMap(rows) {
    return new Map(
        rows.map((r) => [
            String(r.symbol || '').toUpperCase(),
            { currentPrice: r.currentPrice, previousClose: r.previousClose },
        ])
    );
}

// 백엔드 재조회 결과(r)에 보존된 가격 정보를 머지
function mergePreservedPrices(r, prevPriceBySym) {
    const prev = prevPriceBySym.get(String(r.symbol || '').toUpperCase());
    if (!prev) return r;
    const cp = prev.currentPrice;
    if (cp === undefined || cp === null || cp === '') return r;
    return { ...r, currentPrice: cp, previousClose: prev.previousClose };
}

/**
 * 거래 목록 관리 커스텀 훅
 */
export function useTransactions(openAlert = (msg) => alert(msg)) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    // 최초 로드 시 목록 조회 + 실시간 현재가 갱신
    useEffect(() => {
        loadTransactions().then((list) => {
            if (list && list.length > 0) {
                const symbols = Array.from(new Set(list.map((r) => r.symbol).filter(Boolean)));
                mergePricesBySymbols(symbols);
            }
        });
    }, []);

    const loadTransactions = async () => {
        setLoading(true);
        try {
            const list = await fetchTransactions();
            setRows(sortRowsBySymbolAndDate(list));
            setLastUpdated(new Date());
            return list;
        } finally {
            setLoading(false);
        }
    };

    // 목록 재조회 (현재가/전일종가는 기존 값 보존)
    // 기업가치 분석 후 targetPriceSync로 갱신된 목표가 반영 용도
    const refetchTransactions = async () => {
        setLoading(true);
        try {
            const prevPriceBySym = buildPrevPriceMap(rows);
            const list = await fetchTransactions();
            const merged = list.map((r) => mergePreservedPrices(r, prevPriceBySym));
            const sorted = sortRowsBySymbolAndDate(merged);
            setRows(sorted);
            setLastUpdated(new Date());
            return sorted;
        } catch (e) {
            return null;
        } finally {
            setLoading(false);
        }
    };

    const addTransaction = async (payload, mergePricesBySymbols) => {
        if (!payload.symbol) {
            openAlert('티커를 입력해주세요.');
            return false;
        }

        setSaving(true);
        try {
            // 기존 현재가/전일종가 보존
            const prevPriceBySym = buildPrevPriceMap(rows);

            // 등록
            await createTransaction(payload);

            // 목록 재조회 + 기존 가격 머지
            const list = await fetchTransactions();
            const merged = list.map((r) => mergePreservedPrices(r, prevPriceBySym));
            setRows(sortRowsBySymbolAndDate(merged));

            // 모든 심볼의 현재가 동기화
            const allSymbols = Array.from(new Set(merged.map((r) => r.symbol)));
            await mergePricesBySymbols(allSymbols);

            setLastUpdated(new Date());
            return true;
        } catch (e) {
            openAlert('등록에 실패했습니다.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const updateTransactionField = async (id, field, value) => {
        setSaving(true);
        try {
            const updated = await updateTransaction(id, { [field]: value });

            setRows((prev) => {
                const newRows = prev.map((r) => {
                    if (r.id === id) {
                        // currentPrice는 프론트에서만 관리되는 필드이므로 절대 덮어쓰면 안됨
                        // 백엔드 응답에서 currentPrice를 제외하고 나머지만 업데이트
                        const { currentPrice: _, ...backendData } = updated || {};

                        // 기존 row에 백엔드 데이터를 머지 (currentPrice는 보존됨)
                        return { ...r, ...backendData };
                    }
                    return r;
                });
                return newRows;
            });
            return true;
        } catch (e) {
            openAlert('수정에 실패했습니다.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    // 복수 필드를 한 번의 API 호출로 수정
    const updateTransactionFields = async (id, updates) => {
        setSaving(true);
        try {
            const updated = await updateTransaction(id, updates);

            setRows((prev) =>
                prev.map((r) => {
                    if (r.id === id) {
                        const { currentPrice: _, ...backendData } = updated || {};
                        return { ...r, ...backendData };
                    }
                    return r;
                })
            );
            return true;
        } catch (e) {
            openAlert('수정에 실패했습니다.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const removeTransaction = async (id) => {
        setSaving(true);
        try {
            // 기존 현재가/전일종가 보존
            const prevPriceBySym = buildPrevPriceMap(rows);

            await deleteTransaction(id);
            const list = await fetchTransactions();
            const merged = list.map((r) => mergePreservedPrices(r, prevPriceBySym));
            setRows(sortRowsBySymbolAndDate(merged));
            setLastUpdated(new Date());
            return true;
        } catch (e) {
            openAlert('삭제에 실패했습니다.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const mergePricesBySymbols = async (symbols = []) => {
        const unique = Array.from(
            new Set(symbols.filter(Boolean).map((s) => String(s).toUpperCase()))
        );
        if (unique.length === 0) return;

        const priceList = await fetchCurrentPricesBySymbols(unique);
        const bySym = new Map(priceList.map((p) => [String(p.symbol).toUpperCase(), p]));

        setRows((prev) =>
            prev.map((r) => {
                const sym = String(r.symbol || '').toUpperCase();
                const hit = bySym.get(sym);
                if (!hit) return r;
                return {
                    ...r,
                    currentPrice: Number(hit.currentPrice),
                    previousClose: hit.previousClose != null ? Number(hit.previousClose) : r.previousClose,
                };
            })
        );
        setLastUpdated(new Date());
    };

    // 동기화 목표가 재계산 후 같은 심볼의 동기화 ON 행에 반영 (상세 모달 진입 시 캐시 만료 종목)
    const refreshSyncTarget = async (symbol) => {
        const res = await syncTargetPrice(symbol);
        const target = res?.targetPrice;
        if (!(target > 0)) return null;

        const sym = String(symbol).toUpperCase();
        setRows((prev) =>
            prev.map((r) =>
                r.targetPriceSync && String(r.symbol || '').toUpperCase() === sym
                    ? { ...r, targetPrice: target, targetPriceCached: true }
                    : r
            )
        );
        return target;
    };

    /**
     * 매도 처리 (FIFO 방식)
     * @param {Object} sellData - 매도 정보 { symbol, companyName, sellPrice, sellQty, buyExchangeRateAtTrade, sellExchangeRateAtTrade }
     * @param {Array} targetRows - 매도 대상 행들 (매수일자 기준 오래된 순 정렬 필요)
     */
    const processSell = async (sellData, targetRows) => {
        const { symbol, companyName, sellPrice, sellQty, buyExchangeRateAtTrade, sellExchangeRateAtTrade } = sellData;

        setSaving(true);
        try {
            // 1. 매도 기록 등록 (실현손익 계산)
            // FIFO 방식으로 실현손익 계산
            let remainingQty = sellQty;
            let totalPnl = 0;
            const sortedRows = [...targetRows].sort((a, b) =>
                new Date(a.buyDate || 0) - new Date(b.buyDate || 0)
            );

            for (const row of sortedRows) {
                if (remainingQty <= 0) break;
                const rowQty = row.totalBuyAmount || 0;
                const sellFromRow = Math.min(remainingQty, rowQty);
                totalPnl += (sellPrice - (row.buyPrice || 0)) * sellFromRow;
                remainingQty -= sellFromRow;
            }

            const sellRecord = {
                symbol,
                companyName,
                sellDate: new Date().toISOString().split('T')[0],
                sellPrice,
                sellQty,
                realizedPnl: totalPnl,
                buyExchangeRateAtTrade,
                sellExchangeRateAtTrade,
            };

            await createSellRecord(sellRecord);

            // 2. FIFO 방식으로 수량 차감 및 삭제
            remainingQty = sellQty;
            const rowsToDelete = [];
            const rowsToUpdate = [];

            for (const row of sortedRows) {
                if (remainingQty <= 0) break;
                const rowQty = row.totalBuyAmount || 0;

                if (remainingQty >= rowQty) {
                    // 전량 매도 - 삭제 대상
                    rowsToDelete.push(row.id);
                    remainingQty -= rowQty;
                } else {
                    // 일부 매도 - 수량 업데이트
                    rowsToUpdate.push({
                        id: row.id,
                        newQty: rowQty - remainingQty,
                    });
                    remainingQty = 0;
                }
            }

            // 3. 삭제 처리
            for (const id of rowsToDelete) {
                await deleteTransaction(id);
            }

            // 4. 수량 업데이트 처리
            for (const { id, newQty } of rowsToUpdate) {
                await updateTransaction(id, { totalBuyAmount: newQty });
            }

            // 5. 로컬 상태 즉시 업데이트 (API 호출 실패에 대비)
            setRows((prev) => {
                let updated = prev.filter((r) => !rowsToDelete.includes(r.id));
                updated = updated.map((r) => {
                    const upd = rowsToUpdate.find((u) => u.id === r.id);
                    return upd ? { ...r, totalBuyAmount: upd.newQty } : r;
                });
                return sortRowsBySymbolAndDate(updated);
            });

            // 6. 백그라운드에서 목록 갱신 시도 (실패해도 무시)
            try {
                const list = await fetchTransactions();
                const prevPriceBySym = buildPrevPriceMap(rows);
                const merged = list.map((r) => mergePreservedPrices(r, prevPriceBySym));
                setRows(sortRowsBySymbolAndDate(merged));
            } catch (refreshError) {
                console.warn('목록 갱신 실패 (로컬 상태는 이미 업데이트됨):', refreshError);
            }

            setLastUpdated(new Date());
            return { success: true, realizedPnl: totalPnl };
        } catch (e) {
            openAlert('매도 처리에 실패했습니다.');
            return { success: false };
        } finally {
            setSaving(false);
        }
    };

    return {
        rows,
        loading,
        saving,
        lastUpdated,
        addTransaction,
        updateTransactionField,
        updateTransactionFields,
        removeTransaction,
        mergePricesBySymbols,
        processSell,
        refetchTransactions,
        refreshSyncTarget,
    };
}
