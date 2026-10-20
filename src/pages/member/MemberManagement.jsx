import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { send } from '@/util/ClientUtil';
import { useAuth } from '@/context/AuthContext';
import useModalAnimation from '@/hooks/useModalAnimation';
import PageTitle from '@/component/common/display/PageTitle';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import RoleManagementModal from '@/component/layouts/common/popup/RoleManagementModal';
import Input from '@/component/common/input/Input';
import Button from '@/component/common/button/Button';

// 테이블 컬럼 너비 상수
const COLUMN_WIDTHS = {
    id: 'w-20',           // 회원번호
    username: 'w-32',     // 사용자 ID
    nickname: 'w-28',     // 닉네임
    email: 'w-48',        // 이메일
    roles: 'w-32',        // 권한
    approvalStatus: 'w-24', // 승인상태
    createdAt: 'w-28',    // 가입일
    actions: 'w-44'       // 관리 버튼
};

export default function MemberManagement() {
    const navigate = useNavigate();
    const { roles: currentUserRoles, userName, setNickName } = useAuth();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null, onAfterClose: null });

    // 페이징 상태
    const [pageNumber, setPageNumber] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // 검색 조건 상태
    const [searchParams, setSearchParams] = useState({
        username: '',
        email: '',
        nickname: '',
        createdAtStart: '',
        createdAtEnd: '',
        approvalStatus: '',
        roleName: ''
    });

    const [showSearchForm, setShowSearchForm] = useState(false);
    const { shouldRender: showSearch, isAnimatingOut: isSearchClosing } = useModalAnimation(showSearchForm, 200);
    const [roles, setRoles] = useState([]);
    const [roleModalOpen, setRoleModalOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState(null);

    // 회원 탈퇴 확인 모달 상태
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const { shouldRender: renderDeleteModal, isAnimatingOut: isDeleteModalClosing } = useModalAnimation(deleteModalOpen, 250);
    const [deleteTargetMember, setDeleteTargetMember] = useState(null);
    const [deleteConfirmUsername, setDeleteConfirmUsername] = useState('');

    // 회원 수정 모달 상태
    const [editModalOpen, setEditModalOpen] = useState(false);
    const { shouldRender: renderEditModal, isAnimatingOut: isEditModalClosing } = useModalAnimation(editModalOpen, 250);
    const [editTargetMember, setEditTargetMember] = useState(null);
    const [editEmail, setEditEmail] = useState('');
    const [editNickname, setEditNickname] = useState('');
    const [editLoading, setEditLoading] = useState(false);

    const openAlert = (message, onConfirm = null, onAfterClose = null) => {
        setAlertConfig({ open: true, message, onConfirm, onAfterClose });
    };

    const handleCloseAlert = () => {
        setAlertConfig({ open: false, message: '', onConfirm: null, onAfterClose: null });
    };

    useEffect(() => {
        fetchRoles();
        fetchMembers();
    }, [pageNumber, pageSize]);

    const fetchRoles = async () => {
        try {
            const { data, error } = await send('/dart/role', {}, 'GET');
            if (!error && data?.success && data?.response) {
                const roleList = Array.isArray(data.response) ? data.response : [];
                setRoles(roleList);
            } else {
                setRoles([]);
            }
        } catch (e) {
            console.error('권한 목록 조회 실패:', e);
            setRoles([]);
        }
    };

    const fetchMembers = async () => {

        setLoading(true);
        try {
            const requestData = {
                pageSize,
                pageNumber,
                ...Object.fromEntries(
                    Object.entries(searchParams).filter(([_, v]) => v !== '')
                )
            };

            const { data, error } = await send('/dart/member/list', requestData, 'POST');

            if (error) {
                openAlert(error);
            } else if (data?.success && data?.response) {
                const response = data.response;
                setMembers(response.members || []);
                setTotalElements(response.totalCount || 0);
                setTotalPages(response.totalPages || 0);
            }
        } catch (e) {
            console.error('회원 목록 조회 실패:', e);
            openAlert('회원 목록을 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        setPageNumber(0);
        fetchMembers();
    };

    const handleResetSearch = () => {
        setSearchParams({
            username: '',
            email: '',
            nickname: '',
            createdAtStart: '',
            createdAtEnd: '',
            approvalStatus: '',
            roleName: ''
        });
        setPageNumber(0);
        setTimeout(() => fetchMembers(), 0);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 0 && newPage < totalPages) {
            setPageNumber(newPage);
        }
    };

    const handleToggleApproval = async (member) => {
        const newStatus = member.approvalStatus === 'Y' ? 'N' : 'Y';
        const statusText = newStatus === 'Y' ? '승인' : '미승인';

        openAlert(
            `${member.nickname || member.username} 회원을 ${statusText} 상태로 변경하시겠습니까?`,
            async () => {
                try {
                    const { data, error } = await send('/dart/member/update/approval', {
                        id: member.id,
                        approvalStatus: newStatus
                    }, 'POST');

                    if (error) {
                        setTimeout(() => {
                            openAlert(error);
                        }, 100);
                    } else if (data?.success) {
                        setTimeout(() => {
                            openAlert(`${statusText} 처리가 완료되었습니다.`);
                        }, 100);
                        // 목록 새로고침
                        fetchMembers();
                    }
                } catch (e) {
                    console.error('승인 상태 변경 실패:', e);
                    setTimeout(() => {
                        openAlert('승인 상태 변경 중 오류가 발생했습니다.');
                    }, 100);
                }
            }
        );
    };

    const handleReject = (member) => {
        // 슈퍼관리자 권한 체크
        if (!isSuperAdmin()) {
            openAlert('회원 탈퇴 처리는 슈퍼관리자만 가능합니다.');
            return;
        }

        // 탈퇴 확인 모달 열기
        setDeleteTargetMember(member);
        setDeleteConfirmUsername('');
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        // 사용자명 확인
        if (deleteConfirmUsername !== deleteTargetMember.username) {
            openAlert('사용자 ID가 일치하지 않습니다.');
            return;
        }

        setDeleteModalOpen(false);

        const { data, error } = await send('/dart/member/admin/delete', {
            memberId: deleteTargetMember.id
        }, 'POST');

        if (error) {
            setTimeout(() => {
                openAlert(error);
            }, 100);
        } else if (data?.success) {
            // 성공 메시지 표시
            setTimeout(() => {
                openAlert('회원 탈퇴 처리가 완료되었습니다.', null, fetchMembers);
            }, 100);
        } else {
            setTimeout(() => {
                openAlert(data?.message || '회원 탈퇴 처리에 실패했습니다.');
            }, 100);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteModalOpen(false);
        setDeleteTargetMember(null);
        setDeleteConfirmUsername('');
    };

    const handleEdit = (member) => {
        setEditTargetMember(member);
        setEditEmail(member.email || '');
        setEditNickname(member.nickname || '');
        setEditModalOpen(true);
    };

    const handleEditSave = async () => {
        if (!editEmail.trim() && !editNickname.trim()) {
            openAlert('이메일 또는 닉네임 중 하나는 입력해야 합니다.');
            return;
        }

        setEditLoading(true);
        try {
            const { data, error } = await send('/dart/member/admin/update', {
                memberId: editTargetMember.id,
                email: editEmail.trim(),
                nickname: editNickname.trim()
            }, 'POST');

            if (error) {
                openAlert(error);
            } else if (data?.success) {
                // 자기 자신을 수정한 경우 헤더의 닉네임 업데이트
                if (editTargetMember.username === userName && editNickname.trim()) {
                    setNickName(editNickname.trim());
                    localStorage.setItem('nickName', editNickname.trim());
                }

                setEditModalOpen(false);
                openAlert('회원 정보가 수정되었습니다.', null, fetchMembers);
            } else {
                openAlert(data?.message || '회원 정보 수정에 실패했습니다.');
            }
        } catch (e) {
            console.error('회원 정보 수정 실패:', e);
            openAlert('회원 정보 수정 중 오류가 발생했습니다.');
        } finally {
            setEditLoading(false);
        }
    };

    const handleEditCancel = () => {
        setEditModalOpen(false);
        setEditTargetMember(null);
        setEditEmail('');
        setEditNickname('');
    };

    const handleChangeRole = (member) => {
        // 슈퍼관리자 권한 체크
        if (!isSuperAdmin()) {
            openAlert('권한 관리는 슈퍼관리자만 가능합니다.');
            return;
        }
        setSelectedMember(member);
        setRoleModalOpen(true);
    };

    const isSuperAdmin = () => {
        return currentUserRoles && currentUserRoles.includes('ROLE_SUPER_ADMIN');
    };

    const handleSaveRoles = async (member, addedRoles, removedRoles) => {
        try {
            // 권한 삭제 처리
            for (const roleName of removedRoles) {
                const role = roles.find(r => r.roleName === roleName);
                if (role) {
                    const { error } = await send(`/dart/role/member/${member.id}/role/${role.id}`, {}, 'DELETE');
                    if (error) {
                        openAlert(`권한 삭제 실패: ${error}`);
                        return;
                    }
                }
            }

            // 권한 추가 처리
            for (const roleName of addedRoles) {
                const role = roles.find(r => r.roleName === roleName);
                if (role) {
                    const { error } = await send(`/dart/role/member/${member.id}/role/${role.id}`, {}, 'POST');
                    if (error) {
                        openAlert(`권한 추가 실패: ${error}`);
                        return;
                    }
                }
            }

            openAlert('권한이 성공적으로 변경되었습니다.');
            setRoleModalOpen(false);
            setSelectedMember(null);
            fetchMembers();
        } catch (e) {
            console.error('권한 변경 실패:', e);
            openAlert('권한 변경 중 오류가 발생했습니다.');
        }
    };

    const handleCloseRoleModal = () => {
        setRoleModalOpen(false);
        setSelectedMember(null);
    };

    const getRoleDisplayName = (roleName) => {
        // 기본 표시명 매핑
        const defaultNames = {
            'ROLE_SUPER_ADMIN': '슈퍼관리자',
            'ROLE_ADMIN': '관리자',
            'ROLE_USER': '일반사용자'
        };

        // roles 배열에서 찾기 시도
        const role = roles.find(r => r.roleName === roleName);

        if (role) {
            // API 응답에서 description 필드 사용 (roleDisplayName이 아님)
            return role.description || role.roleDisplayName || defaultNames[roleName] || roleName.replace('ROLE_', '');
        }

        // roles 배열에 없으면 기본 표시명 사용
        return defaultNames[roleName] || roleName.replace('ROLE_', '');
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getApprovalStatusBadge = (status, onClick) => {
        if (status === 'Y') {
            return (
                <button
                    onClick={onClick}
                    className="px-2 py-0.5 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-900/50 rounded text-xs font-medium transition-colors cursor-pointer"
                    title="클릭하여 미승인으로 변경"
                >
                    승인
                </button>
            );
        } else if (status === 'N') {
            return (
                <button
                    onClick={onClick}
                    className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded text-xs font-medium transition-colors cursor-pointer"
                    title="클릭하여 승인으로 변경"
                >
                    미승인
                </button>
            );
        }
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded text-xs font-medium">{status || '-'}</span>;
    };

    return (
        <>
            <PageTitle />

            <div className="space-y-6 px-4 py-8">
                {/* 헤더 */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                            aria-label="뒤로가기"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">회원 관리</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                전체 {totalElements.toLocaleString()}명
                            </p>
                        </div>
                    </div>
                    <Button onClick={() => setShowSearchForm(!showSearchForm)}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        검색 {showSearchForm ? '닫기' : '열기'}
                    </Button>
                </div>

                {/* 검색 폼 */}
                {showSearch && (
                    <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 animate__animated ${isSearchClosing ? 'animate__fadeOutUp' : 'animate__fadeInDown'}`} style={{ animationDuration: '0.2s' }}>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">검색 조건</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    사용자 ID
                                </label>
                                <input
                                    type="text"
                                    value={searchParams.username}
                                    onChange={(e) => setSearchParams({ ...searchParams, username: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="사용자 ID"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    이메일
                                </label>
                                <input
                                    type="text"
                                    value={searchParams.email}
                                    onChange={(e) => setSearchParams({ ...searchParams, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="이메일"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    닉네임
                                </label>
                                <input
                                    type="text"
                                    value={searchParams.nickname}
                                    onChange={(e) => setSearchParams({ ...searchParams, nickname: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="닉네임"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    가입일 시작
                                </label>
                                <input
                                    type="date"
                                    value={searchParams.createdAtStart}
                                    onChange={(e) => setSearchParams({ ...searchParams, createdAtStart: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    가입일 종료
                                </label>
                                <input
                                    type="date"
                                    value={searchParams.createdAtEnd}
                                    onChange={(e) => setSearchParams({ ...searchParams, createdAtEnd: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    승인 상태
                                </label>
                                <select
                                    value={searchParams.approvalStatus}
                                    onChange={(e) => setSearchParams({ ...searchParams, approvalStatus: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">전체</option>
                                    <option value="Y">승인</option>
                                    <option value="N">미승인</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    권한
                                </label>
                                <select
                                    value={searchParams.roleName}
                                    onChange={(e) => setSearchParams({ ...searchParams, roleName: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">전체</option>
                                    {roles.map(role => (
                                        <option key={role.roleName} value={role.roleName}>
                                            {role.description || role.roleDisplayName || role.roleName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="secondary" onClick={handleResetSearch}>
                                초기화
                            </Button>
                            <Button onClick={handleSearch}>
                                검색
                            </Button>
                        </div>
                    </div>
                )}

                {/* 회원 목록 테이블 */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">회원 목록을 불러오는 중...</p>
                            </div>
                        </div>
                    ) : members.length === 0 ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="text-center">
                                <svg className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                <p className="text-lg font-medium text-slate-700 dark:text-slate-300">회원이 없습니다</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto scrollbar-always">
                                <table className="w-full min-w-[1000px]">
                                    <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className={`px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 ${COLUMN_WIDTHS.id}`}>
                                                회원번호
                                            </th>
                                            <th className={`px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 ${COLUMN_WIDTHS.username}`}>
                                                사용자 ID
                                            </th>
                                            <th className={`px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 ${COLUMN_WIDTHS.nickname}`}>
                                                닉네임
                                            </th>
                                            <th className={`px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 ${COLUMN_WIDTHS.email}`}>
                                                이메일
                                            </th>
                                            <th className={`px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 ${COLUMN_WIDTHS.roles}`}>
                                                권한
                                            </th>
                                            <th className={`px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 ${COLUMN_WIDTHS.approvalStatus}`}>
                                                승인상태
                                            </th>
                                            <th className={`px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 ${COLUMN_WIDTHS.createdAt}`}>
                                                가입일
                                            </th>
                                            <th className={`px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 ${COLUMN_WIDTHS.actions}`}>
                                                관리
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {members.map((member) => (
                                            <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className={`px-4 py-3 text-sm text-slate-900 dark:text-white ${COLUMN_WIDTHS.id}`}>
                                                    {member.id}
                                                </td>
                                                <td className={`px-4 py-3 text-sm font-medium text-slate-900 dark:text-white ${COLUMN_WIDTHS.username}`}>
                                                    {member.username}
                                                </td>
                                                <td className={`px-4 py-3 text-sm text-slate-900 dark:text-white ${COLUMN_WIDTHS.nickname}`}>
                                                    {member.nickname || '-'}
                                                </td>
                                                <td className={`px-4 py-3 text-sm text-slate-600 dark:text-slate-400 ${COLUMN_WIDTHS.email}`}>
                                                    {member.email || '-'}
                                                </td>
                                                <td className={`px-4 py-3 text-sm ${COLUMN_WIDTHS.roles}`}>
                                                    <div className="flex flex-wrap gap-1">
                                                        {member.roles && member.roles.length > 0 ? (
                                                            member.roles.map((role, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs font-medium"
                                                                >
                                                                    {getRoleDisplayName(role)}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-slate-400 dark:text-slate-500">-</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className={`px-4 py-3 text-sm ${COLUMN_WIDTHS.approvalStatus}`}>
                                                    {getApprovalStatusBadge(member.approvalStatus, () => handleToggleApproval(member))}
                                                </td>
                                                <td className={`px-4 py-3 text-sm text-slate-600 dark:text-slate-400 ${COLUMN_WIDTHS.createdAt}`}>
                                                    {formatDate(member.createdAt)}
                                                </td>
                                                <td className={`px-4 py-3 text-sm ${COLUMN_WIDTHS.actions}`}>
                                                    <div className="flex flex-wrap gap-1 items-center">
                                                        <button
                                                            onClick={() => handleEdit(member)}
                                                            className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 rounded text-xs font-medium transition-colors"
                                                            title="수정"
                                                        >
                                                            수정
                                                        </button>
                                                        {isSuperAdmin() ? (
                                                            <button
                                                                onClick={() => handleChangeRole(member)}
                                                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded text-xs font-medium transition-colors"
                                                                title="권한"
                                                            >
                                                                권한
                                                            </button>
                                                        ) : (
                                                            <button
                                                                disabled
                                                                className="px-2 py-1 bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500 rounded text-xs font-medium cursor-not-allowed"
                                                                title="슈퍼관리자만 권한 관리 가능"
                                                            >
                                                                권한
                                                            </button>
                                                        )}
                                                        {isSuperAdmin() ? (
                                                            <button
                                                                onClick={() => handleReject(member)}
                                                                className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-400 rounded text-xs font-medium transition-colors"
                                                                title="탈퇴"
                                                            >
                                                                탈퇴
                                                            </button>
                                                        ) : (
                                                            <button
                                                                disabled
                                                                className="px-2 py-1 bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500 rounded text-xs font-medium cursor-not-allowed"
                                                                title="슈퍼관리자만 회원 탈퇴 가능"
                                                            >
                                                                탈퇴
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* 페이징 */}
                            <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    {/* 페이지 정보 */}
                                    <div className="text-sm text-slate-600 dark:text-slate-400 order-1 sm:order-1">
                                        {totalElements > 0 ? (
                                            <>
                                                <span className="font-medium text-slate-900 dark:text-white">
                                                    {pageNumber * pageSize + 1}
                                                </span>
                                                {' - '}
                                                <span className="font-medium text-slate-900 dark:text-white">
                                                    {Math.min((pageNumber + 1) * pageSize, totalElements)}
                                                </span>
                                                {' / '}
                                                <span className="font-medium text-slate-900 dark:text-white">
                                                    {totalElements.toLocaleString()}
                                                </span>
                                                {' 명'}
                                            </>
                                        ) : (
                                            '0 명'
                                        )}
                                    </div>

                                    {/* 페이지 버튼 */}
                                    <div className="flex items-center gap-2 order-3 sm:order-2">
                                        <button
                                            onClick={() => handlePageChange(0)}
                                            disabled={pageNumber === 0}
                                            className="px-3 py-1 text-sm font-medium border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            처음
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(pageNumber - 1)}
                                            disabled={pageNumber === 0}
                                            className="px-3 py-1 text-sm font-medium border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            이전
                                        </button>
                                        <span className="px-4 py-1 text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                            {pageNumber + 1} / {totalPages || 1}
                                        </span>
                                        <button
                                            onClick={() => handlePageChange(pageNumber + 1)}
                                            disabled={pageNumber >= totalPages - 1}
                                            className="px-3 py-1 text-sm font-medium border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            다음
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(totalPages - 1)}
                                            disabled={pageNumber >= totalPages - 1}
                                            className="px-3 py-1 text-sm font-medium border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            마지막
                                        </button>
                                    </div>

                                    {/* 페이지 사이즈 선택 */}
                                    <div className="flex items-center gap-2 order-2 sm:order-3">
                                        <label className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                            페이지 크기:
                                        </label>
                                        <select
                                            value={pageSize}
                                            onChange={(e) => {
                                                setPageSize(Number(e.target.value));
                                                setPageNumber(0);
                                            }}
                                            className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        >
                                            <option value={10}>10</option>
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <AlertModal
                open={alertConfig.open}
                message={alertConfig.message}
                onClose={handleCloseAlert}
                onConfirm={alertConfig.onConfirm}
                onAfterClose={alertConfig.onAfterClose}
            />

            <RoleManagementModal
                open={roleModalOpen}
                member={selectedMember}
                allRoles={roles}
                onClose={handleCloseRoleModal}
                onSave={handleSaveRoles}
            />

            {/* 회원 탈퇴 확인 모달 */}
            {renderDeleteModal && deleteTargetMember && (
                <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 px-4 animate__animated ${isDeleteModalClosing ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }}>
                    <div className={`w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-xl ring-1 ring-slate-900/5 dark:bg-slate-800 dark:text-white dark:ring-slate-700 animate__animated ${isDeleteModalClosing ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }}>
                        <h2 className="mb-4 text-lg font-semibold text-orange-600 dark:text-orange-400">회원 강제탈퇴 확인</h2>

                        <div className="mb-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">회원번호:</span>
                                    <span className="font-medium">{deleteTargetMember.id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">사용자 ID:</span>
                                    <span className="font-medium">{deleteTargetMember.username}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">닉네임:</span>
                                    <span className="font-medium">{deleteTargetMember.nickname || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">이메일:</span>
                                    <span className="font-medium">{deleteTargetMember.email || '-'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mb-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 p-3">
                            <p className="text-sm text-orange-600 dark:text-orange-400">
                                이 작업은 되돌릴 수 없습니다.<br />
                                회원의 모든 데이터가 영구적으로 삭제됩니다.
                            </p>
                        </div>

                        <div className="mb-5">
                            <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                확인을 위해 사용자 ID를 입력해주세요:
                            </label>
                            <Input
                                value={deleteConfirmUsername}
                                onChange={e => setDeleteConfirmUsername(e.target.value)}
                                placeholder={deleteTargetMember.username}
                                wdfull={true}
                                onEnter={handleDeleteConfirm}
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                입력할 ID: <span className="font-mono font-semibold">{deleteTargetMember.username}</span>
                            </p>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={handleDeleteCancel}>
                                취소
                            </Button>
                            <Button variant="danger" onClick={handleDeleteConfirm} disabled={deleteConfirmUsername !== deleteTargetMember.username}>
                                탈퇴 처리
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 회원 정보 수정 모달 */}
            {renderEditModal && editTargetMember && (
                <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 px-4 animate__animated ${isEditModalClosing ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }}>
                    <div className={`w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-xl ring-1 ring-slate-900/5 dark:bg-slate-800 dark:text-white dark:ring-slate-700 animate__animated ${isEditModalClosing ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }}>
                        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">회원 정보 수정</h2>

                        <div className="mb-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">회원번호:</span>
                                    <span className="font-medium">{editTargetMember.id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">사용자 ID:</span>
                                    <span className="font-medium">{editTargetMember.username}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 mb-5">
                            <div>
                                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                    이메일
                                </label>
                                <Input
                                    type="email"
                                    value={editEmail}
                                    onChange={e => setEditEmail(e.target.value)}
                                    placeholder="이메일을 입력하세요"
                                    wdfull={true}
                                />
                            </div>

                            <div>
                                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                    닉네임
                                </label>
                                <Input
                                    value={editNickname}
                                    onChange={e => setEditNickname(e.target.value)}
                                    placeholder="닉네임을 입력하세요"
                                    wdfull={true}
                                    onEnter={handleEditSave}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={handleEditCancel} disabled={editLoading}>
                                취소
                            </Button>
                            <Button onClick={handleEditSave} disabled={editLoading}>
                                {editLoading ? '저장 중...' : '저장'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
