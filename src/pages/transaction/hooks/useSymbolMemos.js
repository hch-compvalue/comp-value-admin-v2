import { useState, useEffect, useCallback } from 'react';
import { fetchSymbolMemos, saveSymbolMemo } from '../services/TransactionService';

const normalize = (symbol) => String(symbol || '').toUpperCase();

/**
 * 보유종목 종목 메모 (심볼 → 메모)
 * - 보유 심볼 목록이 바뀌면 다시 조회: 마지막 매수 건 삭제·전량 매도·티커 변경 시 백엔드가 메모를 정리하므로
 * @param {string} heldSymbolsKey - 보유 심볼을 정렬해 이은 문자열 (변경 감지용)
 */
export function useSymbolMemos(heldSymbolsKey) {
    const [memos, setMemos] = useState(() => new Map());

    useEffect(() => {
        if (!heldSymbolsKey) {
            setMemos(new Map());
            return;
        }
        let cancelled = false;
        fetchSymbolMemos()
            .then((list) => {
                if (!cancelled) setMemos(new Map(list.map((m) => [normalize(m.symbol), m.memo || ''])));
            })
            .catch((e) => console.error(e.message));
        return () => { cancelled = true; };
    }, [heldSymbolsKey]);

    const getMemo = useCallback((symbol) => memos.get(normalize(symbol)) || '', [memos]);

    /** 저장 후 로컬 반영, 실패 시 예외 그대로 전달 */
    const saveMemo = async (symbol, memo) => {
        const res = await saveSymbolMemo(symbol, memo);
        setMemos((prev) => {
            const next = new Map(prev);
            if (res?.memo) next.set(normalize(symbol), res.memo);
            else next.delete(normalize(symbol));
            return next;
        });
        return res;
    };

    return { getMemo, saveMemo };
}
