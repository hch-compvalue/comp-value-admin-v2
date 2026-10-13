import { createContext } from 'react';

/**
 * 하위 탭으로 삽입된 페이지의 타이틀 정보
 * - 값이 있으면 PageTitle이 라우트 대신 이 정보로 브레드크럼/타이틀을 표시한다
 * - { section, parentLabel, label } | null
 */
export const EmbeddedPageContext = createContext(null);
