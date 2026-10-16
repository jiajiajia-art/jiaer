import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import privacyPolicy from '../content/legal/privacy-policy-zh.md?raw';
import userAgreement from '../content/legal/user-agreement-zh.md?raw';
import styles from './LegalDocument.module.css';

interface LegalDocumentProps {
  document: 'user-agreement' | 'privacy-policy';
}

const DOCUMENTS = {
  'user-agreement': {
    title: 'FunLoom 用户服务协议',
    content: userAgreement,
  },
  'privacy-policy': {
    title: 'FunLoom 隐私政策',
    content: privacyPolicy,
  },
} as const;

export default function LegalDocument({ document }: LegalDocumentProps) {
  const selected = DOCUMENTS[document];

  useEffect(() => {
    const previousTitle = window.document.title;
    window.document.title = selected.title;
    return () => {
      window.document.title = previousTitle;
    };
  }, [selected.title]);

  return (
    <main className={styles.page}>
      <article className={styles.document}>
        <ReactMarkdown>{selected.content}</ReactMarkdown>
      </article>
    </main>
  );
}
