import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import '@/App.css'

import Layout from '@/component/layouts/Layout001'
import routes from '@/config/routes'
import PrivateRoute from '@/config/PrivateRoutes';
import Loading from '@/component/common/display/Loading';
import LogStreamViewer from '@/component/feature/log/LogStreamViewer';

import { send } from '@/util/ClientUtil';

function App() {

  // const location = useLocation(); // 현재 URL 경로를 가져옴
  // const navigate = useNavigate(); // 리다이렉트를 위해 필요
  // const { setIsLoggedIn } = useAuth(); // 로그인 상태 변경 함수
  // const [isCheckingLogin, setIsCheckingLogin] = useState(true); // 로그인 확인 중 상태

  // // 🔒 로그인 여부 체크: 페이지 이동 시마다 실행됨
  // useEffect(() => {
  //   const checkLogin = async () => {
  //     // 서버에 로그인 상태 확인 요청
  //     const { data, error } = await send('/dart/member/me', {}, 'GET');

  //     if (data && data.success) {

  //       setIsLoggedIn(true);  // 로그인 되어있다면 상태 true로 설정

  //     } else {

  //       setIsLoggedIn(false); // 아니면 false로

  //       if (location.pathname !== '/') {
  //         alert('로그인이 필요합니다.');
  //         navigate('/');
  //       }
  //     }
  //     setIsCheckingLogin(false);
  //   };

  //   checkLogin(); // 처음 로딩되거나 URL 변경될 때마다 로그인 체크

  // }, [location.pathname]); // location.pathname이 변경될 때마다 useEffect 실행됨

  // // 로그인 확인 중이면 아무것도 렌더링하지 않음 (또는 로딩 UI)
  // if (isCheckingLogin) {
  //   return (
  //     <>
  //       <Loading show={true} />
  //     </>
  //   );
  // }

  // 라우트 설정: routes 객체를 기반으로 Route 컴포넌트 생성
  function renderRoutes(routes) {
    return Object.entries(routes).map(([key, route]) => (
      <Route key={key} path={route.path} element={<PrivateRoute children={route.element} />}>
        {route.children && renderRoutesFromArray(route.children)}
      </Route>
    ));
  }

  // 중첩 라우트가 있을 경우 재귀적으로 처리
  function renderRoutesFromArray(children) {
    return children.map((child, idx) => (
      <Route key={idx} path={child.path} element={<PrivateRoute children={child.element} />}>
        {child.children && renderRoutesFromArray(child.children)}
      </Route>
    ));
  }

  return (
    // 최상위 라우팅 설정: "/" 경로에 Layout 컴포넌트를 기본으로 두고 그 내부에 라우트 렌더링
    <Routes>
      {/* 레이아웃 없이 렌더링되는 팝업 페이지 */}
      <Route path="/member/logstream" element={<PrivateRoute children={<LogStreamViewer sourceKey="app" />} />} />
      <Route path="/member/ml-logstream" element={<PrivateRoute children={<LogStreamViewer sourceKey="ml" />} />} />
      <Route path="/member/cointrade-logstream" element={<PrivateRoute children={<LogStreamViewer sourceKey="cointrade" />} />} />

      {/* 일반 페이지들 (레이아웃 포함) */}
      <Route path="/" element={<Layout />}>
        {renderRoutes(routes)}
      </Route>
    </Routes>
  )
}

export default App
