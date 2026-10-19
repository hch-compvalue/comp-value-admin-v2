/**
 * 숫자 변환 유틸리티
 */
export const toNum = (v) => (v == null || v === '' || isNaN(Number(v)) ? 0 : Number(v));

/**
 * 숫자 포맷팅
 * @param {number} n - 포맷팅할 숫자
 * @param {number} d - 소수점 자릿수
 */
export function fmtNum(n, d = 2) {
    if (n == null || n === '' || isNaN(Number(n))) return '';
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
}

/**
 * USD 포맷팅 (소수점 2자리 고정)
 * @param {number} n - 포맷팅할 숫자
 */
export function fmtUsd(n) {
    if (n == null || n === '' || isNaN(Number(n))) return '';
    return Number(n).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD)
 * @param {Date|string} d - 포맷팅할 날짜
 */
export function fmtDate(d) {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * 통화 금액 텍스트 (테이블 통화 토글용)
 * - KRW: 현재 환율 환산 후 원 단위 반올림, 환율 없으면 USD 로 표시
 * @param {number} usd - USD 금액
 * @param {'USD'|'KRW'} currency
 * @param {number} fx - USD/KRW 환율
 * @param {{ signed?: boolean }} [opts] - signed: 양수에 + 표시
 */
export function fmtMoney(usd, currency, fx, { signed = false } = {}) {
    const v = toNum(usd);
    const sign = v < 0 ? '-' : signed && v > 0 ? '+' : '';
    const abs = Math.abs(v);
    if (currency === 'KRW' && fx > 0) return `${sign}₩${Math.round(abs * fx).toLocaleString()}`;
    return `${sign}$${fmtUsd(abs)}`;
}
