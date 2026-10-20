import { useState, useMemo, Fragment } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Lock, ChevronRight, ChevronDown } from 'lucide-react';
import Toast from '@/component/common/display/Toast';
import Button from '@/component/common/button/Button';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import { Card, Row, WeightBar, ModeSelector, ErrorBanner, RefreshButton } from './StrategyUi';
import useStrategyData from './useStrategyData';
import {
    RUN_LIMIT, MIN_CAPITAL_KRW, EMERGENCY_CONFIRM_WORD, COLOR_STRATEGY, STRATEGY_STOCK, MODES,
    modeLabel, hourRange, fmtKrw, fmtPct, fmtSignedPct, returnAccent, fmtShares, fmtDateTime, INPUT_CLASS,
} from './strategyCommon';
import { SLATE, withAlpha } from '@/config/themeColors';

/**
 * 주식 자동매매 — ETF 3종 분산 (200일선 추세 + 목표변동성, 평일 1회)
 * 운영 설정(모드·투자금·실행 시각·종목 일시 중지)만 화면에서 변경, 전략 파라미터·종목 구성은 잠금(표시 전용).
 * 색상: 적록색약 배려 — 파랑(전략/정상) · 노랑/주황(비교/경고)
 */

const DEFAULT_RUN_HOUR_RANGE = [10, 14];        // 서버가 runHourRange를 안 줄 때 대비 (KRX 장중)
const KRX_EMERGENCY_WINDOW = '09:00~15:20';

const STOCK_MODES = MODES.map((m) => (m.key === 'LIVE' ? { ...m, desc: '한국투자증권 실제 주문' } : m));

const TRIGGER_LABEL = { AUTO: '자동', MANUAL: '수동', EMERGENCY: '긴급' };
const STATUS_LABEL = { SUCCESS: '성공', FAILED: '실패', SKIPPED: '휴장일' };
const ACTION_LABEL = { BUY: '매수', SELL: '매도', HOLD: '유지', MIXED: '매수+매도' };

const STATUS_BADGE = {
    SUCCESS: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
    SKIPPED: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
    FAILED: 'bg-orange-100 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400',
};

const RUN_HEADERS = ['', '실행일', '모드', '구분', '상태', '일봉', '목표', '이전→이후', '주문', '금액', '평가금액', '메시지'];
const DETAIL_HEADERS = ['종목', '종가', '평균선', '변동성', '목표', '이전→이후', '주문', '수량', '금액', '체결가', '수수료', '비고'];

const TH_CLASS = 'py-2 px-2 font-medium';
const HEAD_ROW_CLASS = 'text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700';

const fmtPrice = (v) => (v ? fmtKrw(v) : '-');

export default function StockStrategyPanel({ header }) {
    const { status, runs, toast, busy, refreshing, capitalInput, setCapitalInput, showToast, refresh, call, updateSettings } = useStrategyData(STRATEGY_STOCK);
    const [confirm, setConfirm] = useState({ open: false, message: '', onConfirm: null });
    const [notice, setNotice] = useState({ open: false, message: '' });
    const [emergencyOpen, setEmergencyOpen] = useState(false);
    const [emergencyText, setEmergencyText] = useState('');
    const [expanded, setExpanded] = useState(() => new Set());

    const spec = status?.strategy;
    const assets = useMemo(() => spec?.assets || [], [spec]);
    const paused = useMemo(() => status?.pausedSymbols || [], [status?.pausedSymbols]);
    const modeLedger = status?.ledgers?.[status?.mode];
    const liveLedger = status?.ledgers?.LIVE;
    const liveHeld = assets.filter((a) => (liveLedger?.holdings?.[a.symbol]?.units || 0) > 0);
    const [minHour, maxHour] = status?.runHourRange || DEFAULT_RUN_HOUR_RANGE;
    const runHours = hourRange(minHour, maxHour);

    const signalBySymbol = useMemo(
        () => Object.fromEntries((status?.signals || []).map((s) => [s.symbol, s])),
        [status?.signals],
    );

    const changeMode = (mode) => {
        if (mode === status?.mode) return;
        const apply = () => updateSettings({ mode }, `모드 변경: ${modeLabel(mode)}`);
        if (mode === 'LIVE') {
            setConfirm({
                open: true,
                message: `실전 모드로 전환합니다.\n한국투자증권 계좌에 실제 주문이 나갑니다 (투자금 ${fmtKrw(status?.capitalKrw)}).\n계속할까요?`,
                onConfirm: apply,
            });
            return;
        }
        apply();
    };

    const saveCapital = () => {
        const value = Number(capitalInput.replace(/,/g, ''));
        if (!Number.isFinite(value) || value < MIN_CAPITAL_KRW) {
            showToast(`투자금은 ${MIN_CAPITAL_KRW.toLocaleString('ko-KR')}원 이상 숫자로 입력하세요`);
            return;
        }
        setConfirm({
            open: true,
            message: `투자금을 ${fmtKrw(value)}으로 변경합니다.\n장부 현금이 차액만큼 증감합니다.`,
            onConfirm: () => updateSettings({ capitalKrw: value }, '투자금 변경 완료'),
        });
    };

    const togglePause = (asset) => {
        const isPaused = paused.includes(asset.symbol);
        const next = isPaused ? paused.filter((s) => s !== asset.symbol) : [...paused, asset.symbol];
        setConfirm({
            open: true,
            message: isPaused
                ? `${asset.name}(${asset.symbol}) 일시 중지를 해제합니다.\n다음 실행부터 전략 규칙대로 다시 매매합니다.`
                : `${asset.name}(${asset.symbol})를 일시 중지합니다.\n해제할 때까지 이 종목은 신규 주문을 내지 않고, 보유 수량은 그대로 둡니다.`,
            onConfirm: () => updateSettings({ pausedSymbols: next },
                `${asset.name} ${isPaused ? '일시 중지 해제' : '일시 중지'} 완료`),
        });
    };

    const runNow = () => {
        setConfirm({
            open: true,
            message: `현재 모드(${modeLabel(status?.mode)})로 지금 1회 실행합니다.\n목표 비중과 차이가 있을 때만 주문합니다. 휴장일이면 건너뜁니다.`,
            onConfirm: async () => {
                const { data, error } = await call('/run', {}, 'POST');
                if (error) {
                    showToast(`실행 실패: ${error}`);
                } else {
                    const r = data.response;
                    const label = STATUS_LABEL[r.status] || r.status;
                    showToast(r.status === 'SUCCESS'
                        ? `실행 완료: ${ACTION_LABEL[r.action] || r.action}${r.message ? ` (${r.message})` : ''}`
                        : `${label}: ${r.message || ''}`);
                }
                refresh();
            },
        });
    };

    const runEmergencyExit = async () => {
        if (emergencyText.trim() !== EMERGENCY_CONFIRM_WORD) {
            showToast(`'${EMERGENCY_CONFIRM_WORD}'를 정확히 입력해야 실행됩니다 — 취소됨`);
            return;
        }
        const { data, error } = await call('/emergency-exit', { confirm: EMERGENCY_CONFIRM_WORD }, 'POST');
        // 장외 시간 실패 등은 메시지를 놓치지 않도록 모달로 표시
        setNotice({ open: true, message: error ? `긴급 매도 실패: ${error}` : (data.response.message || '긴급 매도 처리됨') });
        refresh();
    };

    const toggleExpand = (id) => setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    const chartData = useMemo(() => {
        const ok = runs.filter((r) => r.status === 'SUCCESS' && r.mode === status?.mode && r.equityKrw)
            .slice().reverse();
        const byDate = new Map(ok.map((r) => [r.runDate, r]));      // 날짜별 마지막 실행
        const rows = [...byDate.values()];
        if (!rows.length) return [];
        const eq0 = rows[0].equityKrw;
        return rows.map((r) => ({
            date: r.runDate.slice(5),
            strategy: +((r.equityKrw / eq0 - 1) * 100).toFixed(2),
        }));
    }, [runs, status?.mode]);

    const headerRow = (
        <div className="flex items-center justify-between gap-2">
            {header}
            <RefreshButton onClick={refresh} busy={busy} refreshing={refreshing} />
        </div>
    );

    if (!status) {
        return (
            <div className="space-y-4">
                {headerRow}
                <p className="text-sm text-slate-500">불러오는 중...</p>
                <Toast message={toast} />
            </div>
        );
    }

    // 프록시/서버가 strategy 쿼리를 아직 모르면 코인 상태가 돌아온다 — 코인 설정을 잘못 바꾸지 않도록 조작 차단
    if (status.strategyId !== STRATEGY_STOCK) {
        return (
            <div className="space-y-4">
                {headerRow}
                <ErrorBanner errors={[`서버가 주식 전략(${STRATEGY_STOCK})을 아직 지원하지 않습니다 (응답 전략: ${status.strategyId || '알 수 없음'}). 서버 배포 후 다시 확인하세요.`]} />
                <Toast message={toast} />
            </div>
        );
    }

    const isLive = status.mode === 'LIVE';
    const symbolHeaders = ['종목', '기본 비중', `종가 / ${spec?.sma ?? ''}일선`, '추세', '변동성', '목표 비중', '현재가',
        `장부 수량 (${modeLabel(status.mode)})`, '평가액', '비중', ...(isLive ? ['계좌 수량'] : []), '일시 중지'];

    return (
        <div className="space-y-4">
            {headerRow}

            <ErrorBanner errors={status.errors} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 운영 설정 */}
                <Card title="운영">
                    <ModeSelector modes={STOCK_MODES} current={status.mode} onChange={changeMode} disabled={busy} busy={busy} />

                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">투자금 (원)</label>
                    <div className="flex gap-2 mb-3">
                        <input
                            value={capitalInput}
                            onChange={(e) => setCapitalInput(e.target.value)}
                            inputMode="numeric"
                            className={`flex-1 min-w-0 ${INPUT_CLASS}`}
                        />
                        <Button size="sm" variant="secondary" onClick={saveCapital} disabled={busy}>저장</Button>
                    </div>

                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">평일 실행 시각 (KST)</label>
                    <select
                        value={status.runHour}
                        onChange={(e) => updateSettings({ runHour: Number(e.target.value) }, '실행 시각 변경 완료')}
                        disabled={busy}
                        className={`w-full mb-3 ${INPUT_CLASS}`}
                    >
                        {runHours.map((h) => <option key={h} value={h}>{h}시</option>)}
                    </select>

                    <Row label="오늘 실행" value={status.doneToday ? '완료' : '대기'}
                        accent={status.doneToday ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'} />
                    <Row label="다음 실행" value={fmtDateTime(status.nextRun)} />
                    <ul className="text-[11px] text-slate-400 mt-1 space-y-0.5 list-disc pl-4">
                        <li>실행 시각은 장중 {minHour}~{maxHour}시 중 선택 (평일만, 휴장일은 자동 건너뜀).</li>
                        <li>주문은 정수 주 단위 — 목표 금액을 주가로 나눈 수량에서 소수점 이하는 버립니다.</li>
                        <li>실행 시각에 서버가 꺼져 있었다면 켜진 뒤 5분 안에 그날 실행됩니다.</li>
                    </ul>
                    <Button fullWidth className="mt-3" onClick={runNow} disabled={busy || status.mode === 'OFF'}>
                        {busy ? '처리 중...' : '지금 실행'}
                    </Button>
                </Card>

                {/* 전략 (잠금) */}
                <Card title="전략" right={<span className="inline-flex items-center gap-1 text-xs text-slate-400"><Lock size={12} />변경 불가</span>}>
                    <Row label="프리셋" value={spec?.name || status.strategyId} />
                    <Row label="추세 기준" value={spec?.sma ? `${spec.sma}일 평균선` : '-'} />
                    <Row label="변동성 기간" value={spec?.volWindow ? `${spec.volWindow}일` : '-'} />
                    <Row label="목표 변동성 (연)" value={fmtPct(spec?.targetVol, 0)} />
                    <Row label="매매 생략 폭" value={spec?.band !== undefined ? `비중 차이 ${fmtPct(spec.band, 0)} 미만` : '-'} />
                    <Row label="비중 방식" value={spec?.weighting || '-'} />
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">종목 구성 (고정)</p>
                        {assets.map((a) => (
                            <Row key={a.symbol} label={`${a.name} (${a.symbol})`} value={fmtPct(a.baseWeight)} />
                        ))}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 break-all">
                        검증 문서: <span className="font-mono">{spec?.doc || '-'}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                        종목별 목표 비중 = 기본 비중 × (종가 &gt; {spec?.sma}일선 ? 1 : 0) × min(1, {fmtPct(spec?.targetVol, 0)} ÷ 변동성).
                        파라미터는 봉인 검증 결과 그대로 고정됩니다.
                    </p>
                </Card>

                {/* 전략 장부 */}
                <Card title={`전략 장부 (${modeLabel(status.mode)})`}>
                    {modeLedger ? (
                        <>
                            <Row label="평가금액" value={fmtKrw(modeLedger.equityKrw)} />
                            <Row label="투입 원금" value={fmtKrw(modeLedger.capitalKrw)} />
                            <Row label="현금" value={fmtKrw(modeLedger.cashKrw)} />
                            <div className="mt-2 mb-1 flex justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">주식 투자 비중</span>
                                <span className="font-semibold">{fmtPct(modeLedger.investedWeight)}</span>
                            </div>
                            <WeightBar weight={modeLedger.investedWeight} />
                            <Row label="전략 수익률" value={fmtSignedPct(modeLedger.returnPct)} accent={returnAccent(modeLedger.returnPct)} />
                            <Row label="같은 기간 기본 비중 보유" value={fmtSignedPct(modeLedger.holdReturnPct)} accent="text-amber-600 dark:text-amber-400" />
                            <p className="text-[11px] text-slate-400 mt-1">시작: {fmtDateTime(modeLedger.startedAt)}</p>
                        </>
                    ) : <p className="text-sm text-slate-400">이 모드의 첫 실행 때 장부가 생성됩니다.</p>}
                    {liveHeld.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                실전 장부 보유: {liveHeld.map((a) => `${a.name} ${fmtShares(liveLedger.holdings[a.symbol].units)}`).join(', ')}
                            </p>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => { setEmergencyText(''); setEmergencyOpen(true); }}
                                className="w-full rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                긴급 전량 매도 + 중지
                            </button>
                            <p className="text-[11px] text-slate-400 mt-1">
                                비상용입니다. 장 운영시간({KRX_EMERGENCY_WINDOW})에만 매도되며, 그 밖의 시간에는 매도 없이 모드만 중지됩니다.
                            </p>
                        </div>
                    )}
                    {status.account && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-slate-500 mb-1">한국투자증권 계좌 (대조용)</p>
                            <Row label="예수금" value={fmtKrw(status.account.krw)} />
                        </div>
                    )}
                </Card>
            </div>

            {/* 종목별 현황 */}
            <Card title="종목별 현황" right={<span className="text-xs text-slate-400">{status.signals?.[0]?.candleDate} 일봉 기준</span>}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm whitespace-nowrap">
                        <thead>
                            <tr className={HEAD_ROW_CLASS}>
                                {symbolHeaders.map((h) => <th key={h} className={TH_CLASS}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {assets.map((a) => {
                                const s = signalBySymbol[a.symbol];
                                const h = modeLedger?.holdings?.[a.symbol];
                                const isPaused = paused.includes(a.symbol);
                                return (
                                    <tr key={a.symbol} className={`border-b border-slate-100 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 ${isPaused ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                                        <td className="py-1.5 px-2">
                                            <div className="font-medium text-slate-800 dark:text-slate-100">{a.name}</div>
                                            <div className="text-xs text-slate-400">{a.symbol}</div>
                                        </td>
                                        <td className="px-2">{fmtPct(a.baseWeight)}</td>
                                        <td className="px-2">{s ? `${fmtKrw(s.close)} / ${fmtKrw(s.sma)}` : '-'}</td>
                                        <td className="px-2">
                                            {s ? (
                                                <span className={s.trendOn ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}>
                                                    {s.trendOn ? 'ON (보유)' : 'OFF (현금)'}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-2">{fmtPct(s?.vol)}</td>
                                        <td className="px-2 font-semibold text-blue-600 dark:text-blue-400">{fmtPct(s?.targetWeight)}</td>
                                        <td className="px-2">{fmtPrice(s?.price)}</td>
                                        <td className="px-2">{h ? fmtShares(h.units) : '-'}</td>
                                        <td className="px-2">{h?.value !== undefined ? fmtKrw(h.value) : '-'}</td>
                                        <td className="px-2">{fmtPct(h?.weight)}</td>
                                        {isLive && <td className="px-2">{status.account ? fmtShares(status.account.holdings?.[a.symbol]) : '-'}</td>}
                                        <td className="px-2">
                                            <div className="flex items-center gap-2">
                                                {isPaused && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                        수동 제외 중
                                                    </span>
                                                )}
                                                <Button size="sm" variant="secondary" onClick={() => togglePause(a)} disabled={busy}>
                                                    {isPaused ? '재개' : '일시 중지'}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                    일시 중지는 비상용 임시 조치입니다. 중지된 종목은 신규 주문을 내지 않고 보유 수량을 그대로 둡니다. 종목 추가·삭제는 지원하지 않습니다.
                </p>
            </Card>

            <Card title="수익률 추이 (실행 기록 기준)">
                {chartData.length > 1 ? (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={withAlpha(SLATE[400], 20)} />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v) => `${v}%`} />
                                <Legend />
                                <Line type="monotone" dataKey="strategy" name="전략" stroke={COLOR_STRATEGY} dot={false} strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : <p className="text-sm text-slate-400">실행 기록이 2일 이상 쌓이면 표시됩니다.</p>}
            </Card>

            <Card title="실행 기록" right={<span className="text-xs text-slate-400">최근 {RUN_LIMIT}건 · 전체 모드 · 행을 누르면 종목별 상세</span>}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm whitespace-nowrap">
                        <thead>
                            <tr className={HEAD_ROW_CLASS}>
                                {RUN_HEADERS.map((h, i) => <th key={h || i} className={TH_CLASS}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map((r) => {
                                const hasDetail = r.detail?.length > 0;
                                const isOpen = expanded.has(r.id);
                                return (
                                    <Fragment key={r.id}>
                                        <tr
                                            onClick={hasDetail ? () => toggleExpand(r.id) : undefined}
                                            className={`border-b border-slate-100 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${hasDetail ? 'cursor-pointer' : ''}`}
                                        >
                                            <td className="pl-2 w-6 text-slate-400">
                                                {hasDetail && (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                                            </td>
                                            <td className="py-1.5 px-2">{fmtDateTime(r.createdAt)}</td>
                                            <td className="px-2">{modeLabel(r.mode) || r.mode}</td>
                                            <td className="px-2">{TRIGGER_LABEL[r.trigger] || r.trigger}</td>
                                            <td className="px-2">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[r.status] || STATUS_BADGE.FAILED}`}>
                                                    {STATUS_LABEL[r.status] || r.status}
                                                </span>
                                            </td>
                                            <td className="px-2">{r.candleDate || '-'}</td>
                                            <td className="px-2">{fmtPct(r.targetWeight)}</td>
                                            <td className="px-2">{fmtPct(r.weightBefore)} → {fmtPct(r.weightAfter)}</td>
                                            <td className="px-2">{ACTION_LABEL[r.action] || '-'}</td>
                                            <td className="px-2">{r.orderKrw ? fmtKrw(r.orderKrw) : '-'}</td>
                                            <td className="px-2">{fmtKrw(r.equityKrw)}</td>
                                            <td className="px-2 max-w-xs truncate" title={r.message || ''}>{r.message || ''}</td>
                                        </tr>
                                        {isOpen && (
                                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                                <td colSpan={RUN_HEADERS.length} className="px-4 py-2">
                                                    <RunDetail lines={r.detail} />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                            {!runs.length && (
                                <tr><td colSpan={RUN_HEADERS.length} className="py-4 text-center text-slate-400">실행 기록 없음</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <AlertModal
                open={confirm.open}
                title="확인"
                message={confirm.message}
                onConfirm={confirm.onConfirm}
                onClose={() => setConfirm({ open: false, message: '', onConfirm: null })}
            />
            <AlertModal
                open={notice.open}
                title="긴급 전량 매도 결과"
                message={notice.message}
                onClose={() => setNotice({ open: false, message: '' })}
            />
            <AlertModal
                open={emergencyOpen}
                title="긴급 전량 매도 + 중지"
                onConfirm={runEmergencyExit}
                onClose={() => setEmergencyOpen(false)}
            >
                <p className="whitespace-pre-line mb-3">
                    {`실전 장부의 보유 종목(${liveHeld.map((a) => `${a.name} ${fmtShares(liveLedger?.holdings?.[a.symbol]?.units)}`).join(', ')})을 지금 전량 매도하고 모드를 '중지'로 바꿉니다.\n장 운영시간(${KRX_EMERGENCY_WINDOW}) 밖이면 매도되지 않고 모드만 중지됩니다.\n계좌의 다른 자산은 건드리지 않습니다.\n계속하려면 '${EMERGENCY_CONFIRM_WORD}'를 입력하세요.`}
                </p>
                <input
                    value={emergencyText}
                    onChange={(e) => setEmergencyText(e.target.value)}
                    placeholder={EMERGENCY_CONFIRM_WORD}
                    className={`w-full ${INPUT_CLASS}`}
                />
            </AlertModal>
            <Toast message={toast} />
        </div>
    );
}

/** 실행 1건의 종목별 상세 (detail 배열) */
function RunDetail({ lines }) {
    return (
        <table className="w-full text-xs whitespace-nowrap">
            <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    {DETAIL_HEADERS.map((h) => <th key={h} className="py-1 px-2 font-medium">{h}</th>)}
                </tr>
            </thead>
            <tbody>
                {lines.map((d) => (
                    <tr key={d.symbol} className="text-slate-700 dark:text-slate-300">
                        <td className="py-1 px-2">{d.name || d.symbol} <span className="text-slate-400">{d.symbol}</span></td>
                        <td className="px-2">{fmtPrice(d.close)}</td>
                        <td className="px-2">{fmtPrice(d.sma)}</td>
                        <td className="px-2">{fmtPct(d.vol)}</td>
                        <td className="px-2">{fmtPct(d.target)}</td>
                        <td className="px-2">{fmtPct(d.weight_before)} → {fmtPct(d.weight_after)}</td>
                        <td className="px-2">{ACTION_LABEL[d.action] || d.action || '-'}</td>
                        <td className="px-2">{d.volume ? fmtShares(d.volume) : '-'}</td>
                        <td className="px-2">{d.funds ? fmtKrw(d.funds) : '-'}</td>
                        <td className="px-2">{fmtPrice(d.fill_price)}</td>
                        <td className="px-2">{d.fee ? fmtKrw(d.fee) : '-'}</td>
                        <td className="px-2">
                            {d.paused && <span className="mr-1 text-amber-600 dark:text-amber-400">[수동 제외]</span>}
                            {d.note || ''}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
