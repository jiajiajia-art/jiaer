/**
 * 功能注释：注册 ts-ext-loader，使 npm test 能解析 Romance 省略扩展名的相对路径。
 */
import { register } from 'node:module';

register(new URL('./ts-ext-loader.mjs', import.meta.url));
