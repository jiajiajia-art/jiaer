import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
//import { useTranslation } from 'react-i18next';
import { Converter } from 'showdown';
import { IoChevronBack, IoChevronDown, IoChevronForward, IoChevronUp, IoClose, IoMenuOutline, IoCloudDownloadOutline } from 'react-icons/io5';
import { MdCheck, MdContentCopy } from 'react-icons/md';
import { LuClock3 } from 'react-icons/lu';
import documentApi from '../api/document/documentApi';
import type { DocumentItem, GuideGroup } from '../api/document/document.type';
import styles from './Document.module.css';
import PDFTemplateModal from '../components/GameSettingEditor/PDFTemplateModal';

interface DocumentState {
    list: DocumentItem[];
    guides: GuideGroup[];
    currentSlug: string | null;
    markdown: string;
    title: string;
    guide: string;
    category: string;
    updatedAt: string;
    prevDoc: { slug: string; title: string } | null;
    nextDoc: { slug: string; title: string } | null;
}

const DEFAULT_DOCUMENT_STATE: DocumentState = {
    list: [],
    guides: [],
    currentSlug: null,
    markdown: '',
    title: '文档中心',
    guide: '',
    category: '',
    updatedAt: '',
    prevDoc: null,
    nextDoc: null,
};

const DEFAULT_MARKDOWN = `# Funloom 文档总览

欢迎来到 Funloom 文档中心。
当接口暂时不可用时，会展示这份默认文档作为占位内容。

## 页面定位

- 路由地址: /document
- 内容来源: 服务端 Markdown 文档
- 当前能力: Markdown 渲染、目录导航、上一页/下一页、代码复制

## 访问示例

\`\`\`bash
/funloom/document
\`\`\`

## 后续规划

- 多语言版本
- 文档检索
- 更丰富的排版能力
`;

const LogoIcon = () => (
    <img
        className={styles.topNavLogoIcon}
        src={`${import.meta.env.BASE_URL}data/assets/funloom_icon.png`}
        alt="Funloom"
    />
);

const MenuIcon = () => <IoMenuOutline className={styles.mobileMenuIcon} />;

const ChevronDownIcon = () => <IoChevronDown className={styles.navCategoryArrow} />;

const CloseIcon = () => <IoClose className={styles.mobileCloseIcon} />;

const ArrowUpIcon = () => <IoChevronUp className={styles.backToTopIcon} />;

const ClockIcon = () => <LuClock3 className={styles.footerTimeIcon} />;

const CopyIcon = () => <MdContentCopy className={styles.copyIcon} />;

const CheckIcon = () => <MdCheck className={styles.copyIcon} />;

const ArrowRightIcon = () => <IoChevronForward className={styles.pagerArrow} />;

const ArrowLeftIcon = () => <IoChevronBack className={styles.pagerArrow} />;

type HeadingItem = {
    id: string;
    text: string;
    level: 1 | 2 | 3;
};

const markdownConverter = new Converter({
    tables: true,
    tasklists: true,
    strikethrough: true,
    simpleLineBreaks: true,
    ghCodeBlocks: true,
    emoji: false,
});

const slugifyHeading = (text: string): string => {
    const slug = text
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return slug || 'section';
};

const sanitizeHtml = (html: string): string => {
    if (!html) return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const blockedTags = ['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta'];

    blockedTags.forEach((tagName) => {
        doc.querySelectorAll(tagName).forEach((node) => node.remove());
    });

    doc.querySelectorAll('*').forEach((element) => {
        Array.from(element.attributes).forEach((attr) => {
            const name = attr.name.toLowerCase();
            const value = attr.value.toLowerCase().trim();

            if (name.startsWith('on')) {
                element.removeAttribute(attr.name);
                return;
            }

            if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
                element.removeAttribute(attr.name);
            }
        });
    });

    return doc.body.innerHTML;
};

const buildDocumentHtml = (markdownText: string): { html: string; headings: HeadingItem[]; codeBlocks: { id: string; code: string }[] } => {
    const rawHtml = markdownConverter.makeHtml(markdownText || '');
    const safeHtml = sanitizeHtml(rawHtml);
    const doc = new DOMParser().parseFromString(safeHtml, 'text/html');
    const headingElements = Array.from(doc.querySelectorAll<HTMLElement>('h1, h2, h3'));
    const usedIdMap = new Map<string, number>();
    const headings: HeadingItem[] = [];
    const codeBlocks: { id: string; code: string }[] = [];

    headingElements.forEach((headingElement) => {
        const text = String(headingElement.textContent || '').trim();
        const level = Number(headingElement.tagName.slice(1)) as 1 | 2 | 3;
        if (!text || ![1, 2, 3].includes(level)) return;

        const baseId = slugifyHeading(text);
        const usedCount = usedIdMap.get(baseId) || 0;
        const id = usedCount === 0 ? baseId : `${baseId}-${usedCount + 1}`;

        usedIdMap.set(baseId, usedCount + 1);
        headingElement.id = id;
        headings.push({ id, text, level });
    });

    doc.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchorElement) => {
        const hrefValue = anchorElement.getAttribute('href') || '';
        if (hrefValue.startsWith('#')) return;

        anchorElement.dataset.href = hrefValue;
        anchorElement.removeAttribute('href');
        anchorElement.classList.add('doc-internal-link');
        anchorElement.setAttribute('role', 'link');
        anchorElement.setAttribute('tabindex', '0');
    });

    let codeBlockIndex = 0;
    doc.querySelectorAll<HTMLElement>('pre').forEach((preElement) => {
        const codeElement = preElement.querySelector('code');
        const codeText = codeElement?.textContent || '';
        const codeId = `code-block-${codeBlockIndex++}`;

        codeBlocks.push({ id: codeId, code: codeText });

        const wrapper = doc.createElement('div');
        wrapper.className = 'code-block-wrapper';
        wrapper.setAttribute('data-code-id', codeId);

        preElement.parentNode?.insertBefore(wrapper, preElement);
        wrapper.appendChild(preElement);

        const button = doc.createElement('button');
        button.className = 'copy-code-button';
        button.setAttribute('data-code-id', codeId);
        button.setAttribute('type', 'button');
        preElement.appendChild(button);
    });

    // 功能注释：去掉 Markdown 图的固定宽高，避免手机端按原图像素撑破版心；由 CSS 等比缩放
    doc.querySelectorAll<HTMLImageElement>('img').forEach((imgElement) => {
        imgElement.removeAttribute('width');
        imgElement.removeAttribute('height');
        const styleValue = imgElement.getAttribute('style') || '';
        if (styleValue) {
            const nextStyle = styleValue
                .split(';')
                .map((part) => part.trim())
                .filter((part) => part && !/^(width|height|max-width|min-width)\s*:/i.test(part))
                .join('; ');
            if (nextStyle) imgElement.setAttribute('style', nextStyle);
            else imgElement.removeAttribute('style');
        }
        imgElement.setAttribute('loading', 'lazy');
        imgElement.setAttribute('decoding', 'async');
    });

    return {
        html: doc.body.innerHTML,
        headings,
        codeBlocks,
    };
};

const Document: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const urlSlug = searchParams.get('slug');
    const [isLoading, setIsLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
    const [activeHeadingId, setActiveHeadingId] = useState('');
    const [showBackToTop, setShowBackToTop] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [mobileGuideMenuOpen, setMobileGuideMenuOpen] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [activeGuide, setActiveGuide] = useState<string>('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [imageScale, setImageScale] = useState(1);
    const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
    const [initialPinchScale, setInitialPinchScale] = useState(1);
    const [docState, setDocState] = useState<DocumentState>(DEFAULT_DOCUMENT_STATE);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const articleRef = useRef<HTMLElement | null>(null);
    const userTriggeredGuideChangeRef = useRef(false);
    const mobileGuideSelectRef = useRef<HTMLDivElement | null>(null);

    const navigateToSlug = useCallback((slug: string) => {
        navigate(`/document?slug=${encodeURIComponent(slug)}`);
        setMobileSidebarOpen(false);
    }, [navigate]);

    useEffect(() => {
        if (!activeGuide || docState.guides.length === 0) return;

        const currentGuideData = docState.guides.find((g) => g.guide === activeGuide);
        if (!currentGuideData || currentGuideData.categories.length === 0) return;

        const firstCategory = currentGuideData.categories[0];
        const firstDoc = firstCategory.documents[0];
        if (!firstDoc) return;

        setExpandedCategories((prev) => new Set([...prev, firstCategory.category]));

        const shouldAutoNavigate = userTriggeredGuideChangeRef.current || (!urlSlug && !docState.currentSlug);
        if (shouldAutoNavigate && docState.currentSlug !== firstDoc.slug) {
            navigateToSlug(firstDoc.slug);
        }

        userTriggeredGuideChangeRef.current = false;
    }, [activeGuide, docState.guides, docState.currentSlug, navigateToSlug, urlSlug]);

    useEffect(() => {
        let isCancelled = false;

        const loadDocumentList = async () => {
            try {
                const response = await documentApi.getDocumentList();
                if (isCancelled) return;

                const data = response.data?.data;
                const documents = data?.documents || [];
                const guides = data?.guides || [];
                setDocState((prev) => ({ ...prev, list: documents, guides }));
                if (guides.length > 0 && !activeGuide) {
                    setActiveGuide(guides[0].guide);
                }
            } catch (error) {
                console.warn('Failed to load document list:', error);
            }
        };

        void loadDocumentList();

        return () => {
            isCancelled = true;
        };
    }, []);

    useEffect(() => {
        let isCancelled = false;

        const loadDocument = async () => {
            setIsLoading(true);
            const slug = urlSlug || 'intro';

            try {
                const response = await documentApi.getDocument(slug);
                if (isCancelled) return;

                const data = response.data?.data;
                if (data && data.markdown) {
                    setDocState((prev) => ({
                        ...prev,
                        currentSlug: slug,
                        markdown: data.markdown || '',
                        title: data.title || 'Document',
                        guide: data.guide || '',
                        category: data.category || '',
                        updatedAt: data.updatedAt || '',
                        prevDoc: data.prevDoc || null,
                        nextDoc: data.nextDoc || null,
                    }));
                    setIsLoading(false);
                    return;
                }
            } catch (error) {
                console.warn('Failed to load document, fallback to default:', error);
            }

            if (isCancelled) return;
            setDocState((prev) => ({
                ...prev,
                currentSlug: null,
                markdown: DEFAULT_MARKDOWN,
                title: '文档中心',
                guide: '',
                category: '',
                updatedAt: '',
                prevDoc: null,
                nextDoc: null,
            }));
            setIsLoading(false);
        };

        void loadDocument();

        return () => {
            isCancelled = true;
        };
    }, [urlSlug]);

    useEffect(() => {
        if (!docState.guide || !docState.guides.length) return;
        if (activeGuide === docState.guide) return;

        const existsInGuideList = docState.guides.some((guideGroup) => guideGroup.guide === docState.guide);
        if (!existsInGuideList) return;

        setActiveGuide(docState.guide);
    }, [activeGuide, docState.guide, docState.guides]);

    useEffect(() => {
        if (!mobileSidebarOpen) {
            setMobileGuideMenuOpen(false);
        }
    }, [mobileSidebarOpen]);

    useEffect(() => {
        if (!mobileGuideMenuOpen) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node;
            if (mobileGuideSelectRef.current?.contains(target)) return;
            setMobileGuideMenuOpen(false);
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
        };
    }, [mobileGuideMenuOpen]);

    const renderedDocument = useMemo(() => {
        return buildDocumentHtml(docState.markdown);
    }, [docState.markdown]);
    const renderedHtml = renderedDocument.html;
    const headings = renderedDocument.headings;
    const codeBlocks = renderedDocument.codeBlocks;

    const leftNavHeadings = useMemo(() => headings.filter((item) => item.level <= 2), [headings]);

    useEffect(() => {
        if (!headings.length) {
            setActiveHeadingId('');
            return;
        }
        setActiveHeadingId((prev) => (prev ? prev : headings[0].id));
    }, [headings]);

    useEffect(() => {
        const articleElement = articleRef.current;
        if (!articleElement || !headings.length) return;

        const scrollRoot = document.getElementById('root');
        let ticking = false;

        const updateActiveHeading = () => {
            ticking = false;
            const offsetTop = 130;
            const headingElements = Array.from(articleElement.querySelectorAll<HTMLElement>('h1, h2, h3'));
            if (!headingElements.length) return;

            let currentHeadingId = headingElements[0].id;

            headingElements.forEach((headingElement) => {
                if (headingElement.getBoundingClientRect().top <= offsetTop) {
                    currentHeadingId = headingElement.id;
                }
            });

            setActiveHeadingId(currentHeadingId);
        };

        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(updateActiveHeading);
        };

        updateActiveHeading();
        window.addEventListener('resize', onScroll);
        (scrollRoot || window).addEventListener('scroll', onScroll);

        return () => {
            window.removeEventListener('resize', onScroll);
            (scrollRoot || window).removeEventListener('scroll', onScroll);
        };
    }, [headings, isLoading]);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 1800);
        return () => window.clearTimeout(timer);
    }, [copied]);

    const copyCode = useCallback(async (code: string, codeId: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedCodeId(codeId);
            setTimeout(() => setCopiedCodeId(null), 1800);
        } catch {
            // ignore
        }
    }, []);

    const openImagePreview = useCallback((src: string) => {
        setPreviewImage(src);
    }, []);

    const closeImagePreview = useCallback(() => {
        setPreviewImage(null);
        setImageScale(1);
        setInitialPinchDistance(null);
        setInitialPinchScale(1);
    }, []);

    const getPinchDistance = (touches: React.TouchList) => {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLImageElement>) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const distance = getPinchDistance(e.touches);
            setInitialPinchDistance(distance);
            setInitialPinchScale(imageScale);
        }
    }, [imageScale]);

    const handleTouchMove = useCallback((e: React.TouchEvent<HTMLImageElement>) => {
        if (e.touches.length === 2 && initialPinchDistance !== null) {
            e.preventDefault();
            const distance = getPinchDistance(e.touches);
            const scaleFactor = distance / initialPinchDistance;
            const newScale = Math.min(Math.max(initialPinchScale * scaleFactor, 0.5), 5);
            setImageScale(newScale);
        }
    }, [initialPinchDistance, initialPinchScale]);

    const handleTouchEnd = useCallback(() => {
        setInitialPinchDistance(null);
        setInitialPinchScale(imageScale);
    }, [imageScale]);

    useEffect(() => {
        if (!previewImage) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeImagePreview();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [previewImage, closeImagePreview]);

    useEffect(() => {
        const handleCodeCopy = (event: Event) => {
            const button = (event.target as HTMLElement).closest('.copy-code-button');
            if (!button) return;

            const codeId = button.getAttribute('data-code-id');
            if (!codeId) return;

            const codeBlock = codeBlocks.find((cb) => cb.id === codeId);
            if (codeBlock) {
                void copyCode(codeBlock.code, codeId);
            }
        };

        document.addEventListener('click', handleCodeCopy);
        return () => document.removeEventListener('click', handleCodeCopy);
    }, [codeBlocks, copyCode]);

    useEffect(() => {
        const handleImageClick = (event: Event) => {
            const target = event.target as HTMLElement;
            if (target.tagName === 'IMG' && target.closest('article')) {
                const src = (target as HTMLImageElement).src;
                if (src) {
                    openImagePreview(src);
                }
            }
        };

        const handleInternalLinkClick = (event: Event) => {
            const target = event.target as HTMLElement;
            const link = target.closest('.doc-internal-link') as HTMLElement | null;
            if (!link) return;

            const href = link.dataset.href;
            if (!href) return;

            event.preventDefault();

            // 提取 slug：支持 "/document?slug=xxx" 或纯 "xxx" 两种格式
            let slug = href;
            if (href.includes('/document?slug=')) {
                slug = href.split('/document?slug=')[1] || href;
            }

            navigate(`/document?slug=${encodeURIComponent(slug)}`);
        };

        document.addEventListener('click', handleImageClick);
        document.addEventListener('click', handleInternalLinkClick);
        return () => {
            document.removeEventListener('click', handleImageClick);
            document.removeEventListener('click', handleInternalLinkClick);
        };
    }, [openImagePreview, navigate]);

    useEffect(() => {
        const buttons = document.querySelectorAll<HTMLButtonElement>('.copy-code-button');
        buttons.forEach((button) => {
            const codeId = button.getAttribute('data-code-id');
            if (codeId === copiedCodeId) {
                button.textContent = '';
                button.classList.add('copied');
            } else {
                button.textContent = '';
                button.classList.remove('copied');
            }
        });
    }, [copiedCodeId]);

    const copyMarkdown = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(docState.markdown);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    }, [docState.markdown]);

    const scrollToHeading = useCallback((headingId: string) => {
        const headingElement = document.getElementById(headingId);
        if (!headingElement) return;

        headingElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.replaceState(null, '', `#${headingId}`);
    }, []);

    const showMeta = !isLoading && Boolean(docState.markdown.trim());

    const scrollToTop = useCallback(() => {
        const scrollRoot = document.getElementById('root');
        if (scrollRoot) {
            scrollRoot.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    useEffect(() => {
        const scrollRoot = document.getElementById('root');
        const scrollTarget: HTMLElement | Window = scrollRoot || window;

        const getScrollTop = () => {
            if (scrollRoot) return scrollRoot.scrollTop;
            return window.scrollY || window.pageYOffset || 0;
        };

        const handleScroll = () => {
            setShowBackToTop(getScrollTop() > 400);
        };

        handleScroll();
        scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
        return () => scrollTarget.removeEventListener('scroll', handleScroll);
    }, []);

    const toggleCategory = useCallback((categoryId: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            return next;
        });
    }, []);

    const renderTopNav = () => (
        <header className={styles.topNav}>
            {/* 功能注释：顶栏对齐效果图 — 左汉堡/品牌，右描边「模板下载」，分组只在侧栏 */}
            <div className={styles.topNavInner}>
                <div className={styles.topNavLeft}>
                    <button
                        type="button"
                        className={styles.mobileMenuButton}
                        onClick={() => setMobileSidebarOpen(true)}
                        aria-label="打开文档导航"
                    >
                        <MenuIcon />
                    </button>
                    <a href="/" className={styles.topNavLogo} aria-label="返回首页">
                        <LogoIcon />
                        <span className={styles.topNavLogoText}>文档中心</span>
                    </a>
                </div>
                <div className={styles.topNavRight}>
                    <button
                        type="button"
                        className={styles.templateDownloadButton}
                        onClick={() => setIsTemplateModalOpen(true)}
                        title="模板下载"
                    >
                        <IoCloudDownloadOutline />
                        <span>模板下载</span>
                    </button>
                </div>
            </div>
        </header>
    );

    const renderSidebar = () => {
        const currentGuideData = docState.guides.find((g) => g.guide === activeGuide);
        if (!currentGuideData) return null;

        return (
            <aside className={styles.sidebar}>
                <nav>
                    {currentGuideData.categories.map((categoryGroup) => (
                        <div key={categoryGroup.category} className={styles.sidebarCategory}>
                            <button
                                type="button"
                                className={styles.sidebarCategoryButton}
                                onClick={() => toggleCategory(categoryGroup.category)}
                                aria-expanded={expandedCategories.has(categoryGroup.category)}
                            >
                                <ChevronDownIcon />
                                <span>{categoryGroup.category}</span>
                            </button>
                            {expandedCategories.has(categoryGroup.category) && (
                                <ul className={styles.sidebarDocList}>
                                    {categoryGroup.documents.map((doc) => (
                                        <li key={doc.slug}>
                                            <button
                                                type="button"
                                                className={`${styles.sidebarDocItem} ${docState.currentSlug === doc.slug ? styles.sidebarDocItemActive : ''}`}
                                                onClick={() => navigateToSlug(doc.slug)}
                                            >
                                                {doc.title}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </nav>
            </aside>
        );
    };

    const renderMobileSidebar = () => {
        const currentGuideData = docState.guides.find((g) => g.guide === activeGuide);
        if (!currentGuideData) return null;

        return (
            <>
                <div
                    className={`${styles.mobileOverlay} ${mobileSidebarOpen ? styles.mobileOverlayVisible : ''}`}
                    onClick={() => setMobileSidebarOpen(false)}
                />
                <aside className={`${styles.mobileSidebar} ${mobileSidebarOpen ? styles.mobileSidebarOpen : ''}`}>
                    <div className={styles.mobileSidebarHeader}>
                        <button
                            type="button"
                            className={styles.mobileSidebarBack}
                            onClick={() => {
                                setMobileSidebarOpen(false);
                                navigate('/home');
                            }}
                        >
                            <ArrowLeftIcon />
                        </button>
                        <span className={styles.mobileSidebarTitle}>文档导航</span>
                        <button
                            type="button"
                            className={styles.mobileSidebarClose}
                            onClick={() => setMobileSidebarOpen(false)}
                        >
                            <CloseIcon />
                        </button>
                    </div>
                    <nav>
                        {docState.guides.length > 1 && (
                            <div ref={mobileGuideSelectRef} className={styles.mobileGuideSelectRow}>
                                <div className={styles.mobileGuideSelectLabel}>
                                    文档分组
                                </div>
                                <div className={styles.mobileGuideDropdown}>
                                    <button
                                        type="button"
                                        className={styles.mobileGuideTrigger}
                                        aria-haspopup="listbox"
                                        aria-expanded={mobileGuideMenuOpen}
                                        onClick={() => setMobileGuideMenuOpen((prev) => !prev)}
                                    >
                                        <span>{activeGuide}</span>
                                        <span className={`${styles.mobileGuideCaret} ${mobileGuideMenuOpen ? styles.mobileGuideCaretOpen : ''}`} />
                                    </button>
                                    {mobileGuideMenuOpen && (
                                        <ul className={styles.mobileGuideMenu} role="listbox" aria-label="文档分组">
                                            {docState.guides.map((guideGroup) => (
                                                <li key={guideGroup.guide}>
                                                    <button
                                                        type="button"
                                                        className={`${styles.mobileGuideOption} ${activeGuide === guideGroup.guide ? styles.mobileGuideOptionActive : ''}`}
                                                        onClick={() => {
                                                            setMobileGuideMenuOpen(false);
                                                            if (activeGuide === guideGroup.guide) return;
                                                            userTriggeredGuideChangeRef.current = true;
                                                            setActiveGuide(guideGroup.guide);
                                                        }}
                                                    >
                                                        {guideGroup.guide}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                        {currentGuideData.categories.map((categoryGroup) => (
                            <div key={categoryGroup.category} className={styles.sidebarCategory}>
                                <button
                                    type="button"
                                    className={styles.sidebarCategoryButton}
                                    onClick={() => toggleCategory(categoryGroup.category)}
                                    aria-expanded={expandedCategories.has(categoryGroup.category)}
                                >
                                    <ChevronDownIcon />
                                    <span>{categoryGroup.category}</span>
                                </button>
                                {expandedCategories.has(categoryGroup.category) && (
                                    <ul className={styles.sidebarDocList}>
                                        {categoryGroup.documents.map((doc) => (
                                            <li key={doc.slug}>
                                                <button
                                                    type="button"
                                                    className={`${styles.sidebarDocItem} ${docState.currentSlug === doc.slug ? styles.sidebarDocItemActive : ''}`}
                                                    onClick={() => navigateToSlug(doc.slug)}
                                                >
                                                    {doc.title}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </nav>
                </aside>
            </>
        );
    };

    return (
        <div className={styles.pageRoot}>
            {renderTopNav()}

            <div className={styles.layout}>
                {renderSidebar()}

                <main className={styles.main}>
                    <header className={styles.header}>
                        <div>
                            <h1 className={styles.title}>{docState.title}</h1>
                            {showMeta ? (
                                <div className={styles.metaRow}>
                                    {docState.category && (
                                        <span className={styles.metaText}>
                                            {docState.guide && <span>{docState.guide} / </span>}
                                            {docState.category}
                                        </span>
                                    )}
                                </div>
                            ) : null}
                        </div>
                        <button type="button" className={styles.copyButton} onClick={copyMarkdown}>
                            {copied ? <CheckIcon /> : <CopyIcon />}
                            {copied ? '已复制' : '复制 MARKDOWN'}
                        </button>
                    </header>

                    {isLoading ? (
                        <div className={styles.loadingPanel}>
                            <div className="loadingSpinner" />
                            <p className={styles.loadingText}>文档加载中…</p>
                        </div>
                    ) : (
                        <>
                            <article
                                ref={articleRef}
                                className={styles.markdownBody}
                                dangerouslySetInnerHTML={{ __html: renderedHtml }}
                            />
                            <footer className={styles.documentFooter}>
                                <span className={styles.footerTime}>
                                    <ClockIcon />
                                    最后更新 {docState.updatedAt ? new Date(docState.updatedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未提供'}
                                </span>
                                <div className={styles.pagerRow}>
                                    {docState.prevDoc ? (
                                        <button
                                            type="button"
                                            className={styles.pagerButton}
                                            onClick={() => navigateToSlug(docState.prevDoc!.slug)}
                                            title={`上一页: ${docState.prevDoc.title}`}
                                        >
                                            <ArrowLeftIcon />
                                            <span className={styles.pagerLabel}>上一页</span>
                                        </button>
                                    ) : (
                                        <button type="button" className={`${styles.pagerButton} ${styles.pagerButtonDisabled}`} disabled>
                                            <ArrowLeftIcon />
                                            <span className={styles.pagerLabel}>上一页</span>
                                        </button>
                                    )}
                                    {docState.nextDoc ? (
                                        <button
                                            type="button"
                                            className={styles.pagerButton}
                                            onClick={() => navigateToSlug(docState.nextDoc!.slug)}
                                            title={`下一页: ${docState.nextDoc.title}`}
                                        >
                                            <span className={styles.pagerLabel}>下一页</span>
                                            <ArrowRightIcon />
                                        </button>
                                    ) : (
                                        <button type="button" className={`${styles.pagerButton} ${styles.pagerButtonDisabled}`} disabled>
                                            <span className={styles.pagerLabel}>下一页</span>
                                            <ArrowRightIcon />
                                        </button>
                                    )}
                                </div>
                            </footer>
                        </>
                    )}
                </main>

                <aside className={styles.rightNav}>
                    {leftNavHeadings.length > 0 && (
                        <nav className={styles.rightNavInner}>
                            <div className={styles.rightNavTitle}>目录</div>
                            <ul className={styles.rightNavList}>
                                {leftNavHeadings.map((headingItem) => (
                                    <li
                                        key={headingItem.id}
                                        className={`${styles.rightNavItem} ${headingItem.level === 1 ? styles.rightNavItemH1 : styles.rightNavItemH2}`}
                                    >
                                        <button
                                            type="button"
                                            className={`${styles.rightNavButton} ${activeHeadingId === headingItem.id ? styles.rightNavButtonActive : ''}`}
                                            onClick={() => scrollToHeading(headingItem.id)}
                                        >
                                            {headingItem.text}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    )}
                </aside>
            </div>

            {renderMobileSidebar()}

            <button
                type="button"
                className={`${styles.backToTop} ${showBackToTop ? styles.visible : ''}`}
                onClick={scrollToTop}
                aria-label="Back to top"
            >
                <ArrowUpIcon />
            </button>

            {previewImage && (
                <div className={styles.imagePreviewOverlay} onClick={closeImagePreview}>
                    <button
                        type="button"
                        className={styles.imagePreviewClose}
                        onClick={closeImagePreview}
                        aria-label="关闭"
                    >
                        <CloseIcon />
                    </button>
                    <img
                        src={previewImage}
                        alt="预览图片"
                        className={styles.imagePreviewImage}
                        style={{ transform: `scale(${imageScale})` }}
                        onClick={(e) => e.stopPropagation()}
                        onWheel={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const delta = e.deltaY > 0 ? -0.1 : 0.1;
                            setImageScale((prev) => Math.min(Math.max(prev + delta, 0.5), 5));
                        }}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    />
                </div>
            )}

            <PDFTemplateModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
            />
        </div>
    );
};

export default Document;
