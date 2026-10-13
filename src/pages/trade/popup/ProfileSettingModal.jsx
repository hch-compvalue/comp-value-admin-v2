import { useState } from 'react';
import useModalAnimation from '@/hooks/useModalAnimation';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import MultiSelect from '@/component/common/select/MultiSelect';
import DualRangeSlider from '@/component/common/input/DualRangeSlider';

/**
 * 추천 프로파일 설정 모달 (등록·수정·복사·삭제)
 * - 2026-10 AbroadRecommendedStock.jsx에서 분리 (추천 목록 화면 삭제, 종목 발굴 > 프로파일 설정 탭에서 사용)
 */

const DEFAULT_SECTOR_QUOTA_PCT = 30;

const ProfileSettingModal = ({ isOpen, onClose, profiles, onRefresh, openAlert, isLoading, setIsLoading, send, filterOptions, filterOptionsLoading }) => {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen, 250);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState(null);
    const [deleteConfirmConfig, setDeleteConfirmConfig] = useState({ open: false, profileName: '' });

    // 초기 폼 데이터 (등록 시)
    const getInitialFormData = () => ({
        profileName: '',
        profileDesc: '',
        isActive: 'Y',
        sortOrder: 1,
        marketCapMin: '',
        marketCapMax: '',
        betaMin: '',
        betaMax: '',
        volumeMin: '',
        volumeMax: '',
        priceMin: '',
        priceMax: '',
        isEtf: 'N',
        isFund: 'N',
        isActivelyTrading: 'Y',
        excludeNonCommonStock: 'Y',
        sectorQuotaPct: DEFAULT_SECTOR_QUOTA_PCT,
        exchange: ['NASDAQ', 'NYSE'],
        sector: [],
        industry: [],
        country: [],
        screenerLimit: 10000,
        peRatioMin: '',
        peRatioMax: '',
        pbRatioMin: '',
        pbRatioMax: '',
        roeMin: '',
        roeMax: '',
        debtEquityMin: '',
        debtEquityMax: '',
        revenueGrowthMin: '',
        revenueGrowthMax: '',
        netIncomeGrowthMin: '',
        netIncomeGrowthMax: '',
        marketCapEnabled: false,
        priceEnabled: false,
        betaEnabled: false,
        volumeEnabled: false,
        peRatioEnabled: false,
        pbRatioEnabled: false,
        roeEnabled: false,
        debtEquityEnabled: false,
        revenueGrowthEnabled: false,
        netIncomeGrowthEnabled: false,
    });

    // 프로파일 선택 시
    const handleSelectProfile = (profile) => {
        setSelectedProfile(profile);
        // 콤마로 구분된 문자열을 배열로 변환
        const splitToArray = (str) => str ? str.split(',').map(s => s.trim()).filter(s => s) : [];

        const hasValue = (v) => v !== null && v !== undefined && v !== '';
        const formDataWithArrays = {
            ...profile,
            excludeNonCommonStock: profile.excludeNonCommonStock || 'Y',
            exchange: splitToArray(profile.exchange),
            sector: splitToArray(profile.sector),
            industry: splitToArray(profile.industry),
            country: splitToArray(profile.country),
            marketCapEnabled: hasValue(profile.marketCapMin) || hasValue(profile.marketCapMax),
            priceEnabled: hasValue(profile.priceMin) || hasValue(profile.priceMax),
            betaEnabled: hasValue(profile.betaMin) || hasValue(profile.betaMax),
            volumeEnabled: hasValue(profile.volumeMin) || hasValue(profile.volumeMax),
            peRatioEnabled: hasValue(profile.peRatioMin) || hasValue(profile.peRatioMax),
            pbRatioEnabled: hasValue(profile.pbRatioMin) || hasValue(profile.pbRatioMax),
            roeEnabled: hasValue(profile.roeMin) || hasValue(profile.roeMax),
            debtEquityEnabled: hasValue(profile.debtEquityMin) || hasValue(profile.debtEquityMax),
            revenueGrowthEnabled: hasValue(profile.revenueGrowthMin) || hasValue(profile.revenueGrowthMax),
            netIncomeGrowthEnabled: hasValue(profile.netIncomeGrowthMin) || hasValue(profile.netIncomeGrowthMax),
        };
        setFormData(formDataWithArrays);
        setIsCreating(false);
    };

    // 등록 버튼 클릭
    const handleCreateNew = () => {
        setIsCreating(true);
        setSelectedProfile(null);
        setFormData(getInitialFormData());
    };

    // 프로파일명 중복 확인 및 번호 증가
    const getUniqueProfileName = (baseName) => {
        const existingNames = profiles.map(p => p.profileName);

        // 기본 복사 이름 생성
        let newName = `${baseName}_복사1`;
        let counter = 1;

        // 중복이 없을 때까지 번호 증가
        while (existingNames.includes(newName)) {
            counter++;
            newName = `${baseName}_복사${counter}`;
        }

        return newName;
    };

    // 프로파일 복사 (즉시 저장)
    const handleCopyProfile = async (profile, e) => {
        // 이벤트 버블링 방지 (프로파일 선택 이벤트와 분리)
        e?.stopPropagation();

        if (!profile) return;

        setIsLoading(true);
        try {
            // 고유한 프로파일명 생성
            const newProfileName = getUniqueProfileName(profile.profileName);

            // 복사할 데이터 생성 (id 제외)
            const copiedData = {
                ...profile,
                id: undefined, // 새로 생성되어야 하므로 id 제거
                profileName: newProfileName,
            };

            // 서버에 등록 요청
            const { data, error } = await send('/dart/recommend/profile/regi', copiedData, 'POST');

            if (!error) {
                openAlert(`프로파일이 복사되었습니다.\n새 프로파일명: ${newProfileName}`);
                onRefresh(); // 목록 갱신
            } else {
                openAlert(data?.message || '복사 중 오류가 발생했습니다.');
            }
        } catch (e) {
            openAlert('요청 처리 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // 폼 필드 변경
    const handleFormChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    // 저장 (등록 또는 수정)
    const handleSave = async () => {
        if (!formData) return;

        // 필수 필드 검증
        if (!formData.profileName?.trim()) {
            openAlert('프로파일명은 필수 입력 항목입니다.');
            return;
        }
        if (formData.screenerLimit === '' || formData.screenerLimit === null || formData.screenerLimit === undefined) {
            openAlert('스크리너 조회 제한 건수를 입력해주세요.');
            return;
        }

        setIsLoading(true);
        try {
            // 배열을 콤마로 구분된 문자열로 변환
            const arrayToString = (arr) => Array.isArray(arr) ? arr.join(',') : arr;

            const dataToSend = {
                ...formData,
                exchange: arrayToString(formData.exchange),
                sector: arrayToString(formData.sector),
                industry: arrayToString(formData.industry),
                country: arrayToString(formData.country),
                // 비활성 지표는 null 전달 (백엔드에서 필터링 생략)
                marketCapMin: formData.marketCapEnabled ? formData.marketCapMin : null,
                marketCapMax: formData.marketCapEnabled ? formData.marketCapMax : null,
                priceMin: formData.priceEnabled ? formData.priceMin : null,
                priceMax: formData.priceEnabled ? formData.priceMax : null,
                betaMin: formData.betaEnabled ? formData.betaMin : null,
                betaMax: formData.betaEnabled ? formData.betaMax : null,
                volumeMin: formData.volumeEnabled ? formData.volumeMin : null,
                volumeMax: formData.volumeEnabled ? formData.volumeMax : null,
                peRatioMin: formData.peRatioEnabled ? formData.peRatioMin : null,
                peRatioMax: formData.peRatioEnabled ? formData.peRatioMax : null,
                pbRatioMin: formData.pbRatioEnabled ? formData.pbRatioMin : null,
                pbRatioMax: formData.pbRatioEnabled ? formData.pbRatioMax : null,
                roeMin: formData.roeEnabled ? formData.roeMin : null,
                roeMax: formData.roeEnabled ? formData.roeMax : null,
                debtEquityMin: formData.debtEquityEnabled ? formData.debtEquityMin : null,
                debtEquityMax: formData.debtEquityEnabled ? formData.debtEquityMax : null,
                revenueGrowthMin: formData.revenueGrowthEnabled ? formData.revenueGrowthMin : null,
                revenueGrowthMax: formData.revenueGrowthEnabled ? formData.revenueGrowthMax : null,
                netIncomeGrowthMin: formData.netIncomeGrowthEnabled ? formData.netIncomeGrowthMin : null,
                netIncomeGrowthMax: formData.netIncomeGrowthEnabled ? formData.netIncomeGrowthMax : null,
                // 섹터 쿼터: 빈 값이면 null (미적용)
                sectorQuotaPct: formData.sectorQuotaPct === '' ? null : formData.sectorQuotaPct,
            };
            // enabled 상태 필드는 백엔드에 보내지 않음
            delete dataToSend.marketCapEnabled;
            delete dataToSend.priceEnabled;
            delete dataToSend.betaEnabled;
            delete dataToSend.volumeEnabled;
            delete dataToSend.peRatioEnabled;
            delete dataToSend.pbRatioEnabled;
            delete dataToSend.roeEnabled;
            delete dataToSend.debtEquityEnabled;
            delete dataToSend.revenueGrowthEnabled;
            delete dataToSend.netIncomeGrowthEnabled;

            const endpoint = isCreating ? '/dart/recommend/profile/regi' : '/dart/recommend/profile/modi';
            const { data, error } = await send(endpoint, dataToSend, 'POST');

            if (!error) {
                openAlert(isCreating ? '프로파일이 등록되었습니다.' : '프로파일이 수정되었습니다.');
                onRefresh();
                setIsCreating(false);
                setSelectedProfile(null);
                setFormData(null);
            } else {
                openAlert(data?.message || '처리 중 오류가 발생했습니다.');
            }
        } catch (e) {
            openAlert('요청 처리 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // 삭제 확인 모달 열기
    const handleDeleteClick = () => {
        if (!selectedProfile?.id) return;
        setDeleteConfirmConfig({
            open: true,
            profileName: selectedProfile.profileName
        });
    };

    // 삭제 실행
    const handleDeleteConfirm = async () => {
        if (!selectedProfile?.id) return;

        setDeleteConfirmConfig({ open: false, profileName: '' });
        setIsLoading(true);
        try {
            const { data, error } = await send('/dart/recommend/profile/del', { id: selectedProfile.id }, 'POST');

            if (!error) {
                openAlert('프로파일이 삭제되었습니다.');
                onRefresh();
                setSelectedProfile(null);
                setFormData(null);
            } else {
                openAlert(data?.message || '삭제 중 오류가 발생했습니다.');
            }
        } catch (e) {
            openAlert('요청 처리 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!shouldRender) return null;

    return (
        <>
            {/* 배경 오버레이 */}
            <div className={`fixed inset-0 z-[70] bg-black/50 dark:bg-black/70 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }} onClick={onClose} />

            {/* 모달 */}
            <div
                className={`fixed z-[80] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[98vw] md:w-[min(95vw,1200px)] max-h-[95vh] md:max-h-[90vh] rounded-lg md:rounded-xl bg-white shadow-2xl dark:bg-slate-800 flex flex-col animate__animated ${isAnimatingOut ? 'animate__zoomOut' : 'animate__zoomIn'}`} style={{ animationDuration: '0.25s' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white">프로파일 설정</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 본문 */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* 왼쪽: 프로파일 목록 */}
                    <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 overflow-y-auto max-h-[40vh] md:max-h-none bg-slate-100/50 dark:bg-black/20">
                        <div className="p-3 md:p-4">
                            <button
                                onClick={handleCreateNew}
                                disabled={isLoading}
                                className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                            >
                                + 새 프로파일 등록
                            </button>
                            <div className="space-y-2">
                                {profiles.map((profile) => (
                                    <div
                                        key={profile.id}
                                        className={`relative rounded-lg transition-colors ${selectedProfile?.id === profile.id
                                                ? 'bg-blue-50 border-2 border-blue-500 dark:bg-blue-900/30 dark:border-blue-400'
                                                : 'bg-slate-50 border border-slate-200 hover:bg-slate-100 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600'
                                            } ${profile.isActive !== 'Y' ? 'opacity-50' : ''}`}
                                    >
                                        <button
                                            onClick={() => handleSelectProfile(profile)}
                                            className="w-full px-4 py-3 pr-12 text-left"
                                        >
                                            <div className={`font-medium ${profile.isActive !== 'Y' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>{profile.profileName}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                {profile.isActive === 'Y' ? '활성' : <span className="text-red-400">비활성</span>} | 정렬순서: {profile.sortOrder}
                                            </div>
                                        </button>
                                        <button
                                            onClick={(e) => handleCopyProfile(profile, e)}
                                            disabled={isLoading}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="프로파일 복사"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 오른쪽: 프로파일 상세/수정 폼 */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6">
                        {formData ? (
                            <ProfileForm
                                formData={formData}
                                onChange={handleFormChange}
                                isCreating={isCreating}
                                onSave={handleSave}
                                onDelete={handleDeleteClick}
                                onCancel={() => {
                                    setFormData(null);
                                    setSelectedProfile(null);
                                    setIsCreating(false);
                                }}
                                isLoading={isLoading}
                                filterOptions={filterOptions}
                                filterOptionsLoading={filterOptionsLoading}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
                                프로파일을 선택하거나 새로 등록하세요
                            </div>
                        )}
                    </div>
                </div>

                {/* 삭제 확인 모달 */}
                <AlertModal
                    open={deleteConfirmConfig.open}
                    title="삭제 확인"
                    message={`'${deleteConfirmConfig.profileName}' 프로파일을 삭제하시겠습니까?`}
                    onClose={() => setDeleteConfirmConfig({ open: false, profileName: '' })}
                    onConfirm={handleDeleteConfirm}
                />
            </div>
        </>
    );
};
/**
 * 프로파일 입력 폼 컴포넌트
 */
// 숫자를 한글 단위로 변환 (슬라이더 표시용)
const formatKoreanNumber = (num) => {
    if (num === null || num === undefined || num === '' || isNaN(num)) return '0';
    const number = Number(num);
    if (number === 0) return '0';

    const units = [
        { unit: '조', value: 1000000000000 },
        { unit: '억', value: 100000000 },
        { unit: '만', value: 10000 },
    ];

    const result = [];
    let remaining = Math.abs(number);

    for (const { unit, value } of units) {
        const count = Math.floor(remaining / value);
        if (count > 0) {
            result.push(`${count.toLocaleString()}${unit}`);
            remaining = remaining % value;
        }
    }

    if (remaining > 0 || result.length === 0) {
        result.push(remaining.toLocaleString());
    }

    return (number < 0 ? '-' : '') + result.join(' ');
};

const ProfileForm = ({ formData, onChange, isCreating, onSave, onDelete, onCancel, isLoading, filterOptions, filterOptionsLoading }) => {
    return (
        <div className="space-y-4 md:space-y-6">
            {/* 프로파일 기본 정보 */}
            <section>
                <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                    프로파일 기본 정보
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <FormInput
                        label="프로파일명 (profileName)"
                        value={formData.profileName}
                        onChange={(v) => onChange('profileName', v)}
                        placeholder="예: 가치투자형"
                        required
                    />
                    <FormInput
                        label="프로파일 설명 (profileDesc)"
                        value={formData.profileDesc}
                        onChange={(v) => onChange('profileDesc', v)}
                        placeholder="예: 저평가 가치주 중심"
                    />
                    <FormToggleSwitch
                        label="활성여부 (isActive)"
                        value={formData.isActive}
                        onChange={(v) => onChange('isActive', v)}
                    />
                    <FormNumberStepper
                        label="정렬순서 (sortOrder)"
                        value={formData.sortOrder}
                        onChange={(v) => onChange('sortOrder', v)}
                        min={1}
                        max={99}
                        required
                    />
                </div>
            </section>

            {/* Stock Screener 조건 */}
            <section>
                <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                    Stock Screener 조건
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <DualRangeSlider
                        label="시가총액"
                        description="Market Cap (USD)"
                        min={0}
                        max={5000000000000}
                        step={1000000000}
                        valueMin={formData.marketCapMin}
                        valueMax={formData.marketCapMax}
                        onChangeMin={(v) => onChange('marketCapMin', v)}
                        onChangeMax={(v) => onChange('marketCapMax', v)}
                        enabled={formData.marketCapEnabled}
                        onToggle={() => onChange('marketCapEnabled', !formData.marketCapEnabled)}
                        formatDisplay={formatKoreanNumber}
                    />
                    <DualRangeSlider
                        label="주가"
                        description="Price (USD)"
                        min={0}
                        max={1000000}
                        step={100}
                        valueMin={formData.priceMin}
                        valueMax={formData.priceMax}
                        onChangeMin={(v) => onChange('priceMin', v)}
                        onChangeMax={(v) => onChange('priceMax', v)}
                        enabled={formData.priceEnabled}
                        onToggle={() => onChange('priceEnabled', !formData.priceEnabled)}
                        formatDisplay={formatKoreanNumber}
                    />
                    <DualRangeSlider
                        label="베타"
                        description="Beta"
                        min={0}
                        max={5}
                        step={0.01}
                        valueMin={formData.betaMin}
                        valueMax={formData.betaMax}
                        onChangeMin={(v) => onChange('betaMin', v)}
                        onChangeMax={(v) => onChange('betaMax', v)}
                        enabled={formData.betaEnabled}
                        onToggle={() => onChange('betaEnabled', !formData.betaEnabled)}
                    />
                    <DualRangeSlider
                        label="거래량"
                        description="Volume"
                        min={0}
                        max={100000000}
                        step={10000}
                        valueMin={formData.volumeMin}
                        valueMax={formData.volumeMax}
                        onChangeMin={(v) => onChange('volumeMin', v)}
                        onChangeMax={(v) => onChange('volumeMax', v)}
                        enabled={formData.volumeEnabled}
                        onToggle={() => onChange('volumeEnabled', !formData.volumeEnabled)}
                        formatDisplay={formatKoreanNumber}
                    />
                    <FormToggleSwitch
                        label="ETF 포함여부 (isEtf)"
                        value={formData.isEtf}
                        onChange={(v) => onChange('isEtf', v)}
                        labelOn="포함"
                        labelOff="제외"
                    />
                    <FormToggleSwitch
                        label="펀드 포함여부 (isFund)"
                        value={formData.isFund}
                        onChange={(v) => onChange('isFund', v)}
                        labelOn="포함"
                        labelOff="제외"
                    />
                    <FormToggleSwitch
                        label="활성거래 종목만 (isActivelyTrading)"
                        value={formData.isActivelyTrading}
                        onChange={(v) => onChange('isActivelyTrading', v)}
                        labelOn="활성거래만"
                        labelOff="전체"
                    />
                    <FormToggleSwitch
                        label="비일반주식 제외 (excludeNonCommonStock)"
                        value={formData.excludeNonCommonStock}
                        onChange={(v) => onChange('excludeNonCommonStock', v)}
                        labelOn="제외 (워런트/우선주/CVR/채권)"
                        labelOff="포함"
                    />
                    <FormMultiSelect
                        label="국가 (country)"
                        value={formData.country || []}
                        onChange={(v) => onChange('country', v)}
                        options={filterOptions?.countries || []}
                        loading={filterOptionsLoading?.countries}
                        placeholder="국가 선택"
                    />
                    <FormMultiSelect
                        label="거래소 (exchange)"
                        value={formData.exchange || []}
                        onChange={(v) => onChange('exchange', v)}
                        options={filterOptions?.exchanges || []}
                        loading={filterOptionsLoading?.exchanges}
                        placeholder="거래소 선택"
                        required
                    />
                    <FormMultiSelect
                        label="섹터 (sector)"
                        value={formData.sector || []}
                        onChange={(v) => onChange('sector', v)}
                        options={filterOptions?.sectors || []}
                        loading={filterOptionsLoading?.sectors}
                        placeholder="섹터 선택"
                    />
                    <FormMultiSelect
                        label="산업군 (industry)"
                        value={formData.industry || []}
                        onChange={(v) => onChange('industry', v)}
                        options={filterOptions?.industries || []}
                        loading={filterOptionsLoading?.industries}
                        placeholder="산업군 선택"
                    />
                    <FormInput
                        label="스크리너 조회 제한 건수 (screenerLimit)"
                        type="number"
                        value={formData.screenerLimit}
                        onChange={(v) => onChange('screenerLimit', v)}
                        placeholder="10000"
                        required
                    />
                    <FormInput
                        label="섹터 쿼터 % (sectorQuotaPct)"
                        type="number"
                        value={formData.sectorQuotaPct}
                        onChange={(v) => onChange('sectorQuotaPct', v)}
                        placeholder="30 (빈 값 = 미적용, 한 섹터가 결과에서 차지하는 비중 상한)"
                    />
                </div>
            </section>

            {/* 저평가 필터링 조건 */}
            <section>
                <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                    저평가 필터링 조건
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <DualRangeSlider
                        label="PER"
                        description="주가수익비율 (15 = 이익의 15배)"
                        min={0}
                        max={100}
                        step={0.5}
                        valueMin={formData.peRatioMin}
                        valueMax={formData.peRatioMax}
                        onChangeMin={(v) => onChange('peRatioMin', v)}
                        onChangeMax={(v) => onChange('peRatioMax', v)}
                        enabled={formData.peRatioEnabled}
                        onToggle={() => onChange('peRatioEnabled', !formData.peRatioEnabled)}
                    />
                    <DualRangeSlider
                        label="PBR"
                        description="주가순자산비율 (2.5 = 순자산의 2.5배)"
                        min={0}
                        max={10}
                        step={0.1}
                        valueMin={formData.pbRatioMin}
                        valueMax={formData.pbRatioMax}
                        onChangeMin={(v) => onChange('pbRatioMin', v)}
                        onChangeMax={(v) => onChange('pbRatioMax', v)}
                        enabled={formData.pbRatioEnabled}
                        onToggle={() => onChange('pbRatioEnabled', !formData.pbRatioEnabled)}
                    />
                    <DualRangeSlider
                        label="ROE"
                        description="자기자본이익률 (0.1 = 10%)"
                        min={0}
                        max={1.0}
                        step={0.01}
                        valueMin={formData.roeMin}
                        valueMax={formData.roeMax}
                        onChangeMin={(v) => onChange('roeMin', v)}
                        onChangeMax={(v) => onChange('roeMax', v)}
                        enabled={formData.roeEnabled}
                        onToggle={() => onChange('roeEnabled', !formData.roeEnabled)}
                    />
                    <DualRangeSlider
                        label="부채비율"
                        description="D/E Ratio (1.5 = 자기자본 대비 부채 150%)"
                        min={0}
                        max={5.0}
                        step={0.1}
                        valueMin={formData.debtEquityMin}
                        valueMax={formData.debtEquityMax}
                        onChangeMin={(v) => onChange('debtEquityMin', v)}
                        onChangeMax={(v) => onChange('debtEquityMax', v)}
                        enabled={formData.debtEquityEnabled}
                        onToggle={() => onChange('debtEquityEnabled', !formData.debtEquityEnabled)}
                    />
                </div>
            </section>

            {/* 성장률 필터링 조건 */}
            <section>
                <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                    성장률 필터링 조건
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <DualRangeSlider
                        label="매출 성장률 (3Y 평균)"
                        description="연평균 매출 증감률 (0.10 = 10%)"
                        min={-1.0}
                        max={5.0}
                        step={0.01}
                        valueMin={formData.revenueGrowthMin}
                        valueMax={formData.revenueGrowthMax}
                        onChangeMin={(v) => onChange('revenueGrowthMin', v)}
                        onChangeMax={(v) => onChange('revenueGrowthMax', v)}
                        enabled={formData.revenueGrowthEnabled}
                        onToggle={() => onChange('revenueGrowthEnabled', !formData.revenueGrowthEnabled)}
                    />
                    <DualRangeSlider
                        label="순이익 성장률 (3Y 평균)"
                        description="연평균 순이익 증감률 (0.20 = 20%)"
                        min={-1.0}
                        max={5.0}
                        step={0.01}
                        valueMin={formData.netIncomeGrowthMin}
                        valueMax={formData.netIncomeGrowthMax}
                        onChangeMin={(v) => onChange('netIncomeGrowthMin', v)}
                        onChangeMax={(v) => onChange('netIncomeGrowthMax', v)}
                        enabled={formData.netIncomeGrowthEnabled}
                        onToggle={() => onChange('netIncomeGrowthEnabled', !formData.netIncomeGrowthEnabled)}
                    />
                </div>
            </section>

            {/* 버튼 */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
                <div>
                    {!isCreating && (
                        <button
                            onClick={onDelete}
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            삭제
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                        취소
                    </button>
                    <button
                        onClick={onSave}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isCreating ? '등록' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * 폼 입력 컴포넌트
 */
const FormInput = ({ label, value, onChange, type = 'text', placeholder, required, step }) => {
    // 숫자를 한글 단위로 변환
    const formatNumberToKorean = (num) => {
        if (!num || isNaN(num)) return '';

        const number = Number(num);
        const units = [
            { unit: '조', value: 1000000000000 },
            { unit: '억', value: 100000000 },
            { unit: '만', value: 10000 },
        ];

        const result = [];
        let remaining = Math.abs(number);

        for (const { unit, value } of units) {
            const count = Math.floor(remaining / value);
            if (count > 0) {
                result.push(`${count.toLocaleString()}${unit}`);
                remaining = remaining % value;
            }
        }

        if (remaining > 0 || result.length === 0) {
            result.push(remaining.toLocaleString());
        }

        return result.join(' ') + (number < 0 ? ' (음수)' : '');
    };

    // type이 number이고 큰 금액 필드인지 확인
    const isLargeNumberField = type === 'number' && (
        label.includes('시가총액') ||
        label.includes('거래량') ||
        label.includes('screenerLimit')
    );

    const koreanValue = isLargeNumberField ? formatNumberToKorean(value) : '';

    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                type={type === 'number' ? 'text' : type}
                value={value === null || value === undefined ? '' : String(value)}
                onChange={(e) => {
                    const val = e.target.value;
                    if (type === 'number') {
                        // 빈 문자열이거나 숫자(소수점, 음수 포함)만 허용
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                            onChange(val === '' ? '' : val);
                        }
                    } else {
                        onChange(val);
                    }
                }}
                onBlur={(e) => {
                    // blur 시 숫자로 변환
                    if (type === 'number' && e.target.value !== '') {
                        const num = parseFloat(e.target.value);
                        onChange(isNaN(num) ? '' : num);
                    }
                }}
                placeholder={placeholder}
                step={step}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            />
            {koreanValue && (
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    {koreanValue}
                </p>
            )}
        </div>
    );
};

/**
 * 폼 셀렉트 컴포넌트
 */
const FormSelect = ({ label, value, onChange, options, required }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    </div>
);

/**
 * 폼 멀티셀렉트 컴포넌트
 */
const FormMultiSelect = ({ label, value, onChange, options, loading, placeholder, required }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <MultiSelect
            value={value || []}
            onChange={onChange}
            options={options || []}
            loading={loading}
            placeholder={placeholder}
            searchable={true}
            showChips={true}
        />
    </div>
);

/**
 * 폼 토글 스위치 컴포넌트 (Y/N 값)
 */
const FormToggleSwitch = ({ label, value, onChange, labelOn = '활성', labelOff = '비활성' }) => {
    const isOn = value === 'Y';
    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {label}
            </label>
            <button
                type="button"
                role="switch"
                aria-checked={isOn}
                onClick={() => onChange(isOn ? 'N' : 'Y')}
                className={`relative inline-flex h-8 w-16 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${
                    isOn ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-500'
                }`}
            >
                <span
                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isOn ? 'translate-x-8' : 'translate-x-0'
                    }`}
                />
            </button>
            <span className={`ml-2 text-sm font-medium ${isOn ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {isOn ? labelOn : labelOff}
            </span>
        </div>
    );
};

/**
 * 폼 숫자 스테퍼 컴포넌트
 */
const FormNumberStepper = ({ label, value, onChange, min = 1, max = 99, required }) => {
    const numValue = Number(value) || min;
    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(min, numValue - 1))}
                    disabled={numValue <= min}
                    className="px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-l-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    −
                </button>
                <span className="px-4 py-2 text-sm font-medium text-slate-900 dark:text-white min-w-[3rem] text-center border-x border-slate-300 dark:border-slate-600">
                    {numValue}
                </span>
                <button
                    type="button"
                    onClick={() => onChange(Math.min(max, numValue + 1))}
                    disabled={numValue >= max}
                    className="px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-r-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    +
                </button>
            </div>
        </div>
    );
};

export default ProfileSettingModal;
