import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { registerCodeHighlighting } from '@lexical/code';
import { $patchStyleText, $getSelectionStyleValueForProperty } from '@lexical/selection';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism-tomorrow.css';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import {
    $getRoot,
    $insertNodes,
    $createParagraphNode,
    $createTextNode,
    FORMAT_TEXT_COMMAND,
    FORMAT_ELEMENT_COMMAND,
    $getSelection,
    $isRangeSelection,
    $isElementNode,
    DecoratorNode,
    SELECTION_CHANGE_COMMAND,
    COMMAND_PRIORITY_CRITICAL,
    KEY_ENTER_COMMAND,
    COMMAND_PRIORITY_LOW,
    $getNodeByKey,
    CLICK_COMMAND,
    COMMAND_PRIORITY_HIGH,
} from 'lexical';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { Resizable } from 're-resizable';
import { useEffect, useRef, useState, useCallback } from 'react';
import { mergeRegister } from '@lexical/utils';
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Strikethrough,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    AlignLeft,
    AlignCenter,
    AlignRight,
    LinkIcon,
    ImageIcon,
    Quote,
    Code,
    Palette,
} from 'lucide-react';
import { $isHeadingNode, $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $isListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from '@lexical/list';
import { $isLinkNode, TOGGLE_LINK_COMMAND, $createLinkNode } from '@lexical/link';
import { $createCodeNode, $isCodeNode } from '@lexical/code';
import { SLATE } from '@/config/themeColors';

// Resizable Image Component
function ResizableImageComponent({ src, altText, width, height, nodeKey }) {
    const [editor] = useLexicalComposerContext();
    const [currentWidth, setCurrentWidth] = useState(width === 'inherit' ? 'auto' : width);
    const [currentHeight, setCurrentHeight] = useState(height === 'inherit' ? 'auto' : height);
    const [isSelected, setIsSelected] = useState(false);
    const imageRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (imageRef.current && !imageRef.current.contains(e.target)) {
                setIsSelected(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleResizeStop = (e, direction, ref, d) => {
        const newWidth = ref.style.width;
        const newHeight = ref.style.height;
        setCurrentWidth(newWidth);
        setCurrentHeight(newHeight);

        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if (node) {
                node.setWidthAndHeight(newWidth, newHeight);
            }
        });
    };

    const handleClick = (e) => {
        e.stopPropagation();
        setIsSelected(true);
    };

    return (
        <div
            ref={imageRef}
            onClick={handleClick}
            style={{ display: 'inline-block', margin: '0.5rem 0' }}
        >
            <Resizable
                size={{
                    width: currentWidth === 'auto' ? 'auto' : currentWidth,
                    height: currentHeight === 'auto' ? 'auto' : currentHeight,
                }}
                onResizeStop={handleResizeStop}
                lockAspectRatio={false}
                enable={isSelected ? {
                    top: true,
                    right: true,
                    bottom: true,
                    left: true,
                    topRight: true,
                    bottomRight: true,
                    bottomLeft: true,
                    topLeft: true,
                } : {}}
                style={{
                    border: isSelected ? '2px solid #0ea5e9' : '2px solid transparent',
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                }}
                handleStyles={{
                    top: { cursor: 'n-resize' },
                    right: { cursor: 'e-resize' },
                    bottom: { cursor: 's-resize' },
                    left: { cursor: 'w-resize' },
                    topRight: { cursor: 'ne-resize' },
                    bottomRight: { cursor: 'se-resize' },
                    bottomLeft: { cursor: 'sw-resize' },
                    topLeft: { cursor: 'nw-resize' },
                }}
                handleComponent={{
                    topRight: isSelected ? <div style={{ width: 10, height: 10, background: '#0ea5e9', borderRadius: '50%' }} /> : null,
                    bottomRight: isSelected ? <div style={{ width: 10, height: 10, background: '#0ea5e9', borderRadius: '50%' }} /> : null,
                    bottomLeft: isSelected ? <div style={{ width: 10, height: 10, background: '#0ea5e9', borderRadius: '50%' }} /> : null,
                    topLeft: isSelected ? <div style={{ width: 10, height: 10, background: '#0ea5e9', borderRadius: '50%' }} /> : null,
                }}
            >
                <img
                    src={src}
                    alt={altText || ''}
                    draggable={false}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        borderRadius: '0.375rem',
                    }}
                />
            </Resizable>
            {isSelected && (
                <div style={{
                    fontSize: '12px',
                    color: SLATE[500],
                    marginTop: '4px',
                    textAlign: 'center',
                }}>
                    드래그하여 크기 조절 (모서리: 가로+세로, 변: 한 방향)
                </div>
            )}
        </div>
    );
}

// Custom ImageNode
class ImageNode extends DecoratorNode {
    __src;
    __altText;
    __width;
    __height;

    static getType() {
        return 'image';
    }

    static clone(node) {
        return new ImageNode(node.__src, node.__altText, node.__width, node.__height, node.__key);
    }

    constructor(src, altText, width, height, key) {
        super(key);
        this.__src = src;
        this.__altText = altText;
        this.__width = width || 'inherit';
        this.__height = height || 'inherit';
    }

    setWidthAndHeight(width, height) {
        const writable = this.getWritable();
        writable.__width = width;
        writable.__height = height;
    }

    createDOM() {
        const span = document.createElement('span');
        return span;
    }

    updateDOM() {
        return false;
    }

    decorate() {
        return (
            <ResizableImageComponent
                src={this.__src}
                altText={this.__altText}
                width={this.__width}
                height={this.__height}
                nodeKey={this.__key}
            />
        );
    }

    exportJSON() {
        return {
            type: 'image',
            version: 1,
            src: this.__src,
            altText: this.__altText,
            width: this.__width,
            height: this.__height,
        };
    }

    static importJSON(serializedNode) {
        const { src, altText, width, height } = serializedNode;
        return $createImageNode(src, altText, width, height);
    }

    exportDOM() {
        const img = document.createElement('img');
        img.setAttribute('src', this.__src);
        img.setAttribute('alt', this.__altText || '');
        if (this.__width !== 'inherit') {
            img.style.width = this.__width;
        }
        if (this.__height !== 'inherit') {
            img.style.height = this.__height;
        }
        return { element: img };
    }
}

function $createImageNode(src, altText, width, height) {
    return new ImageNode(src, altText, width, height);
}

// 글자색 팔레트 상수
const COLOR_PALETTE = [
    { color: '#000000', label: '검정' },
    { color: '#FF0000', label: '빨강' },
    { color: '#FF6B00', label: '주황' },
    { color: '#FFD700', label: '노랑' },
    { color: '#00FF00', label: '초록' },
    { color: '#00BFFF', label: '하늘' },
    { color: '#0000FF', label: '파랑' },
    { color: '#8B00FF', label: '보라' },
    { color: '#FF1493', label: '분홍' },
    { color: '#666666', label: '회색' },
];

const theme = {
    paragraph: 'editor-paragraph',
    heading: {
        h1: 'text-3xl font-bold my-2',
        h2: 'text-2xl font-bold my-2',
        h3: 'text-xl font-bold my-2',
    },
    list: {
        nested: {
            listitem: 'list-none',
        },
        ol: 'list-decimal ml-4 my-2',
        ul: 'list-disc ml-4 my-2',
    },
    link: 'text-blue-600 dark:text-blue-400 underline cursor-pointer',
    text: {
        bold: 'font-bold',
        italic: 'italic',
        strikethrough: 'line-through',
        underline: 'underline',
        code: 'bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-sm',
    },
    code: 'bg-slate-900 text-slate-100 p-4 rounded my-2 font-mono text-sm overflow-x-auto relative language-',
    codeHighlight: {
        atrule: 'token atrule',
        attr: 'token attr',
        boolean: 'token boolean',
        builtin: 'token builtin',
        cdata: 'token cdata',
        char: 'token char',
        class: 'token class',
        'class-name': 'token class-name',
        comment: 'token comment',
        constant: 'token constant',
        deleted: 'token deleted',
        doctype: 'token doctype',
        entity: 'token entity',
        function: 'token function',
        important: 'token important',
        inserted: 'token inserted',
        keyword: 'token keyword',
        namespace: 'token namespace',
        number: 'token number',
        operator: 'token operator',
        prolog: 'token prolog',
        property: 'token property',
        punctuation: 'token punctuation',
        regex: 'token regex',
        selector: 'token selector',
        string: 'token string',
        symbol: 'token symbol',
        tag: 'token tag',
        url: 'token url',
        variable: 'token variable',
    },
    quote: 'border-l-4 border-slate-300 dark:border-slate-600 pl-4 my-2 text-slate-600 dark:text-slate-400',
};

function onError(error) {
    console.error(error);
}

// HTML을 Lexical 노드로 변환하는 헬퍼 함수
function convertHtmlToNodes(editor, htmlString) {
    const parser = new DOMParser();
    const dom = parser.parseFromString(htmlString, 'text/html');

    // 먼저 모든 img 태그를 찾아서 특별한 마커로 교체
    const images = dom.querySelectorAll('img');
    const imageData = [];

    images.forEach((img, index) => {
        const src = img.getAttribute('src');
        const alt = img.getAttribute('alt') || '';
        const width = img.getAttribute('width') || img.style.width || 'inherit';
        const height = img.getAttribute('height') || img.style.height || 'inherit';

        imageData.push({ src, alt, width, height });

        // 이미지를 마커로 교체
        const marker = dom.createElement('span');
        marker.setAttribute('data-image-marker', index.toString());
        marker.textContent = `[IMAGE_${index}]`;
        img.replaceWith(marker);
    });

    // 코드 블록을 찾아서 마커로 교체
    const codeBlocks = dom.querySelectorAll('code');
    const codeBlockData = [];

    codeBlocks.forEach((code, index) => {
        // pre > code 구조인 경우에만 처리 (블록 레벨 코드)
        if (code.parentElement && code.parentElement.tagName === 'PRE') {
            const content = code.textContent || '';
            const language = code.getAttribute('data-language') || code.className.replace('language-', '') || null;

            codeBlockData.push({ content, language });

            // 코드 블록을 마커로 교체
            const marker = dom.createElement('p');
            marker.setAttribute('data-code-marker', index.toString());
            marker.textContent = `[CODE_${index}]`;
            code.parentElement.replaceWith(marker);
        }
    });

    // 색상 스타일이 적용된 모든 요소의 내용을 마커로 교체 (span, strong, em 등)
    // style 속성에서 color를 직접 확인 (background-color 제외)
    const allStyledElements = dom.querySelectorAll('[style]');
    const colorSpanData = [];
    let colorIndex = 0;

    allStyledElements.forEach((el) => {
        const style = el.getAttribute('style') || '';
        // color 속성만 추출 (background-color 제외)
        const colorMatch = style.match(/(?:^|;|\s)color\s*:\s*([^;]+)/i);
        if (colorMatch) {
            const color = colorMatch[1].trim();
            const text = el.textContent || '';
            const markerId = `___COLOR_${colorIndex}___`;
            colorSpanData.push({ markerId, text, color });

            // 요소의 내용만 마커로 교체 (태그는 유지하여 bold 등 서식 보존)
            el.textContent = markerId;
            // style에서 color 속성 제거 (Lexical이 처리하지 않도록)
            el.style.color = '';
            colorIndex++;
        }
    });

    // 기본 파서로 노드 생성
    const nodes = $generateNodesFromDOM(editor, dom);

    // 생성된 노드에서 마커를 찾아 ImageNode 또는 CodeNode로 교체
    function replaceMarkers(node) {
        if (node.getType() === 'text') {
            const text = node.getTextContent();

            // 이미지 마커 확인
            const imageMatch = text.match(/\[IMAGE_(\d+)\]/);
            if (imageMatch) {
                const index = parseInt(imageMatch[1]);
                const data = imageData[index];
                if (data) {
                    const imageNode = $createImageNode(data.src, data.alt, data.width, data.height);
                    node.replace(imageNode);
                    return;
                }
            }

            // 코드 블록 마커 확인
            const codeMatch = text.match(/\[CODE_(\d+)\]/);
            if (codeMatch) {
                const index = parseInt(codeMatch[1]);
                const data = codeBlockData[index];
                if (data) {
                    const codeNode = $createCodeNode(data.language);
                    const textNode = $createTextNode(data.content);
                    codeNode.append(textNode);

                    const parent = node.getParent();
                    if (parent) {
                        parent.replace(codeNode);
                    }
                    return;
                }
            }

            // 색상 마커 확인 및 복원
            const colorMarkerMatch = text.match(/___COLOR_(\d+)___/);
            if (colorMarkerMatch) {
                const idx = parseInt(colorMarkerMatch[1]);
                const data = colorSpanData[idx];
                if (data) {
                    // 마커를 원본 텍스트로 교체
                    const newTextContent = text.replace(data.markerId, data.text);
                    // 새 TextNode 생성하여 교체 (기존 서식 복사 후 색상 추가)
                    const newTextNode = $createTextNode(newTextContent);
                    // 기존 노드의 format(bold, italic 등) 복사
                    const format = node.getFormat();
                    if (format) {
                        newTextNode.setFormat(format);
                    }
                    newTextNode.setStyle(`color: ${data.color}`);
                    node.replace(newTextNode);
                    return;
                }
            }
        }

        const children = node.getChildren ? node.getChildren() : [];
        children.forEach(child => replaceMarkers(child));
    }

    nodes.forEach(node => replaceMarkers(node));

    return nodes;
}

// 코드 블록에서 나가기 플러그인
function CodeBlockExitPlugin() {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        return editor.registerCommand(
            KEY_ENTER_COMMAND,
            (event) => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection)) {
                    return false;
                }

                const anchorNode = selection.anchor.getNode();
                const element = anchorNode.getKey() === 'root'
                    ? anchorNode
                    : anchorNode.getTopLevelElementOrThrow();

                // 코드 블록 안에서 Ctrl/Cmd + Enter를 누르면 아래에 새 단락 생성
                if ($isCodeNode(element) && (event?.ctrlKey || event?.metaKey)) {
                    event?.preventDefault();
                    const newParagraph = $createParagraphNode();
                    element.insertAfter(newParagraph);
                    newParagraph.select();
                    return true;
                }

                return false;
            },
            COMMAND_PRIORITY_LOW
        );
    }, [editor]);

    return null;
}

// Prism 코드 하이라이팅 플러그인
function CodeHighlightPlugin() {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        return registerCodeHighlighting(editor);
    }, [editor]);

    return null;
}

// Home, End 키 처리 플러그인 - 현재 줄의 시작/끝으로 이동
function KeyboardNavigationPlugin() {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const rootElement = editor.getRootElement();
        if (!rootElement) return;

        // DOM Selection 기반으로 현재 줄의 시작/끝 찾기
        const getLineStartOffset = (node, offset) => {
            if (!node || node.nodeType !== Node.TEXT_NODE) return offset;

            const range = document.createRange();
            const selection = window.getSelection();

            try {
                // 현재 위치 설정
                range.setStart(node, offset);
                range.collapse(true);
                const currentRect = range.getBoundingClientRect();
                const currentY = currentRect.top;

                // 줄의 시작점을 찾기 위해 왼쪽으로 이동
                let testOffset = offset;
                while (testOffset > 0) {
                    range.setStart(node, testOffset - 1);
                    range.collapse(true);
                    const rect = range.getBoundingClientRect();

                    // Y 좌표가 변경되면 이전 줄로 넘어간 것
                    if (Math.abs(rect.top - currentY) > 2) {
                        return testOffset;
                    }
                    testOffset--;
                }
                return 0;
            } catch (e) {
                return offset;
            }
        };

        const getLineEndOffset = (node, offset) => {
            if (!node || node.nodeType !== Node.TEXT_NODE) return offset;

            const range = document.createRange();
            const textLength = node.textContent.length;

            try {
                // 현재 위치 설정
                range.setStart(node, offset);
                range.collapse(true);
                const currentRect = range.getBoundingClientRect();
                const currentY = currentRect.top;

                // 줄의 끝점을 찾기 위해 오른쪽으로 이동
                let testOffset = offset;
                while (testOffset < textLength) {
                    range.setStart(node, testOffset + 1);
                    range.collapse(true);
                    const rect = range.getBoundingClientRect();

                    // Y 좌표가 변경되면 다음 줄로 넘어간 것
                    if (Math.abs(rect.top - currentY) > 2) {
                        return testOffset;
                    }
                    testOffset++;
                }
                return textLength;
            } catch (e) {
                return offset;
            }
        };

        const handleKeyDown = (event) => {
            // Home 키 처리 - 현재 줄의 시작으로 이동
            if (event.key === 'Home' && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                event.stopPropagation();

                editor.update(() => {
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        const anchor = selection.anchor;
                        const anchorNode = anchor.getNode();

                        // 코드 블록 내부인 경우 텍스트 기반으로 줄의 시작 찾기
                        if ($isCodeNode(anchorNode.getTopLevelElementOrThrow())) {
                            const textContent = anchorNode.getTextContent();
                            const currentOffset = anchor.offset;
                            let lineStart = 0;

                            for (let i = currentOffset - 1; i >= 0; i--) {
                                if (textContent[i] === '\n') {
                                    lineStart = i + 1;
                                    break;
                                }
                            }
                            anchor.offset = lineStart;
                            selection.focus.set(anchor.key, lineStart, anchor.type);
                        } else {
                            // 일반 텍스트의 경우 DOM 기반으로 현재 줄의 시작 찾기
                            const domSelection = window.getSelection();
                            if (domSelection && domSelection.anchorNode) {
                                const domNode = domSelection.anchorNode;
                                const domOffset = domSelection.anchorOffset;
                                const lineStart = getLineStartOffset(domNode, domOffset);

                                anchor.offset = lineStart;
                                selection.focus.set(anchor.key, lineStart, anchor.type);
                            }
                        }
                    }
                });
                return;
            }

            // End 키 처리 - 현재 줄의 끝으로 이동
            if (event.key === 'End' && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                event.stopPropagation();

                editor.update(() => {
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        const anchor = selection.anchor;
                        const anchorNode = anchor.getNode();
                        const textContent = anchorNode.getTextContent();

                        // 코드 블록 내부인 경우 텍스트 기반으로 줄의 끝 찾기
                        if ($isCodeNode(anchorNode.getTopLevelElementOrThrow())) {
                            const currentOffset = anchor.offset;
                            let lineEnd = textContent.length;

                            for (let i = currentOffset; i < textContent.length; i++) {
                                if (textContent[i] === '\n') {
                                    lineEnd = i;
                                    break;
                                }
                            }
                            anchor.offset = lineEnd;
                            selection.focus.set(anchor.key, lineEnd, anchor.type);
                        } else {
                            // 일반 텍스트의 경우 DOM 기반으로 현재 줄의 끝 찾기
                            const domSelection = window.getSelection();
                            if (domSelection && domSelection.anchorNode) {
                                const domNode = domSelection.anchorNode;
                                const domOffset = domSelection.anchorOffset;
                                const lineEnd = getLineEndOffset(domNode, domOffset);

                                anchor.offset = lineEnd;
                                selection.focus.set(anchor.key, lineEnd, anchor.type);
                            }
                        }
                    }
                });
                return;
            }
        };

        rootElement.addEventListener('keydown', handleKeyDown);
        return () => {
            rootElement.removeEventListener('keydown', handleKeyDown);
        };
    }, [editor]);

    return null;
}

// HTML 동기화 플러그인
function HtmlPlugin({ initialHtml, onChange }) {
    const [editor] = useLexicalComposerContext();
    const isFirstRender = useRef(true);

    // 초기 HTML 로드
    useEffect(() => {
        if (isFirstRender.current && initialHtml) {
            isFirstRender.current = false;
            editor.update(() => {
                const nodes = convertHtmlToNodes(editor, initialHtml);
                $getRoot().clear();
                $getRoot().select();
                $insertNodes(nodes);
            });
        }
    }, [editor, initialHtml]);

    // 변경 감지 및 HTML 변환
    const handleChange = (editorState) => {
        editorState.read(() => {
            const htmlString = $generateHtmlFromNodes(editor);
            onChange(htmlString);
        });
    };

    return <OnChangePlugin onChange={handleChange} />;
}

// 툴바 버튼 컴포넌트
function ToolbarButton({ onClick, isActive, title, icon: Icon }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors relative editor-tooltip-btn ${
                isActive ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
            }`}
            data-tooltip={title}
        >
            <Icon size={18} />
        </button>
    );
}

// 글자색 선택 드롭다운 컴포넌트
function ColorPickerDropdown({ currentColor, onSelectColor, onRemoveColor, onClose }) {
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={dropdownRef}
            className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg z-50 p-2"
            style={{ minWidth: '140px' }}
        >
            <div className="grid grid-cols-5 gap-1 mb-2">
                {COLOR_PALETTE.map(({ color, label }) => (
                    <button
                        key={color}
                        type="button"
                        onClick={() => {
                            onSelectColor(color);
                            onClose();
                        }}
                        className={`w-6 h-6 rounded border-2 ${
                            currentColor === color
                                ? 'border-blue-500 ring-2 ring-blue-300'
                                : 'border-slate-300 dark:border-slate-500'
                        }`}
                        style={{ backgroundColor: color }}
                        title={label}
                    />
                ))}
            </div>
            <button
                type="button"
                onClick={() => {
                    onRemoveColor();
                    onClose();
                }}
                className="w-full text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-2 py-1"
            >
                색상 제거
            </button>
        </div>
    );
}

// 링크 편집 플러그인
function FloatingLinkEditorPlugin() {
    const [editor] = useLexicalComposerContext();
    const [isLink, setIsLink] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [isEditMode, setIsEditMode] = useState(false);
    const [linkPosition, setLinkPosition] = useState({ top: 0, left: 0 });
    const inputRef = useRef(null);
    const editorRef = useRef(null);
    const isEditModeRef = useRef(false);

    useEffect(() => {
        isEditModeRef.current = isEditMode;
    }, [isEditMode]);

    const updateLinkEditor = useCallback(() => {
        // 편집 모드일 때는 URL 업데이트하지 않음
        if (isEditModeRef.current) {
            return;
        }

        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            const node = selection.anchor.getNode();
            const parent = node.getParent();
            if ($isLinkNode(parent)) {
                setLinkUrl(parent.getURL());
                setIsLink(true);
            } else if ($isLinkNode(node)) {
                setLinkUrl(node.getURL());
                setIsLink(true);
            } else {
                setIsLink(false);
                setLinkUrl('');
            }
        }
    }, []);

    useEffect(() => {
        return mergeRegister(
            editor.registerUpdateListener(({ editorState }) => {
                editorState.read(() => {
                    updateLinkEditor();
                });
            }),
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    updateLinkEditor();
                    return false;
                },
                COMMAND_PRIORITY_LOW
            )
        );
    }, [editor, updateLinkEditor]);

    useEffect(() => {
        if (isLink) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                const editorElement = document.querySelector('.lexical-editor');
                if (editorElement) {
                    const editorRect = editorElement.getBoundingClientRect();
                    setLinkPosition({
                        top: rect.bottom - editorRect.top + 8,
                        left: rect.left - editorRect.left,
                    });
                }
            }
        }
    }, [isLink]);

    useEffect(() => {
        if (isEditMode && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditMode]);

    const handleLinkSubmit = () => {
        if (linkUrl) {
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkUrl);
        }
        setIsEditMode(false);
    };

    const handleRemoveLink = () => {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
        setIsLink(false);
        setIsEditMode(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleLinkSubmit();
        } else if (e.key === 'Escape') {
            setIsEditMode(false);
        }
    };

    if (!isLink) return null;

    return (
        <div
            ref={editorRef}
            className="absolute z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg p-2"
            style={{
                top: linkPosition.top,
                left: linkPosition.left,
                minWidth: '300px',
            }}
        >
            {isEditMode ? (
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="URL 입력..."
                        className="flex-1 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <button
                        type="button"
                        onClick={handleLinkSubmit}
                        className="px-3 py-1 text-sm bg-brand text-white rounded hover:bg-brand-hover"
                    >
                        확인
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsEditMode(false)}
                        className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-white rounded hover:bg-slate-300 dark:hover:bg-slate-500"
                    >
                        취소
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm truncate max-w-[200px]"
                    >
                        {linkUrl}
                    </a>
                    <button
                        type="button"
                        onClick={() => setIsEditMode(true)}
                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                    >
                        편집
                    </button>
                    <button
                        type="button"
                        onClick={handleRemoveLink}
                        className="px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300 rounded hover:bg-orange-200 dark:hover:bg-orange-800"
                    >
                        삭제
                    </button>
                </div>
            )}
        </div>
    );
}

// 툴바 플러그인
function ToolbarPlugin() {
    const [editor] = useLexicalComposerContext();
    const fileInputRef = useRef(null);
    const [showCodeLanguageSelect, setShowCodeLanguageSelect] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkInputUrl, setLinkInputUrl] = useState('');
    const linkInputRef = useRef(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [fontColor, setFontColor] = useState(null);
    const [activeStates, setActiveStates] = useState({
        isBold: false,
        isItalic: false,
        isUnderline: false,
        isStrikethrough: false,
        isCode: false,
        isLink: false,
        blockType: 'paragraph',
    });

    const updateToolbar = useCallback(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            setActiveStates({
                isBold: selection.hasFormat('bold'),
                isItalic: selection.hasFormat('italic'),
                isUnderline: selection.hasFormat('underline'),
                isStrikethrough: selection.hasFormat('strikethrough'),
                isCode: selection.hasFormat('code'),
                isLink: false,
                blockType: 'paragraph',
            });

            // 현재 선택된 텍스트의 글자색 감지
            const currentColor = $getSelectionStyleValueForProperty(selection, 'color', null);
            setFontColor(currentColor);

            const anchorNode = selection.anchor.getNode();
            let element =
                anchorNode.getKey() === 'root'
                    ? anchorNode
                    : anchorNode.getTopLevelElementOrThrow();

            const elementKey = element.getKey();
            const elementDOM = editor.getElementByKey(elementKey);

            if (elementDOM !== null) {
                if ($isListNode(element)) {
                    const parentList = element;
                    const type = parentList.getListType();
                    setActiveStates(prev => ({ ...prev, blockType: type }));
                } else {
                    const type = $isHeadingNode(element)
                        ? element.getTag()
                        : element.getType();
                    setActiveStates(prev => ({ ...prev, blockType: type }));
                }
            }

            const node = selection.anchor.getNode();
            const parent = node.getParent();
            if ($isLinkNode(parent) || $isLinkNode(node)) {
                setActiveStates(prev => ({ ...prev, isLink: true }));
            }
        }
    }, [editor]);

    useEffect(() => {
        return mergeRegister(
            editor.registerUpdateListener(({ editorState }) => {
                editorState.read(() => {
                    updateToolbar();
                });
            }),
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    updateToolbar();
                    return false;
                },
                COMMAND_PRIORITY_CRITICAL
            )
        );
    }, [editor, updateToolbar]);

    const formatBold = () => {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
    };

    const formatItalic = () => {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
    };

    const formatUnderline = () => {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
    };

    const formatStrikethrough = () => {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
    };

    const applyFontColor = (color) => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                $patchStyleText(selection, { color: color });
            }
        });
        setFontColor(color);
    };

    const removeFontColor = () => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                $patchStyleText(selection, { color: null });
            }
        });
        setFontColor(null);
    };

    const formatHeading = (level) => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                const nodes = selection.getNodes();
                nodes.forEach((node) => {
                    const parent = node.getParent();
                    if ($isElementNode(parent)) {
                        const headingNode = $createHeadingNode(`h${level}`);
                        parent.replace(headingNode);
                        headingNode.append(...parent.getChildren());
                    }
                });
            }
        });
    };

    const formatAlignment = (alignment) => {
        editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment);
    };

    const insertLink = () => {
        if (activeStates.isLink) {
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
        } else {
            setShowLinkInput(true);
            setLinkInputUrl('https://');
            setTimeout(() => {
                linkInputRef.current?.focus();
                linkInputRef.current?.select();
            }, 100);
        }
    };

    const handleLinkInputSubmit = () => {
        if (linkInputUrl && linkInputUrl !== 'https://') {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    // 텍스트가 선택되어 있는지 확인
                    const selectedText = selection.getTextContent();
                    if (selectedText) {
                        // 텍스트가 선택되어 있으면 링크로 변환
                        editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkInputUrl);
                    } else {
                        // 텍스트가 선택되어 있지 않으면 링크 URL을 텍스트로 삽입하고 링크로 만듦
                        const linkNode = $createLinkNode(linkInputUrl);
                        const textNode = $createTextNode(linkInputUrl);
                        linkNode.append(textNode);
                        selection.insertNodes([linkNode]);
                    }
                }
            });
        }
        setShowLinkInput(false);
        setLinkInputUrl('');
    };

    const handleLinkInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleLinkInputSubmit();
        } else if (e.key === 'Escape') {
            setShowLinkInput(false);
            setLinkInputUrl('');
        }
    };

    const insertUnorderedList = () => {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    };

    const insertOrderedList = () => {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    };

    const insertQuote = () => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                const nodes = selection.getNodes();
                nodes.forEach((node) => {
                    const parent = node.getParent();
                    if ($isElementNode(parent)) {
                        const quoteNode = $createQuoteNode();
                        parent.replace(quoteNode);
                        quoteNode.append(...parent.getChildren());
                    }
                });
            }
        });
    };

    const insertCodeBlock = (language = null) => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                const anchorNode = selection.anchor.getNode();
                const element =
                    anchorNode.getKey() === 'root'
                        ? anchorNode
                        : anchorNode.getTopLevelElementOrThrow();

                const elementKey = element.getKey();
                const elementDOM = editor.getElementByKey(elementKey);

                if (elementDOM !== null) {
                    // 이미 코드 블록이면 일반 단락으로 변경
                    if ($isCodeNode(element)) {
                        const paragraphNode = $createParagraphNode();
                        element.replace(paragraphNode);
                        paragraphNode.append(...element.getChildren());
                    } else {
                        // 코드 블록으로 변경
                        const codeNode = $createCodeNode(language);
                        element.replace(codeNode);
                        codeNode.append(...element.getChildren());
                    }
                }
            }
        });
        setShowCodeLanguageSelect(false);
    };

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('이미지 파일만 업로드 가능합니다.');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                alert('이미지 크기는 5MB 이하만 가능합니다.');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result;
                if (base64) {
                    editor.update(() => {
                        const imageNode = $createImageNode(base64, file.name);
                        $insertNodes([imageNode]);
                    });
                }
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    return (
        <div className="editor-toolbar border-b border-slate-200 dark:border-slate-600 p-2 bg-slate-50 dark:bg-slate-700 rounded-t-lg flex flex-wrap gap-1">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
            />

            <ToolbarButton onClick={formatBold} isActive={activeStates.isBold} title="굵게 (Ctrl+B)" icon={Bold} />
            <ToolbarButton onClick={formatItalic} isActive={activeStates.isItalic} title="기울임 (Ctrl+I)" icon={Italic} />
            <ToolbarButton onClick={formatUnderline} isActive={activeStates.isUnderline} title="밑줄 (Ctrl+U)" icon={UnderlineIcon} />
            <ToolbarButton onClick={formatStrikethrough} isActive={activeStates.isStrikethrough} title="취소선" icon={Strikethrough} />

            <div className="relative">
                <button
                    type="button"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors relative editor-tooltip-btn ${
                        fontColor ? 'bg-blue-100 dark:bg-blue-900' : 'text-slate-700 dark:text-slate-300'
                    }`}
                    data-tooltip="글자색"
                >
                    <Palette size={18} />
                    <div
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-sm"
                        style={{ backgroundColor: fontColor || '#000000' }}
                    />
                </button>
                {showColorPicker && (
                    <ColorPickerDropdown
                        currentColor={fontColor}
                        onSelectColor={applyFontColor}
                        onRemoveColor={removeFontColor}
                        onClose={() => setShowColorPicker(false)}
                    />
                )}
            </div>

            <div className="w-px bg-slate-300 dark:bg-slate-500 mx-1"></div>

            <ToolbarButton onClick={() => formatHeading(1)} isActive={activeStates.blockType === 'h1'} title="제목 1" icon={Heading1} />
            <ToolbarButton onClick={() => formatHeading(2)} isActive={activeStates.blockType === 'h2'} title="제목 2" icon={Heading2} />
            <ToolbarButton onClick={() => formatHeading(3)} isActive={activeStates.blockType === 'h3'} title="제목 3" icon={Heading3} />

            <div className="w-px bg-slate-300 dark:bg-slate-500 mx-1"></div>

            <ToolbarButton onClick={insertUnorderedList} isActive={activeStates.blockType === 'bullet'} title="글머리 기호 목록" icon={List} />
            <ToolbarButton onClick={insertOrderedList} isActive={activeStates.blockType === 'number'} title="번호 매기기 목록" icon={ListOrdered} />

            <div className="w-px bg-slate-300 dark:bg-slate-500 mx-1"></div>

            <ToolbarButton onClick={() => formatAlignment('left')} title="왼쪽 정렬" icon={AlignLeft} />
            <ToolbarButton onClick={() => formatAlignment('center')} title="가운데 정렬" icon={AlignCenter} />
            <ToolbarButton onClick={() => formatAlignment('right')} title="오른쪽 정렬" icon={AlignRight} />

            <div className="w-px bg-slate-300 dark:bg-slate-500 mx-1"></div>

            <div className="relative">
                <ToolbarButton onClick={insertLink} isActive={activeStates.isLink} title="링크 삽입" icon={LinkIcon} />
                {showLinkInput && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg z-50 p-2 w-screen max-w-[min(320px,calc(100vw-2rem))]">
                        <div className="flex flex-col gap-2">
                            <input
                                ref={linkInputRef}
                                type="text"
                                value={linkInputUrl}
                                onChange={(e) => setLinkInputUrl(e.target.value)}
                                onKeyDown={handleLinkInputKeyDown}
                                placeholder="URL 입력 (예: https://example.com)"
                                className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            />
                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={handleLinkInputSubmit}
                                    className="px-3 py-1 text-sm bg-brand text-white rounded hover:bg-brand-hover whitespace-nowrap"
                                >
                                    확인
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowLinkInput(false); setLinkInputUrl(''); }}
                                    className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-white rounded hover:bg-slate-300 dark:hover:bg-slate-500 whitespace-nowrap"
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            텍스트를 선택한 후 링크를 추가하거나, 텍스트 없이 링크만 추가할 수 있습니다
                        </p>
                    </div>
                )}
            </div>
            <ToolbarButton onClick={handleImageClick} title="이미지 삽입" icon={ImageIcon} />

            <div className="w-px bg-slate-300 dark:bg-slate-500 mx-1"></div>

            <ToolbarButton onClick={insertQuote} isActive={activeStates.blockType === 'quote'} title="인용구" icon={Quote} />

            <div className="relative">
                <ToolbarButton
                    onClick={() => setShowCodeLanguageSelect(!showCodeLanguageSelect)}
                    isActive={activeStates.blockType === 'code'}
                    title="코드 블록 (Ctrl+Enter로 나가기)"
                    icon={Code}
                />
                {showCodeLanguageSelect && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg z-50 py-1 min-w-[150px]">
                        <button
                            type="button"
                            onClick={() => insertCodeBlock(null)}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                            Plain Text
                        </button>
                        <button
                            type="button"
                            onClick={() => insertCodeBlock('javascript')}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                            JavaScript
                        </button>
                        <button
                            type="button"
                            onClick={() => insertCodeBlock('python')}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                            Python
                        </button>
                        <button
                            type="button"
                            onClick={() => insertCodeBlock('java')}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                            Java
                        </button>
                        <button
                            type="button"
                            onClick={() => insertCodeBlock('html')}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                            HTML
                        </button>
                        <button
                            type="button"
                            onClick={() => insertCodeBlock('css')}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                            CSS
                        </button>
                        <button
                            type="button"
                            onClick={() => insertCodeBlock('sql')}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                            SQL
                        </button>
                        <button
                            type="button"
                            onClick={() => insertCodeBlock('json')}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                            JSON
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// 컨텐츠 사이즈 체크 플러그인
function ContentSizePlugin({ onSizeChange }) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        return editor.registerUpdateListener(({ editorState }) => {
            editorState.read(() => {
                const htmlString = $generateHtmlFromNodes(editor);

                // HTML 문자열의 바이트 크기 계산
                const contentSize = new Blob([htmlString]).size;

                // 이미지들의 개별 크기 체크
                const parser = new DOMParser();
                const dom = parser.parseFromString(htmlString, 'text/html');
                const images = dom.querySelectorAll('img');

                const imageSizes = Array.from(images).map((img) => {
                    const src = img.getAttribute('src') || '';
                    // Base64 이미지 크기 계산
                    if (src.startsWith('data:')) {
                        const base64Data = src.split(',')[1] || '';
                        const imageSize = Math.ceil(base64Data.length * 0.75); // Base64는 원본의 약 133%
                        return imageSize;
                    }
                    return 0;
                });

                if (onSizeChange) {
                    onSizeChange({ contentSize, imageSizes });
                }
            });
        });
    }, [editor, onSizeChange]);

    return null;
}

export default function RichTextEditor({ value, onChange, placeholder = '내용을 입력하세요...', height = '700px', onSizeChange }) {
    const initialConfig = {
        namespace: 'RichTextEditor',
        theme,
        onError,
        nodes: [
            HeadingNode,
            ListNode,
            ListItemNode,
            QuoteNode,
            CodeNode,
            CodeHighlightNode,
            TableNode,
            TableCellNode,
            TableRowNode,
            AutoLinkNode,
            LinkNode,
            ImageNode,
        ],
    };

    return (
        <div
            className="lexical-editor border border-slate-200 dark:border-slate-600 rounded-lg"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: height,
                overflow: 'hidden'
            }}
        >
            <style>{`
                /* Sticky toolbar styles */
                .lexical-editor .editor-toolbar {
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    flex-shrink: 0;
                }

                /* Tooltip styles */
                .editor-tooltip-btn {
                    position: relative;
                }
                .editor-tooltip-btn::before {
                    content: attr(data-tooltip);
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    margin-bottom: 8px;
                    padding: 4px 8px;
                    background-color: var(--color-slate-800);
                    color: white;
                    font-size: 12px;
                    white-space: nowrap;
                    border-radius: 4px;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.2s;
                    z-index: 9999;
                }
                .dark .editor-tooltip-btn::before {
                    background-color: var(--color-slate-700);
                }
                .editor-tooltip-btn::after {
                    content: '';
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    margin-bottom: 3px;
                    border: 4px solid transparent;
                    border-top-color: var(--color-slate-800);
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.2s;
                    z-index: 9999;
                }
                .dark .editor-tooltip-btn::after {
                    border-top-color: var(--color-slate-700);
                }
                .editor-tooltip-btn:hover::before,
                .editor-tooltip-btn:hover::after {
                    opacity: 1;
                }

                /* Editor content styles */
                .lexical-editor .editor-input {
                    padding: 1rem;
                    outline: none;
                    background-color: white;
                    color: var(--color-slate-900);
                }
                .dark .lexical-editor .editor-input {
                    background-color: var(--color-slate-800);
                    color: var(--color-slate-100);
                }
                .lexical-editor .editor-placeholder {
                    position: absolute;
                    top: 1rem;
                    left: 1rem;
                    color: var(--color-slate-400);
                    pointer-events: none;
                }
                .lexical-editor img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 0.5rem;
                    margin: 0.5rem 0;
                }
                /* Code block styles */
                .lexical-editor .editor-input code {
                    display: block;
                    white-space: pre-wrap !important;
                    word-break: break-word;
                    line-height: 1.6;
                }
                .lexical-editor .editor-input div[data-gutter="true"] + * {
                    white-space: pre-wrap !important;
                }
                .lexical-editor .editor-input br {
                    display: block;
                    content: "";
                    margin: 0;
                }
                .lexical-editor [data-lexical-code]::before {
                    content: attr(data-language);
                    position: absolute;
                    top: 0.5rem;
                    right: 0.5rem;
                    font-size: 0.75rem;
                    color: var(--color-slate-500);
                    text-transform: uppercase;
                    font-weight: 600;
                    opacity: 0.7;
                    z-index: 1;
                }
            `}</style>

            <LexicalComposer initialConfig={initialConfig}>
                <ToolbarPlugin />
                <div
                    className="editor-content-wrapper"
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        minHeight: 0
                    }}
                >
                    <div className="relative">
                        <RichTextPlugin
                            contentEditable={<ContentEditable className="editor-input" />}
                            placeholder={<div className="editor-placeholder">{placeholder}</div>}
                            ErrorBoundary={LexicalErrorBoundary}
                        />
                        <FloatingLinkEditorPlugin />
                    </div>
                    <HtmlPlugin initialHtml={value} onChange={onChange} />
                    <HistoryPlugin />
                    <AutoFocusPlugin />
                    <ListPlugin />
                    <LinkPlugin />
                    <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
                    <CodeBlockExitPlugin />
                    <CodeHighlightPlugin />
                    <TabIndentationPlugin />
                    <KeyboardNavigationPlugin />
                    {onSizeChange && <ContentSizePlugin onSizeChange={onSizeChange} />}
                </div>
            </LexicalComposer>
        </div>
    );
}
