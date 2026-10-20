import { useState } from 'react';
import CommentForm from './CommentForm';

function CommentItem({ comment, currentUser, onReply, onUpdate, onDelete }) {
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const isOwner = currentUser?.userName && comment.memberUsername === currentUser.userName;
    const isAdmin = currentUser?.roles?.some(r =>
        r.toUpperCase().includes('SUPER_ADMIN') || r.toUpperCase().includes('ADMIN')
    );
    const canEdit = isOwner && !comment.deleted;
    const canDelete = (isOwner || isAdmin) && !comment.deleted;
    const canReply = comment.depth < 1 && !comment.deleted;

    const handleReply = (content) => {
        onReply(comment.id, content);
        setShowReplyForm(false);
    };

    const handleUpdate = (content) => {
        onUpdate(comment.id, content);
        setIsEditing(false);
    };

    const handleDelete = () => {
        if (window.confirm('댓글을 삭제하시겠습니까?')) {
            onDelete(comment.id);
        }
    };

    return (
        <div className={comment.depth > 0 ? 'ml-6 border-l-2 border-slate-200 dark:border-slate-600 pl-4' : ''}>
            <div className="py-3">
                {/* 헤더: 작성자, 날짜 */}
                <div className="flex items-center gap-2 mb-1">
                    {comment.depth > 0 && (
                        <span className="text-slate-400 dark:text-slate-500 text-sm">&#8627;</span>
                    )}
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {comment.memberNickname || comment.memberUsername}
                    </span>
                    {comment.memberUsername && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                            ({comment.memberUsername})
                        </span>
                    )}
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                        {comment.createdAt}
                    </span>
                    {comment.updatedAt && comment.updatedAt !== comment.createdAt && !comment.deleted && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                            (수정됨)
                        </span>
                    )}
                </div>

                {/* 내용 */}
                {isEditing ? (
                    <CommentForm
                        onSubmit={handleUpdate}
                        onCancel={() => setIsEditing(false)}
                        initialContent={comment.content}
                        submitLabel="수정"
                        placeholder="댓글을 수정하세요."
                    />
                ) : (
                    <div className={`text-sm whitespace-pre-wrap break-words ${
                        comment.deleted
                            ? 'text-slate-400 dark:text-slate-500 italic'
                            : 'text-slate-700 dark:text-slate-300'
                    }`}>
                        {comment.content}
                    </div>
                )}

                {/* 액션 버튼 */}
                {!isEditing && (
                    <div className="flex items-center gap-3 mt-2">
                        {canReply && currentUser?.userName && (
                            <button
                                onClick={() => setShowReplyForm(!showReplyForm)}
                                className="text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                            >
                                답글
                            </button>
                        )}
                        {canEdit && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                            >
                                수정
                            </button>
                        )}
                        {canDelete && (
                            <button
                                onClick={handleDelete}
                                className="text-xs text-slate-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400 transition-colors"
                            >
                                삭제
                            </button>
                        )}
                    </div>
                )}

                {/* 답글 작성 폼 */}
                {showReplyForm && (
                    <div className="mt-2">
                        <CommentForm
                            onSubmit={handleReply}
                            onCancel={() => setShowReplyForm(false)}
                            placeholder={`${comment.memberNickname || comment.memberUsername}님에게 답글을 작성하세요.`}
                            submitLabel="답글 등록"
                        />
                    </div>
                )}
            </div>

            {/* 답글 목록 (재귀) */}
            {comment.replies && comment.replies.length > 0 && (
                <div>
                    {comment.replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            currentUser={currentUser}
                            onReply={onReply}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default CommentItem;
