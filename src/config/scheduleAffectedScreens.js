import { STOCK_DISCOVER_PATH, SUB_TAB } from '@/config/menuPaths';

/**
 * 스케줄 작업 → 영향받는 화면 매핑 (관리 > 스케줄 관리에 표시)
 * - 백엔드 ScheduleJobType에 작업을 추가하면 여기에도 jobKey로 항목을 추가
 * - kind: 'output' = 작업 결과를 보여주는 화면, 'input' = 작업이 실행 기준으로 읽는 설정 화면
 */
export const SCHEDULE_AFFECTED_SCREENS = {
    RECOMMENDED_STOCKS: [
        { kind: 'output', label: '종목 발굴 > 오늘의 매수후보', path: STOCK_DISCOVER_PATH, subTab: SUB_TAB.DAILY_PICKS, note: '실행일의 평가 결과로 목록 갱신' },
        { kind: 'output', label: '종목 발굴 > 성과 추적', path: STOCK_DISCOVER_PATH, subTab: SUB_TAB.PERFORMANCE, note: '실행할 때마다 평가 기록이 쌓여 성과 계산에 사용' },
        { kind: 'input', label: '종목 발굴 > 프로파일 설정', path: STOCK_DISCOVER_PATH, subTab: SUB_TAB.PROFILE_SETTINGS, note: '활성 프로파일 기준으로 종목을 스크리닝' },
    ],
};
