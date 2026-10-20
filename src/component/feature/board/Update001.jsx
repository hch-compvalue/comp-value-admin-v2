import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import Button from '@/component/common/button/Button';
import Input from '@/component/common/input/Input';
import RichTextEditor from '@/component/common/editor/RichTextEditor';
import { MAX_FILE_COUNT, ATTACHMENT_ACCEPT, validateAttachments } from '@/util/AttachmentUtil';


function Update001({ boardData = {}, moveViewPage = {}, onUpdate = {}, canSetNotice = false, openAlert = (msg) => alert(msg) }) {

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [notice, setNotice] = useState(false);
    const [secret, setSecret] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [contentSize, setContentSize] = useState(0);
    const [imageSizes, setImageSizes] = useState([]);
    const [newFiles, setNewFiles] = useState([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState([]);

    const handleSizeChange = ({ contentSize, imageSizes }) => {
        setContentSize(contentSize);
        setImageSizes(imageSizes);
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    // 기존 첨부파일 중 삭제 표시되지 않은 파일 수
    const existingAttachments = boardData.attachments || [];
    const remainingCount = existingAttachments.filter(a => !deletedAttachmentIds.includes(a.id)).length;

    const handleFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files);
        const rejectReason = validateAttachments(remainingCount + newFiles.length, selectedFiles);
        if (rejectReason) {
            openAlert(rejectReason);
            e.target.value = '';
            return;
        }
        setNewFiles(prev => [...prev, ...selectedFiles]);
        e.target.value = '';
    };

    const handleNewFileRemove = (index) => {
        setNewFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleExistingFileDelete = (attachmentId) => {
        setDeletedAttachmentIds(prev =>
            prev.includes(attachmentId) ? prev.filter(id => id !== attachmentId) : [...prev, attachmentId]
        );
    };

    const handleUpdate = () => {
        // 이미지 개별 크기 체크 (5MB)
        const oversizedImages = imageSizes.filter(size => size > 5 * 1024 * 1024);
        if (oversizedImages.length > 0) {
            openAlert('이미지는 각각 5MB 이하만 첨부 가능합니다.');
            return;
        }

        // 전체 컨텐츠 크기 체크 (10MB)
        if (contentSize > 10 * 1024 * 1024) {
            openAlert('전체 컨텐츠 크기는 10MB 이하만 가능합니다.');
            return;
        }

        // 첨부파일 개수 검증
        if (remainingCount + newFiles.length > MAX_FILE_COUNT) {
            openAlert(`첨부파일은 최대 ${MAX_FILE_COUNT}개까지 가능합니다.`);
            return;
        }

        onUpdate(title, content, notice, secret, newFiles, deletedAttachmentIds);
    };

    useEffect(() => {
        if (boardData.content !== undefined) {
            setTitle(boardData.title ?? '');
            setContent(boardData.content ?? '');
            setNotice(boardData.notice ?? false);
            setSecret(boardData.secret ?? false);
            setIsLoaded(true);
        }
    }, [boardData.title, boardData.content, boardData.notice, boardData.secret]);


    return (
        <div className="px-2 md:px-4 py-4 md:py-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <div className="border-b border-slate-200 px-3 sm:px-4 py-4 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={moveViewPage}
                            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                            aria-label="뒤로가기"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <div>
                            <h2 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-white">게시글 수정</h2>
                            <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">게시글 내용을 수정해주세요</p>
                        </div>
                    </div>
                </div>

                <form className="p-3 sm:p-4 space-y-6">
                    <div>
                        <Input id='title' label='제목' value={title} labelNewLine={true} onChange={(e) => setTitle(e.target.value)} disabled={false} wdfull={true} />
                    </div>
                    <div>
                        <Input
                            id='author'
                            label='작성자'
                            value={
                                boardData.memberNickname && boardData.memberUsername
                                    ? `${boardData.memberNickname} (${boardData.memberUsername})`
                                    : boardData.author || boardData.memberNickname || boardData.memberUsername || ''
                            }
                            labelNewLine={true}
                            disabled={true}
                            wdfull={true}
                        />
                    </div>
                    <div className="flex gap-4">
                        {canSetNotice && (
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={notice}
                                    onChange={(e) => setNotice(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700"
                                />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                                    </svg>
                                    공지글
                                </span>
                            </label>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={secret}
                                onChange={(e) => setSecret(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-700"
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                비밀글
                            </span>
                        </label>
                    </div>
                    <div>
                        <label htmlFor="content" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            내용
                        </label>
                        {isLoaded && (
                            <RichTextEditor
                                value={content}
                                onChange={setContent}
                                height="700px"
                                onSizeChange={handleSizeChange}
                            />
                        )}
                        <div className="mt-2 flex flex-wrap gap-4 text-sm">
                            <div className={`${contentSize > 10 * 1024 * 1024 ? 'text-orange-600 dark:text-orange-400 font-semibold' : 'text-slate-600 dark:text-slate-400'}`}>
                                전체 크기: {formatSize(contentSize)} / 10 MB
                            </div>
                            {imageSizes.length > 0 && (
                                <div className="text-slate-600 dark:text-slate-400">
                                    이미지 {imageSizes.length}개
                                    {imageSizes.some(size => size > 5 * 1024 * 1024) && (
                                        <span className="ml-2 text-orange-600 dark:text-orange-400 font-semibold">
                                            (일부 이미지가 5MB를 초과합니다)
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* 첨부파일 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            첨부파일
                        </label>

                        {/* 기존 첨부파일 */}
                        {existingAttachments.length > 0 && (
                            <div className="space-y-1 mb-2">
                                {existingAttachments.map((att) => {
                                    const isDeleted = deletedAttachmentIds.includes(att.id);
                                    return (
                                        <div key={att.id} className={`flex items-center justify-between px-3 py-2 rounded-lg ${isDeleted ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-slate-50 dark:bg-slate-700'}`}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <svg className="w-4 h-4 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                                <span className={`text-sm truncate ${isDeleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {att.originalFilename}
                                                </span>
                                                <span className="text-xs text-slate-500 flex-shrink-0 dark:text-slate-400">
                                                    ({formatSize(att.fileSize)})
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleExistingFileDelete(att.id)}
                                                className={`px-2 py-1 text-xs rounded transition-colors ${isDeleted
                                                    ? 'text-blue-600 hover:text-blue-700 dark:text-blue-400'
                                                    : 'text-orange-500 hover:text-orange-700 dark:text-orange-400'}`}
                                            >
                                                {isDeleted ? '취소' : '삭제'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* 새 파일 추가 */}
                        <div className="flex items-center gap-2 mb-2">
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600 transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                파일 추가
                                <input type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" onChange={handleFileSelect} />
                            </label>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                최대 {MAX_FILE_COUNT}개, 각 10MB 이하 (현재 {remainingCount + newFiles.length}개)
                            </span>
                        </div>
                        {newFiles.length > 0 && (
                            <div className="space-y-1">
                                {newFiles.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg dark:bg-blue-900/20">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <svg className="w-4 h-4 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            <span className="text-sm text-slate-700 truncate dark:text-slate-300">{file.name}</span>
                                            <span className="text-xs text-slate-500 flex-shrink-0 dark:text-slate-400">({formatSize(file.size)})</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleNewFileRemove(index)}
                                            className="p-1 text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <Button children="저장" variant="primary" onClick={handleUpdate} />
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Update001;