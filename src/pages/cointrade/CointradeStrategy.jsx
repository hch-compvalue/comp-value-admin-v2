import { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { send } from '@/util/ClientUtil';
import Toast from '@/component/common/display/Toast';
import PageTitle from '@/component/common/display/PageTitle';
import Button from '@/component/common/button/Button';
import AlertModal from '@/component/layouts/common/popup/AlertModal';

/**
 * 코인 자동매매 v5.0 — BTC 50일선 추세 + 목표변동성 (매일 1회)
 * 기존 '자동매매 대시보드' + '스케줄러 관리'를 통합한 페이지.
 * 색상: 적록색약 배려 — 파랑(전략/정상) · 노랑/주황(BTC 비교/경고)
 */

const API = '/dart/api/cointrade/strategy';
const STATUS_REFRESH_MS = 60_000;
const RUN_LIMIT = 90;
const MIN_CAPITAL_KRW = 5000;
const RUN_HOURS = Array.from({ length: 15 }, (_, i) => i + 9);   // 9~23시 (09시 일봉 마감 이후)
const COLOR_STRATEGY = '#3b82f6';
const COLOR_BTC = '#f59e0b';

const MODES = [
    { key: 'OFF', label: '중지', desc: '실행 안 함' },
    { key: 'DRY_RUN', label: '확인 실행', desc: '판단·주문계획만 기록 (주문 없음)' },
    { key: 'LIVE', label: '실전', desc: '업비트 실제 주문' },
];

const fmtKrw = (v) => (v === null || v === undefined ? '-' : `${Math.round(v).toLocaleString('ko-KR')}원`);
const fmtPct = (v, digits = 1) => (v === null || v === undefined ? '-' : `${(v * 100).toFixed(digits)}%`);
const fmtSignedPct = (v) => (v === null || v === undefined ? '-' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`);
const fmtBtc = (v) => (v === null || v === undefined ? '-' : Number(v).toFixed(8));
const fmtDateTime = (iso) => (iso ? iso.replace('T', ' ').slice(0, 16) : '-');

const Card = ({ title, children, right }) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
            {right}
        </div>
        {children}
    </div>
);

const Row = ({ label, value, accent }) => (
    <div className="flex justify-between py-1 text-sm">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`font-medium ${accent || 'text-slate-800 dark:text-slate-100'}`}>{value}</span>
    </div>
);

const WeightBar = ({ weight }) => (
    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className="h-2 bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, (weight || 0) * 100))}%` }} />
    </div>
);

const INPUT_CLASS = 'h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed dark:disabled:bg-slate-800';

const statusBadge = (status) => (status === 'SUCCESS'
    ? 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400'
    : 'bg-orange-100 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400');

const actionLabel = { BUY: '매수', SELL: '매도', HOLD: '유지' };

export default function CointradeStrategy() {
    const [status, setStatus] = useState(null);
    const [runs, setRuns] = useState([]);
    const [toast, setToast] = useState(null);
    const [busy, setBusy] = useState(false);
    const [capitalInput, setCapitalInput] = useState('');
    const [confirm, setConfirm] = useState({ open: false, message: '', onConfirm: null });

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const fetchStatus = useCallback(async () => {
        const { data, error } = await send(`${API}/status`, {}, 'GET');
        if (error) {
            showToast(`상태 조회 실패: ${error}`);
            return;
        }
        setStatus(data.response);
        setCapitalInput((prev) => (prev === '' ? String(Math.round(data.response.capitalKrw)) : prev));
    }, []);

    const fetchRuns = useCallback(async () => {
        const { data, error } = await send(`${API}/runs`, { limit: RUN_LIMIT }, 'GET');
        if (!error) setRuns(data.response.runs || []);
    }, []);

    const refresh = useCallback(() => {
        fetchStatus();
        fetchRuns();
    }, [fetchStatus, fetchRuns]);

    useEffect(() => {
        refresh();
        const timer = setInterval(fetchStatus, STATUS_REFRESH_MS);
        return () => clearInterval(timer);
    }, [refresh, fetchStatus]);

    const updateSettings = async (body, successMsg) => {
        setBusy(true);
        const { error } = await send(`${API}/settings`, body, 'PUT');
        setBusy(false);
        if (error) {
            showToast(`변경 실패: ${error}`);
            return;
        }
        showToast(successMsg);
        refresh();
    };

    const changeMode = (mode) => {
        if (mode === status?.mode) return;
        const apply = () => updateSettings({ mode }, `모드 변경: ${MODES.find((m) => m.key === mode).label}`);
        if (mode === 'LIVE') {
            setConfirm({
                open: true,
                message: `실전 모드로 전환합니다.\n업비트에 실제 주문이 나갑니다 (투자금 ${fmtKrw(status?.capitalKrw)}).\n계속할까요?`,
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

    const runNow = () => {
        setConfirm({
            open: true,
            message: `현재 모드(${MODES.find((m) => m.key === status?.mode)?.label})로 지금 1회 실행합니다.\n목표 비중과 차이가 있을 때만 주문합니다.`,
            onConfirm: async () => {
                setBusy(true);
                const { data, error } = await send(`${API}/run`, {}, 'POST');
                setBusy(false);
                if (error) {
                    showToast(`실행 실패: ${error}`);
                } else {
                    const r = data.response;
                    showToast(r.status === 'SUCCESS'
                        ? `실행 완료: ${actionLabel[r.action] || r.action}${r.message ? ` (${r.message})` : ''}`
                        : `실행 실패: ${r.message}`);
                }
                refresh();
            },
        });
    };

    const modeLedger = status?.ledgers?.[status?.mode];
    const sig = status?.signal;

    const chartData = useMemo(() => {
        const ok = runs.filter((r) => r.status === 'SUCCESS' && r.mode === status?.mode && r.equityKrw && r.btcPrice)
            .slice().reverse();
        const byDate = new Map(ok.map((r) => [r.runDate, r]));      // 날짜별 마지막 실행
        const rows = [...byDate.values()];
        if (!rows.length) return [];
        const eq0 = rows[0].equityKrw;
        const px0 = rows[0].btcPrice;
        return rows.map((r) => ({
            date: r.runDate.slice(5),
            strategy: +((r.equityKrw / eq0 - 1) * 100).toFixed(2),
            btc: +((r.btcPrice / px0 - 1) * 100).toFixed(2),
        }));
    }, [runs, status?.mode]);

    if (!status) {
        return (
            <div className="p-2 md:p-4">
                <PageTitle />
                <p className="text-sm text-slate-500">불러오는 중...</p>
                <Toast message={toast} />
            </div>
        );
    }

    return (
        <div className="p-2 md:p-4 space-y-4">
            <div className="flex items-center justify-between">
                <PageTitle />
                <Button variant="secondary" size="sm" onClick={refresh} disabled={busy}>새로고침</Button>
            </div>

            {status.errors?.length > 0 && (
                <div className="rounded-lg border border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20 p-3 text-sm text-orange-800 dark:text-orange-200">
                    {status.errors.map((e) => <div key={e}>⚠ {e}</div>)}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 운영 설정 */}
                <Card title="운영">
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        {MODES.map((m) => (
                            <button
                                key={m.key}
                                onClick={() => changeMode(m.key)}
                                disabled={busy}
                                title={m.desc}
                                className={`rounded-lg px-2 py-2 text-sm font-medium border transition-colors ${
                                    status.mode === m.key
                                        ? m.key === 'LIVE'
                                            ? 'bg-orange-500 text-white border-orange-500'
                                            : 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{MODES.find((m) => m.key === status.mode)?.desc}</p>

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

                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">매일 실행 시각 (KST)</label>
                    <select
                        value={status.runHour}
                        onChange={(e) => updateSettings({ runHour: Number(e.target.value) }, '실행 시각 변경 완료')}
                        disabled={busy}
                        className={`w-full mb-3 ${INPUT_CLASS}`}
                    >
                        {RUN_HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}
                    </select>

                    <Row label="오늘 실행" value={status.doneToday ? '완료' : '대기'}
                        accent={status.doneToday ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'} />
                    <Row label="다음 실행" value={fmtDateTime(status.nextRun)} />
                    <p className="text-[11px] text-slate-400 mt-1">실행 시각에 서버가 꺼져 있었다면 켜진 뒤 5분 안에 그날 실행됩니다.</p>
                    <Button fullWidth className="mt-3" onClick={runNow} disabled={busy || status.mode === 'OFF'}>
                        {busy ? '처리 중...' : '지금 실행'}
                    </Button>
                </Card>

                {/* 오늘 신호 */}
                <Card title="오늘 신호" right={<span className="text-xs text-slate-400">{sig?.candleDate} 일봉 기준</span>}>
                    {sig ? (
                        <>
                            <Row label="BTC 종가" value={fmtKrw(sig.close)} />
                            <Row label="50일 평균선" value={fmtKrw(sig.sma50)} />
                            <Row label="추세" value={sig.trendOn ? '평균선 위 (보유)' : '평균선 아래 (현금)'}
                                accent={sig.trendOn ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'} />
                            <Row label="최근 30일 변동성 (연환산)" value={fmtPct(sig.vol30)} />
                            <div className="mt-2 mb-1 flex justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">목표 BTC 비중</span>
                                <span className="font-semibold text-blue-600 dark:text-blue-400">{fmtPct(sig.targetWeight)}</span>
                            </div>
                            <WeightBar weight={sig.targetWeight} />
                            <Row label="현재가" value={fmtKrw(sig.btcPrice)} />
                        </>
                    ) : <p className="text-sm text-slate-400">시세 조회 실패</p>}
                    <p className="text-[11px] text-slate-400 mt-2">
                        목표 비중 = (종가 &gt; 50일선 ? 1 : 0) × min(1, {fmtPct(status.strategy?.targetVol, 0)} ÷ 변동성).
                        비중 차이 {fmtPct(status.strategy?.band, 0)} 미만은 매매 생략.
                    </p>
                </Card>

                {/* 전략 장부 */}
                <Card title={`전략 장부 (${MODES.find((m) => m.key === status.mode)?.label})`}>
                    {modeLedger ? (
                        <>
                            <Row label="평가금액" value={fmtKrw(modeLedger.equityKrw)} />
                            <Row label="투입 원금" value={fmtKrw(modeLedger.capitalKrw)} />
                            <Row label="현금" value={fmtKrw(modeLedger.cashKrw)} />
                            <Row label="BTC 수량" value={fmtBtc(modeLedger.btcUnits)} />
                            <div className="mt-2 mb-1 flex justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">현재 BTC 비중</span>
                                <span className="font-semibold">{fmtPct(modeLedger.btcWeight)}</span>
                            </div>
                            <WeightBar weight={modeLedger.btcWeight} />
                            <Row label="전략 수익률" value={fmtSignedPct(modeLedger.returnPct)} accent="text-blue-600 dark:text-blue-400" />
                            <Row label="같은 기간 BTC 보유" value={fmtSignedPct(modeLedger.btcHoldReturnPct)} accent="text-amber-600 dark:text-amber-400" />
                            <p className="text-[11px] text-slate-400 mt-1">시작: {fmtDateTime(modeLedger.startedAt)}</p>
                        </>
                    ) : <p className="text-sm text-slate-400">이 모드의 첫 실행 때 장부가 생성됩니다.</p>}
                    {status.account && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-slate-500 mb-1">업비트 계좌 (대조용)</p>
                            <Row label="원화" value={fmtKrw(status.account.krw)} />
                            <Row label="BTC" value={fmtBtc(status.account.btc)} />
                        </div>
                    )}
                </Card>
            </div>

            <Card title="수익률 추이 (실행 기록 기준)">
                {chartData.length > 1 ? (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v) => `${v}%`} />
                                <Legend />
                                <Line type="monotone" dataKey="strategy" name="전략" stroke={COLOR_STRATEGY} dot={false} strokeWidth={2} />
                                <Line type="monotone" dataKey="btc" name="BTC 보유" stroke={COLOR_BTC} dot={false} strokeWidth={2} strokeDasharray="5 3" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : <p className="text-sm text-slate-400">실행 기록이 2일 이상 쌓이면 표시됩니다.</p>}
            </Card>

            <Card title="실행 기록" right={<span className="text-xs text-slate-400">최근 {RUN_LIMIT}건 · 전체 모드</span>}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm whitespace-nowrap">
                        <thead>
                            <tr className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                                {['실행일', '모드', '구분', '상태', '일봉', '목표', '이전→이후', '주문', '금액', '체결가', '평가금액', '메시지'].map((h) => (
                                    <th key={h} className="py-2 px-2 font-medium">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map((r) => (
                                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="py-1.5 px-2">{fmtDateTime(r.createdAt)}</td>
                                    <td className="px-2">{MODES.find((m) => m.key === r.mode)?.label || r.mode}</td>
                                    <td className="px-2">{r.trigger === 'AUTO' ? '자동' : '수동'}</td>
                                    <td className="px-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(r.status)}`}>{r.status === 'SUCCESS' ? '성공' : '실패'}</span></td>
                                    <td className="px-2">{r.candleDate || '-'}</td>
                                    <td className="px-2">{fmtPct(r.targetWeight)}</td>
                                    <td className="px-2">{fmtPct(r.weightBefore)} → {fmtPct(r.weightAfter)}</td>
                                    <td className="px-2">{actionLabel[r.action] || '-'}</td>
                                    <td className="px-2">{r.orderKrw ? fmtKrw(r.orderKrw) : '-'}</td>
                                    <td className="px-2">{r.fillPrice ? fmtKrw(r.fillPrice) : '-'}</td>
                                    <td className="px-2">{fmtKrw(r.equityKrw)}</td>
                                    <td className="px-2 max-w-xs truncate" title={r.message || ''}>{r.message || ''}</td>
                                </tr>
                            ))}
                            {!runs.length && (
                                <tr><td colSpan={12} className="py-4 text-center text-slate-400">실행 기록 없음</td></tr>
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
            <Toast message={toast} />
        </div>
    );
}
