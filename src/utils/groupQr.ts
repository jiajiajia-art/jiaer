export const QQ_GROUP_QR_MALE_PATH = 'data/assets/group/qr_qq_male.png';
export const QQ_GROUP_QR_FEMALE_PATH = 'data/assets/group/qr_qq_female.png';

export const getQqGroupQrSrc = (gender?: string | null, baseUrl = '/'): string => {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const assetPath = String(gender || '').trim().toLowerCase() === 'female'
        ? QQ_GROUP_QR_FEMALE_PATH
        : QQ_GROUP_QR_MALE_PATH;
    return `${normalizedBase}${assetPath}`;
};
