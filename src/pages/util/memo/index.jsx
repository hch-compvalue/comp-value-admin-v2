import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pin, PinOff, Pencil, Trash2, Search, X, Tag } from 'lucide-react';
import PageTitle from '@/component/common/display/PageTitle';
import Loading from '@/component/common/display/Loading';
import { send } from '@/util/ClientUtil';

// ── 날짜 포맷 ──
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ── 삭제 확인 모달 ──
function ConfirmDialog({ open, message, onConfirm, onCancel }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
            <div
                className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
                onClick={(e) => e.stopPropagation()}
            >
                <p className="mb-6 text-sm text-slate-700 dark:text-slate-200">{message}</p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                        취소
                    </button>
                    <button
                        onClick={onConfirm}
                        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
                    >
                        삭제
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 메모 카드 ──
function MemoCard({ memo, onEdit, onDelete, onTogglePin }) {
    return (
        <div
            className={`group relative flex flex-col rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-800 ${
                memo.pinned
                    ? 'border-l-4 border-sky-500 dark:border-sky-400'
                    : 'border-slate-200 dark:border-slate-700'
            }`}
        >
            {/* 헤더: 제목 + 액션 버튼 */}
            <div className="mb-2 flex items-start justify-between gap-2">
                <h3
                    className="line-clamp-1 cursor-pointer text-base font-semibold text-slate-900 dark:text-white"
                    onClick={() => onEdit(memo)}
                >
                    {memo.title || '(제목 없음)'}
                </h3>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                        onClick={() => onTogglePin(memo)}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-500 dark:hover:bg-slate-700 dark:hover:text-sky-400"
                        title={memo.pinned ? '고정 해제' : '고정'}
                    >
                        {memo.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </button>
                    <button
                        onClick={() => onEdit(memo)}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-500 dark:hover:bg-slate-700 dark:hover:text-sky-400"
                        title="수정"
                    >
                        <Pencil className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onDelete(memo)}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-orange-500 dark:hover:bg-slate-700 dark:hover:text-orange-400"
                        title="삭제"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* 내용 미리보기 */}
            <p
                className="mb-3 line-clamp-3 flex-1 cursor-pointer whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300"
                onClick={() => onEdit(memo)}
            >
                {memo.content || '(내용 없음)'}
            </p>

            {/* 하단: 카테고리 + 날짜 */}
            <div className="flex items-center justify-between gap-2">
                {memo.category ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                        <Tag className="h-3 w-3" />
                        {memo.category}
                    </span>
                ) : (
                    <span />
                )}
                <span className="text-xs text-slate-400 dark:text-slate-500">
                    {formatDate(memo.updatedAt || memo.createdAt)}
                </span>
            </div>
        </div>
    );
}

// ── 메모 작성/수정 모달 ──
function MemoModal({ open, memo, categories, onClose, onSave }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('');
    const [customCategory, setCustomCategory] = useState('');
    const [useCustomCategory, setUseCustomCategory] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [saving, setSaving] = useState(false);
    const titleRef = useRef(null);

    const isEdit = !!memo;

    useEffect(() => {
        if (open) {
            if (memo) {
                setTitle(memo.title || '');
                setContent(memo.content || '');
                setPinned(!!memo.pinned);
                // 카테고리가 기존 목록에 있으면 select, 없으면 직접입력
                if (memo.category && !categories.includes(memo.category)) {
                    setUseCustomCategory(true);
                    setCustomCategory(memo.category);
                    setCategory('');
                } else {
                    setUseCustomCategory(false);
                    setCategory(memo.category || '');
                    setCustomCategory('');
                }
            } else {
                setTitle('');
                setContent('');
                setCategory('');
                setCustomCategory('');
                setUseCustomCategory(false);
                setPinned(false);
            }
            // 모달 열릴 때 제목 포커스
            setTimeout(() => titleRef.current?.focus(), 100);
        }
    }, [open, memo, categories]);

    const handleCategorySelectChange = (value) => {
        if (value === '__custom__') {
            setUseCustomCategory(true);
            setCategory('');
        } else {
            setUseCustomCategory(false);
            setCategory(value);
            setCustomCategory('');
        }
    };

    const handleSave = async () => {
        const finalCategory = useCustomCategory ? customCategory.trim() : category;
        setSaving(true);
        await onSave({
            ...(memo ? { id: memo.id } : {}),
            title: title.trim(),
            content: content.trim(),
            category: finalCategory,
            pinned,
        });
        setSaving(false);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {isEdit ? '메모 수정' : '새 메모'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* 제목 */}
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">제목</label>
                        <input
                            ref={titleRef}
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="메모 제목"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:focus:border-sky-400 dark:focus:ring-sky-400"
                        />
                    </div>

                    {/* 내용 */}
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">내용</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="메모 내용을 입력하세요"
                            rows={8}
                            className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:focus:border-sky-400 dark:focus:ring-sky-400"
                        />
                    </div>

                    {/* 카테고리 */}
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">카테고리</label>
                        {!useCustomCategory ? (
                            <select
                                value={category}
                                onChange={(e) => handleCategorySelectChange(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:focus:border-sky-400 dark:focus:ring-sky-400"
                            >
                                <option value="">없음</option>
                                {categories.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                                <option value="__custom__">+ 직접 입력</option>
                            </select>
                        ) : (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                    placeholder="새 카테고리 이름"
                                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:focus:border-sky-400 dark:focus:ring-sky-400"
                                    autoFocus
                                />
                                <button
                                    onClick={() => {
                                        setUseCustomCategory(false);
                                        setCustomCategory('');
                                    }}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                                >
                                    목록
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 고정 여부 */}
                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            checked={pinned}
                            onChange={(e) => setPinned(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500 dark:border-slate-600"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">상단 고정</span>
                    </label>
                </div>

                {/* 버튼 */}
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !title.trim()}
                        className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 메인 컴포넌트 ──
export default function Memo() {
    const [memos, setMemos] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null); // null = 전체
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingMemo, setEditingMemo] = useState(null); // null = 신규, object = 수정
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null });

    // ── 데이터 로드 ──
    const fetchMemos = useCallback(async () => {
        setLoading(true);
        const url = selectedCategory ? `/dart/memo?category=${encodeURIComponent(selectedCategory)}` : '/dart/memo';
        const { data, error } = await send(url, null, 'GET');
        if (!error && data?.response) {
            setMemos(data.response);
        }
        setLoading(false);
    }, [selectedCategory]);

    const fetchCategories = useCallback(async () => {
        const { data, error } = await send('/dart/memo/categories', null, 'GET');
        if (!error && data?.response) {
            setCategories(data.response);
        }
    }, []);

    useEffect(() => {
        fetchMemos();
    }, [fetchMemos]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    // ── 필터링 (클라이언트 사이드 검색) ──
    const filteredMemos = memos.filter((m) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (m.title && m.title.toLowerCase().includes(q)) ||
            (m.content && m.content.toLowerCase().includes(q))
        );
    });

    // ── 모달 열기/닫기 ──
    const openNewMemo = () => {
        setEditingMemo(null);
        setModalOpen(true);
    };

    const openEditMemo = (memo) => {
        setEditingMemo(memo);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingMemo(null);
    };

    // ── 저장 (생성/수정) ──
    const handleSave = async (formData) => {
        if (formData.id) {
            // 수정
            const { error } = await send('/dart/memo/modi', formData, 'PUT');
            if (error) return;
        } else {
            // 생성
            const { error } = await send('/dart/memo/regi', formData, 'POST');
            if (error) return;
        }
        closeModal();
        await fetchMemos();
        await fetchCategories();
    };

    // ── 삭제 ──
    const handleDeleteClick = (memo) => {
        setAlertConfig({
            open: true,
            message: `"${memo.title || '(제목 없음)'}" 메모를 삭제하시겠습니까?`,
            onConfirm: async () => {
                setAlertConfig({ open: false, message: '', onConfirm: null });
                const { error } = await send(`/dart/memo/${memo.id}`, null, 'DELETE');
                if (!error) {
                    setMemos((prev) => prev.filter((m) => m.id !== memo.id));
                    await fetchCategories();
                }
            },
        });
    };

    // ── 고정 토글 ──
    const handleTogglePin = async (memo) => {
        const { error } = await send('/dart/memo/modi', {
            id: memo.id,
            title: memo.title,
            content: memo.content,
            category: memo.category,
            pinned: !memo.pinned,
        }, 'PUT');
        if (!error) {
            await fetchMemos();
        }
    };

    return (
        <div>
            <PageTitle />
            <Loading show={loading} />

            {/* 필터 + 검색 + 새 메모 버튼 */}
            <div className="mb-6 space-y-3">
                {/* 카테고리 필터 */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                            selectedCategory === null
                                ? 'bg-sky-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                        }`}
                    >
                        전체
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                selectedCategory === cat
                                    ? 'bg-sky-500 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* 검색 + 새 메모 */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="제목 또는 내용으로 검색"
                            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 dark:focus:border-sky-400 dark:focus:ring-sky-400"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={openNewMemo}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-600"
                    >
                        <Plus className="h-4 w-4" />
                        새 메모
                    </button>
                </div>
            </div>

            {/* 메모 그리드 */}
            {!loading && filteredMemos.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 dark:border-slate-600">
                    <p className="mb-1 text-sm text-slate-500 dark:text-slate-400">
                        메모가 없습니다. 새 메모를 작성해보세요!
                    </p>
                    <button
                        onClick={openNewMemo}
                        className="mt-3 flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-600"
                    >
                        <Plus className="h-4 w-4" />
                        새 메모
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {filteredMemos.map((memo) => (
                    <MemoCard
                        key={memo.id}
                        memo={memo}
                        onEdit={openEditMemo}
                        onDelete={handleDeleteClick}
                        onTogglePin={handleTogglePin}
                    />
                ))}
            </div>

            {/* 메모 작성/수정 모달 */}
            <MemoModal
                open={modalOpen}
                memo={editingMemo}
                categories={categories}
                onClose={closeModal}
                onSave={handleSave}
            />

            {/* 삭제 확인 모달 */}
            <ConfirmDialog
                open={alertConfig.open}
                message={alertConfig.message}
                onConfirm={alertConfig.onConfirm}
                onCancel={() => setAlertConfig({ open: false, message: '', onConfirm: null })}
            />
        </div>
    );
}
