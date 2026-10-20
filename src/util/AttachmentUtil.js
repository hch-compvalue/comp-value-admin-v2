/**
 * 게시판 첨부파일 검증 — 백엔드 FreeBoardAttachmentService 와 같은 기준 (바꿀 때 양쪽 함께)
 * 파일을 고르는 순간 막아서, 저장 버튼을 누른 뒤에야 거부되는 일이 없게 함
 */
export const MAX_FILE_COUNT = 5;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// 허용 MIME 타입 (백엔드 ALLOWED_CONTENT_TYPES 와 동일)
const ALLOWED_CONTENT_TYPES = new Set([
    // 이미지
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
    // PDF
    'application/pdf',
    // Office
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // 텍스트
    'text/plain', 'text/csv',
    // 압축
    'application/zip', 'application/x-7z-compressed', 'application/x-rar-compressed',
    'application/vnd.rar',
]);

// 차단 확장자 (백엔드 BLOCKED_EXTENSIONS 와 동일)
const BLOCKED_EXTENSIONS = new Set(['exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js', 'jar', 'war', 'class', 'dll', 'so', 'msi']);

/** 파일 선택 창에 보일 확장자 (input accept) */
export const ATTACHMENT_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.7z,.rar';

const extensionOf = (name) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '');

/**
 * 새로 고른 파일 검증
 * @param {number} currentCount 이미 첨부(예정)된 파일 수
 * @param {File[]} files 새로 고른 파일
 * @returns {string|null} 거부 사유 (통과하면 null)
 */
export function validateAttachments(currentCount, files) {
    if (currentCount + files.length > MAX_FILE_COUNT) {
        return `첨부파일은 최대 ${MAX_FILE_COUNT}개까지 가능합니다.`;
    }
    for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
            return `파일 크기는 10MB 이하만 가능합니다: ${file.name}`;
        }
        if (BLOCKED_EXTENSIONS.has(extensionOf(file.name))) {
            return `허용되지 않는 파일 확장자입니다: ${file.name}`;
        }
        if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
            return `허용되지 않는 파일 형식입니다: ${file.name}\n(이미지·PDF·오피스·텍스트·압축 파일만 첨부할 수 있습니다)`;
        }
    }
    return null;
}
