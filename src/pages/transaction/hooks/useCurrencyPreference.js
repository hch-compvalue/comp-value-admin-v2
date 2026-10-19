import { useState } from 'react';
import { CURRENCIES } from '../constants';

const STORAGE_KEY = 'transaction.currency';

function readSaved() {
    try {
        return localStorage.getItem(STORAGE_KEY) === CURRENCIES.KRW ? CURRENCIES.KRW : CURRENCIES.USD;
    } catch {
        return CURRENCIES.USD; // 저장소 차단(사생활 보호 모드 등) 시 기본값
    }
}

/** 보유종목 테이블 표시 통화 (브라우저에 기억) */
export function useCurrencyPreference() {
    const [currency, setCurrency] = useState(readSaved);

    const changeCurrency = (next) => {
        setCurrency(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // 저장 실패 시 현재 세션 동안만 유지
        }
    };

    return [currency, changeCurrency];
}
