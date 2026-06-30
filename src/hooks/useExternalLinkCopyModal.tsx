import { useCallback, useState } from 'react';
import MobileTipModal from '../components/CreateGame/MobileTipModal';

export function useExternalLinkCopyModal() {
    const [state, setState] = useState<{ isOpen: boolean; url: string }>({
        isOpen: false,
        url: '',
    });

    const requestCopy = useCallback((url: string) => {
        setState({ isOpen: true, url: url.trim() });
    }, []);

    const close = useCallback(() => {
        setState({ isOpen: false, url: '' });
    }, []);

    const modal = (
        <MobileTipModal
            isOpen={state.isOpen}
            onClose={close}
            title="打开外部链接"
            message="小程序内无法直接打开外部链接，请复制后在浏览器中打开"
            linkUrl={state.url}
            copyButtonText="复制"
            icon="🔗"
        />
    );

    return { requestCopy, modal };
}
