export type InteractiveVideoEditStepKey = 'theme' | 'monetization' | 'test' | 'delivery';
export type InteractiveVideoEditStepStatus = 'complete' | 'warning' | 'blocked' | 'pending';

export interface InteractiveVideoEditStepItem {
    key: InteractiveVideoEditStepKey;
    title: string;
    summary: string;
    status: InteractiveVideoEditStepStatus;
    statusText: string;
    description: string;
}

export interface InteractiveVideoEditStepInput {
    selectedThemeCount: number;
    themeTagMin: number;
    hasUnsavedThemeTags: boolean;
    hasUnsavedMonetization?: boolean;
    monetizationStatusText?: string;
    themeTagError?: string | null;
    monetizationLoaded: boolean;
    monetizationError?: string | null;
    isSavingThemeTags: boolean;
    isSavingMonetization: boolean;
    isPublished: boolean;
    isDownloading: boolean;
}

export type InteractiveVideoEditSteps = Record<InteractiveVideoEditStepKey, InteractiveVideoEditStepItem>;

export const INTERACTIVE_VIDEO_EDIT_STEP_ORDER: InteractiveVideoEditStepKey[] = [
    'theme',
    'monetization',
    'test',
    'delivery',
];

export const getInteractiveVideoDeliveryBlockingReasons = ({
    selectedThemeCount,
    themeTagMin,
    hasUnsavedThemeTags,
    themeTagError,
    monetizationLoaded,
    monetizationError,
}: Pick<
    InteractiveVideoEditStepInput,
    'selectedThemeCount' | 'themeTagMin' | 'hasUnsavedThemeTags' | 'themeTagError' | 'monetizationLoaded' | 'monetizationError'
>) => {
    const reasons: string[] = [];
    if (selectedThemeCount < themeTagMin) {
        reasons.push(`至少选择 ${themeTagMin} 个题材标签`);
    }
    if (hasUnsavedThemeTags) {
        reasons.push('题材标签尚未保存');
    }
    if (themeTagError) {
        reasons.push(themeTagError);
    }
    if (!monetizationLoaded) {
        reasons.push('内购配置尚未加载完成');
    }
    if (monetizationError) {
        reasons.push(monetizationError);
    }
    return reasons;
};

export const buildInteractiveVideoEditSteps = (input: InteractiveVideoEditStepInput): InteractiveVideoEditSteps => {
    const themeReady = input.selectedThemeCount >= input.themeTagMin;
    const deliveryBlockingReasons = getInteractiveVideoDeliveryBlockingReasons(input);
    const monetizationStatusText = input.monetizationStatusText || '当前：免费开放';

    const theme: InteractiveVideoEditStepItem = input.themeTagError ? {
        key: 'theme',
        title: '题材标签',
        summary: '选择作品题材',
        status: 'blocked',
        statusText: '需处理',
        description: input.themeTagError,
    } : !themeReady ? {
        key: 'theme',
        title: '题材标签',
        summary: '选择作品题材',
        status: 'pending',
        statusText: '未完成',
        description: `请选择 ${input.themeTagMin}-2 个题材标签。`,
    } : input.hasUnsavedThemeTags ? {
        key: 'theme',
        title: '题材标签',
        summary: '选择作品题材',
        status: 'warning',
        statusText: '未保存',
        description: '题材修改后需要先保存，发布前会使用已保存题材。',
    } : {
        key: 'theme',
        title: '题材标签',
        summary: '选择作品题材',
        status: 'complete',
        statusText: '已完成',
        description: '题材标签已保存。',
    };

    const monetization: InteractiveVideoEditStepItem = input.monetizationError ? {
        key: 'monetization',
        title: '内购配置',
        summary: '确认免费或付费模式',
        status: 'blocked',
        statusText: '需处理',
        description: input.monetizationError,
    } : !input.monetizationLoaded ? {
        key: 'monetization',
        title: '内购配置',
        summary: '确认免费或付费模式',
        status: 'pending',
        statusText: '加载中',
        description: '正在加载内购配置。',
    } : input.isSavingMonetization ? {
        key: 'monetization',
        title: '内购配置',
        summary: '确认免费或付费模式',
        status: 'warning',
        statusText: monetizationStatusText,
        description: '内购配置正在保存，请稍候。',
    } : input.hasUnsavedMonetization ? {
        key: 'monetization',
        title: '内购配置',
        summary: '确认免费或付费模式',
        status: 'warning',
        statusText: monetizationStatusText,
        description: '内购配置已有修改，建议保存后再测试或发布。',
    } : {
        key: 'monetization',
        title: '内购配置',
        summary: '确认免费或付费模式',
        status: 'complete',
        statusText: monetizationStatusText,
        description: '内购配置已可用于发布前检查。',
    };

    const test: InteractiveVideoEditStepItem = input.hasUnsavedThemeTags || input.isSavingThemeTags || input.isSavingMonetization ? {
        key: 'test',
        title: '测试作品',
        summary: '发布前体验作品',
        status: 'warning',
        statusText: '建议先保存',
        description: '测试前建议先保存题材和内购配置，避免体验内容与发布准备不一致。',
    } : {
        key: 'test',
        title: '测试作品',
        summary: '发布前体验作品',
        status: 'complete',
        statusText: '可测试',
        description: '可以进入测试页检查作品体验。',
    };

    const delivery: InteractiveVideoEditStepItem = deliveryBlockingReasons.length > 0 ? {
        key: 'delivery',
        title: '发布交付',
        summary: '发布、下架或下载 ZIP',
        status: 'blocked',
        statusText: '未准备好',
        description: deliveryBlockingReasons.join('；'),
    } : input.hasUnsavedMonetization ? {
        key: 'delivery',
        title: '发布交付',
        summary: '发布、下架或下载 ZIP',
        status: 'warning',
        statusText: '建议先保存',
        description: '内购配置有未保存修改；当前仍会按已保存配置发布。',
    } : input.isDownloading ? {
        key: 'delivery',
        title: '发布交付',
        summary: '发布、下架或下载 ZIP',
        status: 'warning',
        statusText: '下载中',
        description: '正在准备 002 可导入 ZIP。',
    } : {
        key: 'delivery',
        title: '发布交付',
        summary: '发布、下架或下载 ZIP',
        status: 'complete',
        statusText: input.isPublished ? '已发布' : '可发布',
        description: input.isPublished ? '作品已发布，可下架或下载项目包。' : '发布前检查已通过，可发布或下载项目包。',
    };

    return {
        theme,
        monetization,
        test,
        delivery,
    };
};
