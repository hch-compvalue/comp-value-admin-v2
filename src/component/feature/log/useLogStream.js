import { useState, useEffect, useRef, useCallback } from 'react';
import { send } from '@/util/ClientUtil';

export const MAX_LOGS = 10000; // 최대 로그 개수
export const POLLING_INTERVAL = 2000; // 2초
const SSE_RECONNECT_DELAY = 3000; // SSE 재연결 대기 (3초)

const nowTime = () => new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
});

// 최대 개수 제한을 적용해 로그 추가
const appendLogs = (prevLogs, entries) => {
    const newLogs = [...prevLogs, ...entries];
    return newLogs.length > MAX_LOGS ? newLogs.slice(-MAX_LOGS) : newLogs;
};

/**
 * 로그 스트림 수신 훅
 * - mode 'sse': EventSource로 수신, 마운트 시 자동 연결 + 끊기면 자동 재연결
 * - mode 'polling': lastLine 이후 로그를 주기적으로 조회, 사용자가 시작해야 동작
 *
 * @param {{ mode: 'sse'|'polling', endpoint: string }} source
 */
export default function useLogStream({ mode, endpoint }) {
    const [logs, setLogs] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState('');

    const eventSourceRef = useRef(null);
    const pollingIntervalRef = useRef(null);
    const lastLineRef = useRef(0); // lastLine을 ref로 관리하여 폴링 시 최신값 참조 보장

    const addLog = useCallback((message) => {
        setLogs(prev => appendLogs(prev, [{ timestamp: nowTime(), message }]));
    }, []);

    // ── SSE ──
    const connectSSE = useCallback(() => {
        try {
            const eventSource = new EventSource(endpoint);
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                setIsConnected(true);
                addLog('[시스템] 로그 스트림에 연결되었습니다.');
            };

            // 서버로부터 로그 메시지 수신
            eventSource.onmessage = (event) => addLog(event.data);

            eventSource.onerror = (err) => {
                console.error('SSE 연결 오류:', err);
                setIsConnected(false);
                addLog('[오류] 로그 스트림 연결이 끊어졌습니다.');

                // 자동 재연결 시도
                setTimeout(() => {
                    if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
                        addLog('[시스템] 재연결을 시도합니다...');
                        connectSSE();
                    }
                }, SSE_RECONNECT_DELAY);
            };
        } catch (err) {
            console.error('SSE 연결 실패:', err);
            addLog('[오류] 로그 스트림 연결에 실패했습니다.');
        }
    }, [endpoint, addLog]);

    const disconnectSSE = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
            setIsConnected(false);
        }
    }, []);

    // SSE는 창이 열리면 바로 연결하고, 창 닫힐 때 정리
    useEffect(() => {
        if (mode !== 'sse') return undefined;
        connectSSE();
        return disconnectSSE;
    }, [mode, connectSSE, disconnectSSE]);

    // ── 폴링 ──
    useEffect(() => {
        if (mode !== 'polling' || !isConnected) return undefined;

        const fetchLogs = async () => {
            try {
                const currentLastLine = lastLineRef.current;
                const { data, error: apiError } = await send(endpoint, { lastLine: currentLastLine }, 'GET');

                if (apiError) {
                    setError(apiError);
                    return;
                }
                if (!data?.response) return;

                const { content, endLine } = data.response;
                // 새로운 내용이 있고, 서버가 반환한 endLine이 현재 lastLine보다 클 때만 처리
                if (content && content.trim() && endLine > currentLastLine) {
                    const newLines = content.split('\n').filter(line => line.trim());
                    if (newLines.length > 0) {
                        const timestamp = nowTime();
                        setLogs(prev => appendLogs(prev, newLines.map(line => ({ timestamp, message: line }))));
                        lastLineRef.current = endLine;
                    }
                }
                setError('');
            } catch {
                setError('로그 조회 중 오류가 발생했습니다.');
            }
        };

        // 초기 로드 후 폴링 시작
        fetchLogs();
        pollingIntervalRef.current = setInterval(fetchLogs, POLLING_INTERVAL);

        return () => {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        };
    }, [mode, endpoint, isConnected]);

    const start = useCallback(() => {
        if (mode === 'sse') {
            connectSSE();
            return;
        }
        setIsConnected(true);
        setError('');
        addLog('[시스템] 폴링 시작됨');
    }, [mode, connectSSE, addLog]);

    const stop = useCallback(() => {
        if (mode === 'sse') {
            disconnectSSE();
            addLog('[시스템] 연결을 종료했습니다.');
            return;
        }
        setIsConnected(false);
        addLog('[시스템] 폴링 종료됨');
    }, [mode, disconnectSSE, addLog]);

    const clear = useCallback(() => {
        setLogs([]);
        lastLineRef.current = 0;
    }, []);

    return { logs, isConnected, error, start, stop, clear };
}
