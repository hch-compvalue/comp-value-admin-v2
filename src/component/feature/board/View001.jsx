import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism-tomorrow.css';

import Button from '@/component/common/button/Button';
import CommentSection from '@/component/feature/board/comment/CommentSection';

function View001({
    onMoveBack = () => {},
    onMoveUpdate = () => {},
    onDelete = () => {},
    canEdit = false,
    canDelete = false,
    boardData = {
        title: '',
        content: '',
        author: '',
        viewCount: 0,
        memberUsername: '',
        memberNickname: '',
        createdAt: '',
        updatedAt: '',
    },
}) {
    const { id } = useParams(); // ← URL에서 :id 값 가져옴

    // Prism 하이라이팅 적용
    useEffect(() => {
        Prism.highlightAll();
    }, [boardData.content]);

    return (
        <div className="px-2 md:px-4 py-4 md:py-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                {/* 헤더 */}
                <div className="border-b border-slate-200 px-3 sm:px-4 py-5 dark:border-slate-700">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                    #{id}
                                </span>
                                {boardData.notice && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                                        </svg>
                                        공지
                                    </span>
                                )}
                                {boardData.secret && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                        비밀글
                                    </span>
                                )}
                            </div>
                            <h1 className="text-xl sm:text-2xl font-semibold text-slate-800 break-words dark:text-white">
                                {boardData.title}
                            </h1>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-lg self-start dark:bg-slate-700">
                            <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span className="text-sm font-medium text-slate-700 whitespace-nowrap dark:text-slate-300">{boardData.viewCount ?? 0}</span>
                        </div>
                    </div>

                    {/* 작성자 정보 */}
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            <span
                                className="font-medium truncate"
                                title={boardData.memberNickname && boardData.memberUsername
                                    ? `${boardData.memberNickname} (${boardData.memberUsername})`
                                    : boardData.author || boardData.memberNickname || boardData.memberUsername || '-'}
                            >
                                {boardData.memberNickname && boardData.memberUsername
                                    ? `${boardData.memberNickname} (${boardData.memberUsername})`
                                    : boardData.author || boardData.memberNickname || boardData.memberUsername || '-'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                            </svg>
                            <span className="truncate" title={boardData.createdAt || '-'}>{boardData.createdAt || '-'}</span>
                        </div>
                        {boardData.updatedAt && boardData.updatedAt !== boardData.createdAt && (
                            <div className="flex items-center gap-1.5 text-slate-500 min-w-0 dark:text-slate-500">
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs truncate" title={`수정됨 ${boardData.updatedAt}`}>수정됨 {boardData.updatedAt}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 본문 */}
                <div className="px-3 sm:px-4 py-8">
                    <style>{`
                        .tiptap-view-content {
                            color: var(--color-slate-900);
                        }
                        .dark .tiptap-view-content {
                            color: var(--color-slate-100);
                        }
                        .tiptap-view-content h1 {
                            font-size: 2em;
                            font-weight: bold;
                            margin: 0.5em 0;
                        }
                        .tiptap-view-content h2 {
                            font-size: 1.5em;
                            font-weight: bold;
                            margin: 0.5em 0;
                        }
                        .tiptap-view-content h3 {
                            font-size: 1.17em;
                            font-weight: bold;
                            margin: 0.5em 0;
                        }
                        .tiptap-view-content strong {
                            font-weight: bold;
                        }
                        .tiptap-view-content em {
                            font-style: italic;
                        }
                        .tiptap-view-content u {
                            text-decoration: underline;
                        }
                        .tiptap-view-content s {
                            text-decoration: line-through;
                        }
                        .tiptap-view-content ul,
                        .tiptap-view-content ol {
                            padding-left: 1.5rem;
                            margin: 0.5em 0;
                        }
                        .tiptap-view-content blockquote {
                            border-left: 3px solid var(--color-slate-300);
                            padding-left: 1rem;
                            margin: 1rem 0;
                            color: var(--color-slate-500);
                        }
                        .dark .tiptap-view-content blockquote {
                            border-left-color: var(--color-slate-600);
                            color: var(--color-slate-400);
                        }
                        .tiptap-view-content code {
                            background-color: var(--color-slate-100);
                            padding: 0.2em 0.4em;
                            border-radius: 0.25rem;
                            font-family: 'Courier New', Courier, monospace;
                            font-size: 0.875em;
                        }
                        .dark .tiptap-view-content code {
                            background-color: var(--color-slate-700);
                        }
                        .tiptap-view-content pre {
                            background-color: #2d2d2d;
                            color: var(--color-slate-100);
                            padding: 1rem;
                            border-radius: 0.5rem;
                            overflow-x: auto;
                            font-family: 'Courier New', Courier, monospace;
                            margin: 1rem 0;
                            font-size: 0.875rem;
                            line-height: 1.5;
                            white-space: pre-wrap;
                            word-break: break-word;
                        }
                        .dark .tiptap-view-content pre {
                            background-color: #1e1e1e;
                        }
                        .tiptap-view-content pre code {
                            background: none !important;
                            padding: 0 !important;
                            color: inherit;
                            border-radius: 0;
                        }
                        /* Lexical 코드 블록 지원 */
                        .tiptap-view-content div[data-lexical-decorator="true"] code,
                        .tiptap-view-content .code-block,
                        .tiptap-view-content [class*="code"] {
                            display: block;
                            background-color: var(--color-slate-800);
                            color: var(--color-slate-100);
                            padding: 1rem;
                            border-radius: 0.5rem;
                            overflow-x: auto;
                            font-family: 'Courier New', Courier, monospace;
                            margin: 1rem 0;
                            white-space: pre-wrap;
                            word-break: break-word;
                        }
                        .dark .tiptap-view-content div[data-lexical-decorator="true"] code,
                        .dark .tiptap-view-content .code-block,
                        .dark .tiptap-view-content [class*="code"] {
                            background-color: var(--color-slate-900);
                        }
                        .tiptap-view-content a {
                            color: #0ea5e9;
                            text-decoration: underline;
                        }
                        .dark .tiptap-view-content a {
                            color: #38bdf8;
                        }
                        .tiptap-view-content img {
                            max-width: 100%;
                            height: auto;
                            border-radius: 0.5rem;
                        }
                        .tiptap-view-content p {
                            margin: 0;
                        }
                        .tiptap-view-content [style*="text-align: left"] {
                            text-align: left;
                        }
                        .tiptap-view-content [style*="text-align: center"] {
                            text-align: center;
                        }
                        .tiptap-view-content [style*="text-align: right"] {
                            text-align: right;
                        }
                    `}</style>
                    <div className="prose prose-slate max-w-none dark:prose-invert">
                        <div
                            className="tiptap-view-content leading-relaxed break-words"
                            dangerouslySetInnerHTML={{
                                __html: (boardData.content || '')
                                    .replace(/<\/p>\s*<p[^>]*>/gi, '<br>')
                                    .replace(/^<p[^>]*>/, '')
                                    .replace(/<\/p>$/, '')
                            }}
                        />
                    </div>
                </div>

                {/* 첨부파일 */}
                {boardData.attachments && boardData.attachments.length > 0 && (
                    <div className="border-t border-slate-200 px-3 sm:px-4 py-4 dark:border-slate-700">
                        <div className="flex items-center gap-1.5 mb-3">
                            <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                첨부파일 ({boardData.attachments.length})
                            </span>
                        </div>
                        <div className="space-y-1">
                            {boardData.attachments.map((att) => (
                                <a
                                    key={att.id}
                                    href={`/dart/freeboard/attachment/${att.id}/download`}
                                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors group"
                                >
                                    <svg className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-sm text-slate-700 group-hover:text-blue-600 dark:text-slate-300 dark:group-hover:text-blue-400 truncate">
                                        {att.originalFilename}
                                    </span>
                                    <span className="text-xs text-slate-500 flex-shrink-0 dark:text-slate-400">
                                        ({att.fileSize < 1024 ? att.fileSize + ' B'
                                            : att.fileSize < 1024 * 1024 ? Math.round(att.fileSize / 1024 * 100) / 100 + ' KB'
                                            : Math.round(att.fileSize / (1024 * 1024) * 100) / 100 + ' MB'})
                                    </span>
                                    <svg className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-blue-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* 댓글 섹션 */}
                <CommentSection boardId={Number(id)} />

                {/* 버튼들 */}
                <div className="border-t border-slate-200 px-3 sm:px-4 py-4 dark:border-slate-700">
                    <div className="flex justify-between items-center gap-2">
                        <div className="flex gap-2">
                            {canEdit && (
                                <Button children="수정" variant="secondary" onClick={onMoveUpdate} />
                            )}
                            {canDelete && (
                                <Button children="삭제" variant="danger" onClick={onDelete} />
                            )}
                        </div>
                        <Button children="목록" variant="secondary" onClick={onMoveBack} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default View001;