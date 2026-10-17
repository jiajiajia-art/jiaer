/** 功能注释：注册提交前必须勾选同意隐私政策 */
export function isPrivacyAgreementAccepted(agreed: boolean | null | undefined): boolean {
  return agreed === true;
}
