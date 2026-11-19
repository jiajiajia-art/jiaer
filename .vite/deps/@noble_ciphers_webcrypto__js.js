import { abytes, anumber, concatBytes } from "./@noble_ciphers_utils__js.js";
//#region node_modules/.pnpm/@noble+ciphers@1.3.0/node_modules/@noble/ciphers/esm/crypto.js
var crypto = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
//#endregion
//#region node_modules/.pnpm/@noble+ciphers@1.3.0/node_modules/@noble/ciphers/esm/webcrypto.js
/**
* WebCrypto-based AES gcm/ctr/cbc, `managedNonce` and `randomBytes`.
* We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
* node.js versions earlier than v19 don't declare it in global scope.
* For node.js, package.js on#exports field mapping rewrites import
* from `crypto` to `cryptoNode`, which imports native module.
* Makes the utils un-importable in browsers without a bundler.
* Once node.js 18 is deprecated, we can just drop the import.
* @module
*/
/**
* Secure PRNG. Uses `crypto.getRandomValues`, which defers to OS.
*/
function randomBytes(bytesLength = 32) {
	if (crypto && typeof crypto.getRandomValues === "function") return crypto.getRandomValues(new Uint8Array(bytesLength));
	if (crypto && typeof crypto.randomBytes === "function") return Uint8Array.from(crypto.randomBytes(bytesLength));
	throw new Error("crypto.getRandomValues must be defined");
}
function getWebcryptoSubtle() {
	if (crypto && typeof crypto.subtle === "object" && crypto.subtle != null) return crypto.subtle;
	throw new Error("crypto.subtle must be defined");
}
/**
* Uses CSPRG for nonce, nonce injected in ciphertext.
* @example
* const gcm = managedNonce(aes.gcm);
* const ciphr = gcm(key).encrypt(data);
* const plain = gcm(key).decrypt(ciph);
*/
function managedNonce(fn) {
	const { nonceLength } = fn;
	anumber(nonceLength);
	return ((key, ...args) => ({
		encrypt(plaintext, ...argsEnc) {
			const nonce = randomBytes(nonceLength);
			const ciphertext = fn(key, nonce, ...args).encrypt(plaintext, ...argsEnc);
			const out = concatBytes(nonce, ciphertext);
			ciphertext.fill(0);
			return out;
		},
		decrypt(ciphertext, ...argsDec) {
			const nonce = ciphertext.subarray(0, nonceLength);
			const data = ciphertext.subarray(nonceLength);
			return fn(key, nonce, ...args).decrypt(data, ...argsDec);
		}
	}));
}
var utils = {
	async encrypt(key, keyParams, cryptParams, plaintext) {
		const cr = getWebcryptoSubtle();
		const iKey = await cr.importKey("raw", key, keyParams, true, ["encrypt"]);
		const ciphertext = await cr.encrypt(cryptParams, iKey, plaintext);
		return new Uint8Array(ciphertext);
	},
	async decrypt(key, keyParams, cryptParams, ciphertext) {
		const cr = getWebcryptoSubtle();
		const iKey = await cr.importKey("raw", key, keyParams, true, ["decrypt"]);
		const plaintext = await cr.decrypt(cryptParams, iKey, ciphertext);
		return new Uint8Array(plaintext);
	}
};
var mode = {
	CBC: "AES-CBC",
	CTR: "AES-CTR",
	GCM: "AES-GCM"
};
function getCryptParams(algo, nonce, AAD) {
	if (algo === mode.CBC) return {
		name: mode.CBC,
		iv: nonce
	};
	if (algo === mode.CTR) return {
		name: mode.CTR,
		counter: nonce,
		length: 64
	};
	if (algo === mode.GCM) if (AAD) return {
		name: mode.GCM,
		iv: nonce,
		additionalData: AAD
	};
	else return {
		name: mode.GCM,
		iv: nonce
	};
	throw new Error("unknown aes block mode");
}
function generate(algo) {
	return (key, nonce, AAD) => {
		abytes(key);
		abytes(nonce);
		const keyParams = {
			name: algo,
			length: key.length * 8
		};
		const cryptParams = getCryptParams(algo, nonce, AAD);
		let consumed = false;
		return {
			encrypt(plaintext) {
				abytes(plaintext);
				if (consumed) throw new Error("Cannot encrypt() twice with same key / nonce");
				consumed = true;
				return utils.encrypt(key, keyParams, cryptParams, plaintext);
			},
			decrypt(ciphertext) {
				abytes(ciphertext);
				return utils.decrypt(key, keyParams, cryptParams, ciphertext);
			}
		};
	};
}
/** AES-CBC, native webcrypto version */
var cbc = generate(mode.CBC);
/** AES-CTR, native webcrypto version */
var ctr = generate(mode.CTR);
/** AES-GCM, native webcrypto version */
var gcm = generate(mode.GCM);
//#endregion
export { cbc, ctr, gcm, getWebcryptoSubtle, managedNonce, randomBytes, utils };

//# sourceMappingURL=@noble_ciphers_webcrypto__js.js.map