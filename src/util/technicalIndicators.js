/**
 * 기술적 지표 계산 유틸리티
 * 각 함수는 chartData 배열(OHLCV)을 받아 계산된 값을 각 데이터 포인트에 추가한 새 배열을 반환
 */

/**
 * SMA (Simple Moving Average) - 단순이동평균
 * @param {Array} data - OHLCV 데이터 배열
 * @param {number} period - 기간 (20, 50, 200)
 * @returns {Array} sma{period} 필드가 추가된 배열
 */
export const calcSMA = (data, period) => {
    const key = `sma${period}`;
    return data.map((item, i) => {
        if (i < period - 1) return { ...item, [key]: null };
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            sum += data[j].close;
        }
        return { ...item, [key]: sum / period };
    });
};

/**
 * EMA (Exponential Moving Average) - 지수이동평균
 * @param {Array} data - OHLCV 데이터 배열
 * @param {number} period - 기간 (12, 26)
 * @returns {Array} ema{period} 필드가 추가된 배열
 */
export const calcEMA = (data, period) => {
    const key = `ema${period}`;
    const multiplier = 2 / (period + 1);
    const result = [];

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push({ ...data[i], [key]: null });
        } else if (i === period - 1) {
            // 첫 EMA = 첫 period개의 SMA
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[j].close;
            }
            result.push({ ...data[i], [key]: sum / period });
        } else {
            const prevEma = result[i - 1][key];
            const ema = (data[i].close - prevEma) * multiplier + prevEma;
            result.push({ ...data[i], [key]: ema });
        }
    }
    return result;
};

/**
 * 볼린저 밴드 (Bollinger Bands)
 * @param {Array} data - OHLCV 데이터 배열
 * @param {number} period - 기간 (기본 20)
 * @param {number} stdDev - 표준편차 배수 (기본 2)
 * @returns {Array} bbUpper, bbMiddle, bbLower 필드가 추가된 배열
 */
export const calcBollingerBands = (data, period = 20, stdDev = 2) => {
    return data.map((item, i) => {
        if (i < period - 1) {
            return { ...item, bbUpper: null, bbMiddle: null, bbLower: null };
        }

        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            sum += data[j].close;
        }
        const mean = sum / period;

        let sqSum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            sqSum += (data[j].close - mean) ** 2;
        }
        const std = Math.sqrt(sqSum / period);

        return {
            ...item,
            bbUpper: mean + stdDev * std,
            bbMiddle: mean,
            bbLower: mean - stdDev * std,
        };
    });
};

/**
 * RSI (Relative Strength Index) - 상대강도지수
 * @param {Array} data - OHLCV 데이터 배열
 * @param {number} period - 기간 (기본 14)
 * @returns {Array} rsi 필드가 추가된 배열
 */
export const calcRSI = (data, period = 14) => {
    const result = [];

    for (let i = 0; i < data.length; i++) {
        if (i < period) {
            result.push({ ...data[i], rsi: null });
            continue;
        }

        if (i === period) {
            // 첫 RSI: 단순 평균으로 계산
            let gainSum = 0;
            let lossSum = 0;
            for (let j = 1; j <= period; j++) {
                const change = data[j].close - data[j - 1].close;
                if (change > 0) gainSum += change;
                else lossSum += Math.abs(change);
            }
            const avgGain = gainSum / period;
            const avgLoss = lossSum / period;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
            result.push({ ...data[i], rsi, _avgGain: avgGain, _avgLoss: avgLoss });
            continue;
        }

        // 이후: 지수이동평균 방식
        const prev = result[i - 1];
        const change = data[i].close - data[i - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        const avgGain = (prev._avgGain * (period - 1) + gain) / period;
        const avgLoss = (prev._avgLoss * (period - 1) + loss) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

        result.push({ ...data[i], rsi, _avgGain: avgGain, _avgLoss: avgLoss });
    }

    // 내부 계산용 필드 제거
    return result.map(({ _avgGain, _avgLoss, ...rest }) => rest);
};

/**
 * MACD (Moving Average Convergence Divergence)
 * @param {Array} data - OHLCV 데이터 배열
 * @param {number} fast - 빠른 EMA 기간 (기본 12)
 * @param {number} slow - 느린 EMA 기간 (기본 26)
 * @param {number} signal - 시그널 기간 (기본 9)
 * @returns {Array} macd, macdSignal, macdHist 필드가 추가된 배열
 */
export const calcMACD = (data, fast = 12, slow = 26, signal = 9) => {
    // EMA 계산 헬퍼 (내부용 - 배열 값만 반환)
    const computeEMA = (values, period) => {
        const multiplier = 2 / (period + 1);
        const result = [];
        for (let i = 0; i < values.length; i++) {
            if (i < period - 1) {
                result.push(null);
            } else if (i === period - 1) {
                let sum = 0;
                for (let j = 0; j < period; j++) sum += values[j];
                result.push(sum / period);
            } else {
                result.push((values[i] - result[i - 1]) * multiplier + result[i - 1]);
            }
        }
        return result;
    };

    const closes = data.map(d => d.close);
    const fastEMA = computeEMA(closes, fast);
    const slowEMA = computeEMA(closes, slow);

    // MACD 라인 = fast EMA - slow EMA
    const macdLine = fastEMA.map((f, i) => {
        if (f === null || slowEMA[i] === null) return null;
        return f - slowEMA[i];
    });

    // 시그널 라인 = MACD 라인의 EMA
    const validMacd = [];
    const validMacdStartIdx = macdLine.findIndex(v => v !== null);
    for (let i = validMacdStartIdx; i < macdLine.length; i++) {
        validMacd.push(macdLine[i]);
    }
    const signalEMA = computeEMA(validMacd, signal);

    return data.map((item, i) => {
        const macd = macdLine[i];
        const signalIdx = i - validMacdStartIdx;
        const macdSignal = signalIdx >= 0 && signalIdx < signalEMA.length ? signalEMA[signalIdx] : null;
        const macdHist = macd !== null && macdSignal !== null ? macd - macdSignal : null;

        return { ...item, macd, macdSignal, macdHist };
    });
};

/**
 * 스토캐스틱 오실레이터 (Stochastic Oscillator)
 * @param {Array} data - OHLCV 데이터 배열
 * @param {number} kPeriod - %K 기간 (기본 14)
 * @param {number} dPeriod - %D 기간 (기본 3)
 * @returns {Array} stochK, stochD 필드가 추가된 배열
 */
export const calcStochastic = (data, kPeriod = 14, dPeriod = 3) => {
    const result = [];

    // %K 계산
    for (let i = 0; i < data.length; i++) {
        if (i < kPeriod - 1) {
            result.push({ ...data[i], stochK: null, stochD: null });
            continue;
        }

        let highest = -Infinity;
        let lowest = Infinity;
        for (let j = i - kPeriod + 1; j <= i; j++) {
            if (data[j].high > highest) highest = data[j].high;
            if (data[j].low < lowest) lowest = data[j].low;
        }

        const range = highest - lowest;
        const stochK = range === 0 ? 50 : ((data[i].close - lowest) / range) * 100;
        result.push({ ...data[i], stochK, stochD: null });
    }

    // %D 계산 (%K의 SMA)
    for (let i = 0; i < result.length; i++) {
        if (result[i].stochK === null) continue;

        // %K 값이 dPeriod개 이상 있는지 확인
        let count = 0;
        let sum = 0;
        for (let j = i; j >= 0 && count < dPeriod; j--) {
            if (result[j].stochK !== null) {
                sum += result[j].stochK;
                count++;
            }
        }

        if (count === dPeriod) {
            result[i].stochD = sum / dPeriod;
        }
    }

    return result;
};

/**
 * 지표별 계산에 필요한 봉 수 (첫 값이 나오기까지의 lookback)
 */
export const INDICATOR_LOOKBACK = Object.freeze({
    sma20: 20, sma50: 50, sma200: 200,
    ema12: 12, ema26: 26,
    bollinger: 20,
    rsi: 15,        // 14 + 1
    macd: 35,       // 26 + 9
    stochastic: 17, // 14 + 3
});

/**
 * 선으로 보이려면 값이 2개 이상 필요 → 필요한 최소 봉 수
 */
export const minBarsForLine = (key) => INDICATOR_LOOKBACK[key] + 1;

/**
 * 활성화된 지표 중 가장 긴 lookback 기간 계산
 * API 데이터 요청 시 추가로 필요한 봉 수를 반환
 * @param {Object} indicators - 지표 활성화 상태
 * @returns {number} 추가로 필요한 봉 수
 */
export const getMaxLookback = (indicators) =>
    Object.keys(INDICATOR_LOOKBACK).reduce((max, key) => (indicators[key] ? Math.max(max, INDICATOR_LOOKBACK[key]) : max), 0);
