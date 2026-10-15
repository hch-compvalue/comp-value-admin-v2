# CompValue Frontend 프로젝트 규칙

## 기술 스택
- React 19 + Vite 6.3 + React Router 6.30
- Tailwind CSS v4, Recharts 2.15
- Lexical 0.20 (리치 텍스트), Axios 1.9, XLSX/ExcelJS

## 디렉토리 구조
```
/src
├── component/common/    # Button, Input, Select, Loading, PageTitle, ToggleSection
├── component/feature/   # board, home 등 기능별
├── component/layouts/   # Header, SideBar, Modal
├── config/              # routes.jsx, PrivateRoutes
├── context/             # AuthContext, ThemeContext
├── hooks/               # useRole, useTransactions
├── pages/               # Home, Member, Trade, Transaction 등
└── util/                # ClientUtil, DateUtil, RoleUtil
```

## 핵심 패턴

### API 호출
```javascript
import { send } from '@/util/ClientUtil';
const { data, error } = await send(url, params, method);
```

### 인증
```javascript
const { isLoggedIn, userName, nickName, roles } = useAuth();
const { sessionTTL } = useSession(); // SessionContext에서 별도 관리
```

### 모달 패턴
```javascript
const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null });
```

## 네이밍 규칙
- 컴포넌트: PascalCase (`LoginModal.jsx`)
- 유틸: `기능Util` (`ClientUtil.jsx`)
- 훅: `use기능` (`useRole.js`)
- Context: `기능Context` (`AuthContext.jsx`)
- Import 별칭: `@/` 사용 (`import X from '@/util/ClientUtil'`)

## 코드 스타일
- React: 함수형 컴포넌트, 커스텀 훅, Tailwind CSS
- **동작은 동일, 코드는 짧고 읽기 쉽게, 주석은 동일**

## 개발
- `npm run dev` (개발), `npm run build` (빌드)
- 프록시: `/dart/` → `http://localhost:18080`

## 디자인 시스템
- UI 작업 시 반드시 `docs/DESIGN_SYSTEM.md`를 먼저 읽고 따를 것
- 새 컴포넌트 추가 시 디자인 시스템의 색상/폰트/애니메이션 규칙 준수

## 테이블 컬럼 필터 — 엑셀 스타일 공통 컴포넌트 필수 사용

**규칙**: 데이터 테이블에 컬럼 필터가 필요할 때는 **반드시** `@/component/common/table/ExcelFilter` 를 사용한다. 자체 입력창/드롭다운을 만들지 말 것.

### 왜
- 프로젝트 전반 UX 통일 (엑셀과 유사한 필터·정렬 드롭다운)
- 스크롤/리사이즈/외부 클릭/ESC 닫기, 뷰포트 경계 위치 보정, null 값 `(비어있음)` 라벨 처리 등이 이미 검증됨
- 중복 구현 시 유지보수 비용↑, 페이지 간 일관성↓

### 표준 사용 패턴 (`CointradeHistory` 참고)

```jsx
import ExcelFilter from '@/component/common/table/ExcelFilter';

// 컬럼 정의: 필요 시 표시 포맷용 getFilterLabel 추가
const TABLE_COLUMNS = [
    {
        key: 'accuracy',
        sortable: true,
        render: (v) => v != null ? `${(v * 100).toFixed(2)}%` : '-',
        getFilterLabel: (v) => (v == null ? '(비어있음)' : `${(v * 100).toFixed(2)}%`),
    },
    // ...
];

// 상태: columnFilters[key] = (string|null)[] | undefined  (undefined=필터 해제)
const [columnFilters, setColumnFilters] = useState({});
const [sortConfig, setSortConfig] = useState({ key: '...', direction: 'asc' });

// 핸들러
const handleColumnFilterChange = useCallback((key, selectedValues) => {
    setColumnFilters(prev => {
        const next = { ...prev };
        if (selectedValues === undefined) delete next[key];
        else next[key] = selectedValues;
        return next;
    });
}, []);

const handleSort = useCallback((key, direction) => {
    setSortConfig(prev => {
        if (direction) return { key, direction };  // 드롭다운에서 정렬 지정 시
        return { key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' };
    });
}, []);

// 컬럼별 원본 값 집합 (옵션 생성용)
const columnValuesMap = useMemo(() => {
    const map = {};
    TABLE_COLUMNS.forEach(col => { map[col.key] = records.map(r => r[col.key]); });
    return map;
}, [records]);

// 필터링 로직: 원본 값을 문자열화해 selectedValues와 매칭
const processedData = useMemo(() => records.filter(row => {
    return Object.entries(columnFilters).every(([key, selectedValues]) => {
        if (selectedValues === undefined) return true;
        if (selectedValues.length === 0) return false;
        const v = row[key];
        const k = v === null || v === undefined ? null : String(v);
        return selectedValues.some(sv => sv === null ? k === null : sv === k);
    });
}), [records, columnFilters]);

// 헤더 렌더링 — 라벨 옆에 <ExcelFilter> 배치
<ExcelFilter
    allValues={columnValuesMap[col.key] || []}
    selectedValues={columnFilters[col.key]}
    onApply={(values) => handleColumnFilterChange(col.key, values)}
    onSort={col.sortable ? (dir) => handleSort(col.key, dir) : undefined}
    sortDirection={sortConfig.key === col.key ? sortConfig.direction : null}
    getOptionLabel={col.getFilterLabel}
/>
```

### 금지
- 헤더에 자체 `<input type="text">` 열 추가해 부분일치 필터 구현
- 별도의 체크박스 드롭다운 컴포넌트 신규 작성
- `ColumnFilterDropdown`(엑셀 뷰어 내부용)을 테이블 페이지에서 사용

### 예외
- 엑셀 뷰어(`pages/util/excel-viewer`) 전용 `ColumnFilterDropdown`은 뷰어 내부 용도로만 유지 (다른 페이지에서 쓰지 말 것)
