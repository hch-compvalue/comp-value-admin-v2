import { TRADE_DASHBOARD_PATH } from '@/config/menuPaths';

/**
 * 스케줄 관리 화면의 "다른 곳에서 관리되는 스케줄" (조회 전용) 설정
 * - 주기 변경은 각 관리 위치에서 한다 (이 화면에서 바꾸면 두 곳에서 관리하게 되므로 조회만)
 */

/** DB 백업 — k8s CronJob. 시각을 바꾸면 gos ncloud/backend/db/backup-cronjob.yml의 schedule과 함께 수정 */
export const DB_BACKUP_SCHEDULE = {
    label: 'DB 백업',
    description: 'PostgreSQL 전체 덤프 → GPG 암호화 → GitLab 저장소에 보관 (최근 3개 유지)',
    scheduleText: '매일 15:00',
    managedAt: 'gos 저장소 ncloud/backend/db/backup-cronjob.yml (수정 후 직접 push)',
    note: 'PC가 그 시각에 꺼져 있었으면 다음에 켜질 때 1회 실행됩니다.',
};
export const DB_BACKUP_HISTORY_URL = '/dart/schd/external/db-backup/history';
export const DB_BACKUP_HISTORY_LIMIT = 5;

/** 자동매매 전략 — trader. 실행 시각·모드는 자동매매 화면에서 변경 */
export const STRATEGY_LIST_URL = '/dart/api/cointrade/strategy/list';
export const STRATEGY_RUNS_URL = '/dart/api/cointrade/strategy/runs';
export const STRATEGY_MANAGE_PATH = TRADE_DASHBOARD_PATH;
/** 전략 market → 자동매매 화면 탭 key */
export const STRATEGY_MARKET_TAB = { CRYPTO: 'coin', KRX: 'stock' };
