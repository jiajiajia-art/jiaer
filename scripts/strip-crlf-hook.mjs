/**
 * 功能注释：Windows 检出是 CRLF，检查脚本里的 \n 锚点会对不上。读文本时先收成 LF。
 * syncBuiltinESMExports 让 import { readFileSync } from 'node:fs' 也走到这里。
 */
import { createRequire, syncBuiltinESMExports } from 'node:module';

const require = createRequire(import.meta.url);
const fs = require('node:fs');

const origSync = fs.readFileSync;
fs.readFileSync = function readFileSyncNoCr(path, options) {
  const data = origSync.call(this, path, options);
  return typeof data === 'string' ? data.replace(/\r\n/g, '\n') : data;
};

const orig = fs.promises.readFile;
fs.promises.readFile = async function readFileNoCr(path, options) {
  const data = await orig.call(this, path, options);
  return typeof data === 'string' ? data.replace(/\r\n/g, '\n') : data;
};

syncBuiltinESMExports();
