import { useState, useEffect } from 'react';
import useModalAnimation from '@/hooks/useModalAnimation';
import { send } from '@/util/ClientUtil';

export default function SellRecordModal({ isOpen, mode, data, onClose, onSave }) {
    const [formData, setFormData] = useState({
        symbol: '',
        companyName: '',
        sellDate: new Date().toISOString().split('T')[0],
        sellPrice: '',
        sellQty: '',
        realizedPnl: '',
        buyExchangeRateAtTrade: '',
        sellExchangeRateAtTrade: '',
        rmk: '',
    });
    const [saving, setSaving] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [companyProfile, setCompanyProfile] = useState(null);
    const [fxRate, setFxRate] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchFxRate();
        }
    }, [isOpen]);

    const fetchFxRate = async () => {
        try {
            const { data, error } = await send('/dart/tranrecord/rate', { currency: 'USDKRW' }, 'POST');
            if (!error && data?.success && data?.response) {
                setFxRate(data.response.rate || null);
            }
        } catch (e) {
            console.error('환율 조회 실패:', e);
        }
    };

    useEffect(() => {
        if (mode === 'edit' && data) {
            setFormData({
                symbol: data.symbol || '',
                companyName: data.companyName || '',
                sellDate: data.sellDate || new Date().toISOString().split('T')[0],
                sellPrice: data.sellPrice || '',
                sellQty: data.sellQty || '',
                realizedPnl: data.realizedPnl || '',
                buyExchangeRateAtTrade: data.buyExchangeRateAtTrade || '',
                sellExchangeRateAtTrade: data.sellExchangeRateAtTrade || '',
                rmk: data.rmk || '',
            });
            setCompanyProfile(null);
            // 수정 모드에서 기업정보 조회
            if (data.symbol) {
                fetchCompanyProfileForEdit(data.symbol);
            }
        } else {
            setFormData({
                symbol: '',
                companyName: '',
                sellDate: new Date().toISOString().split('T')[0],
                sellPrice: '',
                sellQty: '',
                realizedPnl: '',
                buyExchangeRateAtTrade: '',
                sellExchangeRateAtTrade: fxRate || '',
                rmk: '',
            });
            setCompanyProfile(null);
        }
    }, [mode, data, isOpen, fxRate]);

    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);

    // 수정 모드 초기 로드 시 기업정보 조회
    const fetchCompanyProfileForEdit = async (symbol) => {
        if (!symbol) return;

        setLoadingProfile(true);
        try {
            const { data, error } = await send(`/dart/abroad/company/search/profile?symbol=${encodeURIComponent(symbol)}`, {}, 'GET');
            if (!error && data?.success && data?.response && data.response.length > 0) {
                const profile = data.response[0];
                setCompanyProfile(profile);
            }
        } catch (e) {
            console.error('프로파일 조회 실패:', e);
        } finally {
            setLoadingProfile(false);
        }
    };

    if (!shouldRender) return null;

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // 티커 입력 후 프로파일 조회
    const handleSymbolBlur = async () => {
        const symbol = formData.symbol.trim().toUpperCase();
        if (!symbol) {
            setCompanyProfile(null);
            return;
        }

        setLoadingProfile(true);
        try {
            const { data, error } = await send(`/dart/abroad/company/search/profile?symbol=${encodeURIComponent(symbol)}`, {}, 'GET');
            if (!error && data?.success && data?.response && data.response.length > 0) {
                const profile = data.response[0];
                setCompanyProfile(profile);
                // 기업명 자동 입력 (항상 업데이트)
                setFormData(prev => ({ ...prev, companyName: profile.companyName || '' }));
            } else {
                setCompanyProfile(null);
            }
        } catch (e) {
            console.error('프로파일 조회 실패:', e);
            setCompanyProfile(null);
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleSubmit = async () => {
        // 유효성 검사
        if (!formData.symbol.trim()) {
            alert('티커를 입력해주세요.');
            return;
        }
        if (!formData.companyName.trim()) {
            alert('기업명을 입력해주세요.');
            return;
        }
        if (!formData.sellDate) {
            alert('매도일을 입력해주세요.');
            return;
        }
        if (!formData.sellPrice || parseFloat(formData.sellPrice) <= 0) {
            alert('올바른 매도가를 입력해주세요.');
            return;
        }
        if (!formData.sellQty || parseInt(formData.sellQty) <= 0) {
            alert('올바른 수량을 입력해주세요.');
            return;
        }

        setSaving(true);
        const success = await onSave({
            symbol: formData.symbol.trim(),
            companyName: formData.companyName.trim(),
            sellDate: formData.sellDate,
            sellPrice: parseFloat(formData.sellPrice),
            sellQty: parseInt(formData.sellQty),
            realizedPnl: parseFloat(formData.realizedPnl) || 0,
            buyExchangeRateAtTrade: formData.buyExchangeRateAtTrade ? parseFloat(formData.buyExchangeRateAtTrade) : null,
            sellExchangeRateAtTrade: formData.sellExchangeRateAtTrade ? parseFloat(formData.sellExchangeRateAtTrade) : null,
            rmk: formData.rmk.trim() || null,
        });
        setSaving(false);

        if (success) {
            // 모달은 부모에서 닫음
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const totalAmount = (parseFloat(formData.sellPrice) || 0) * (parseInt(formData.sellQty) || 0);

    return (
        <div
            className={`fixed inset-0 z-[90] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
            style={{ animationDuration: '0.25s' }}
            onClick={handleOverlayClick}
        >
            <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-lg bg-white shadow-xl dark:bg-slate-800 animate__animated ${isAnimatingOut ? 'animate__fadeOutDown' : 'animate__fadeInUp'}`} style={{ animationDuration: '0.25s' }}>
                {/* 헤더 */}
                <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                {mode === 'edit' ? '매도 기록 수정' : '매도 기록 추가'}
                            </h2>
                            {fxRate && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    환율: 1 USD = ₩{Math.round(fxRate).toLocaleString('ko-KR')} · {new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* 본문 */}
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 티커 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                티커 <span className="text-orange-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.symbol}
                                onChange={(e) => handleChange('symbol', e.target.value.toUpperCase())}
                                onBlur={handleSymbolBlur}
                                placeholder="AAPL"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                            {loadingProfile && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">프로파일 조회 중...</p>
                            )}
                        </div>

                        {/* 기업명 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                기업명 <span className="text-orange-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.companyName}
                                onChange={(e) => handleChange('companyName', e.target.value)}
                                placeholder="Apple Inc."
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>

                        {/* 매도일 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                매도일 <span className="text-orange-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.sellDate}
                                onChange={(e) => handleChange('sellDate', e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>

                        {/* 매도가 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                매도가 ($) <span className="text-orange-500">*</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.sellPrice}
                                onChange={(e) => handleChange('sellPrice', e.target.value)}
                                placeholder="150.50"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                            {fxRate && formData.sellPrice && parseFloat(formData.sellPrice) > 0 && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    (₩{(parseFloat(formData.sellPrice) * fxRate).toLocaleString('ko-KR', { maximumFractionDigits: 0 })})
                                </div>
                            )}
                        </div>

                        {/* 수량 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                수량 <span className="text-orange-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={formData.sellQty}
                                onChange={(e) => handleChange('sellQty', e.target.value)}
                                placeholder="10"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>

                        {/* 실현손익 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                실현손익 ($)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.realizedPnl}
                                onChange={(e) => handleChange('realizedPnl', e.target.value)}
                                placeholder="500.00"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                            {fxRate && formData.realizedPnl && parseFloat(formData.realizedPnl) !== 0 && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    (₩{(parseFloat(formData.realizedPnl) * fxRate).toLocaleString('ko-KR', { maximumFractionDigits: 0 })})
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 환율 입력 */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* 매수당시환율 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                매수당시환율 (₩)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.buyExchangeRateAtTrade}
                                onChange={(e) => handleChange('buyExchangeRateAtTrade', e.target.value)}
                                placeholder={fxRate ? fxRate.toFixed(2) : '1400.00'}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>

                        {/* 매도당시환율 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                매도당시환율 (₩)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.sellExchangeRateAtTrade}
                                onChange={(e) => handleChange('sellExchangeRateAtTrade', e.target.value)}
                                placeholder={fxRate ? fxRate.toFixed(2) : '1400.00'}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* 비고 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            비고
                        </label>
                        <textarea
                            value={formData.rmk}
                            onChange={(e) => handleChange('rmk', e.target.value)}
                            placeholder="메모를 입력하세요..."
                            rows={3}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white resize-none"
                        />
                    </div>

                    {/* 기업 정보 카드 */}
                    {companyProfile && (
                        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                            <div className="flex items-start gap-3 mb-3">
                                {companyProfile.image && !companyProfile.defaultImage && (
                                    <img
                                        src={companyProfile.image}
                                        alt={companyProfile.symbol}
                                        className="w-12 h-12 rounded-lg object-contain bg-white"
                                        onError={(e) => e.target.style.display = 'none'}
                                    />
                                )}
                                <div className="flex-1">
                                    <h3 className="font-semibold text-slate-900 dark:text-white">{companyProfile.companyName}</h3>
                                    <p className="text-xs text-slate-600 dark:text-slate-300">{companyProfile.exchange} · {companyProfile.sector}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                {companyProfile.price && (
                                    <div>
                                        <div className="text-slate-600 dark:text-slate-400">현재가</div>
                                        <div className="font-semibold text-slate-900 dark:text-white">${companyProfile.price.toFixed(2)}</div>
                                    </div>
                                )}
                                {companyProfile.beta && (
                                    <div>
                                        <div className="text-slate-600 dark:text-slate-400">베타</div>
                                        <div className="font-semibold text-slate-900 dark:text-white">{companyProfile.beta.toFixed(2)}</div>
                                    </div>
                                )}
                                {companyProfile.marketCap && (
                                    <div>
                                        <div className="text-slate-600 dark:text-slate-400">시가총액</div>
                                        <div className="font-semibold text-slate-900 dark:text-white">
                                            ${(companyProfile.marketCap / 1e9).toFixed(2)}B
                                        </div>
                                    </div>
                                )}
                                {companyProfile.lastDividend > 0 && (
                                    <div>
                                        <div className="text-slate-600 dark:text-slate-400">배당</div>
                                        <div className="font-semibold text-slate-900 dark:text-white">${companyProfile.lastDividend.toFixed(2)}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 계산 요약 */}
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">매도 금액 (매도가 × 수량)</span>
                            <div className="text-right">
                                <span className="text-lg font-bold text-slate-900 dark:text-white">
                                    ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                {fxRate && totalAmount > 0 && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        (₩{(totalAmount * fxRate).toLocaleString('ko-KR', { maximumFractionDigits: 0 })})
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 푸터 */}
                <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? '저장 중...' : mode === 'edit' ? '수정' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}
