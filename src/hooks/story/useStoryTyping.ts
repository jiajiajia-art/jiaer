import { useState, useEffect, useRef } from 'react';

interface UseStoryTypingOptions {
    text: string;
    enabled: boolean;
    speed?: number;
}

export const useStoryTyping = ({ text, enabled, speed = 60 }: UseStoryTypingOptions) => {
    const [displayedText, setDisplayedText] = useState<string>('');
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        if (!enabled || !text) {
            setDisplayedText('');
            setIsTyping(false);
            return;
        }

        setDisplayedText('');
        setIsTyping(true);

        let currentIndex = 0;

        const typeNextChar = () => {
            if (currentIndex < text.length) {
                setDisplayedText(text.substring(0, currentIndex + 1));
                currentIndex++;
                typingTimeoutRef.current = setTimeout(typeNextChar, speed);
            } else {
                setIsTyping(false);
                setDisplayedText(text);
            }
        };

        typingTimeoutRef.current = setTimeout(typeNextChar, speed);

        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [text, enabled, speed]);

    return { displayedText, isTyping };
};

