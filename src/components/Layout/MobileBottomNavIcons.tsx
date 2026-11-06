/**
 * 功能注释：底部导航图标按设计稿 SVG（底部icon.html）拆分；描边项用 currentColor，创作中钮固定红底白加号。
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { active?: boolean };

const outlineBase: SVGProps<SVGSVGElement> = {
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true,
  focusable: 'false',
};

/** 首页：房屋描边 */
export function BottomNavHomeIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg viewBox="35.5 10.5 20 21" {...outlineBase} {...props}>
      <path
        d="M48.8333 31.4995V22.6576C48.8333 22.3645 48.7163 22.0833 48.5079 21.8761C48.2995 21.6688 48.0169 21.5524 47.7222 21.5524H43.2778C42.9831 21.5524 42.7005 21.6688 42.4921 21.8761C42.2837 22.0833 42.1667 22.3645 42.1667 22.6576V31.4995M35.5 19.3424C35.4999 19.0209 35.5704 18.7032 35.7064 18.4115C35.8425 18.1198 36.0409 17.8612 36.2878 17.6536L44.0656 11.0222C44.4667 10.685 44.9748 10.5 45.5 10.5C46.0252 10.5 46.5333 10.685 46.9344 11.0222L54.7122 17.6536C54.9591 17.8612 55.1575 18.1198 55.2936 18.4115C55.4296 18.7032 55.5001 19.0209 55.5 19.3424V29.2895C55.5 29.8758 55.2659 30.438 54.8491 30.8526C54.4324 31.2671 53.8671 31.5 53.2778 31.5H37.7222C37.1329 31.5 36.5676 31.2671 36.1509 30.8526C35.7341 30.438 35.5 29.8758 35.5 29.2895V19.3424Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 书架：书本描边 */
export function BottomNavBookshelfIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg viewBox="106 10.5 21.5 21" {...outlineBase} {...props}>
      <path
        d="M106 31H127M107 11H111V27.8421H107V11ZM114 13.1053H118V27.8421H114V13.1053ZM120 12.0526L124 11L127 26.7895L123 27.8421L120 12.0526Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 创作：设计稿红底圆角钮 + 白加号（不受选中态染色） */
export function BottomNavCreateIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg viewBox="167.5 5 40 32" {...outlineBase} {...props}>
      <rect x="167.5" y="5" width="40" height="32" rx="11" fill="#D52D49" />
      <path
        d="M179.5 21H187.5M187.5 21H195.5M187.5 21V13M187.5 21V29"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 排行榜：叠层卡片描边 */
export function BottomNavRankingsIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg viewBox="247.5 10 22 22.5" {...outlineBase} {...props}>
      <path
        d="M267.3 17.7016C267.883 17.7016 268.443 17.9334 268.856 18.3461C269.268 18.7587 269.5 19.3184 269.5 19.902V31.2189C269.5 31.3734 269.454 31.5244 269.368 31.6529C269.283 31.7813 269.161 31.8814 269.018 31.9405C268.875 31.9997 268.718 32.0151 268.567 31.985C268.415 31.9549 268.276 31.8805 268.167 31.7713L265.745 29.3486C265.332 28.9359 264.773 28.7039 264.189 28.7038H256.3C255.717 28.7038 255.157 28.472 254.744 28.0593C254.332 27.6467 254.1 27.087 254.1 26.5034V25.4032M262.9 18.8018C262.9 19.3854 262.668 19.9451 262.256 20.3578C261.843 20.7704 261.283 21.0022 260.7 21.0022H252.811C252.227 21.0024 251.668 21.2343 251.255 21.647L248.833 24.0697C248.724 24.1789 248.585 24.2533 248.433 24.2834C248.282 24.3136 248.125 24.2981 247.982 24.239C247.839 24.1799 247.717 24.0797 247.632 23.9513C247.546 23.8229 247.5 23.6718 247.5 23.5174V12.2005C247.5 11.6169 247.732 11.0572 248.144 10.6445C248.557 10.2318 249.117 10 249.7 10H260.7C261.283 10 261.843 10.2318 262.256 10.6445C262.668 11.0572 262.9 11.6169 262.9 12.2005V18.8018Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 我的：人物描边 */
export function BottomNavProfileIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg viewBox="320.5 11 18 20" {...outlineBase} {...props}>
      <path
        d="M329.5 22.1111C332.607 22.1111 335.125 19.6238 335.125 16.5556C335.125 13.4873 332.607 11 329.5 11C326.393 11 323.875 13.4873 323.875 16.5556C323.875 19.6238 326.393 22.1111 329.5 22.1111ZM329.5 22.1111C331.887 22.1111 334.176 23.0476 335.864 24.7146C337.552 26.3816 338.5 28.6425 338.5 31M329.5 22.1111C327.113 22.1111 324.824 23.0476 323.136 24.7146C321.448 26.3816 320.5 28.6425 320.5 31"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
