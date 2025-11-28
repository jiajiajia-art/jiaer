// hooks/useMarkdown.ts
import { useMemo } from 'react';
import { Converter } from 'showdown';

interface UseMarkdownOptions {
  tables?: boolean;
  strikethrough?: boolean;
  tasklists?: boolean;
  smoothLivePreview?: boolean;
  simpleLineBreaks?: boolean;
  emoji?: boolean;
}

export function useMarkdown(
  content: string,
  options: UseMarkdownOptions = {}
): string {
  return useMemo(() => {
    if (!content) return '';
    
    const converter = new Converter({
      tables: true,
      strikethrough: true,
      tasklists: true,
      smoothLivePreview: true,
      simpleLineBreaks: true,
      ...options
    });
    
    return converter.makeHtml(content);
  }, [content, options]);
}

