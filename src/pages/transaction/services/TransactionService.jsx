// TransactionService.jsx
// 실제 백엔드 API와 연동하거나, 현재는 모킹 데이터를 반환하는 예시 서비스

import { send } from '@/util/ClientUtil';

let _mock = [
    {
        id: 1,
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        buyPrice: 180.12,
        totalBuyAmount: 10,
        buyDate: '2025-09-15',
        currentPrice: 195.42,
        targetPrice: 220,
    },
    {
        id: 2,
        symbol: 'MSFT',
        companyName: 'Microsoft',
        buyPrice: 400.0,
        totalBuyAmount: 5,
        buyDate: '2025-08-10',
        currentPrice: 415.2,
        targetPrice: 450,
    },
    {
        id: 3,
        symbol: 'NVDA',
        companyName: 'NVIDIA',
        buyPrice: 900.0,
        totalBuyAmount: 2,
        buyDate: '2025-10-01',
        currentPrice: 920.0,
        targetPrice: 1000,
    },
];

let _id = 4;

// 거래내역 조회
export async function fetchTransactions() {
    await delay(200);
    //return _mock.slice();   // test

    const sendUrl = `/dart/tranrecord`;
    const { data, error } = await send(sendUrl, "", "GET");

    if (error == null) {
        return data.response;
    } else {
        return data.response;
    }

}

// 거래내역 등록
export async function createTransaction(payload) {
    await delay(200);
    //_mock.push({ id: _id++, ...payload });  // test

    const sendUrl = `/dart/tranrecord/regi`;
    const { data, error } = await send(sendUrl, payload, "POST");

    if (error == null) {
        return true;
    } else {
        return false;
    }
}

// 거래내역 수정
export async function updateTransaction(id, patch) {
    await delay(150);
    // test
    // const idx = _mock.findIndex((x) => x.id === id);
    // if (idx >= 0) {
    //     _mock[idx] = { ..._mock[idx], ...normalizePatch(patch) };
    //     return _mock[idx];
    // }

    const sendUrl = `/dart/tranrecord/modi`;
    const { data, error } = await send(sendUrl, { "id": id, ...patch }, "POST");

    if (error == null) {
        return data.response;
    } else {
        throw new Error('not found');
    }
}

// 거래내역 삭제
export async function deleteTransaction(id) {
    await delay(150);
    //_mock = _mock.filter((x) => x.id !== id);   // test

    const sendUrl = `/dart/tranrecord/del`;
    const { data, error } = await send(sendUrl, { "id": id }, "POST");

    if (error == null) {
        return true;
    } else {
        return false;
    }
}

// 현재가격 갱신 (랜덤 변동)
export async function refreshCurrentPrices(ids) {
    await delay(400);
    // test
    _mock = _mock.map((x) =>
        ids.includes(x.id)
            ? { ...x, currentPrice: Number((Number(x.currentPrice) * (0.99 + Math.random() * 0.02)).toFixed(2)) }
            : x
    );
    return _mock.filter((x) => ids.includes(x.id));
}

function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

function normalizePatch(patch) {
    const p = { ...patch };
    ['buyPrice', 'totalBuyAmount', 'currentPrice', 'targetPrice'].forEach((k) => {
        if (p[k] != null && p[k] !== '') p[k] = Number(p[k]);
    });
    return p;
}

// 환율 조회 (모킹). TODO: 실제 연동 시 서버 API로 교체하세요.
export async function fetchFxRate() {
    await delay(120);

    // 예시: 고정 환율 + 갱신 시각
    // const rate = 1390.25; // 1 USD -> KRW
    // return { rate, updatedAt: new Date().toISOString() };

    const currency = "USDKRW";

    const sendUrl = `/dart/tranrecord/rate`;
    const { data, error } = await send(sendUrl, { "currency": currency }, "POST");

    if (error == null && data && data.success) {
        return data.response;
    } else {
        console.error('[fetchCurrentPricesBySymbols] error:', error || data);
        return [];
    }

}

// ---------------------------------------------------------------------------
// 티커 기준 현재가 조회 (백단 연동 지점)
// - 실제 구현 시 서버 API 호출로 교체하세요.
// - 반환 형식: [{ symbol: 'AAPL', currentPrice: 123.45, updatedAt: 'iso-string' }, ...]
export async function fetchCurrentPricesBySymbols(symbols = []) {
    await delay(120);

    // MOCK: 심볼별 임의 가격 생성 (실서버에서는 제거)
    // const now = new Date().toISOString();
    // return symbols
    //     .filter(Boolean)
    //     .map((s) => ({
    //         symbol: String(s).toUpperCase(),
    //         currentPrice: Number((100 + Math.random() * 100)).toFixed(2),
    //         updatedAt: now,
    //     }));

    const sendUrl = `/dart/tranrecord/price`;
    const { data, error } = await send(sendUrl, { "symbols": symbols }, "POST");

    if (error == null && data && data.success) {
        // 백엔드의 response 배열만 반환
        return data.response;
    } else {
        console.error('[fetchCurrentPricesBySymbols] error:', error || data);
        return [];
    }

}

// 단일 티커 현재가 조회 (편의용)
export async function fetchCurrentPriceBySymbol(symbol) {
    const list = await fetchCurrentPricesBySymbols([symbol]);
    return list[0] || null;
}

// 종목 메모 목록 조회 → [{ symbol, memo, updatedAt }]
export async function fetchSymbolMemos() {
    const { data, error } = await send(`/dart/tranrecord/memo`, {}, "GET");
    if (error == null && data && data.success) return data.response || [];
    throw new Error(error || '종목 메모 조회 실패');
}

// 종목 메모 저장 (빈 메모 = 삭제) → { symbol, memo }
export async function saveSymbolMemo(symbol, memo) {
    const { data, error } = await send(`/dart/tranrecord/memo`, { symbol, memo }, "POST");
    if (error == null && data && data.success) return data.response;
    throw new Error(error || '종목 메모 저장 실패');
}

// 동기화 목표매도가 재계산 (캐시 만료 종목) → { symbol, targetPrice, targetPriceCached }
export async function syncTargetPrice(symbol) {
    const sendUrl = `/dart/tranrecord/sync-target`;
    const { data, error } = await send(sendUrl, { symbol }, "POST");

    if (error == null && data && data.success) {
        return data.response;
    } else {
        throw new Error(data?.message || '목표가 갱신 실패');
    }
}

// 매도 기록 등록
export async function createSellRecord(payload) {
    await delay(200);

    const sendUrl = `/dart/sellrecord/regi`;
    const { data, error } = await send(sendUrl, payload, "POST");

    if (error == null && data && data.success) {
        return data.response;
    } else {
        throw new Error(data?.message || '매도 기록 등록 실패');
    }
}