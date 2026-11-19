import { abytes, aexists, aoutput, clean, complexOverlapBytes, concatBytes, copyBytes, createView, equalBytes, getOutput, isAligned32, overlapBytes, setBigUint64, toBytes, u32, u64Lengths, u8, wrapCipher } from "./@noble_ciphers_utils__js.js";
//#region node_modules/.pnpm/@noble+ciphers@1.3.0/node_modules/@noble/ciphers/esm/_polyval.js
/**
* GHash from AES-GCM and its little-endian "mirror image" Polyval from AES-SIV.
*
* Implemented in terms of GHash with conversion function for keys
* GCM GHASH from
* [NIST SP800-38d](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf),
* SIV from
* [RFC 8452](https://datatracker.ietf.org/doc/html/rfc8452).
*
* GHASH   modulo: x^128 + x^7   + x^2   + x     + 1
* POLYVAL modulo: x^128 + x^127 + x^126 + x^121 + 1
*
* @module
*/
var BLOCK_SIZE$1 = 16;
var ZEROS16 = /* @__PURE__ */ new Uint8Array(16);
var ZEROS32 = u32(ZEROS16);
var POLY$1 = 225;
var mul2$1 = (s0, s1, s2, s3) => {
	const hiBit = s3 & 1;
	return {
		s3: s2 << 31 | s3 >>> 1,
		s2: s1 << 31 | s2 >>> 1,
		s1: s0 << 31 | s1 >>> 1,
		s0: s0 >>> 1 ^ POLY$1 << 24 & -(hiBit & 1)
	};
};
var swapLE = (n) => (n >>> 0 & 255) << 24 | (n >>> 8 & 255) << 16 | (n >>> 16 & 255) << 8 | n >>> 24 & 255 | 0;
/**
* `mulX_POLYVAL(ByteReverse(H))` from spec
* @param k mutated in place
*/
function _toGHASHKey(k) {
	k.reverse();
	const hiBit = k[15] & 1;
	let carry = 0;
	for (let i = 0; i < k.length; i++) {
		const t = k[i];
		k[i] = t >>> 1 | carry;
		carry = (t & 1) << 7;
	}
	k[0] ^= -hiBit & 225;
	return k;
}
var estimateWindow = (bytes) => {
	if (bytes > 64 * 1024) return 8;
	if (bytes > 1024) return 4;
	return 2;
};
var GHASH = class {
	constructor(key, expectedLength) {
		this.blockLen = BLOCK_SIZE$1;
		this.outputLen = BLOCK_SIZE$1;
		this.s0 = 0;
		this.s1 = 0;
		this.s2 = 0;
		this.s3 = 0;
		this.finished = false;
		key = toBytes(key);
		abytes(key, 16);
		const kView = createView(key);
		let k0 = kView.getUint32(0, false);
		let k1 = kView.getUint32(4, false);
		let k2 = kView.getUint32(8, false);
		let k3 = kView.getUint32(12, false);
		const doubles = [];
		for (let i = 0; i < 128; i++) {
			doubles.push({
				s0: swapLE(k0),
				s1: swapLE(k1),
				s2: swapLE(k2),
				s3: swapLE(k3)
			});
			({s0: k0, s1: k1, s2: k2, s3: k3} = mul2$1(k0, k1, k2, k3));
		}
		const W = estimateWindow(expectedLength || 1024);
		if (![
			1,
			2,
			4,
			8
		].includes(W)) throw new Error("ghash: invalid window size, expected 2, 4 or 8");
		this.W = W;
		const windows = 128 / W;
		const windowSize = this.windowSize = 2 ** W;
		const items = [];
		for (let w = 0; w < windows; w++) for (let byte = 0; byte < windowSize; byte++) {
			let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
			for (let j = 0; j < W; j++) {
				if (!(byte >>> W - j - 1 & 1)) continue;
				const { s0: d0, s1: d1, s2: d2, s3: d3 } = doubles[W * w + j];
				s0 ^= d0, s1 ^= d1, s2 ^= d2, s3 ^= d3;
			}
			items.push({
				s0,
				s1,
				s2,
				s3
			});
		}
		this.t = items;
	}
	_updateBlock(s0, s1, s2, s3) {
		s0 ^= this.s0, s1 ^= this.s1, s2 ^= this.s2, s3 ^= this.s3;
		const { W, t, windowSize } = this;
		let o0 = 0, o1 = 0, o2 = 0, o3 = 0;
		const mask = (1 << W) - 1;
		let w = 0;
		for (const num of [
			s0,
			s1,
			s2,
			s3
		]) for (let bytePos = 0; bytePos < 4; bytePos++) {
			const byte = num >>> 8 * bytePos & 255;
			for (let bitPos = 8 / W - 1; bitPos >= 0; bitPos--) {
				const bit = byte >>> W * bitPos & mask;
				const { s0: e0, s1: e1, s2: e2, s3: e3 } = t[w * windowSize + bit];
				o0 ^= e0, o1 ^= e1, o2 ^= e2, o3 ^= e3;
				w += 1;
			}
		}
		this.s0 = o0;
		this.s1 = o1;
		this.s2 = o2;
		this.s3 = o3;
	}
	update(data) {
		aexists(this);
		data = toBytes(data);
		abytes(data);
		const b32 = u32(data);
		const blocks = Math.floor(data.length / BLOCK_SIZE$1);
		const left = data.length % BLOCK_SIZE$1;
		for (let i = 0; i < blocks; i++) this._updateBlock(b32[i * 4 + 0], b32[i * 4 + 1], b32[i * 4 + 2], b32[i * 4 + 3]);
		if (left) {
			ZEROS16.set(data.subarray(blocks * BLOCK_SIZE$1));
			this._updateBlock(ZEROS32[0], ZEROS32[1], ZEROS32[2], ZEROS32[3]);
			clean(ZEROS32);
		}
		return this;
	}
	destroy() {
		const { t } = this;
		for (const elm of t) elm.s0 = 0, elm.s1 = 0, elm.s2 = 0, elm.s3 = 0;
	}
	digestInto(out) {
		aexists(this);
		aoutput(out, this);
		this.finished = true;
		const { s0, s1, s2, s3 } = this;
		const o32 = u32(out);
		o32[0] = s0;
		o32[1] = s1;
		o32[2] = s2;
		o32[3] = s3;
		return out;
	}
	digest() {
		const res = new Uint8Array(BLOCK_SIZE$1);
		this.digestInto(res);
		this.destroy();
		return res;
	}
};
var Polyval = class extends GHASH {
	constructor(key, expectedLength) {
		key = toBytes(key);
		abytes(key);
		const ghKey = _toGHASHKey(copyBytes(key));
		super(ghKey, expectedLength);
		clean(ghKey);
	}
	update(data) {
		data = toBytes(data);
		aexists(this);
		const b32 = u32(data);
		const left = data.length % BLOCK_SIZE$1;
		const blocks = Math.floor(data.length / BLOCK_SIZE$1);
		for (let i = 0; i < blocks; i++) this._updateBlock(swapLE(b32[i * 4 + 3]), swapLE(b32[i * 4 + 2]), swapLE(b32[i * 4 + 1]), swapLE(b32[i * 4 + 0]));
		if (left) {
			ZEROS16.set(data.subarray(blocks * BLOCK_SIZE$1));
			this._updateBlock(swapLE(ZEROS32[3]), swapLE(ZEROS32[2]), swapLE(ZEROS32[1]), swapLE(ZEROS32[0]));
			clean(ZEROS32);
		}
		return this;
	}
	digestInto(out) {
		aexists(this);
		aoutput(out, this);
		this.finished = true;
		const { s0, s1, s2, s3 } = this;
		const o32 = u32(out);
		o32[0] = s0;
		o32[1] = s1;
		o32[2] = s2;
		o32[3] = s3;
		return out.reverse();
	}
};
function wrapConstructorWithKey(hashCons) {
	const hashC = (msg, key) => hashCons(key, msg.length).update(toBytes(msg)).digest();
	const tmp = hashCons(new Uint8Array(16), 0);
	hashC.outputLen = tmp.outputLen;
	hashC.blockLen = tmp.blockLen;
	hashC.create = (key, expectedLength) => hashCons(key, expectedLength);
	return hashC;
}
/** GHash MAC for AES-GCM. */
var ghash = wrapConstructorWithKey((key, expectedLength) => new GHASH(key, expectedLength));
/** Polyval MAC for AES-SIV. */
var polyval = wrapConstructorWithKey((key, expectedLength) => new Polyval(key, expectedLength));
//#endregion
//#region node_modules/.pnpm/@noble+ciphers@1.3.0/node_modules/@noble/ciphers/esm/aes.js
/**
* [AES](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard)
* a.k.a. Advanced Encryption Standard
* is a variant of Rijndael block cipher, standardized by NIST in 2001.
* We provide the fastest available pure JS implementation.
*
* Data is split into 128-bit blocks. Encrypted in 10/12/14 rounds (128/192/256 bits). In every round:
* 1. **S-box**, table substitution
* 2. **Shift rows**, cyclic shift left of all rows of data array
* 3. **Mix columns**, multiplying every column by fixed polynomial
* 4. **Add round key**, round_key xor i-th column of array
*
* Check out [FIPS-197](https://csrc.nist.gov/files/pubs/fips/197/final/docs/fips-197.pdf)
* and [original proposal](https://csrc.nist.gov/csrc/media/projects/cryptographic-standards-and-guidelines/documents/aes-development/rijndael-ammended.pdf)
* @module
*/
var BLOCK_SIZE = 16;
var BLOCK_SIZE32 = 4;
var EMPTY_BLOCK = /* @__PURE__ */ new Uint8Array(BLOCK_SIZE);
var POLY = 283;
function mul2(n) {
	return n << 1 ^ POLY & -(n >> 7);
}
function mul(a, b) {
	let res = 0;
	for (; b > 0; b >>= 1) {
		res ^= a & -(b & 1);
		a = mul2(a);
	}
	return res;
}
var sbox = /* @__PURE__ */ (() => {
	const t = new Uint8Array(256);
	for (let i = 0, x = 1; i < 256; i++, x ^= mul2(x)) t[i] = x;
	const box = new Uint8Array(256);
	box[0] = 99;
	for (let i = 0; i < 255; i++) {
		let x = t[255 - i];
		x |= x << 8;
		box[t[i]] = (x ^ x >> 4 ^ x >> 5 ^ x >> 6 ^ x >> 7 ^ 99) & 255;
	}
	clean(t);
	return box;
})();
var invSbox = /* @__PURE__ */ sbox.map((_, j) => sbox.indexOf(j));
var rotr32_8 = (n) => n << 24 | n >>> 8;
var rotl32_8 = (n) => n << 8 | n >>> 24;
var byteSwap = (word) => word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
function genTtable(sbox, fn) {
	if (sbox.length !== 256) throw new Error("Wrong sbox length");
	const T0 = new Uint32Array(256).map((_, j) => fn(sbox[j]));
	const T1 = T0.map(rotl32_8);
	const T2 = T1.map(rotl32_8);
	const T3 = T2.map(rotl32_8);
	const T01 = new Uint32Array(256 * 256);
	const T23 = new Uint32Array(256 * 256);
	const sbox2 = new Uint16Array(256 * 256);
	for (let i = 0; i < 256; i++) for (let j = 0; j < 256; j++) {
		const idx = i * 256 + j;
		T01[idx] = T0[i] ^ T1[j];
		T23[idx] = T2[i] ^ T3[j];
		sbox2[idx] = sbox[i] << 8 | sbox[j];
	}
	return {
		sbox,
		sbox2,
		T0,
		T1,
		T2,
		T3,
		T01,
		T23
	};
}
var tableEncoding = /* @__PURE__ */ genTtable(sbox, (s) => mul(s, 3) << 24 | s << 16 | s << 8 | mul(s, 2));
var tableDecoding = /* @__PURE__ */ genTtable(invSbox, (s) => mul(s, 11) << 24 | mul(s, 13) << 16 | mul(s, 9) << 8 | mul(s, 14));
var xPowers = /* @__PURE__ */ (() => {
	const p = new Uint8Array(16);
	for (let i = 0, x = 1; i < 16; i++, x = mul2(x)) p[i] = x;
	return p;
})();
/** Key expansion used in CTR. */
function expandKeyLE(key) {
	abytes(key);
	const len = key.length;
	if (![
		16,
		24,
		32
	].includes(len)) throw new Error("aes: invalid key size, should be 16, 24 or 32, got " + len);
	const { sbox2 } = tableEncoding;
	const toClean = [];
	if (!isAligned32(key)) toClean.push(key = copyBytes(key));
	const k32 = u32(key);
	const Nk = k32.length;
	const subByte = (n) => applySbox(sbox2, n, n, n, n);
	const xk = new Uint32Array(len + 28);
	xk.set(k32);
	for (let i = Nk; i < xk.length; i++) {
		let t = xk[i - 1];
		if (i % Nk === 0) t = subByte(rotr32_8(t)) ^ xPowers[i / Nk - 1];
		else if (Nk > 6 && i % Nk === 4) t = subByte(t);
		xk[i] = xk[i - Nk] ^ t;
	}
	clean(...toClean);
	return xk;
}
function expandKeyDecLE(key) {
	const encKey = expandKeyLE(key);
	const xk = encKey.slice();
	const Nk = encKey.length;
	const { sbox2 } = tableEncoding;
	const { T0, T1, T2, T3 } = tableDecoding;
	for (let i = 0; i < Nk; i += 4) for (let j = 0; j < 4; j++) xk[i + j] = encKey[Nk - i - 4 + j];
	clean(encKey);
	for (let i = 4; i < Nk - 4; i++) {
		const x = xk[i];
		const w = applySbox(sbox2, x, x, x, x);
		xk[i] = T0[w & 255] ^ T1[w >>> 8 & 255] ^ T2[w >>> 16 & 255] ^ T3[w >>> 24];
	}
	return xk;
}
function apply0123(T01, T23, s0, s1, s2, s3) {
	return T01[s0 << 8 & 65280 | s1 >>> 8 & 255] ^ T23[s2 >>> 8 & 65280 | s3 >>> 24 & 255];
}
function applySbox(sbox2, s0, s1, s2, s3) {
	return sbox2[s0 & 255 | s1 & 65280] | sbox2[s2 >>> 16 & 255 | s3 >>> 16 & 65280] << 16;
}
function encrypt(xk, s0, s1, s2, s3) {
	const { sbox2, T01, T23 } = tableEncoding;
	let k = 0;
	s0 ^= xk[k++], s1 ^= xk[k++], s2 ^= xk[k++], s3 ^= xk[k++];
	const rounds = xk.length / 4 - 2;
	for (let i = 0; i < rounds; i++) {
		const t0 = xk[k++] ^ apply0123(T01, T23, s0, s1, s2, s3);
		const t1 = xk[k++] ^ apply0123(T01, T23, s1, s2, s3, s0);
		const t2 = xk[k++] ^ apply0123(T01, T23, s2, s3, s0, s1);
		const t3 = xk[k++] ^ apply0123(T01, T23, s3, s0, s1, s2);
		s0 = t0, s1 = t1, s2 = t2, s3 = t3;
	}
	return {
		s0: xk[k++] ^ applySbox(sbox2, s0, s1, s2, s3),
		s1: xk[k++] ^ applySbox(sbox2, s1, s2, s3, s0),
		s2: xk[k++] ^ applySbox(sbox2, s2, s3, s0, s1),
		s3: xk[k++] ^ applySbox(sbox2, s3, s0, s1, s2)
	};
}
function decrypt(xk, s0, s1, s2, s3) {
	const { sbox2, T01, T23 } = tableDecoding;
	let k = 0;
	s0 ^= xk[k++], s1 ^= xk[k++], s2 ^= xk[k++], s3 ^= xk[k++];
	const rounds = xk.length / 4 - 2;
	for (let i = 0; i < rounds; i++) {
		const t0 = xk[k++] ^ apply0123(T01, T23, s0, s3, s2, s1);
		const t1 = xk[k++] ^ apply0123(T01, T23, s1, s0, s3, s2);
		const t2 = xk[k++] ^ apply0123(T01, T23, s2, s1, s0, s3);
		const t3 = xk[k++] ^ apply0123(T01, T23, s3, s2, s1, s0);
		s0 = t0, s1 = t1, s2 = t2, s3 = t3;
	}
	return {
		s0: xk[k++] ^ applySbox(sbox2, s0, s3, s2, s1),
		s1: xk[k++] ^ applySbox(sbox2, s1, s0, s3, s2),
		s2: xk[k++] ^ applySbox(sbox2, s2, s1, s0, s3),
		s3: xk[k++] ^ applySbox(sbox2, s3, s2, s1, s0)
	};
}
function ctrCounter(xk, nonce, src, dst) {
	abytes(nonce, BLOCK_SIZE);
	abytes(src);
	const srcLen = src.length;
	dst = getOutput(srcLen, dst);
	complexOverlapBytes(src, dst);
	const ctr = nonce;
	const c32 = u32(ctr);
	let { s0, s1, s2, s3 } = encrypt(xk, c32[0], c32[1], c32[2], c32[3]);
	const src32 = u32(src);
	const dst32 = u32(dst);
	for (let i = 0; i + 4 <= src32.length; i += 4) {
		dst32[i + 0] = src32[i + 0] ^ s0;
		dst32[i + 1] = src32[i + 1] ^ s1;
		dst32[i + 2] = src32[i + 2] ^ s2;
		dst32[i + 3] = src32[i + 3] ^ s3;
		let carry = 1;
		for (let i = ctr.length - 1; i >= 0; i--) {
			carry = carry + (ctr[i] & 255) | 0;
			ctr[i] = carry & 255;
			carry >>>= 8;
		}
		({s0, s1, s2, s3} = encrypt(xk, c32[0], c32[1], c32[2], c32[3]));
	}
	const start = BLOCK_SIZE * Math.floor(src32.length / BLOCK_SIZE32);
	if (start < srcLen) {
		const b32 = new Uint32Array([
			s0,
			s1,
			s2,
			s3
		]);
		const buf = u8(b32);
		for (let i = start, pos = 0; i < srcLen; i++, pos++) dst[i] = src[i] ^ buf[pos];
		clean(b32);
	}
	return dst;
}
function ctr32(xk, isLE, nonce, src, dst) {
	abytes(nonce, BLOCK_SIZE);
	abytes(src);
	dst = getOutput(src.length, dst);
	const ctr = nonce;
	const c32 = u32(ctr);
	const view = createView(ctr);
	const src32 = u32(src);
	const dst32 = u32(dst);
	const ctrPos = isLE ? 0 : 12;
	const srcLen = src.length;
	let ctrNum = view.getUint32(ctrPos, isLE);
	let { s0, s1, s2, s3 } = encrypt(xk, c32[0], c32[1], c32[2], c32[3]);
	for (let i = 0; i + 4 <= src32.length; i += 4) {
		dst32[i + 0] = src32[i + 0] ^ s0;
		dst32[i + 1] = src32[i + 1] ^ s1;
		dst32[i + 2] = src32[i + 2] ^ s2;
		dst32[i + 3] = src32[i + 3] ^ s3;
		ctrNum = ctrNum + 1 >>> 0;
		view.setUint32(ctrPos, ctrNum, isLE);
		({s0, s1, s2, s3} = encrypt(xk, c32[0], c32[1], c32[2], c32[3]));
	}
	const start = BLOCK_SIZE * Math.floor(src32.length / BLOCK_SIZE32);
	if (start < srcLen) {
		const b32 = new Uint32Array([
			s0,
			s1,
			s2,
			s3
		]);
		const buf = u8(b32);
		for (let i = start, pos = 0; i < srcLen; i++, pos++) dst[i] = src[i] ^ buf[pos];
		clean(b32);
	}
	return dst;
}
/**
* CTR: counter mode. Creates stream cipher.
* Requires good IV. Parallelizable. OK, but no MAC.
*/
var ctr = /* @__PURE__ */ wrapCipher({
	blockSize: 16,
	nonceLength: 16
}, function aesctr(key, nonce) {
	function processCtr(buf, dst) {
		abytes(buf);
		if (dst !== void 0) {
			abytes(dst);
			if (!isAligned32(dst)) throw new Error("unaligned destination");
		}
		const xk = expandKeyLE(key);
		const n = copyBytes(nonce);
		const toClean = [xk, n];
		if (!isAligned32(buf)) toClean.push(buf = copyBytes(buf));
		const out = ctrCounter(xk, n, buf, dst);
		clean(...toClean);
		return out;
	}
	return {
		encrypt: (plaintext, dst) => processCtr(plaintext, dst),
		decrypt: (ciphertext, dst) => processCtr(ciphertext, dst)
	};
});
function validateBlockDecrypt(data) {
	abytes(data);
	if (data.length % BLOCK_SIZE !== 0) throw new Error("aes-(cbc/ecb).decrypt ciphertext should consist of blocks with size " + BLOCK_SIZE);
}
function validateBlockEncrypt(plaintext, pcks5, dst) {
	abytes(plaintext);
	let outLen = plaintext.length;
	const remaining = outLen % BLOCK_SIZE;
	if (!pcks5 && remaining !== 0) throw new Error("aec/(cbc-ecb): unpadded plaintext with disabled padding");
	if (!isAligned32(plaintext)) plaintext = copyBytes(plaintext);
	const b = u32(plaintext);
	if (pcks5) {
		let left = BLOCK_SIZE - remaining;
		if (!left) left = BLOCK_SIZE;
		outLen = outLen + left;
	}
	dst = getOutput(outLen, dst);
	complexOverlapBytes(plaintext, dst);
	return {
		b,
		o: u32(dst),
		out: dst
	};
}
function validatePCKS(data, pcks5) {
	if (!pcks5) return data;
	const len = data.length;
	if (!len) throw new Error("aes/pcks5: empty ciphertext not allowed");
	const lastByte = data[len - 1];
	if (lastByte <= 0 || lastByte > 16) throw new Error("aes/pcks5: wrong padding");
	const out = data.subarray(0, -lastByte);
	for (let i = 0; i < lastByte; i++) if (data[len - i - 1] !== lastByte) throw new Error("aes/pcks5: wrong padding");
	return out;
}
function padPCKS(left) {
	const tmp = new Uint8Array(16);
	const tmp32 = u32(tmp);
	tmp.set(left);
	const paddingByte = BLOCK_SIZE - left.length;
	for (let i = BLOCK_SIZE - paddingByte; i < BLOCK_SIZE; i++) tmp[i] = paddingByte;
	return tmp32;
}
/**
* ECB: Electronic CodeBook. Simple deterministic replacement.
* Dangerous: always map x to y. See [AES Penguin](https://words.filippo.io/the-ecb-penguin/).
*/
var ecb = /* @__PURE__ */ wrapCipher({ blockSize: 16 }, function aesecb(key, opts = {}) {
	const pcks5 = !opts.disablePadding;
	return {
		encrypt(plaintext, dst) {
			const { b, o, out: _out } = validateBlockEncrypt(plaintext, pcks5, dst);
			const xk = expandKeyLE(key);
			let i = 0;
			for (; i + 4 <= b.length;) {
				const { s0, s1, s2, s3 } = encrypt(xk, b[i + 0], b[i + 1], b[i + 2], b[i + 3]);
				o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
			}
			if (pcks5) {
				const tmp32 = padPCKS(plaintext.subarray(i * 4));
				const { s0, s1, s2, s3 } = encrypt(xk, tmp32[0], tmp32[1], tmp32[2], tmp32[3]);
				o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
			}
			clean(xk);
			return _out;
		},
		decrypt(ciphertext, dst) {
			validateBlockDecrypt(ciphertext);
			const xk = expandKeyDecLE(key);
			dst = getOutput(ciphertext.length, dst);
			const toClean = [xk];
			if (!isAligned32(ciphertext)) toClean.push(ciphertext = copyBytes(ciphertext));
			complexOverlapBytes(ciphertext, dst);
			const b = u32(ciphertext);
			const o = u32(dst);
			for (let i = 0; i + 4 <= b.length;) {
				const { s0, s1, s2, s3 } = decrypt(xk, b[i + 0], b[i + 1], b[i + 2], b[i + 3]);
				o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
			}
			clean(...toClean);
			return validatePCKS(dst, pcks5);
		}
	};
});
/**
* CBC: Cipher-Block-Chaining. Key is previous round’s block.
* Fragile: needs proper padding. Unauthenticated: needs MAC.
*/
var cbc = /* @__PURE__ */ wrapCipher({
	blockSize: 16,
	nonceLength: 16
}, function aescbc(key, iv, opts = {}) {
	const pcks5 = !opts.disablePadding;
	return {
		encrypt(plaintext, dst) {
			const xk = expandKeyLE(key);
			const { b, o, out: _out } = validateBlockEncrypt(plaintext, pcks5, dst);
			let _iv = iv;
			const toClean = [xk];
			if (!isAligned32(_iv)) toClean.push(_iv = copyBytes(_iv));
			const n32 = u32(_iv);
			let s0 = n32[0], s1 = n32[1], s2 = n32[2], s3 = n32[3];
			let i = 0;
			for (; i + 4 <= b.length;) {
				s0 ^= b[i + 0], s1 ^= b[i + 1], s2 ^= b[i + 2], s3 ^= b[i + 3];
				({s0, s1, s2, s3} = encrypt(xk, s0, s1, s2, s3));
				o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
			}
			if (pcks5) {
				const tmp32 = padPCKS(plaintext.subarray(i * 4));
				s0 ^= tmp32[0], s1 ^= tmp32[1], s2 ^= tmp32[2], s3 ^= tmp32[3];
				({s0, s1, s2, s3} = encrypt(xk, s0, s1, s2, s3));
				o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
			}
			clean(...toClean);
			return _out;
		},
		decrypt(ciphertext, dst) {
			validateBlockDecrypt(ciphertext);
			const xk = expandKeyDecLE(key);
			let _iv = iv;
			const toClean = [xk];
			if (!isAligned32(_iv)) toClean.push(_iv = copyBytes(_iv));
			const n32 = u32(_iv);
			dst = getOutput(ciphertext.length, dst);
			if (!isAligned32(ciphertext)) toClean.push(ciphertext = copyBytes(ciphertext));
			complexOverlapBytes(ciphertext, dst);
			const b = u32(ciphertext);
			const o = u32(dst);
			let s0 = n32[0], s1 = n32[1], s2 = n32[2], s3 = n32[3];
			for (let i = 0; i + 4 <= b.length;) {
				const ps0 = s0, ps1 = s1, ps2 = s2, ps3 = s3;
				s0 = b[i + 0], s1 = b[i + 1], s2 = b[i + 2], s3 = b[i + 3];
				const { s0: o0, s1: o1, s2: o2, s3: o3 } = decrypt(xk, s0, s1, s2, s3);
				o[i++] = o0 ^ ps0, o[i++] = o1 ^ ps1, o[i++] = o2 ^ ps2, o[i++] = o3 ^ ps3;
			}
			clean(...toClean);
			return validatePCKS(dst, pcks5);
		}
	};
});
/**
* CFB: Cipher Feedback Mode. The input for the block cipher is the previous cipher output.
* Unauthenticated: needs MAC.
*/
var cfb = /* @__PURE__ */ wrapCipher({
	blockSize: 16,
	nonceLength: 16
}, function aescfb(key, iv) {
	function processCfb(src, isEncrypt, dst) {
		abytes(src);
		const srcLen = src.length;
		dst = getOutput(srcLen, dst);
		if (overlapBytes(src, dst)) throw new Error("overlapping src and dst not supported.");
		const xk = expandKeyLE(key);
		let _iv = iv;
		const toClean = [xk];
		if (!isAligned32(_iv)) toClean.push(_iv = copyBytes(_iv));
		if (!isAligned32(src)) toClean.push(src = copyBytes(src));
		const src32 = u32(src);
		const dst32 = u32(dst);
		const next32 = isEncrypt ? dst32 : src32;
		const n32 = u32(_iv);
		let s0 = n32[0], s1 = n32[1], s2 = n32[2], s3 = n32[3];
		for (let i = 0; i + 4 <= src32.length;) {
			const { s0: e0, s1: e1, s2: e2, s3: e3 } = encrypt(xk, s0, s1, s2, s3);
			dst32[i + 0] = src32[i + 0] ^ e0;
			dst32[i + 1] = src32[i + 1] ^ e1;
			dst32[i + 2] = src32[i + 2] ^ e2;
			dst32[i + 3] = src32[i + 3] ^ e3;
			s0 = next32[i++], s1 = next32[i++], s2 = next32[i++], s3 = next32[i++];
		}
		const start = BLOCK_SIZE * Math.floor(src32.length / BLOCK_SIZE32);
		if (start < srcLen) {
			({s0, s1, s2, s3} = encrypt(xk, s0, s1, s2, s3));
			const buf = u8(new Uint32Array([
				s0,
				s1,
				s2,
				s3
			]));
			for (let i = start, pos = 0; i < srcLen; i++, pos++) dst[i] = src[i] ^ buf[pos];
			clean(buf);
		}
		clean(...toClean);
		return dst;
	}
	return {
		encrypt: (plaintext, dst) => processCfb(plaintext, true, dst),
		decrypt: (ciphertext, dst) => processCfb(ciphertext, false, dst)
	};
});
function computeTag(fn, isLE, key, data, AAD) {
	const aadLength = AAD ? AAD.length : 0;
	const h = fn.create(key, data.length + aadLength);
	if (AAD) h.update(AAD);
	const num = u64Lengths(8 * data.length, 8 * aadLength, isLE);
	h.update(data);
	h.update(num);
	const res = h.digest();
	clean(num);
	return res;
}
/**
* GCM: Galois/Counter Mode.
* Modern, parallel version of CTR, with MAC.
* Be careful: MACs can be forged.
* Unsafe to use random nonces under the same key, due to collision chance.
* As for nonce size, prefer 12-byte, instead of 8-byte.
*/
var gcm = /* @__PURE__ */ wrapCipher({
	blockSize: 16,
	nonceLength: 12,
	tagLength: 16,
	varSizeNonce: true
}, function aesgcm(key, nonce, AAD) {
	if (nonce.length < 8) throw new Error("aes/gcm: invalid nonce length");
	const tagLength = 16;
	function _computeTag(authKey, tagMask, data) {
		const tag = computeTag(ghash, false, authKey, data, AAD);
		for (let i = 0; i < tagMask.length; i++) tag[i] ^= tagMask[i];
		return tag;
	}
	function deriveKeys() {
		const xk = expandKeyLE(key);
		const authKey = EMPTY_BLOCK.slice();
		const counter = EMPTY_BLOCK.slice();
		ctr32(xk, false, counter, counter, authKey);
		if (nonce.length === 12) counter.set(nonce);
		else {
			const nonceLen = EMPTY_BLOCK.slice();
			setBigUint64(createView(nonceLen), 8, BigInt(nonce.length * 8), false);
			const g = ghash.create(authKey).update(nonce).update(nonceLen);
			g.digestInto(counter);
			g.destroy();
		}
		return {
			xk,
			authKey,
			counter,
			tagMask: ctr32(xk, false, counter, EMPTY_BLOCK)
		};
	}
	return {
		encrypt(plaintext) {
			const { xk, authKey, counter, tagMask } = deriveKeys();
			const out = new Uint8Array(plaintext.length + tagLength);
			const toClean = [
				xk,
				authKey,
				counter,
				tagMask
			];
			if (!isAligned32(plaintext)) toClean.push(plaintext = copyBytes(plaintext));
			ctr32(xk, false, counter, plaintext, out.subarray(0, plaintext.length));
			const tag = _computeTag(authKey, tagMask, out.subarray(0, out.length - tagLength));
			toClean.push(tag);
			out.set(tag, plaintext.length);
			clean(...toClean);
			return out;
		},
		decrypt(ciphertext) {
			const { xk, authKey, counter, tagMask } = deriveKeys();
			const toClean = [
				xk,
				authKey,
				tagMask,
				counter
			];
			if (!isAligned32(ciphertext)) toClean.push(ciphertext = copyBytes(ciphertext));
			const data = ciphertext.subarray(0, -tagLength);
			const passedTag = ciphertext.subarray(-tagLength);
			const tag = _computeTag(authKey, tagMask, data);
			toClean.push(tag);
			if (!equalBytes(tag, passedTag)) throw new Error("aes/gcm: invalid ghash tag");
			const out = ctr32(xk, false, counter, data);
			clean(...toClean);
			return out;
		}
	};
});
var limit = (name, min, max) => (value) => {
	if (!Number.isSafeInteger(value) || min > value || value > max) {
		const minmax = "[" + min + ".." + max + "]";
		throw new Error("" + name + ": expected value in range " + minmax + ", got " + value);
	}
};
/**
* AES-GCM-SIV: classic AES-GCM with nonce-misuse resistance.
* Guarantees that, when a nonce is repeated, the only security loss is that identical
* plaintexts will produce identical ciphertexts.
* RFC 8452, https://datatracker.ietf.org/doc/html/rfc8452
*/
var gcmsiv = /* @__PURE__ */ wrapCipher({
	blockSize: 16,
	nonceLength: 12,
	tagLength: 16,
	varSizeNonce: true
}, function aessiv(key, nonce, AAD) {
	const tagLength = 16;
	const AAD_LIMIT = limit("AAD", 0, 2 ** 36);
	const PLAIN_LIMIT = limit("plaintext", 0, 2 ** 36);
	const NONCE_LIMIT = limit("nonce", 12, 12);
	const CIPHER_LIMIT = limit("ciphertext", 16, 2 ** 36 + 16);
	abytes(key, 16, 24, 32);
	NONCE_LIMIT(nonce.length);
	if (AAD !== void 0) AAD_LIMIT(AAD.length);
	function deriveKeys() {
		const xk = expandKeyLE(key);
		const encKey = new Uint8Array(key.length);
		const authKey = new Uint8Array(16);
		const toClean = [xk, encKey];
		let _nonce = nonce;
		if (!isAligned32(_nonce)) toClean.push(_nonce = copyBytes(_nonce));
		const n32 = u32(_nonce);
		let s0 = 0, s1 = n32[0], s2 = n32[1], s3 = n32[2];
		let counter = 0;
		for (const derivedKey of [authKey, encKey].map(u32)) {
			const d32 = u32(derivedKey);
			for (let i = 0; i < d32.length; i += 2) {
				const { s0: o0, s1: o1 } = encrypt(xk, s0, s1, s2, s3);
				d32[i + 0] = o0;
				d32[i + 1] = o1;
				s0 = ++counter;
			}
		}
		const res = {
			authKey,
			encKey: expandKeyLE(encKey)
		};
		clean(...toClean);
		return res;
	}
	function _computeTag(encKey, authKey, data) {
		const tag = computeTag(polyval, true, authKey, data, AAD);
		for (let i = 0; i < 12; i++) tag[i] ^= nonce[i];
		tag[15] &= 127;
		const t32 = u32(tag);
		let s0 = t32[0], s1 = t32[1], s2 = t32[2], s3 = t32[3];
		({s0, s1, s2, s3} = encrypt(encKey, s0, s1, s2, s3));
		t32[0] = s0, t32[1] = s1, t32[2] = s2, t32[3] = s3;
		return tag;
	}
	function processSiv(encKey, tag, input) {
		let block = copyBytes(tag);
		block[15] |= 128;
		const res = ctr32(encKey, true, block, input);
		clean(block);
		return res;
	}
	return {
		encrypt(plaintext) {
			PLAIN_LIMIT(plaintext.length);
			const { encKey, authKey } = deriveKeys();
			const tag = _computeTag(encKey, authKey, plaintext);
			const toClean = [
				encKey,
				authKey,
				tag
			];
			if (!isAligned32(plaintext)) toClean.push(plaintext = copyBytes(plaintext));
			const out = new Uint8Array(plaintext.length + tagLength);
			out.set(tag, plaintext.length);
			out.set(processSiv(encKey, tag, plaintext));
			clean(...toClean);
			return out;
		},
		decrypt(ciphertext) {
			CIPHER_LIMIT(ciphertext.length);
			const tag = ciphertext.subarray(-tagLength);
			const { encKey, authKey } = deriveKeys();
			const toClean = [encKey, authKey];
			if (!isAligned32(ciphertext)) toClean.push(ciphertext = copyBytes(ciphertext));
			const plaintext = processSiv(encKey, tag, ciphertext.subarray(0, -tagLength));
			const expectedTag = _computeTag(encKey, authKey, plaintext);
			toClean.push(expectedTag);
			if (!equalBytes(tag, expectedTag)) {
				clean(...toClean);
				throw new Error("invalid polyval tag");
			}
			clean(...toClean);
			return plaintext;
		}
	};
});
/**
* AES-GCM-SIV, not AES-SIV.
* This is legace name, use `gcmsiv` export instead.
* @deprecated
*/
var siv = gcmsiv;
function isBytes32(a) {
	return a instanceof Uint32Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint32Array";
}
function encryptBlock(xk, block) {
	abytes(block, 16);
	if (!isBytes32(xk)) throw new Error("_encryptBlock accepts result of expandKeyLE");
	const b32 = u32(block);
	let { s0, s1, s2, s3 } = encrypt(xk, b32[0], b32[1], b32[2], b32[3]);
	b32[0] = s0, b32[1] = s1, b32[2] = s2, b32[3] = s3;
	return block;
}
function decryptBlock(xk, block) {
	abytes(block, 16);
	if (!isBytes32(xk)) throw new Error("_decryptBlock accepts result of expandKeyLE");
	const b32 = u32(block);
	let { s0, s1, s2, s3 } = decrypt(xk, b32[0], b32[1], b32[2], b32[3]);
	b32[0] = s0, b32[1] = s1, b32[2] = s2, b32[3] = s3;
	return block;
}
/**
* AES-W (base for AESKW/AESKWP).
* Specs: [SP800-38F](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38F.pdf),
* [RFC 3394](https://datatracker.ietf.org/doc/rfc3394/),
* [RFC 5649](https://datatracker.ietf.org/doc/rfc5649/).
*/
var AESW = {
	encrypt(kek, out) {
		if (out.length >= 2 ** 32) throw new Error("plaintext should be less than 4gb");
		const xk = expandKeyLE(kek);
		if (out.length === 16) encryptBlock(xk, out);
		else {
			const o32 = u32(out);
			let a0 = o32[0], a1 = o32[1];
			for (let j = 0, ctr = 1; j < 6; j++) for (let pos = 2; pos < o32.length; pos += 2, ctr++) {
				const { s0, s1, s2, s3 } = encrypt(xk, a0, a1, o32[pos], o32[pos + 1]);
				a0 = s0, a1 = s1 ^ byteSwap(ctr), o32[pos] = s2, o32[pos + 1] = s3;
			}
			o32[0] = a0, o32[1] = a1;
		}
		xk.fill(0);
	},
	decrypt(kek, out) {
		if (out.length - 8 >= 2 ** 32) throw new Error("ciphertext should be less than 4gb");
		const xk = expandKeyDecLE(kek);
		const chunks = out.length / 8 - 1;
		if (chunks === 1) decryptBlock(xk, out);
		else {
			const o32 = u32(out);
			let a0 = o32[0], a1 = o32[1];
			for (let j = 0, ctr = chunks * 6; j < 6; j++) for (let pos = chunks * 2; pos >= 1; pos -= 2, ctr--) {
				a1 ^= byteSwap(ctr);
				const { s0, s1, s2, s3 } = decrypt(xk, a0, a1, o32[pos], o32[pos + 1]);
				a0 = s0, a1 = s1, o32[pos] = s2, o32[pos + 1] = s3;
			}
			o32[0] = a0, o32[1] = a1;
		}
		xk.fill(0);
	}
};
var AESKW_IV = /* @__PURE__ */ new Uint8Array(8).fill(166);
/**
* AES-KW (key-wrap). Injects static IV into plaintext, adds counter, encrypts 6 times.
* Reduces block size from 16 to 8 bytes.
* For padded version, use aeskwp.
* [RFC 3394](https://datatracker.ietf.org/doc/rfc3394/),
* [NIST.SP.800-38F](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38F.pdf).
*/
var aeskw = /* @__PURE__ */ wrapCipher({ blockSize: 8 }, (kek) => ({
	encrypt(plaintext) {
		if (!plaintext.length || plaintext.length % 8 !== 0) throw new Error("invalid plaintext length");
		if (plaintext.length === 8) throw new Error("8-byte keys not allowed in AESKW, use AESKWP instead");
		const out = concatBytes(AESKW_IV, plaintext);
		AESW.encrypt(kek, out);
		return out;
	},
	decrypt(ciphertext) {
		if (ciphertext.length % 8 !== 0 || ciphertext.length < 24) throw new Error("invalid ciphertext length");
		const out = copyBytes(ciphertext);
		AESW.decrypt(kek, out);
		if (!equalBytes(out.subarray(0, 8), AESKW_IV)) throw new Error("integrity check failed");
		out.subarray(0, 8).fill(0);
		return out.subarray(8);
	}
}));
var AESKWP_IV = 2790873510;
/**
* AES-KW, but with padding and allows random keys.
* Second u32 of IV is used as counter for length.
* [RFC 5649](https://www.rfc-editor.org/rfc/rfc5649)
*/
var aeskwp = /* @__PURE__ */ wrapCipher({ blockSize: 8 }, (kek) => ({
	encrypt(plaintext) {
		if (!plaintext.length) throw new Error("invalid plaintext length");
		const padded = Math.ceil(plaintext.length / 8) * 8;
		const out = new Uint8Array(8 + padded);
		out.set(plaintext, 8);
		const out32 = u32(out);
		out32[0] = AESKWP_IV;
		out32[1] = byteSwap(plaintext.length);
		AESW.encrypt(kek, out);
		return out;
	},
	decrypt(ciphertext) {
		if (ciphertext.length < 16) throw new Error("invalid ciphertext length");
		const out = copyBytes(ciphertext);
		const o32 = u32(out);
		AESW.decrypt(kek, out);
		const len = byteSwap(o32[1]) >>> 0;
		const padded = Math.ceil(len / 8) * 8;
		if (o32[0] !== AESKWP_IV || out.length - 8 !== padded) throw new Error("integrity check failed");
		for (let i = len; i < padded; i++) if (out[8 + i] !== 0) throw new Error("integrity check failed");
		out.subarray(0, 8).fill(0);
		return out.subarray(8, 8 + len);
	}
}));
/** Unsafe low-level internal methods. May change at any time. */
var unsafe = {
	expandKeyLE,
	expandKeyDecLE,
	encrypt,
	decrypt,
	encryptBlock,
	decryptBlock,
	ctrCounter,
	ctr32
};
//#endregion
export { aeskw, aeskwp, cbc, cfb, ctr, ecb, gcm, gcmsiv, siv, unsafe };

//# sourceMappingURL=@noble_ciphers_aes__js.js.map