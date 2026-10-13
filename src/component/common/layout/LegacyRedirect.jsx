import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTab } from '@/context/TabContext';

/**
 * 메뉴 통합 전 경로(북마크 등)를 새 경로로 옮긴다
 * - 옛 경로 탭은 닫는다 (KeepAlive가 캐시된 리다이렉트를 다시 렌더링해 반복 이동하는 것을 방지)
 *
 * @param {string} to - 이동할 경로
 * @param {string} [subTab] - 이동한 페이지에서 열 하위 탭 키
 */
export default function LegacyRedirect({ to, subTab }) {
    const location = useLocation();
    const { closeTabAndNavigate } = useTab();
    const doneRef = useRef(false);

    useEffect(() => {
        if (doneRef.current) return;
        doneRef.current = true;
        closeTabAndNavigate(location.pathname, to, { replace: true, state: subTab ? { subTab } : undefined });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}
