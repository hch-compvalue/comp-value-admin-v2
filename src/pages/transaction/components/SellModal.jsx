import { useState, useEffect } from 'react';
import Button from '@/component/common/button/Button';
import { fmtUsd } from '../utils/formatters';
import { FmtAmount } from './TableCells';
import useModalAnimation from '@/hooks/useModalAnimation';

/**
 * 매도 정보 입력 모달
 */
export default function SellModal({
    open,
    onClose,
    onConfirm,
    data,
    fx,
    saving,
}) {
    const [sellPrice, setSellPrice] = useState('');
    const [sellQty, setSellQty] = useState('');
    const [buyExchangeRate, setBuyExchangeRate] = useState('');
    const [sellExchangeRate, setSellExchangeRate] = useState('');
    const [error, setError] = useState('');

    // 모달 열릴 때 초기화
    useEffect(() => {
        if (open) {
            setSellPrice(data?.currentPrice || '');
            setSellQty('');
            // 매수당시환율: 데이터 있으면 사용, 없으면 현재환율
            setBuyExchangeRate(data?.buyExchangeRateAtTrade || fx || '');
            // 매도당시환율: 현재환율로 초기 세팅
            setSellExchangeRate(fx || '');
            setError('');
        }
    }, [open, data, fx]);

    const { shouldRender, isAnimatingOut } = useModalAnimation(open);

    if (!shouldRender || !data) return null;

    const { symbol, companyName, buyPrice, totalQty, currentPrice, buyExchangeRateAtTrade } = data;
    const maxQty = totalQty || 0;
    // 매수가격 원화 계산: 매수당시환율 우선, 없으면 현재환율 사용
    const buyPriceRate = buyExchangeRateAtTrade || fx;

    const handleSubmit = () => {
        const price = parseFloat(sellPrice);
        const qty = parseInt(sellQty, 10);
        const buyRate = parseFloat(buyExchangeRate);
        const sellRate = parseFloat(sellExchangeRate);

        if (!price || price <= 0) {
            setError('매도 가격을 입력해주세요.');
            return;
        }
        if (!qty || qty <= 0) {
            setError('매도 수량을 입력해주세요.');
            return;
        }
        if (qty > maxQty) {
            setError(`매도 수량은 보유 수량(${maxQty})을 초과할 수 없습니다.`);
            return;
        }

        setError('');
        onConfirm({
            symbol,
            companyName,
            sellPrice: price,
            sellQty: qty,
            buyExchangeRateAtTrade: buyRate || null,
            sellExchangeRateAtTrade: sellRate || null,
        });
    };

    const handleClose = () => {
        if (!saving) {
            onClose();
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 px-4 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }}>
            <div className={`w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-xl ring-1 ring-slate-900/5 dark:bg-slate-800 dark:text-white dark:ring-slate-700 animate__animated ${isAnimatingOut ? 'animate__fadeOutDown' : 'animate__fadeInUp'}`} style={{ animationDuration: '0.25s' }}>
                <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                    매도 정보 입력
                </h2>

                {/* 거래 정보 표시 */}
                <div className="mb-5 rounded-lg bg-slate-50 p-4 dark:bg-slate-700/50">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-slate-500 dark:text-slate-400">티커</span>
                            <p className="font-medium dark:text-white">{symbol}</p>
                        </div>
                        <div>
                            <span className="text-slate-500 dark:text-slate-400">기업명</span>
                            <p className="font-medium dark:text-white">{companyName || '-'}</p>
                        </div>
                        <div>
                            <span className="text-slate-500 dark:text-slate-400">매수가격</span>
                            <p className="font-medium dark:text-white">
                                <FmtAmount text={`$ ${fmtUsd(buyPrice)}`} />
                                {buyPriceRate && <span className="text-xs text-slate-400 ml-1">(₩{Math.round(buyPrice * buyPriceRate).toLocaleString()})</span>}
                            </p>
                        </div>
                        <div>
                            <span className="text-slate-500 dark:text-slate-400">보유수량</span>
                            <p className="font-medium dark:text-white">{maxQty}주</p>
                        </div>
                        <div className="col-span-2">
                            <span className="text-slate-500 dark:text-slate-400">현재가격</span>
                            <p className="font-medium dark:text-white">
                                <FmtAmount text={`$ ${fmtUsd(currentPrice)}`} />
                                {fx && <span className="text-xs text-slate-400 ml-1">(₩{Math.round(currentPrice * fx).toLocaleString()})</span>}
                            </p>
                        </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        * 매수가격 원화는 매수당시 환율 기준, 현재가격 원화는 현재 환율 기준입니다.
                    </div>
                </div>

                {/* 매도 정보 입력 */}
                <div className="space-y-4 mb-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            매도 가격 (USD)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={sellPrice}
                            onChange={(e) => setSellPrice(e.target.value)}
                            placeholder="매도 가격 입력"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            disabled={saving}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            매도 수량 (최대: {maxQty}주)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max={maxQty}
                            value={sellQty}
                            onChange={(e) => setSellQty(e.target.value)}
                            placeholder="매도 수량 입력"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            disabled={saving}
                        />
                        <div className="mt-1 flex gap-2">
                            {[25, 50, 75, 100].map((pct) => (
                                <button
                                    key={pct}
                                    type="button"
                                    onClick={() => setSellQty(Math.floor(maxQty * pct / 100).toString())}
                                    className="px-2 py-0.5 text-xs rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-white"
                                    disabled={saving}
                                >
                                    {pct}%
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 환율 입력 필드 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                매수당시환율 (₩)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={buyExchangeRate}
                                onChange={(e) => setBuyExchangeRate(e.target.value)}
                                placeholder="매수당시환율"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                disabled={saving}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                매도당시환율 (₩)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={sellExchangeRate}
                                onChange={(e) => setSellExchangeRate(e.target.value)}
                                placeholder="매도당시환율"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                disabled={saving}
                            />
                        </div>
                    </div>
                </div>

                {/* 예상 실현손익 표시 */}
                {sellPrice && sellQty && (
                    <div className="mb-5 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                        <div className="text-sm text-slate-600 dark:text-slate-300">예상 실현손익</div>
                        {(() => {
                            const pnl = (parseFloat(sellPrice) - buyPrice) * parseInt(sellQty || 0, 10);
                            const isPositive = pnl >= 0;
                            const sellRate = parseFloat(sellExchangeRate) || fx;
                            return (
                                <p className={`text-lg font-bold ${isPositive ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                    <FmtAmount text={`${isPositive ? '+' : ''}$ ${fmtUsd(pnl)}`} />
                                    {sellRate && (
                                        <span className="text-sm font-normal ml-2">
                                            (₩{Math.round(pnl * sellRate).toLocaleString()})
                                        </span>
                                    )}
                                </p>
                            );
                        })()}
                    </div>
                )}

                {/* 에러 메시지 */}
                {error && (
                    <div className="mb-4 text-sm text-orange-600 dark:text-orange-400">{error}</div>
                )}

                {/* 버튼 */}
                <div className="flex justify-end gap-2">
                    <Button
                        variant="secondary"
                        onClick={handleClose}
                        disabled={saving}
                    >
                        취소
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleSubmit}
                        disabled={saving}
                    >
                        {saving ? '처리 중...' : '매도'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
