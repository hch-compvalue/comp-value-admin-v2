import { FileSpreadsheet, RotateCcw } from 'lucide-react';
import PageTitle from '@/component/common/display/PageTitle';
import Loading from '@/component/common/display/Loading';
import useExcelParser from './hooks/useExcelParser';
import ExcelDropZone from './components/ExcelDropZone';
import SheetTabs from './components/SheetTabs';
import ExcelTable from './components/ExcelTable';

export default function ExcelViewer() {
    const {
        sheetNames,
        activeSheet,
        sheetData,
        cellColors,
        loading,
        error,
        fileName,
        rowCount,
        colCount,
        parseFile,
        changeSheet,
        reset,
    } = useExcelParser();

    const hasData = sheetData.length > 0;

    return (
        <div>
            <PageTitle />
            <Loading show={loading} />

            {error && (
                <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                    {error}
                </div>
            )}

            {!hasData && !loading && (
                <ExcelDropZone onFile={parseFile} />
            )}

            {hasData && (
                <div className="space-y-4">
                    {/* 메타 정보 + 다른 파일 열기 */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                            <FileSpreadsheet className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                            <span className="font-medium">{fileName}</span>
                            <span className="text-slate-400 dark:text-slate-500">|</span>
                            <span>{rowCount}행 x {colCount}열</span>
                            {sheetNames.length > 1 && (
                                <>
                                    <span className="text-slate-400 dark:text-slate-500">|</span>
                                    <span>{sheetNames.length}개 시트</span>
                                </>
                            )}
                        </div>
                        <button
                            onClick={reset}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            다른 파일 열기
                        </button>
                    </div>

                    {/* 시트 탭 */}
                    <SheetTabs
                        sheetNames={sheetNames}
                        activeSheet={activeSheet}
                        onChangeSheet={changeSheet}
                    />

                    {/* 테이블 */}
                    <ExcelTable data={sheetData} cellColors={cellColors} />
                </div>
            )}
        </div>
    );
}
