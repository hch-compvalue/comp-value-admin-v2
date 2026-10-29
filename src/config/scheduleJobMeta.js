/**
 * 스케줄 작업별 화면 표시 정보 (관리 > 스케줄 관리)
 * - 백엔드 ScheduleJobType에 작업을 추가하면 여기에도 jobKey로 항목을 추가
 * - market: 이름 앞 시장 꼬리표 / countLabel: 지금 실행 모달의 처리 건수 설명 / fullRunWarning: 전체 실행 시 주의 문구
 */
export const SCHEDULE_MARKET = {
    US: { label: '미국주식', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    KR: { label: '국내주식', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
};

export const SCHEDULE_JOB_META = {
    RECOMMENDED_STOCKS: {
        market: SCHEDULE_MARKET.US,
        countLabel: '처리 건수 (프로파일별)',
        fullRunWarning: '전체 실행은 약 4시간 걸리고 FMP 호출을 많이 씁니다. 실행 중에는 백엔드 배포를 하지 마세요.',
    },
    KR_DAILY_PRICE: {
        market: SCHEDULE_MARKET.KR,
        countLabel: '처리 건수 (일봉 받을 종목 수)',
        fullRunWarning: '첫 실행은 약 90분, 이후는 약 7분 걸립니다(KIS 사용). 실행 중에는 백엔드 배포를 하지 마세요.',
    },
    KR_FINANCIAL: {
        market: SCHEDULE_MARKET.KR,
        countLabel: '처리 건수 (받을 보고서 수)',
        fullRunWarning: '전체 실행은 실행당 최대 15,000건, 첫 적재는 약 4일에 걸쳐 나눠 받습니다(OpenDart 사용). 실행 중에는 백엔드 배포를 하지 마세요.',
    },
};

/** 등록 안 된 작업용 기본값 */
export const DEFAULT_JOB_META = {
    market: null,
    countLabel: '처리 건수',
    fullRunWarning: '실행 중에는 백엔드 배포를 하지 마세요.',
};

export const jobMetaOf = (jobKey) => SCHEDULE_JOB_META[jobKey] ?? DEFAULT_JOB_META;
