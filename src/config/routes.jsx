import Home from '@/pages/Home'
import CompList from '@/pages/trade/CompList'
import FreeBoard from '@/pages/board/freeBoard/FreeBoard'
import FreeBoardList from '@/pages/board/freeBoard/List'
import NotFound from '@/pages/NotFound'
import FreeBoardView from '@/pages/board/freeBoard/View'
import FreeBoardUpdate from '@/pages/board/freeBoard/Update'
import Register from '@/pages/board/freeBoard/Register'
import CompValue from '@/pages/trade/CompValue'
import CompValueCustom from '@/pages/trade/CompValueCustom'
import TransactionOverview from '@/pages/transaction/TransactionOverview'
import AbroadCompValue from '@/pages/trade/AbroadCompValue'
import RecommendProfileSettings from '@/pages/trade/RecommendProfileSettings'
import MLRetrainManagement from '@/pages/trade/MLRetrainManagement'
import SellRecordHistory from '@/pages/trade/SellRecordHistory'
import InvestmentEvaluation from '@/pages/trade/InvestmentEvaluation'
import DailyPicks from '@/pages/trade/DailyPicks'
import EvaluationPerformance from '@/pages/trade/EvaluationPerformance'
import MyProfile from '@/pages/member/MyProfile'
import EditProfile from '@/pages/member/EditProfile'
import MemberManagement from '@/pages/member/MemberManagement'
import Join from '@/pages/member/Join'
import CointradeStrategy from '@/pages/cointrade/CointradeStrategy'
import CointradeHistory from '@/pages/cointrade/CointradeHistory'
// BacktestOptimizer 삭제됨 (v4.0 모멘텀 스캘핑 전환)
import ExcelViewer from '@/pages/util/excel-viewer'
import ExchangeRate from '@/pages/util/exchange-rate'
import JsonViewer from '@/pages/util/json-viewer'
import Memo from '@/pages/util/memo'
import Calculator from '@/pages/util/calculator'
import MonitoringDashboard from '@/pages/monitoring/MonitoringDashboard'
import SubTabPage from '@/component/common/layout/SubTabPage'
import LegacyRedirect from '@/component/common/layout/LegacyRedirect'
import { STOCK_DISCOVER_PATH, STOCK_ANALYSIS_PATH, PORTFOLIO_PATH, SUB_TAB } from '@/config/menuPaths'

import { SECTIONS } from '@/component/layouts/common/SideBar001';
import {
    Home as HomeIcon, List, BarChart3, Pencil, Sparkles, Brain, Briefcase,
    MessageSquare, LayoutDashboard,
    History, LineChart, FileSpreadsheet, DollarSign, Braces,
    StickyNote, Calculator as CalculatorIcon, Activity
} from 'lucide-react';

const routes = {

    "Home": {
        section: SECTIONS[0], label: 'Home', path: '/', element: <Home />, icon: HomeIcon
    },
    "NotFound": {
        section: 'None', show: false, label: 'NotFound', path: '*', element: <NotFound />
    },

    /* 회원정보 */
    "로그인": { section: '회원정보', label: '로그인', path: '/', element: <Home /> },
    "Join": { section: '회원정보', show: false, label: '회원가입', path: '/member/join', element: <Join /> },
    "MyProfile": { section: '회원정보', show: false, label: '내 정보', path: '/member/myprofile', element: <MyProfile /> },
    "EditProfile": { section: '회원정보', show: false, label: '회원정보 수정', path: '/member/myprofile/edit', element: <EditProfile /> },
    "MemberManagement": { section: '회원정보', show: false, label: '회원 관리 (관리자)', path: '/member/management', element: <MemberManagement /> },

    /* 기업분석(국내) — 2026-10 메뉴 숨김 (KIS 전환 시 새로 구현 예정, 그때 코드 삭제) */
    "CompList": { section: '기업분석(국내)', show: false, label: '기업목록', path: '/complist', element: <CompList />, icon: List },
    "CompValue": { section: '기업분석(국내)', show: false, label: '기업분석', path: '/compvalue', element: <CompValue />, icon: BarChart3 },
    "CompValueCustom": { section: '기업분석(국내)', show: false, label: '기업분석(수동)', path: '/compvalue/custom', element: <CompValueCustom />, icon: Pencil },

    /* 미국주식 — 발굴(매수후보·성과·프로파일 설정) / 분석(단건·일괄) / 포트폴리오(보유·매도) */
    "StockDiscover": {
        section: SECTIONS[1],
        label: '종목 발굴',
        path: STOCK_DISCOVER_PATH,
        icon: Sparkles,
        element: (
            <SubTabPage basePath={STOCK_DISCOVER_PATH} section={SECTIONS[1]} label='종목 발굴' tabs={[
                { key: SUB_TAB.DAILY_PICKS, label: '오늘의 매수후보', element: <DailyPicks /> },
                { key: SUB_TAB.PERFORMANCE, label: '성과 추적', element: <EvaluationPerformance /> },
                { key: SUB_TAB.PROFILE_SETTINGS, label: '프로파일 설정', element: <RecommendProfileSettings />, accessRoles: ['ROLE_SUPER_ADMIN'] },
            ]} />
        ),
    },
    "StockAnalysis": {
        section: SECTIONS[1],
        label: '종목 분석',
        path: STOCK_ANALYSIS_PATH,
        icon: BarChart3,
        element: (
            <SubTabPage basePath={STOCK_ANALYSIS_PATH} section={SECTIONS[1]} label='종목 분석' tabs={[
                { key: SUB_TAB.SEARCH, label: '종목 검색', element: <AbroadCompValue /> },
                { key: SUB_TAB.EVALUATE, label: '일괄 평가', element: <InvestmentEvaluation /> },
            ]} />
        ),
    },
    "Portfolio": {
        section: SECTIONS[1],
        label: '포트폴리오',
        path: PORTFOLIO_PATH,
        icon: Briefcase,
        element: (
            <SubTabPage basePath={PORTFOLIO_PATH} section={SECTIONS[1]} label='포트폴리오' tabs={[
                { key: SUB_TAB.HOLDINGS, label: '보유종목', element: <TransactionOverview /> },
                { key: SUB_TAB.SELL_RECORD, label: '매도기록', element: <SellRecordHistory /> },
            ]} />
        ),
    },

    /* 통합 전 경로 → 새 경로 (북마크 호환) */
    "LegacyAbroadCompanyList": { section: 'None', show: false, label: '이동 중', path: '/complist/abroad', element: <LegacyRedirect to={STOCK_DISCOVER_PATH} subTab={SUB_TAB.DAILY_PICKS} /> },
    "LegacyRecommended": { section: 'None', show: false, label: '이동 중', path: '/recommended/abroad', element: <LegacyRedirect to={STOCK_DISCOVER_PATH} subTab={SUB_TAB.DAILY_PICKS} /> },
    "LegacyDailyPicks": { section: 'None', show: false, label: '이동 중', path: '/trade/daily-picks', element: <LegacyRedirect to={STOCK_DISCOVER_PATH} subTab={SUB_TAB.DAILY_PICKS} /> },
    "LegacyPerformance": { section: 'None', show: false, label: '이동 중', path: '/trade/performance', element: <LegacyRedirect to={STOCK_DISCOVER_PATH} subTab={SUB_TAB.PERFORMANCE} /> },
    "LegacyAbroadCompValue": { section: 'None', show: false, label: '이동 중', path: '/compvalue/abroad', element: <LegacyRedirect to={STOCK_ANALYSIS_PATH} subTab={SUB_TAB.SEARCH} /> },
    "LegacyEvaluation": { section: 'None', show: false, label: '이동 중', path: '/trade/evaluation', element: <LegacyRedirect to={STOCK_ANALYSIS_PATH} subTab={SUB_TAB.EVALUATE} /> },
    "LegacyTransaction": { section: 'None', show: false, label: '이동 중', path: '/transaction/overview', element: <LegacyRedirect to={PORTFOLIO_PATH} subTab={SUB_TAB.HOLDINGS} /> },
    "LegacySellRecord": { section: 'None', show: false, label: '이동 중', path: '/trade/sellrecord', element: <LegacyRedirect to={PORTFOLIO_PATH} subTab={SUB_TAB.SELL_RECORD} /> },

    /* 게시판 */
    "FreeBoard": {
        section: SECTIONS[2],
        label: '자유게시판',
        path: '/freeboard/',
        element: <FreeBoard />,
        icon: MessageSquare,
        children: [
            { section: SECTIONS[2], show: false, label: '게시글목록', path: '', element: <FreeBoardList /> },
            { section: SECTIONS[2], show: false, label: '게시글등록', path: 'regi', element: <Register /> },
            { section: SECTIONS[2], show: false, label: '게시글삭제', path: 'delete' },
            { section: SECTIONS[2], show: false, label: '게시글상세', path: 'view/:id', element: <FreeBoardView /> },
            { section: SECTIONS[2], show: false, label: '게시글수정', path: 'modi/:id', element: <FreeBoardUpdate /> },
        ]
    },

    /* 코인 */
    // v5.0: 대시보드+스케줄러 통합. 파라미터 설정·대상 종목·ML·페이퍼 트레이딩 페이지는 메뉴 제거 (파일 삭제는 docs/phase4_plan.md 정리 단계)
    "CointradeStrategy": {
        section: SECTIONS[3],
        label: '자동매매 (BTC 추세)',
        path: '/cointrade/dashboard',
        element: <CointradeStrategy />,
        icon: LayoutDashboard,
        accessRoles: ['ROLE_SUPER_ADMIN']
    },
    "CointradeHistory": {
        section: SECTIONS[3],
        label: '거래기록 조회',
        path: '/cointrade/history',
        element: <CointradeHistory />,
        icon: History,
        accessRoles: ['ROLE_SUPER_ADMIN']
    },
    // BacktestOptimizer 라우트 삭제됨 (v4.0)

    /* 유틸 */
    "ExcelViewer": {
        section: SECTIONS[4],
        label: '엑셀 보기',
        path: '/util/excel-viewer',
        element: <ExcelViewer />,
        icon: FileSpreadsheet
    },
    "ExchangeRate": {
        section: SECTIONS[4],
        label: '환율 계산기',
        path: '/util/exchange-rate',
        element: <ExchangeRate />,
        icon: DollarSign
    },
    "JsonViewer": {
        section: SECTIONS[4],
        label: 'JSON 뷰어',
        path: '/util/json-viewer',
        element: <JsonViewer />,
        icon: Braces
    },
    "Memo": {
        section: SECTIONS[4],
        label: '메모',
        path: '/util/memo',
        element: <Memo />,
        icon: StickyNote
    },
    "Calculator": {
        section: SECTIONS[4],
        label: '계산기',
        path: '/util/calculator',
        element: <Calculator />,
        icon: CalculatorIcon
    },

    /* 관리 */
    "MonitoringDashboard": {
        section: SECTIONS[5],
        label: '실시간 대시보드',
        path: '/monitoring',
        element: <MonitoringDashboard />,
        icon: Activity,
        accessRoles: ['ROLE_SUPER_ADMIN']
    },
    "MLRetrainManagement": { section: SECTIONS[5], label: 'AI 모델 관리', path: '/ml/retrain', element: <MLRetrainManagement />, icon: Brain },
}

export default routes
