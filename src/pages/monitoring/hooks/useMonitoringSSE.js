import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * SSE 기반 실시간 모니터링 훅 (Web Worker 기반)
 *
 * - Worker가 SSE 연결 + resourceHistory 버퍼링을 담당
 * - 탭 백그라운드에서도 Worker가 계속 데이터 수집
 * - 탭 복귀 시 Worker에서 전체 히스토리를 sync하여 차트 빈틈 방지
 * - Worker 미지원 시 기존 EventSource 폴백
 *
 * named events: snapshot / trade / traffic / api-log
 */
export default function useMonitoringSSE() {
    const [snapshot, setSnapshot] = useState(null);
    const [trades, setTrades] = useState([]);
    const [apiLogs, setApiLogs] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [resourceHistory, setResourceHistory] = useState([]);
    const [traffic, setTraffic] = useState({ http: 0, db: 0, redis: 0, trader: 0, ml: 0 });

    const workerRef = useRef(null);
    const fallbackRef = useRef(null); // EventSource 폴백용
    const isPausedRef = useRef(false);
    const MAX_TRADES = 100;
    const MAX_API_LOGS = 50;
    const MAX_RESOURCE_HISTORY = 620;

    // ─── Worker 메시지 핸들러 ───
    const handleWorkerMessage = useCallback((e) => {
        const msg = e.data;

        switch (msg.type) {
            case 'connected':
                setIsConnected(true);
                break;

            case 'disconnected':
                setIsConnected(false);
                break;

            case 'snapshot':
                // snapshot은 항상 반영 (Worker가 resourceHistory를 버퍼링하므로)
                setSnapshot(msg.data);
                // 탭 활성 시에만 개별 포인트로 resourceHistory 업데이트
                if (!isPausedRef.current && msg.data.resources?.containers?.length > 0) {
                    setResourceHistory(prev => {
                        const next = [...prev, { ...msg.data.resources, ts: Date.now() }];
                        return next.length > MAX_RESOURCE_HISTORY
                            ? next.slice(next.length - MAX_RESOURCE_HISTORY)
                            : next;
                    });
                }
                break;

            case 'history-sync':
                // 탭 복귀 시 Worker의 전체 버퍼로 교체
                setResourceHistory(msg.resourceHistory);
                break;

            case 'trade':
                if (!isPausedRef.current) {
                    setTrades(prev => {
                        const next = [msg.data, ...prev];
                        return next.length > MAX_TRADES ? next.slice(0, MAX_TRADES) : next;
                    });
                }
                break;

            case 'traffic':
                if (!isPausedRef.current) {
                    setTraffic(msg.data);
                }
                break;

            case 'api-log':
                if (!isPausedRef.current) {
                    setApiLogs(prev => {
                        const next = [...msg.data.reverse(), ...prev];
                        return next.length > MAX_API_LOGS ? next.slice(0, MAX_API_LOGS) : next;
                    });
                }
                break;
        }
    }, []);

    // ─── EventSource 폴백 (Worker 미지원 시) ───
    const connectFallback = useCallback(() => {
        try {
            const eventSource = new EventSource('/dart/monitoring/stream');
            fallbackRef.current = eventSource;

            eventSource.onopen = () => setIsConnected(true);

            eventSource.addEventListener('snapshot', (event) => {
                if (isPausedRef.current) return;
                try {
                    const data = JSON.parse(event.data);
                    setSnapshot(data);
                    if (data.resources?.containers?.length > 0) {
                        setResourceHistory(prev => {
                            const next = [...prev, { ...data.resources, ts: Date.now() }];
                            return next.length > MAX_RESOURCE_HISTORY
                                ? next.slice(next.length - MAX_RESOURCE_HISTORY)
                                : next;
                        });
                    }
                } catch (e) {
                    console.error('snapshot parse error:', e);
                }
            });

            eventSource.addEventListener('trade', (event) => {
                if (isPausedRef.current) return;
                try {
                    const data = JSON.parse(event.data);
                    setTrades(prev => {
                        const next = [data, ...prev];
                        return next.length > MAX_TRADES ? next.slice(0, MAX_TRADES) : next;
                    });
                } catch (e) {
                    console.error('trade parse error:', e);
                }
            });

            eventSource.addEventListener('traffic', (event) => {
                if (isPausedRef.current) return;
                try {
                    setTraffic(JSON.parse(event.data));
                } catch (e) {
                    console.error('traffic parse error:', e);
                }
            });

            eventSource.addEventListener('api-log', (event) => {
                if (isPausedRef.current) return;
                try {
                    const batch = JSON.parse(event.data);
                    setApiLogs(prev => {
                        const next = [...batch.reverse(), ...prev];
                        return next.length > MAX_API_LOGS ? next.slice(0, MAX_API_LOGS) : next;
                    });
                } catch (e) {
                    console.error('api-log parse error:', e);
                }
            });

            eventSource.onerror = () => {
                setIsConnected(false);
                eventSource.close();
                setTimeout(() => {
                    if (fallbackRef.current?.readyState === EventSource.CLOSED) {
                        connectFallback();
                    }
                }, 3000);
            };
        } catch (error) {
            console.error('SSE 연결 실패:', error);
            setIsConnected(false);
        }
    }, []);

    // ─── 탭 visibility 처리 ───
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') {
                isPausedRef.current = true;
                setIsPaused(true);
            } else {
                isPausedRef.current = false;
                setIsPaused(false);
                // 탭 복귀 시 Worker에 전체 히스토리 sync 요청
                if (workerRef.current) {
                    workerRef.current.postMessage({ type: 'sync' });
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    // ─── SSE 연결 (Worker 우선, 폴백 EventSource) ───
    useEffect(() => {
        const sseUrl = `${window.location.origin}/dart/monitoring/stream`;

        try {
            const worker = new Worker(
                new URL('./monitoring-sse-worker.js', import.meta.url)
            );
            workerRef.current = worker;
            worker.onmessage = handleWorkerMessage;
            worker.postMessage({ type: 'start', url: sseUrl });
        } catch {
            // Worker 미지원 시 기존 방식 폴백
            connectFallback();
        }

        return () => {
            if (workerRef.current) {
                workerRef.current.postMessage({ type: 'stop' });
                workerRef.current.terminate();
                workerRef.current = null;
            }
            if (fallbackRef.current) {
                fallbackRef.current.close();
                fallbackRef.current = null;
            }
        };
    }, [handleWorkerMessage, connectFallback]);

    const togglePause = useCallback(() => {
        isPausedRef.current = !isPausedRef.current;
        setIsPaused(isPausedRef.current);
        // 일시정지 해제 시 Worker에서 히스토리 sync
        if (!isPausedRef.current && workerRef.current) {
            workerRef.current.postMessage({ type: 'sync' });
        }
    }, []);

    return {
        snapshot,
        trades,
        apiLogs,
        isConnected,
        isPaused,
        togglePause,
        resourceHistory,
        traffic,
    };
}
