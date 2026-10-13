import axios from 'axios';

axios.defaults.withCredentials = true;

// 현재 환경 감지
const isDev = import.meta.env.DEV // vite에서는 import.meta.env.DEV로 감지
const baseURL = isDev ? '' : '' // 개발환경은 proxy 타니까 '', 운영도 상대경로 ''

// ============ API 엔드포인트 ============
export const API_ENDPOINTS = {
    // 해외 기업가치 계산 (단일)
    ABROAD_COMP_VALUE: (symbol) =>
        `/dart/main/cal/per_value/abroad?symbol=${encodeURIComponent(symbol)}`,
};

/**
 * Url에 도메인 세팅
 * 개발은 localhost:port (vite.config.js) / 운영은 상대경로
 * @param {string} url 
 * @returns 
 */
const getUrl = (url) => {
    return baseURL + url;
}

/**
 * 에러 응답 처리
 * @param {any} error 
 * @returns {{ data: null, error: string }}
 */
/**
 * 강제 로그아웃 브로드캐스트 (401 등 세션 만료 시)
 * - 이전에 로그인 상태였을 때만 로그아웃 이벤트 발생 (미로그인 상태에서 401은 무시)
 * - 중복 호출 방지: 이미 로그아웃 처리 중이면 무시
 */
// 대량조회 중 강제 로그아웃 지연
let _bulkOperationActive = false;
let _logoutPending = false;

export function beginBulkOperation() {
    _bulkOperationActive = true;
    _logoutPending = false;
    return () => {
        _bulkOperationActive = false;
        if (_logoutPending) {
            _logoutPending = false;
            forceClientLogout();
        }
    };
}

let _forceLogoutFired = false;
const forceClientLogout = () => {
    if (_forceLogoutFired) return;
    if (_bulkOperationActive) {
        _logoutPending = true;
        return;
    }
    // 로그인한 적이 없으면 (userName 없으면) 조용히 무시
    const wasLoggedIn = !!localStorage.getItem('userName');
    _forceLogoutFired = true;
    try {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userName');
        localStorage.removeItem('nickName');
        localStorage.removeItem('roles');
        sessionStorage.clear();
        // 이전에 로그인 상태였을 때만 로그아웃 알림 (세션 만료 시)
        if (wasLoggedIn) {
            window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: '401' } }));
        }
    } catch (e) { /* noop */ }
    setTimeout(() => { _forceLogoutFired = false; }, 2000);
};

const handleError = (error) => {
    if (error.response) {
        const { status, data } = error.response;
        const message = data.message;

        if (status === 401) {
            // 세션 만료/인증 실패 → 클라이언트 강제 로그아웃 상태로 전환
            forceClientLogout();
            return { data: null, error: message || '인증 실패' };
        }

        if (status === 400) {
            return { data: null, error: message || '잘못된 요청' };
        }

        return { data: null, error: message || '서버 에러' };
    }
    return { data: null, error: '네트워크 에러' };
};

/**
 * 동기 통신 (async/await 방식)
 * 호출하는 쪽에서 동기로 받고 싶으면 await send(...)
 * 호출하는 쪽에서 비동기 방식으로 호출하고 콜백을 받고 싶으면 .then 으로 받아서 처리 (Promise 체인)
 * 
 * @param {string} url 
 * @param {object} params 예: { corp_name: string, corp_code: string, year: string }
 * @param {string} [method="GET"] 
 * @returns {Promise<{ data: any, error: string|null }>}
 */
export const send = async (url, params, method = "GET") => {

    url = getUrl(url);

    try {
        let response;
        if (method === "POST") {
            response = await axios.post(url, params, {
                headers: { 'Content-Type': 'application/json' },
                withCredentials: true,
            });
        } else if (method === "PUT") {
            response = await axios.put(url, params, {
                headers: { 'Content-Type': 'application/json' },
                withCredentials: true,
            });
        } else if (method === "PATCH") {
            response = await axios.patch(url, params, {
                headers: { 'Content-Type': 'application/json' },
                withCredentials: true,
            });
        } else if (method === "DELETE") {
            response = await axios.delete(url, { params, withCredentials: true });
        } else {
            response = await axios.get(url, { params, withCredentials: true });
        }

        // 백엔드 응답에서 success 필드 체크
        const responseData = response.data;
        if (responseData && responseData.success === false) {
            return { data: null, error: responseData.message || '요청 처리 중 오류가 발생했습니다.' };
        }

        // API 호출 성공 시 세션 활동 이벤트 발생 (세션 타이머 동기화)
        // 백엔드 응답에서 sessionTTL 추출하여 전달 (response 내부에 있음)
        const sessionTTL = responseData?.response?.sessionTTL;
        window.dispatchEvent(new CustomEvent('session:activity', {
            detail: { sessionTTL }
        }));

        return { data: response.data, error: null };
    } catch (error) {
        return handleError(error);
    }
};

/**
 * Multipart 통신 (FormData 전송, 파일 업로드 등)
 * @param {string} url
 * @param {FormData} formData
 * @param {string} [method="POST"] POST 또는 PUT
 * @returns {Promise<{ data: any, error: string|null }>}
 */
export const sendMultipart = async (url, formData, method = 'POST') => {
    url = getUrl(url);
    try {
        const config = { withCredentials: true };
        let response;
        if (method === 'PUT') {
            response = await axios.put(url, formData, config);
        } else {
            response = await axios.post(url, formData, config);
        }

        const responseData = response.data;
        if (responseData && responseData.success === false) {
            return { data: null, error: responseData.message || '요청 처리 중 오류가 발생했습니다.' };
        }

        const sessionTTL = responseData?.response?.sessionTTL;
        window.dispatchEvent(new CustomEvent('session:activity', {
            detail: { sessionTTL }
        }));

        return { data: response.data, error: null };
    } catch (error) {
        return handleError(error);
    }
};

/**
 * 비동기 통신 (Promise 체인 방식)
 * @param {string} url 
 * @param {object} params 
 * @param {string} [method="GET"] 
 * @returns {Promise<{ data: any, error: string|null }>}
 */
export const asyncSend = (url, params, method = "GET") => {

    url = getUrl(url);

    const request = method === "POST"
        ? axios.post(url, params, {
            headers: { 'Content-Type': 'application/json' },
            withCredentials: true,
        })
        : axios.get(url, { params, withCredentials: true });

    return request
        .then(response => ({ data: response.data, error: null }))
        .catch(handleError);
};