import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { IoChevronBack } from 'react-icons/io5';
import { isMiniProgramEnv } from '../utils/miniProgram';
import privacyPolicy from '../content/legal/privacy-policy-zh.md?raw';
import privacyPolicyEn from '../content/legal/privacy-policy-en.md?raw';
import userAgreement from '../content/legal/user-agreement-zh.md?raw';
import termsOfServiceEn from '../content/legal/terms-of-service-en.md?raw';
import styles from './LegalDocument.module.css';

type LegalDocumentKey = 'user-agreement' | 'privacy-policy';
type LegalLanguage = 'zh' | 'en';

interface LegalDocumentProps {
  document: LegalDocumentKey;
}

interface LegalDocumentContent {
  title: string;
  content: string;
}

const DOCUMENTS: Record<LegalDocumentKey, Record<LegalLanguage, LegalDocumentContent>> = {
  'user-agreement': {
    zh: {
      title: 'FunLoom 用户服务协议',
      content: userAgreement,
    },
    en: {
      title: 'FunLoom Terms of Service',
      content: termsOfServiceEn,
    },
  },
  'privacy-policy': {
    zh: {
      title: 'FunLoom 隐私政策',
      content: privacyPolicy,
    },
    en: {
      title: 'FunLoom Privacy Policy',
      content: privacyPolicyEn,
    },
  },
};

export default function LegalDocument({ document }: LegalDocumentProps) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const queryLanguage = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('lang')
    : null;
  const language: LegalLanguage = String(queryLanguage || i18n.resolvedLanguage || i18n.language || '').toLowerCase().startsWith('en')
    ? 'en'
    : 'zh';
  const selected = DOCUMENTS[document][language];

  const handleBack = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === 'number' && historyIndex > 0) {
      navigate(-1);
      return;
    }

    const win = window as typeof window & {
      __mpWx?: { miniProgram?: { navigateBack?: (options?: { delta?: number }) => void } };
      wx?: { miniProgram?: { navigateBack?: (options?: { delta?: number }) => void } };
      jWeixin?: { miniProgram?: { navigateBack?: (options?: { delta?: number }) => void } };
    };
    const miniProgramWx = win.__mpWx ?? win.wx ?? win.jWeixin;
    if (isMiniProgramEnv() && typeof miniProgramWx?.miniProgram?.navigateBack === 'function') {
      miniProgramWx.miniProgram.navigateBack({ delta: 1 });
      return;
    }

    try {
      window.close();
    } finally {
      window.setTimeout(() => {
        if (!window.closed) {
          navigate('/home');
        }
      }, 0);
    }
  };

  useEffect(() => {
    const previousTitle = window.document.title;
    window.document.title = selected.title;
    return () => {
      window.document.title = previousTitle;
    };
  }, [selected.title]);

  return (
    <main className={styles.page}>
      <div className={styles.backBar}>
        <button
          type="button"
          className={styles.backButton}
          onClick={handleBack}
          aria-label={language === 'en' ? 'Back' : '返回'}
        >
          <IoChevronBack aria-hidden="true" />
          <span>{language === 'en' ? 'Back' : '返回'}</span>
        </button>
      </div>
      <article className={styles.document}>
        <ReactMarkdown>{selected.content}</ReactMarkdown>
      </article>
    </main>
  );
}
