import i18n from '../i18n';

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

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

const themeStepCopy = () => ({
    title: t('pagesIvg.editSteps.theme.title'),
    summary: t('pagesIvg.editSteps.theme.summary'),
});

const monetizationStepCopy = () => ({
    title: t('pagesIvg.editSteps.monetization.title'),
    summary: t('pagesIvg.editSteps.monetization.summary'),
});

const testStepCopy = () => ({
    title: t('pagesIvg.editSteps.test.title'),
    summary: t('pagesIvg.editSteps.test.summary'),
});

const deliveryStepCopy = () => ({
    title: t('pagesIvg.editSteps.delivery.title'),
    summary: t('pagesIvg.editSteps.delivery.summary'),
});

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
        reasons.push(t('pagesIvg.editSteps.themeMinTags', { count: themeTagMin }));
    }
    if (hasUnsavedThemeTags) {
        reasons.push(t('pagesIvg.editSteps.themeUnsaved'));
    }
    if (themeTagError) {
        reasons.push(themeTagError);
    }
    if (!monetizationLoaded) {
        reasons.push(t('pagesIvg.editSteps.monetizationNotLoaded'));
    }
    if (monetizationError) {
        reasons.push(monetizationError);
    }
    return reasons;
};

export const buildInteractiveVideoEditSteps = (input: InteractiveVideoEditStepInput): InteractiveVideoEditSteps => {
    const themeReady = input.selectedThemeCount >= input.themeTagMin;
    const deliveryBlockingReasons = getInteractiveVideoDeliveryBlockingReasons(input);
    const monetizationStatusText = input.monetizationStatusText || t('pagesIvg.editSteps.defaultMonetizationStatus');

    const theme: InteractiveVideoEditStepItem = input.themeTagError ? {
        key: 'theme',
        ...themeStepCopy(),
        status: 'blocked',
        statusText: t('pagesIvg.editSteps.theme.needsAction'),
        description: input.themeTagError,
    } : !themeReady ? {
        key: 'theme',
        ...themeStepCopy(),
        status: 'pending',
        statusText: t('pagesIvg.editSteps.theme.incomplete'),
        description: t('pagesIvg.editSteps.theme.pickRange', { min: input.themeTagMin }),
    } : input.hasUnsavedThemeTags ? {
        key: 'theme',
        ...themeStepCopy(),
        status: 'warning',
        statusText: t('pagesIvg.editSteps.theme.unsaved'),
        description: t('pagesIvg.editSteps.theme.unsavedHint'),
    } : {
        key: 'theme',
        ...themeStepCopy(),
        status: 'complete',
        statusText: t('pagesIvg.editSteps.theme.complete'),
        description: t('pagesIvg.editSteps.theme.savedHint'),
    };

    const monetization: InteractiveVideoEditStepItem = input.monetizationError ? {
        key: 'monetization',
        ...monetizationStepCopy(),
        status: 'blocked',
        statusText: t('pagesIvg.editSteps.monetization.needsAction'),
        description: input.monetizationError,
    } : !input.monetizationLoaded ? {
        key: 'monetization',
        ...monetizationStepCopy(),
        status: 'pending',
        statusText: t('pagesIvg.editSteps.monetization.loading'),
        description: t('pagesIvg.editSteps.monetization.loadingHint'),
    } : input.isSavingMonetization ? {
        key: 'monetization',
        ...monetizationStepCopy(),
        status: 'warning',
        statusText: monetizationStatusText,
        description: t('pagesIvg.editSteps.monetization.savingHint'),
    } : input.hasUnsavedMonetization ? {
        key: 'monetization',
        ...monetizationStepCopy(),
        status: 'warning',
        statusText: monetizationStatusText,
        description: t('pagesIvg.editSteps.monetization.dirtyHint'),
    } : {
        key: 'monetization',
        ...monetizationStepCopy(),
        status: 'complete',
        statusText: monetizationStatusText,
        description: t('pagesIvg.editSteps.monetization.readyHint'),
    };

    const test: InteractiveVideoEditStepItem = input.hasUnsavedThemeTags || input.isSavingThemeTags || input.isSavingMonetization ? {
        key: 'test',
        ...testStepCopy(),
        status: 'warning',
        statusText: t('pagesIvg.editSteps.test.saveFirst'),
        description: t('pagesIvg.editSteps.test.saveFirstHint'),
    } : {
        key: 'test',
        ...testStepCopy(),
        status: 'complete',
        statusText: t('pagesIvg.editSteps.test.ready'),
        description: t('pagesIvg.editSteps.test.readyHint'),
    };

    const delivery: InteractiveVideoEditStepItem = deliveryBlockingReasons.length > 0 ? {
        key: 'delivery',
        ...deliveryStepCopy(),
        status: 'blocked',
        statusText: t('pagesIvg.editSteps.delivery.notReady'),
        description: deliveryBlockingReasons.join('；'),
    } : input.hasUnsavedMonetization ? {
        key: 'delivery',
        ...deliveryStepCopy(),
        status: 'warning',
        statusText: t('pagesIvg.editSteps.delivery.saveFirst'),
        description: t('pagesIvg.editSteps.delivery.unsavedMonetizationHint'),
    } : input.isDownloading ? {
        key: 'delivery',
        ...deliveryStepCopy(),
        status: 'warning',
        statusText: t('pagesIvg.editSteps.delivery.downloading'),
        description: t('pagesIvg.editSteps.delivery.preparingZip'),
    } : {
        key: 'delivery',
        ...deliveryStepCopy(),
        status: 'complete',
        statusText: input.isPublished ? t('pagesIvg.editSteps.delivery.published') : t('pagesIvg.editSteps.delivery.readyToPublish'),
        description: input.isPublished ? t('pagesIvg.editSteps.delivery.publishedHint') : t('pagesIvg.editSteps.delivery.readyHint'),
    };

    return {
        theme,
        monetization,
        test,
        delivery,
    };
};
