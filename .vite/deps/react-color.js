import { r as __toESM, t as __commonJSMin } from "./chunk-BoAXSpZd.js";
import { t as require_react } from "./react.js";
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_freeGlobal.js
var require__freeGlobal = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = typeof global == "object" && global && global.Object === Object && global;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_root.js
var require__root = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var freeGlobal = require__freeGlobal();
	/** Detect free variable `self`. */
	var freeSelf = typeof self == "object" && self && self.Object === Object && self;
	module.exports = freeGlobal || freeSelf || Function("return this")();
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_Symbol.js
var require__Symbol = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require__root().Symbol;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_getRawTag.js
var require__getRawTag = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Symbol = require__Symbol();
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	/**
	* Used to resolve the
	* [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	* of values.
	*/
	var nativeObjectToString = objectProto.toString;
	/** Built-in value references. */
	var symToStringTag = Symbol ? Symbol.toStringTag : void 0;
	/**
	* A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
	*
	* @private
	* @param {*} value The value to query.
	* @returns {string} Returns the raw `toStringTag`.
	*/
	function getRawTag(value) {
		var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
		try {
			value[symToStringTag] = void 0;
			var unmasked = true;
		} catch (e) {}
		var result = nativeObjectToString.call(value);
		if (unmasked) if (isOwn) value[symToStringTag] = tag;
		else delete value[symToStringTag];
		return result;
	}
	module.exports = getRawTag;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_objectToString.js
var require__objectToString = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Used to resolve the
	* [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	* of values.
	*/
	var nativeObjectToString = Object.prototype.toString;
	/**
	* Converts `value` to a string using `Object.prototype.toString`.
	*
	* @private
	* @param {*} value The value to convert.
	* @returns {string} Returns the converted string.
	*/
	function objectToString(value) {
		return nativeObjectToString.call(value);
	}
	module.exports = objectToString;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseGetTag.js
var require__baseGetTag = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Symbol = require__Symbol(), getRawTag = require__getRawTag(), objectToString = require__objectToString();
	/** `Object#toString` result references. */
	var nullTag = "[object Null]", undefinedTag = "[object Undefined]";
	/** Built-in value references. */
	var symToStringTag = Symbol ? Symbol.toStringTag : void 0;
	/**
	* The base implementation of `getTag` without fallbacks for buggy environments.
	*
	* @private
	* @param {*} value The value to query.
	* @returns {string} Returns the `toStringTag`.
	*/
	function baseGetTag(value) {
		if (value == null) return value === void 0 ? undefinedTag : nullTag;
		return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
	}
	module.exports = baseGetTag;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/isArray.js
var require_isArray = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = Array.isArray;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/isObjectLike.js
var require_isObjectLike = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Checks if `value` is object-like. A value is object-like if it's not `null`
	* and has a `typeof` result of "object".
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	* @example
	*
	* _.isObjectLike({});
	* // => true
	*
	* _.isObjectLike([1, 2, 3]);
	* // => true
	*
	* _.isObjectLike(_.noop);
	* // => false
	*
	* _.isObjectLike(null);
	* // => false
	*/
	function isObjectLike(value) {
		return value != null && typeof value == "object";
	}
	module.exports = isObjectLike;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/isString.js
var require_isString = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseGetTag = require__baseGetTag(), isArray = require_isArray(), isObjectLike = require_isObjectLike();
	/** `Object#toString` result references. */
	var stringTag = "[object String]";
	/**
	* Checks if `value` is classified as a `String` primitive or object.
	*
	* @static
	* @since 0.1.0
	* @memberOf _
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a string, else `false`.
	* @example
	*
	* _.isString('abc');
	* // => true
	*
	* _.isString(1);
	* // => false
	*/
	function isString(value) {
		return typeof value == "string" || !isArray(value) && isObjectLike(value) && baseGetTag(value) == stringTag;
	}
	module.exports = isString;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_createBaseFor.js
var require__createBaseFor = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Creates a base function for methods like `_.forIn` and `_.forOwn`.
	*
	* @private
	* @param {boolean} [fromRight] Specify iterating from right to left.
	* @returns {Function} Returns the new base function.
	*/
	function createBaseFor(fromRight) {
		return function(object, iteratee, keysFunc) {
			var index = -1, iterable = Object(object), props = keysFunc(object), length = props.length;
			while (length--) {
				var key = props[fromRight ? length : ++index];
				if (iteratee(iterable[key], key, iterable) === false) break;
			}
			return object;
		};
	}
	module.exports = createBaseFor;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseFor.js
var require__baseFor = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require__createBaseFor()();
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseTimes.js
var require__baseTimes = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* The base implementation of `_.times` without support for iteratee shorthands
	* or max array length checks.
	*
	* @private
	* @param {number} n The number of times to invoke `iteratee`.
	* @param {Function} iteratee The function invoked per iteration.
	* @returns {Array} Returns the array of results.
	*/
	function baseTimes(n, iteratee) {
		var index = -1, result = Array(n);
		while (++index < n) result[index] = iteratee(index);
		return result;
	}
	module.exports = baseTimes;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseIsArguments.js
var require__baseIsArguments = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseGetTag = require__baseGetTag(), isObjectLike = require_isObjectLike();
	/** `Object#toString` result references. */
	var argsTag = "[object Arguments]";
	/**
	* The base implementation of `_.isArguments`.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is an `arguments` object,
	*/
	function baseIsArguments(value) {
		return isObjectLike(value) && baseGetTag(value) == argsTag;
	}
	module.exports = baseIsArguments;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/isArguments.js
var require_isArguments = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseIsArguments = require__baseIsArguments(), isObjectLike = require_isObjectLike();
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	/** Built-in value references. */
	var propertyIsEnumerable = objectProto.propertyIsEnumerable;
	module.exports = baseIsArguments(function() {
		return arguments;
	}()) ? baseIsArguments : function(value) {
		return isObjectLike(value) && hasOwnProperty.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
	};
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/stubFalse.js
var require_stubFalse = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* This method returns `false`.
	*
	* @static
	* @memberOf _
	* @since 4.13.0
	* @category Util
	* @returns {boolean} Returns `false`.
	* @example
	*
	* _.times(2, _.stubFalse);
	* // => [false, false]
	*/
	function stubFalse() {
		return false;
	}
	module.exports = stubFalse;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/isBuffer.js
var require_isBuffer = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var root = require__root(), stubFalse = require_stubFalse();
	/** Detect free variable `exports`. */
	var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
	/** Detect free variable `module`. */
	var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
	/** Built-in value references. */
	var Buffer = freeModule && freeModule.exports === freeExports ? root.Buffer : void 0;
	module.exports = (Buffer ? Buffer.isBuffer : void 0) || stubFalse;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_isIndex.js
var require__isIndex = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/** Used as references for various `Number` constants. */
	var MAX_SAFE_INTEGER = 9007199254740991;
	/** Used to detect unsigned integer values. */
	var reIsUint = /^(?:0|[1-9]\d*)$/;
	/**
	* Checks if `value` is a valid array-like index.
	*
	* @private
	* @param {*} value The value to check.
	* @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	* @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	*/
	function isIndex(value, length) {
		var type = typeof value;
		length = length == null ? MAX_SAFE_INTEGER : length;
		return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && value > -1 && value % 1 == 0 && value < length;
	}
	module.exports = isIndex;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/isLength.js
var require_isLength = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/** Used as references for various `Number` constants. */
	var MAX_SAFE_INTEGER = 9007199254740991;
	/**
	* Checks if `value` is a valid array-like length.
	*
	* **Note:** This method is loosely based on
	* [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	* @example
	*
	* _.isLength(3);
	* // => true
	*
	* _.isLength(Number.MIN_VALUE);
	* // => false
	*
	* _.isLength(Infinity);
	* // => false
	*
	* _.isLength('3');
	* // => false
	*/
	function isLength(value) {
		return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}
	module.exports = isLength;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseIsTypedArray.js
var require__baseIsTypedArray = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseGetTag = require__baseGetTag(), isLength = require_isLength(), isObjectLike = require_isObjectLike();
	/** `Object#toString` result references. */
	var argsTag = "[object Arguments]", arrayTag = "[object Array]", boolTag = "[object Boolean]", dateTag = "[object Date]", errorTag = "[object Error]", funcTag = "[object Function]", mapTag = "[object Map]", numberTag = "[object Number]", objectTag = "[object Object]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", weakMapTag = "[object WeakMap]";
	var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
	/** Used to identify `toStringTag` values of typed arrays. */
	var typedArrayTags = {};
	typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
	typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
	/**
	* The base implementation of `_.isTypedArray` without Node.js optimizations.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
	*/
	function baseIsTypedArray(value) {
		return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
	}
	module.exports = baseIsTypedArray;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseUnary.js
var require__baseUnary = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* The base implementation of `_.unary` without support for storing metadata.
	*
	* @private
	* @param {Function} func The function to cap arguments for.
	* @returns {Function} Returns the new capped function.
	*/
	function baseUnary(func) {
		return function(value) {
			return func(value);
		};
	}
	module.exports = baseUnary;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_nodeUtil.js
var require__nodeUtil = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var freeGlobal = require__freeGlobal();
	/** Detect free variable `exports`. */
	var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
	/** Detect free variable `module`. */
	var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
	/** Detect free variable `process` from Node.js. */
	var freeProcess = freeModule && freeModule.exports === freeExports && freeGlobal.process;
	module.exports = function() {
		try {
			var types = freeModule && freeModule.require && freeModule.require("util").types;
			if (types) return types;
			return freeProcess && freeProcess.binding && freeProcess.binding("util");
		} catch (e) {}
	}();
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/isTypedArray.js
var require_isTypedArray = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseIsTypedArray = require__baseIsTypedArray(), baseUnary = require__baseUnary(), nodeUtil = require__nodeUtil();
	var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
	module.exports = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_arrayLikeKeys.js
var require__arrayLikeKeys = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseTimes = require__baseTimes(), isArguments = require_isArguments(), isArray = require_isArray(), isBuffer = require_isBuffer(), isIndex = require__isIndex(), isTypedArray = require_isTypedArray();
	/** Used to check objects for own properties. */
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	/**
	* Creates an array of the enumerable property names of the array-like `value`.
	*
	* @private
	* @param {*} value The value to query.
	* @param {boolean} inherited Specify returning inherited property names.
	* @returns {Array} Returns the array of property names.
	*/
	function arrayLikeKeys(value, inherited) {
		var isArr = isArray(value), isArg = !isArr && isArguments(value), isBuff = !isArr && !isArg && isBuffer(value), isType = !isArr && !isArg && !isBuff && isTypedArray(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes(value.length, String) : [], length = result.length;
		for (var key in value) if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && (key == "length" || isBuff && (key == "offset" || key == "parent") || isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || isIndex(key, length)))) result.push(key);
		return result;
	}
	module.exports = arrayLikeKeys;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_isPrototype.js
var require__isPrototype = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	/**
	* Checks if `value` is likely a prototype object.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
	*/
	function isPrototype(value) {
		var Ctor = value && value.constructor;
		return value === (typeof Ctor == "function" && Ctor.prototype || objectProto);
	}
	module.exports = isPrototype;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_overArg.js
var require__overArg = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Creates a unary function that invokes `func` with its argument transformed.
	*
	* @private
	* @param {Function} func The function to wrap.
	* @param {Function} transform The argument transform.
	* @returns {Function} Returns the new function.
	*/
	function overArg(func, transform) {
		return function(arg) {
			return func(transform(arg));
		};
	}
	module.exports = overArg;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_nativeKeys.js
var require__nativeKeys = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require__overArg()(Object.keys, Object);
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseKeys.js
var require__baseKeys = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isPrototype = require__isPrototype(), nativeKeys = require__nativeKeys();
	/** Used to check objects for own properties. */
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	/**
	* The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
	*
	* @private
	* @param {Object} object The object to query.
	* @returns {Array} Returns the array of property names.
	*/
	function baseKeys(object) {
		if (!isPrototype(object)) return nativeKeys(object);
		var result = [];
		for (var key in Object(object)) if (hasOwnProperty.call(object, key) && key != "constructor") result.push(key);
		return result;
	}
	module.exports = baseKeys;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/isObject.js
var require_isObject = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Checks if `value` is the
	* [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
	* of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is an object, else `false`.
	* @example
	*
	* _.isObject({});
	* // => true
	*
	* _.isObject([1, 2, 3]);
	* // => true
	*
	* _.isObject(_.noop);
	* // => true
	*
	* _.isObject(null);
	* // => false
	*/
	function isObject(value) {
		var type = typeof value;
		return value != null && (type == "object" || type == "function");
	}
	module.exports = isObject;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/isFunction.js
var require_isFunction = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseGetTag = require__baseGetTag(), isObject = require_isObject();
	/** `Object#toString` result references. */
	var asyncTag = "[object AsyncFunction]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", proxyTag = "[object Proxy]";
	/**
	* Checks if `value` is classified as a `Function` object.
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a function, else `false`.
	* @example
	*
	* _.isFunction(_);
	* // => true
	*
	* _.isFunction(/abc/);
	* // => false
	*/
	function isFunction(value) {
		if (!isObject(value)) return false;
		var tag = baseGetTag(value);
		return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
	}
	module.exports = isFunction;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/isArrayLike.js
var require_isArrayLike = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isFunction = require_isFunction(), isLength = require_isLength();
	/**
	* Checks if `value` is array-like. A value is considered array-like if it's
	* not a function and has a `value.length` that's an integer greater than or
	* equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	* @example
	*
	* _.isArrayLike([1, 2, 3]);
	* // => true
	*
	* _.isArrayLike(document.body.children);
	* // => true
	*
	* _.isArrayLike('abc');
	* // => true
	*
	* _.isArrayLike(_.noop);
	* // => false
	*/
	function isArrayLike(value) {
		return value != null && isLength(value.length) && !isFunction(value);
	}
	module.exports = isArrayLike;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/keys.js
var require_keys = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var arrayLikeKeys = require__arrayLikeKeys(), baseKeys = require__baseKeys(), isArrayLike = require_isArrayLike();
	/**
	* Creates an array of the own enumerable property names of `object`.
	*
	* **Note:** Non-object values are coerced to objects. See the
	* [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
	* for more details.
	*
	* @static
	* @since 0.1.0
	* @memberOf _
	* @category Object
	* @param {Object} object The object to query.
	* @returns {Array} Returns the array of property names.
	* @example
	*
	* function Foo() {
	*   this.a = 1;
	*   this.b = 2;
	* }
	*
	* Foo.prototype.c = 3;
	*
	* _.keys(new Foo);
	* // => ['a', 'b'] (iteration order is not guaranteed)
	*
	* _.keys('hi');
	* // => ['0', '1']
	*/
	function keys(object) {
		return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
	}
	module.exports = keys;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseForOwn.js
var require__baseForOwn = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseFor = require__baseFor(), keys = require_keys();
	/**
	* The base implementation of `_.forOwn` without support for iteratee shorthands.
	*
	* @private
	* @param {Object} object The object to iterate over.
	* @param {Function} iteratee The function invoked per iteration.
	* @returns {Object} Returns `object`.
	*/
	function baseForOwn(object, iteratee) {
		return object && baseFor(object, iteratee, keys);
	}
	module.exports = baseForOwn;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/identity.js
var require_identity = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* This method returns the first argument it receives.
	*
	* @static
	* @since 0.1.0
	* @memberOf _
	* @category Util
	* @param {*} value Any value.
	* @returns {*} Returns `value`.
	* @example
	*
	* var object = { 'a': 1 };
	*
	* console.log(_.identity(object) === object);
	* // => true
	*/
	function identity(value) {
		return value;
	}
	module.exports = identity;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_castFunction.js
var require__castFunction = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var identity = require_identity();
	/**
	* Casts `value` to `identity` if it's not a function.
	*
	* @private
	* @param {*} value The value to inspect.
	* @returns {Function} Returns cast function.
	*/
	function castFunction(value) {
		return typeof value == "function" ? value : identity;
	}
	module.exports = castFunction;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/forOwn.js
var require_forOwn = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseForOwn = require__baseForOwn(), castFunction = require__castFunction();
	/**
	* Iterates over own enumerable string keyed properties of an object and
	* invokes `iteratee` for each property. The iteratee is invoked with three
	* arguments: (value, key, object). Iteratee functions may exit iteration
	* early by explicitly returning `false`.
	*
	* @static
	* @memberOf _
	* @since 0.3.0
	* @category Object
	* @param {Object} object The object to iterate over.
	* @param {Function} [iteratee=_.identity] The function invoked per iteration.
	* @returns {Object} Returns `object`.
	* @see _.forOwnRight
	* @example
	*
	* function Foo() {
	*   this.a = 1;
	*   this.b = 2;
	* }
	*
	* Foo.prototype.c = 3;
	*
	* _.forOwn(new Foo, function(value, key) {
	*   console.log(key);
	* });
	* // => Logs 'a' then 'b' (iteration order is not guaranteed).
	*/
	function forOwn(object, iteratee) {
		return object && baseForOwn(object, castFunction(iteratee));
	}
	module.exports = forOwn;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_getPrototype.js
var require__getPrototype = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require__overArg()(Object.getPrototypeOf, Object);
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/isPlainObject.js
var require_isPlainObject = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseGetTag = require__baseGetTag(), getPrototype = require__getPrototype(), isObjectLike = require_isObjectLike();
	/** `Object#toString` result references. */
	var objectTag = "[object Object]";
	/** Used for built-in method references. */
	var funcProto = Function.prototype, objectProto = Object.prototype;
	/** Used to resolve the decompiled source of functions. */
	var funcToString = funcProto.toString;
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	/** Used to infer the `Object` constructor. */
	var objectCtorString = funcToString.call(Object);
	/**
	* Checks if `value` is a plain object, that is, an object created by the
	* `Object` constructor or one with a `[[Prototype]]` of `null`.
	*
	* @static
	* @memberOf _
	* @since 0.8.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
	* @example
	*
	* function Foo() {
	*   this.a = 1;
	* }
	*
	* _.isPlainObject(new Foo);
	* // => false
	*
	* _.isPlainObject([1, 2, 3]);
	* // => false
	*
	* _.isPlainObject({ 'x': 0, 'y': 0 });
	* // => true
	*
	* _.isPlainObject(Object.create(null));
	* // => true
	*/
	function isPlainObject(value) {
		if (!isObjectLike(value) || baseGetTag(value) != objectTag) return false;
		var proto = getPrototype(value);
		if (proto === null) return true;
		var Ctor = hasOwnProperty.call(proto, "constructor") && proto.constructor;
		return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
	}
	module.exports = isPlainObject;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_arrayMap.js
var require__arrayMap = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* A specialized version of `_.map` for arrays without support for iteratee
	* shorthands.
	*
	* @private
	* @param {Array} [array] The array to iterate over.
	* @param {Function} iteratee The function invoked per iteration.
	* @returns {Array} Returns the new mapped array.
	*/
	function arrayMap(array, iteratee) {
		var index = -1, length = array == null ? 0 : array.length, result = Array(length);
		while (++index < length) result[index] = iteratee(array[index], index, array);
		return result;
	}
	module.exports = arrayMap;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_listCacheClear.js
var require__listCacheClear = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Removes all key-value entries from the list cache.
	*
	* @private
	* @name clear
	* @memberOf ListCache
	*/
	function listCacheClear() {
		this.__data__ = [];
		this.size = 0;
	}
	module.exports = listCacheClear;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/eq.js
var require_eq = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Performs a
	* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	* comparison between two values to determine if they are equivalent.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to compare.
	* @param {*} other The other value to compare.
	* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	* @example
	*
	* var object = { 'a': 1 };
	* var other = { 'a': 1 };
	*
	* _.eq(object, object);
	* // => true
	*
	* _.eq(object, other);
	* // => false
	*
	* _.eq('a', 'a');
	* // => true
	*
	* _.eq('a', Object('a'));
	* // => false
	*
	* _.eq(NaN, NaN);
	* // => true
	*/
	function eq(value, other) {
		return value === other || value !== value && other !== other;
	}
	module.exports = eq;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_assocIndexOf.js
var require__assocIndexOf = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var eq = require_eq();
	/**
	* Gets the index at which the `key` is found in `array` of key-value pairs.
	*
	* @private
	* @param {Array} array The array to inspect.
	* @param {*} key The key to search for.
	* @returns {number} Returns the index of the matched value, else `-1`.
	*/
	function assocIndexOf(array, key) {
		var length = array.length;
		while (length--) if (eq(array[length][0], key)) return length;
		return -1;
	}
	module.exports = assocIndexOf;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_listCacheDelete.js
var require__listCacheDelete = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var assocIndexOf = require__assocIndexOf();
	/** Built-in value references. */
	var splice = Array.prototype.splice;
	/**
	* Removes `key` and its value from the list cache.
	*
	* @private
	* @name delete
	* @memberOf ListCache
	* @param {string} key The key of the value to remove.
	* @returns {boolean} Returns `true` if the entry was removed, else `false`.
	*/
	function listCacheDelete(key) {
		var data = this.__data__, index = assocIndexOf(data, key);
		if (index < 0) return false;
		if (index == data.length - 1) data.pop();
		else splice.call(data, index, 1);
		--this.size;
		return true;
	}
	module.exports = listCacheDelete;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_listCacheGet.js
var require__listCacheGet = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var assocIndexOf = require__assocIndexOf();
	/**
	* Gets the list cache value for `key`.
	*
	* @private
	* @name get
	* @memberOf ListCache
	* @param {string} key The key of the value to get.
	* @returns {*} Returns the entry value.
	*/
	function listCacheGet(key) {
		var data = this.__data__, index = assocIndexOf(data, key);
		return index < 0 ? void 0 : data[index][1];
	}
	module.exports = listCacheGet;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_listCacheHas.js
var require__listCacheHas = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var assocIndexOf = require__assocIndexOf();
	/**
	* Checks if a list cache value for `key` exists.
	*
	* @private
	* @name has
	* @memberOf ListCache
	* @param {string} key The key of the entry to check.
	* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	*/
	function listCacheHas(key) {
		return assocIndexOf(this.__data__, key) > -1;
	}
	module.exports = listCacheHas;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_listCacheSet.js
var require__listCacheSet = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var assocIndexOf = require__assocIndexOf();
	/**
	* Sets the list cache `key` to `value`.
	*
	* @private
	* @name set
	* @memberOf ListCache
	* @param {string} key The key of the value to set.
	* @param {*} value The value to set.
	* @returns {Object} Returns the list cache instance.
	*/
	function listCacheSet(key, value) {
		var data = this.__data__, index = assocIndexOf(data, key);
		if (index < 0) {
			++this.size;
			data.push([key, value]);
		} else data[index][1] = value;
		return this;
	}
	module.exports = listCacheSet;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_ListCache.js
var require__ListCache = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var listCacheClear = require__listCacheClear(), listCacheDelete = require__listCacheDelete(), listCacheGet = require__listCacheGet(), listCacheHas = require__listCacheHas(), listCacheSet = require__listCacheSet();
	/**
	* Creates an list cache object.
	*
	* @private
	* @constructor
	* @param {Array} [entries] The key-value pairs to cache.
	*/
	function ListCache(entries) {
		var index = -1, length = entries == null ? 0 : entries.length;
		this.clear();
		while (++index < length) {
			var entry = entries[index];
			this.set(entry[0], entry[1]);
		}
	}
	ListCache.prototype.clear = listCacheClear;
	ListCache.prototype["delete"] = listCacheDelete;
	ListCache.prototype.get = listCacheGet;
	ListCache.prototype.has = listCacheHas;
	ListCache.prototype.set = listCacheSet;
	module.exports = ListCache;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_stackClear.js
var require__stackClear = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ListCache = require__ListCache();
	/**
	* Removes all key-value entries from the stack.
	*
	* @private
	* @name clear
	* @memberOf Stack
	*/
	function stackClear() {
		this.__data__ = new ListCache();
		this.size = 0;
	}
	module.exports = stackClear;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_stackDelete.js
var require__stackDelete = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Removes `key` and its value from the stack.
	*
	* @private
	* @name delete
	* @memberOf Stack
	* @param {string} key The key of the value to remove.
	* @returns {boolean} Returns `true` if the entry was removed, else `false`.
	*/
	function stackDelete(key) {
		var data = this.__data__, result = data["delete"](key);
		this.size = data.size;
		return result;
	}
	module.exports = stackDelete;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_stackGet.js
var require__stackGet = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Gets the stack value for `key`.
	*
	* @private
	* @name get
	* @memberOf Stack
	* @param {string} key The key of the value to get.
	* @returns {*} Returns the entry value.
	*/
	function stackGet(key) {
		return this.__data__.get(key);
	}
	module.exports = stackGet;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_stackHas.js
var require__stackHas = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Checks if a stack value for `key` exists.
	*
	* @private
	* @name has
	* @memberOf Stack
	* @param {string} key The key of the entry to check.
	* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	*/
	function stackHas(key) {
		return this.__data__.has(key);
	}
	module.exports = stackHas;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_coreJsData.js
var require__coreJsData = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require__root()["__core-js_shared__"];
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_isMasked.js
var require__isMasked = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var coreJsData = require__coreJsData();
	/** Used to detect methods masquerading as native. */
	var maskSrcKey = function() {
		var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
		return uid ? "Symbol(src)_1." + uid : "";
	}();
	/**
	* Checks if `func` has its source masked.
	*
	* @private
	* @param {Function} func The function to check.
	* @returns {boolean} Returns `true` if `func` is masked, else `false`.
	*/
	function isMasked(func) {
		return !!maskSrcKey && maskSrcKey in func;
	}
	module.exports = isMasked;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_toSource.js
var require__toSource = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/** Used to resolve the decompiled source of functions. */
	var funcToString = Function.prototype.toString;
	/**
	* Converts `func` to its source code.
	*
	* @private
	* @param {Function} func The function to convert.
	* @returns {string} Returns the source code.
	*/
	function toSource(func) {
		if (func != null) {
			try {
				return funcToString.call(func);
			} catch (e) {}
			try {
				return func + "";
			} catch (e) {}
		}
		return "";
	}
	module.exports = toSource;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseIsNative.js
var require__baseIsNative = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isFunction = require_isFunction(), isMasked = require__isMasked(), isObject = require_isObject(), toSource = require__toSource();
	/**
	* Used to match `RegExp`
	* [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
	*/
	var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
	/** Used to detect host constructors (Safari). */
	var reIsHostCtor = /^\[object .+?Constructor\]$/;
	/** Used for built-in method references. */
	var funcProto = Function.prototype, objectProto = Object.prototype;
	/** Used to resolve the decompiled source of functions. */
	var funcToString = funcProto.toString;
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	/** Used to detect if a method is native. */
	var reIsNative = RegExp("^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$");
	/**
	* The base implementation of `_.isNative` without bad shim checks.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a native function,
	*  else `false`.
	*/
	function baseIsNative(value) {
		if (!isObject(value) || isMasked(value)) return false;
		return (isFunction(value) ? reIsNative : reIsHostCtor).test(toSource(value));
	}
	module.exports = baseIsNative;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_getValue.js
var require__getValue = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Gets the value at `key` of `object`.
	*
	* @private
	* @param {Object} [object] The object to query.
	* @param {string} key The key of the property to get.
	* @returns {*} Returns the property value.
	*/
	function getValue(object, key) {
		return object == null ? void 0 : object[key];
	}
	module.exports = getValue;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_getNative.js
var require__getNative = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseIsNative = require__baseIsNative(), getValue = require__getValue();
	/**
	* Gets the native function at `key` of `object`.
	*
	* @private
	* @param {Object} object The object to query.
	* @param {string} key The key of the method to get.
	* @returns {*} Returns the function if it's native, else `undefined`.
	*/
	function getNative(object, key) {
		var value = getValue(object, key);
		return baseIsNative(value) ? value : void 0;
	}
	module.exports = getNative;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_Map.js
var require__Map = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require__getNative()(require__root(), "Map");
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_nativeCreate.js
var require__nativeCreate = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require__getNative()(Object, "create");
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_hashClear.js
var require__hashClear = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var nativeCreate = require__nativeCreate();
	/**
	* Removes all key-value entries from the hash.
	*
	* @private
	* @name clear
	* @memberOf Hash
	*/
	function hashClear() {
		this.__data__ = nativeCreate ? nativeCreate(null) : {};
		this.size = 0;
	}
	module.exports = hashClear;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_hashDelete.js
var require__hashDelete = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Removes `key` and its value from the hash.
	*
	* @private
	* @name delete
	* @memberOf Hash
	* @param {Object} hash The hash to modify.
	* @param {string} key The key of the value to remove.
	* @returns {boolean} Returns `true` if the entry was removed, else `false`.
	*/
	function hashDelete(key) {
		var result = this.has(key) && delete this.__data__[key];
		this.size -= result ? 1 : 0;
		return result;
	}
	module.exports = hashDelete;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_hashGet.js
var require__hashGet = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var nativeCreate = require__nativeCreate();
	/** Used to stand-in for `undefined` hash values. */
	var HASH_UNDEFINED = "__lodash_hash_undefined__";
	/** Used to check objects for own properties. */
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	/**
	* Gets the hash value for `key`.
	*
	* @private
	* @name get
	* @memberOf Hash
	* @param {string} key The key of the value to get.
	* @returns {*} Returns the entry value.
	*/
	function hashGet(key) {
		var data = this.__data__;
		if (nativeCreate) {
			var result = data[key];
			return result === HASH_UNDEFINED ? void 0 : result;
		}
		return hasOwnProperty.call(data, key) ? data[key] : void 0;
	}
	module.exports = hashGet;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_hashHas.js
var require__hashHas = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var nativeCreate = require__nativeCreate();
	/** Used to check objects for own properties. */
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	/**
	* Checks if a hash value for `key` exists.
	*
	* @private
	* @name has
	* @memberOf Hash
	* @param {string} key The key of the entry to check.
	* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	*/
	function hashHas(key) {
		var data = this.__data__;
		return nativeCreate ? data[key] !== void 0 : hasOwnProperty.call(data, key);
	}
	module.exports = hashHas;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_hashSet.js
var require__hashSet = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var nativeCreate = require__nativeCreate();
	/** Used to stand-in for `undefined` hash values. */
	var HASH_UNDEFINED = "__lodash_hash_undefined__";
	/**
	* Sets the hash `key` to `value`.
	*
	* @private
	* @name set
	* @memberOf Hash
	* @param {string} key The key of the value to set.
	* @param {*} value The value to set.
	* @returns {Object} Returns the hash instance.
	*/
	function hashSet(key, value) {
		var data = this.__data__;
		this.size += this.has(key) ? 0 : 1;
		data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED : value;
		return this;
	}
	module.exports = hashSet;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_Hash.js
var require__Hash = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var hashClear = require__hashClear(), hashDelete = require__hashDelete(), hashGet = require__hashGet(), hashHas = require__hashHas(), hashSet = require__hashSet();
	/**
	* Creates a hash object.
	*
	* @private
	* @constructor
	* @param {Array} [entries] The key-value pairs to cache.
	*/
	function Hash(entries) {
		var index = -1, length = entries == null ? 0 : entries.length;
		this.clear();
		while (++index < length) {
			var entry = entries[index];
			this.set(entry[0], entry[1]);
		}
	}
	Hash.prototype.clear = hashClear;
	Hash.prototype["delete"] = hashDelete;
	Hash.prototype.get = hashGet;
	Hash.prototype.has = hashHas;
	Hash.prototype.set = hashSet;
	module.exports = Hash;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_mapCacheClear.js
var require__mapCacheClear = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Hash = require__Hash(), ListCache = require__ListCache(), Map = require__Map();
	/**
	* Removes all key-value entries from the map.
	*
	* @private
	* @name clear
	* @memberOf MapCache
	*/
	function mapCacheClear() {
		this.size = 0;
		this.__data__ = {
			"hash": new Hash(),
			"map": new (Map || ListCache)(),
			"string": new Hash()
		};
	}
	module.exports = mapCacheClear;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_isKeyable.js
var require__isKeyable = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Checks if `value` is suitable for use as unique object key.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is suitable, else `false`.
	*/
	function isKeyable(value) {
		var type = typeof value;
		return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
	}
	module.exports = isKeyable;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_getMapData.js
var require__getMapData = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isKeyable = require__isKeyable();
	/**
	* Gets the data for `map`.
	*
	* @private
	* @param {Object} map The map to query.
	* @param {string} key The reference key.
	* @returns {*} Returns the map data.
	*/
	function getMapData(map, key) {
		var data = map.__data__;
		return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
	}
	module.exports = getMapData;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_mapCacheDelete.js
var require__mapCacheDelete = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var getMapData = require__getMapData();
	/**
	* Removes `key` and its value from the map.
	*
	* @private
	* @name delete
	* @memberOf MapCache
	* @param {string} key The key of the value to remove.
	* @returns {boolean} Returns `true` if the entry was removed, else `false`.
	*/
	function mapCacheDelete(key) {
		var result = getMapData(this, key)["delete"](key);
		this.size -= result ? 1 : 0;
		return result;
	}
	module.exports = mapCacheDelete;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_mapCacheGet.js
var require__mapCacheGet = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var getMapData = require__getMapData();
	/**
	* Gets the map value for `key`.
	*
	* @private
	* @name get
	* @memberOf MapCache
	* @param {string} key The key of the value to get.
	* @returns {*} Returns the entry value.
	*/
	function mapCacheGet(key) {
		return getMapData(this, key).get(key);
	}
	module.exports = mapCacheGet;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_mapCacheHas.js
var require__mapCacheHas = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var getMapData = require__getMapData();
	/**
	* Checks if a map value for `key` exists.
	*
	* @private
	* @name has
	* @memberOf MapCache
	* @param {string} key The key of the entry to check.
	* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	*/
	function mapCacheHas(key) {
		return getMapData(this, key).has(key);
	}
	module.exports = mapCacheHas;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_mapCacheSet.js
var require__mapCacheSet = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var getMapData = require__getMapData();
	/**
	* Sets the map `key` to `value`.
	*
	* @private
	* @name set
	* @memberOf MapCache
	* @param {string} key The key of the value to set.
	* @param {*} value The value to set.
	* @returns {Object} Returns the map cache instance.
	*/
	function mapCacheSet(key, value) {
		var data = getMapData(this, key), size = data.size;
		data.set(key, value);
		this.size += data.size == size ? 0 : 1;
		return this;
	}
	module.exports = mapCacheSet;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_MapCache.js
var require__MapCache = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var mapCacheClear = require__mapCacheClear(), mapCacheDelete = require__mapCacheDelete(), mapCacheGet = require__mapCacheGet(), mapCacheHas = require__mapCacheHas(), mapCacheSet = require__mapCacheSet();
	/**
	* Creates a map cache object to store key-value pairs.
	*
	* @private
	* @constructor
	* @param {Array} [entries] The key-value pairs to cache.
	*/
	function MapCache(entries) {
		var index = -1, length = entries == null ? 0 : entries.length;
		this.clear();
		while (++index < length) {
			var entry = entries[index];
			this.set(entry[0], entry[1]);
		}
	}
	MapCache.prototype.clear = mapCacheClear;
	MapCache.prototype["delete"] = mapCacheDelete;
	MapCache.prototype.get = mapCacheGet;
	MapCache.prototype.has = mapCacheHas;
	MapCache.prototype.set = mapCacheSet;
	module.exports = MapCache;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_stackSet.js
var require__stackSet = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ListCache = require__ListCache(), Map = require__Map(), MapCache = require__MapCache();
	/** Used as the size to enable large array optimizations. */
	var LARGE_ARRAY_SIZE = 200;
	/**
	* Sets the stack `key` to `value`.
	*
	* @private
	* @name set
	* @memberOf Stack
	* @param {string} key The key of the value to set.
	* @param {*} value The value to set.
	* @returns {Object} Returns the stack cache instance.
	*/
	function stackSet(key, value) {
		var data = this.__data__;
		if (data instanceof ListCache) {
			var pairs = data.__data__;
			if (!Map || pairs.length < LARGE_ARRAY_SIZE - 1) {
				pairs.push([key, value]);
				this.size = ++data.size;
				return this;
			}
			data = this.__data__ = new MapCache(pairs);
		}
		data.set(key, value);
		this.size = data.size;
		return this;
	}
	module.exports = stackSet;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_Stack.js
var require__Stack = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ListCache = require__ListCache(), stackClear = require__stackClear(), stackDelete = require__stackDelete(), stackGet = require__stackGet(), stackHas = require__stackHas(), stackSet = require__stackSet();
	/**
	* Creates a stack cache object to store key-value pairs.
	*
	* @private
	* @constructor
	* @param {Array} [entries] The key-value pairs to cache.
	*/
	function Stack(entries) {
		this.size = (this.__data__ = new ListCache(entries)).size;
	}
	Stack.prototype.clear = stackClear;
	Stack.prototype["delete"] = stackDelete;
	Stack.prototype.get = stackGet;
	Stack.prototype.has = stackHas;
	Stack.prototype.set = stackSet;
	module.exports = Stack;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_setCacheAdd.js
var require__setCacheAdd = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/** Used to stand-in for `undefined` hash values. */
	var HASH_UNDEFINED = "__lodash_hash_undefined__";
	/**
	* Adds `value` to the array cache.
	*
	* @private
	* @name add
	* @memberOf SetCache
	* @alias push
	* @param {*} value The value to cache.
	* @returns {Object} Returns the cache instance.
	*/
	function setCacheAdd(value) {
		this.__data__.set(value, HASH_UNDEFINED);
		return this;
	}
	module.exports = setCacheAdd;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_setCacheHas.js
var require__setCacheHas = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Checks if `value` is in the array cache.
	*
	* @private
	* @name has
	* @memberOf SetCache
	* @param {*} value The value to search for.
	* @returns {number} Returns `true` if `value` is found, else `false`.
	*/
	function setCacheHas(value) {
		return this.__data__.has(value);
	}
	module.exports = setCacheHas;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_SetCache.js
var require__SetCache = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var MapCache = require__MapCache(), setCacheAdd = require__setCacheAdd(), setCacheHas = require__setCacheHas();
	/**
	*
	* Creates an array cache object to store unique values.
	*
	* @private
	* @constructor
	* @param {Array} [values] The values to cache.
	*/
	function SetCache(values) {
		var index = -1, length = values == null ? 0 : values.length;
		this.__data__ = new MapCache();
		while (++index < length) this.add(values[index]);
	}
	SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
	SetCache.prototype.has = setCacheHas;
	module.exports = SetCache;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_arraySome.js
var require__arraySome = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* A specialized version of `_.some` for arrays without support for iteratee
	* shorthands.
	*
	* @private
	* @param {Array} [array] The array to iterate over.
	* @param {Function} predicate The function invoked per iteration.
	* @returns {boolean} Returns `true` if any element passes the predicate check,
	*  else `false`.
	*/
	function arraySome(array, predicate) {
		var index = -1, length = array == null ? 0 : array.length;
		while (++index < length) if (predicate(array[index], index, array)) return true;
		return false;
	}
	module.exports = arraySome;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_cacheHas.js
var require__cacheHas = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Checks if a `cache` value for `key` exists.
	*
	* @private
	* @param {Object} cache The cache to query.
	* @param {string} key The key of the entry to check.
	* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	*/
	function cacheHas(cache, key) {
		return cache.has(key);
	}
	module.exports = cacheHas;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_equalArrays.js
var require__equalArrays = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SetCache = require__SetCache(), arraySome = require__arraySome(), cacheHas = require__cacheHas();
	/** Used to compose bitmasks for value comparisons. */
	var COMPARE_PARTIAL_FLAG = 1, COMPARE_UNORDERED_FLAG = 2;
	/**
	* A specialized version of `baseIsEqualDeep` for arrays with support for
	* partial deep comparisons.
	*
	* @private
	* @param {Array} array The array to compare.
	* @param {Array} other The other array to compare.
	* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	* @param {Function} customizer The function to customize comparisons.
	* @param {Function} equalFunc The function to determine equivalents of values.
	* @param {Object} stack Tracks traversed `array` and `other` objects.
	* @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
	*/
	function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
		var isPartial = bitmask & COMPARE_PARTIAL_FLAG, arrLength = array.length, othLength = other.length;
		if (arrLength != othLength && !(isPartial && othLength > arrLength)) return false;
		var arrStacked = stack.get(array);
		var othStacked = stack.get(other);
		if (arrStacked && othStacked) return arrStacked == other && othStacked == array;
		var index = -1, result = true, seen = bitmask & COMPARE_UNORDERED_FLAG ? new SetCache() : void 0;
		stack.set(array, other);
		stack.set(other, array);
		while (++index < arrLength) {
			var arrValue = array[index], othValue = other[index];
			if (customizer) var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
			if (compared !== void 0) {
				if (compared) continue;
				result = false;
				break;
			}
			if (seen) {
				if (!arraySome(other, function(othValue, othIndex) {
					if (!cacheHas(seen, othIndex) && (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) return seen.push(othIndex);
				})) {
					result = false;
					break;
				}
			} else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
				result = false;
				break;
			}
		}
		stack["delete"](array);
		stack["delete"](other);
		return result;
	}
	module.exports = equalArrays;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_Uint8Array.js
var require__Uint8Array = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require__root().Uint8Array;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_mapToArray.js
var require__mapToArray = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Converts `map` to its key-value pairs.
	*
	* @private
	* @param {Object} map The map to convert.
	* @returns {Array} Returns the key-value pairs.
	*/
	function mapToArray(map) {
		var index = -1, result = Array(map.size);
		map.forEach(function(value, key) {
			result[++index] = [key, value];
		});
		return result;
	}
	module.exports = mapToArray;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_setToArray.js
var require__setToArray = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Converts `set` to an array of its values.
	*
	* @private
	* @param {Object} set The set to convert.
	* @returns {Array} Returns the values.
	*/
	function setToArray(set) {
		var index = -1, result = Array(set.size);
		set.forEach(function(value) {
			result[++index] = value;
		});
		return result;
	}
	module.exports = setToArray;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_equalByTag.js
var require__equalByTag = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Symbol = require__Symbol(), Uint8Array = require__Uint8Array(), eq = require_eq(), equalArrays = require__equalArrays(), mapToArray = require__mapToArray(), setToArray = require__setToArray();
	/** Used to compose bitmasks for value comparisons. */
	var COMPARE_PARTIAL_FLAG = 1, COMPARE_UNORDERED_FLAG = 2;
	/** `Object#toString` result references. */
	var boolTag = "[object Boolean]", dateTag = "[object Date]", errorTag = "[object Error]", mapTag = "[object Map]", numberTag = "[object Number]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]";
	var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]";
	/** Used to convert symbols to primitives and strings. */
	var symbolProto = Symbol ? Symbol.prototype : void 0, symbolValueOf = symbolProto ? symbolProto.valueOf : void 0;
	/**
	* A specialized version of `baseIsEqualDeep` for comparing objects of
	* the same `toStringTag`.
	*
	* **Note:** This function only supports comparing values with tags of
	* `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
	*
	* @private
	* @param {Object} object The object to compare.
	* @param {Object} other The other object to compare.
	* @param {string} tag The `toStringTag` of the objects to compare.
	* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	* @param {Function} customizer The function to customize comparisons.
	* @param {Function} equalFunc The function to determine equivalents of values.
	* @param {Object} stack Tracks traversed `object` and `other` objects.
	* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	*/
	function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
		switch (tag) {
			case dataViewTag:
				if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) return false;
				object = object.buffer;
				other = other.buffer;
			case arrayBufferTag:
				if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array(object), new Uint8Array(other))) return false;
				return true;
			case boolTag:
			case dateTag:
			case numberTag: return eq(+object, +other);
			case errorTag: return object.name == other.name && object.message == other.message;
			case regexpTag:
			case stringTag: return object == other + "";
			case mapTag: var convert = mapToArray;
			case setTag:
				var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
				convert || (convert = setToArray);
				if (object.size != other.size && !isPartial) return false;
				var stacked = stack.get(object);
				if (stacked) return stacked == other;
				bitmask |= COMPARE_UNORDERED_FLAG;
				stack.set(object, other);
				var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
				stack["delete"](object);
				return result;
			case symbolTag: if (symbolValueOf) return symbolValueOf.call(object) == symbolValueOf.call(other);
		}
		return false;
	}
	module.exports = equalByTag;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_arrayPush.js
var require__arrayPush = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Appends the elements of `values` to `array`.
	*
	* @private
	* @param {Array} array The array to modify.
	* @param {Array} values The values to append.
	* @returns {Array} Returns `array`.
	*/
	function arrayPush(array, values) {
		var index = -1, length = values.length, offset = array.length;
		while (++index < length) array[offset + index] = values[index];
		return array;
	}
	module.exports = arrayPush;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseGetAllKeys.js
var require__baseGetAllKeys = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var arrayPush = require__arrayPush(), isArray = require_isArray();
	/**
	* The base implementation of `getAllKeys` and `getAllKeysIn` which uses
	* `keysFunc` and `symbolsFunc` to get the enumerable property names and
	* symbols of `object`.
	*
	* @private
	* @param {Object} object The object to query.
	* @param {Function} keysFunc The function to get the keys of `object`.
	* @param {Function} symbolsFunc The function to get the symbols of `object`.
	* @returns {Array} Returns the array of property names and symbols.
	*/
	function baseGetAllKeys(object, keysFunc, symbolsFunc) {
		var result = keysFunc(object);
		return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
	}
	module.exports = baseGetAllKeys;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_arrayFilter.js
var require__arrayFilter = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* A specialized version of `_.filter` for arrays without support for
	* iteratee shorthands.
	*
	* @private
	* @param {Array} [array] The array to iterate over.
	* @param {Function} predicate The function invoked per iteration.
	* @returns {Array} Returns the new filtered array.
	*/
	function arrayFilter(array, predicate) {
		var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
		while (++index < length) {
			var value = array[index];
			if (predicate(value, index, array)) result[resIndex++] = value;
		}
		return result;
	}
	module.exports = arrayFilter;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/stubArray.js
var require_stubArray = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* This method returns a new empty array.
	*
	* @static
	* @memberOf _
	* @since 4.13.0
	* @category Util
	* @returns {Array} Returns the new empty array.
	* @example
	*
	* var arrays = _.times(2, _.stubArray);
	*
	* console.log(arrays);
	* // => [[], []]
	*
	* console.log(arrays[0] === arrays[1]);
	* // => false
	*/
	function stubArray() {
		return [];
	}
	module.exports = stubArray;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_getSymbols.js
var require__getSymbols = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var arrayFilter = require__arrayFilter(), stubArray = require_stubArray();
	/** Built-in value references. */
	var propertyIsEnumerable = Object.prototype.propertyIsEnumerable;
	var nativeGetSymbols = Object.getOwnPropertySymbols;
	module.exports = !nativeGetSymbols ? stubArray : function(object) {
		if (object == null) return [];
		object = Object(object);
		return arrayFilter(nativeGetSymbols(object), function(symbol) {
			return propertyIsEnumerable.call(object, symbol);
		});
	};
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_getAllKeys.js
var require__getAllKeys = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseGetAllKeys = require__baseGetAllKeys(), getSymbols = require__getSymbols(), keys = require_keys();
	/**
	* Creates an array of own enumerable property names and symbols of `object`.
	*
	* @private
	* @param {Object} object The object to query.
	* @returns {Array} Returns the array of property names and symbols.
	*/
	function getAllKeys(object) {
		return baseGetAllKeys(object, keys, getSymbols);
	}
	module.exports = getAllKeys;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_equalObjects.js
var require__equalObjects = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var getAllKeys = require__getAllKeys();
	/** Used to compose bitmasks for value comparisons. */
	var COMPARE_PARTIAL_FLAG = 1;
	/** Used to check objects for own properties. */
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	/**
	* A specialized version of `baseIsEqualDeep` for objects with support for
	* partial deep comparisons.
	*
	* @private
	* @param {Object} object The object to compare.
	* @param {Object} other The other object to compare.
	* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	* @param {Function} customizer The function to customize comparisons.
	* @param {Function} equalFunc The function to determine equivalents of values.
	* @param {Object} stack Tracks traversed `object` and `other` objects.
	* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	*/
	function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
		var isPartial = bitmask & COMPARE_PARTIAL_FLAG, objProps = getAllKeys(object), objLength = objProps.length;
		if (objLength != getAllKeys(other).length && !isPartial) return false;
		var index = objLength;
		while (index--) {
			var key = objProps[index];
			if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) return false;
		}
		var objStacked = stack.get(object);
		var othStacked = stack.get(other);
		if (objStacked && othStacked) return objStacked == other && othStacked == object;
		var result = true;
		stack.set(object, other);
		stack.set(other, object);
		var skipCtor = isPartial;
		while (++index < objLength) {
			key = objProps[index];
			var objValue = object[key], othValue = other[key];
			if (customizer) var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
			if (!(compared === void 0 ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
				result = false;
				break;
			}
			skipCtor || (skipCtor = key == "constructor");
		}
		if (result && !skipCtor) {
			var objCtor = object.constructor, othCtor = other.constructor;
			if (objCtor != othCtor && "constructor" in object && "constructor" in other && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) result = false;
		}
		stack["delete"](object);
		stack["delete"](other);
		return result;
	}
	module.exports = equalObjects;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_DataView.js
var require__DataView = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require__getNative()(require__root(), "DataView");
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_Promise.js
var require__Promise = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require__getNative()(require__root(), "Promise");
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_Set.js
var require__Set = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require__getNative()(require__root(), "Set");
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_WeakMap.js
var require__WeakMap = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require__getNative()(require__root(), "WeakMap");
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_getTag.js
var require__getTag = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var DataView = require__DataView(), Map = require__Map(), Promise = require__Promise(), Set = require__Set(), WeakMap = require__WeakMap(), baseGetTag = require__baseGetTag(), toSource = require__toSource();
	/** `Object#toString` result references. */
	var mapTag = "[object Map]", objectTag = "[object Object]", promiseTag = "[object Promise]", setTag = "[object Set]", weakMapTag = "[object WeakMap]";
	var dataViewTag = "[object DataView]";
	/** Used to detect maps, sets, and weakmaps. */
	var dataViewCtorString = toSource(DataView), mapCtorString = toSource(Map), promiseCtorString = toSource(Promise), setCtorString = toSource(Set), weakMapCtorString = toSource(WeakMap);
	/**
	* Gets the `toStringTag` of `value`.
	*
	* @private
	* @param {*} value The value to query.
	* @returns {string} Returns the `toStringTag`.
	*/
	var getTag = baseGetTag;
	if (DataView && getTag(new DataView(/* @__PURE__ */ new ArrayBuffer(1))) != dataViewTag || Map && getTag(new Map()) != mapTag || Promise && getTag(Promise.resolve()) != promiseTag || Set && getTag(new Set()) != setTag || WeakMap && getTag(new WeakMap()) != weakMapTag) getTag = function(value) {
		var result = baseGetTag(value), Ctor = result == objectTag ? value.constructor : void 0, ctorString = Ctor ? toSource(Ctor) : "";
		if (ctorString) switch (ctorString) {
			case dataViewCtorString: return dataViewTag;
			case mapCtorString: return mapTag;
			case promiseCtorString: return promiseTag;
			case setCtorString: return setTag;
			case weakMapCtorString: return weakMapTag;
		}
		return result;
	};
	module.exports = getTag;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseIsEqualDeep.js
var require__baseIsEqualDeep = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Stack = require__Stack(), equalArrays = require__equalArrays(), equalByTag = require__equalByTag(), equalObjects = require__equalObjects(), getTag = require__getTag(), isArray = require_isArray(), isBuffer = require_isBuffer(), isTypedArray = require_isTypedArray();
	/** Used to compose bitmasks for value comparisons. */
	var COMPARE_PARTIAL_FLAG = 1;
	/** `Object#toString` result references. */
	var argsTag = "[object Arguments]", arrayTag = "[object Array]", objectTag = "[object Object]";
	/** Used to check objects for own properties. */
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	/**
	* A specialized version of `baseIsEqual` for arrays and objects which performs
	* deep comparisons and tracks traversed objects enabling objects with circular
	* references to be compared.
	*
	* @private
	* @param {Object} object The object to compare.
	* @param {Object} other The other object to compare.
	* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	* @param {Function} customizer The function to customize comparisons.
	* @param {Function} equalFunc The function to determine equivalents of values.
	* @param {Object} [stack] Tracks traversed `object` and `other` objects.
	* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	*/
	function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
		var objIsArr = isArray(object), othIsArr = isArray(other), objTag = objIsArr ? arrayTag : getTag(object), othTag = othIsArr ? arrayTag : getTag(other);
		objTag = objTag == argsTag ? objectTag : objTag;
		othTag = othTag == argsTag ? objectTag : othTag;
		var objIsObj = objTag == objectTag, othIsObj = othTag == objectTag, isSameTag = objTag == othTag;
		if (isSameTag && isBuffer(object)) {
			if (!isBuffer(other)) return false;
			objIsArr = true;
			objIsObj = false;
		}
		if (isSameTag && !objIsObj) {
			stack || (stack = new Stack());
			return objIsArr || isTypedArray(object) ? equalArrays(object, other, bitmask, customizer, equalFunc, stack) : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
		}
		if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
			var objIsWrapped = objIsObj && hasOwnProperty.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty.call(other, "__wrapped__");
			if (objIsWrapped || othIsWrapped) {
				var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
				stack || (stack = new Stack());
				return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
			}
		}
		if (!isSameTag) return false;
		stack || (stack = new Stack());
		return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
	}
	module.exports = baseIsEqualDeep;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseIsEqual.js
var require__baseIsEqual = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseIsEqualDeep = require__baseIsEqualDeep(), isObjectLike = require_isObjectLike();
	/**
	* The base implementation of `_.isEqual` which supports partial comparisons
	* and tracks traversed objects.
	*
	* @private
	* @param {*} value The value to compare.
	* @param {*} other The other value to compare.
	* @param {boolean} bitmask The bitmask flags.
	*  1 - Unordered comparison
	*  2 - Partial comparison
	* @param {Function} [customizer] The function to customize comparisons.
	* @param {Object} [stack] Tracks traversed `value` and `other` objects.
	* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	*/
	function baseIsEqual(value, other, bitmask, customizer, stack) {
		if (value === other) return true;
		if (value == null || other == null || !isObjectLike(value) && !isObjectLike(other)) return value !== value && other !== other;
		return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
	}
	module.exports = baseIsEqual;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseIsMatch.js
var require__baseIsMatch = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Stack = require__Stack(), baseIsEqual = require__baseIsEqual();
	/** Used to compose bitmasks for value comparisons. */
	var COMPARE_PARTIAL_FLAG = 1, COMPARE_UNORDERED_FLAG = 2;
	/**
	* The base implementation of `_.isMatch` without support for iteratee shorthands.
	*
	* @private
	* @param {Object} object The object to inspect.
	* @param {Object} source The object of property values to match.
	* @param {Array} matchData The property names, values, and compare flags to match.
	* @param {Function} [customizer] The function to customize comparisons.
	* @returns {boolean} Returns `true` if `object` is a match, else `false`.
	*/
	function baseIsMatch(object, source, matchData, customizer) {
		var index = matchData.length, length = index, noCustomizer = !customizer;
		if (object == null) return !length;
		object = Object(object);
		while (index--) {
			var data = matchData[index];
			if (noCustomizer && data[2] ? data[1] !== object[data[0]] : !(data[0] in object)) return false;
		}
		while (++index < length) {
			data = matchData[index];
			var key = data[0], objValue = object[key], srcValue = data[1];
			if (noCustomizer && data[2]) {
				if (objValue === void 0 && !(key in object)) return false;
			} else {
				var stack = new Stack();
				if (customizer) var result = customizer(objValue, srcValue, key, object, source, stack);
				if (!(result === void 0 ? baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG, customizer, stack) : result)) return false;
			}
		}
		return true;
	}
	module.exports = baseIsMatch;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_isStrictComparable.js
var require__isStrictComparable = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isObject = require_isObject();
	/**
	* Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` if suitable for strict
	*  equality comparisons, else `false`.
	*/
	function isStrictComparable(value) {
		return value === value && !isObject(value);
	}
	module.exports = isStrictComparable;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_getMatchData.js
var require__getMatchData = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isStrictComparable = require__isStrictComparable(), keys = require_keys();
	/**
	* Gets the property names, values, and compare flags of `object`.
	*
	* @private
	* @param {Object} object The object to query.
	* @returns {Array} Returns the match data of `object`.
	*/
	function getMatchData(object) {
		var result = keys(object), length = result.length;
		while (length--) {
			var key = result[length], value = object[key];
			result[length] = [
				key,
				value,
				isStrictComparable(value)
			];
		}
		return result;
	}
	module.exports = getMatchData;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_matchesStrictComparable.js
var require__matchesStrictComparable = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* A specialized version of `matchesProperty` for source values suitable
	* for strict equality comparisons, i.e. `===`.
	*
	* @private
	* @param {string} key The key of the property to get.
	* @param {*} srcValue The value to match.
	* @returns {Function} Returns the new spec function.
	*/
	function matchesStrictComparable(key, srcValue) {
		return function(object) {
			if (object == null) return false;
			return object[key] === srcValue && (srcValue !== void 0 || key in Object(object));
		};
	}
	module.exports = matchesStrictComparable;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseMatches.js
var require__baseMatches = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseIsMatch = require__baseIsMatch(), getMatchData = require__getMatchData(), matchesStrictComparable = require__matchesStrictComparable();
	/**
	* The base implementation of `_.matches` which doesn't clone `source`.
	*
	* @private
	* @param {Object} source The object of property values to match.
	* @returns {Function} Returns the new spec function.
	*/
	function baseMatches(source) {
		var matchData = getMatchData(source);
		if (matchData.length == 1 && matchData[0][2]) return matchesStrictComparable(matchData[0][0], matchData[0][1]);
		return function(object) {
			return object === source || baseIsMatch(object, source, matchData);
		};
	}
	module.exports = baseMatches;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/isSymbol.js
var require_isSymbol = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseGetTag = require__baseGetTag(), isObjectLike = require_isObjectLike();
	/** `Object#toString` result references. */
	var symbolTag = "[object Symbol]";
	/**
	* Checks if `value` is classified as a `Symbol` primitive or object.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
	* @example
	*
	* _.isSymbol(Symbol.iterator);
	* // => true
	*
	* _.isSymbol('abc');
	* // => false
	*/
	function isSymbol(value) {
		return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
	}
	module.exports = isSymbol;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_isKey.js
var require__isKey = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isArray = require_isArray(), isSymbol = require_isSymbol();
	/** Used to match property names within property paths. */
	var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, reIsPlainProp = /^\w*$/;
	/**
	* Checks if `value` is a property name and not a property path.
	*
	* @private
	* @param {*} value The value to check.
	* @param {Object} [object] The object to query keys on.
	* @returns {boolean} Returns `true` if `value` is a property name, else `false`.
	*/
	function isKey(value, object) {
		if (isArray(value)) return false;
		var type = typeof value;
		if (type == "number" || type == "symbol" || type == "boolean" || value == null || isSymbol(value)) return true;
		return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object(object);
	}
	module.exports = isKey;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/memoize.js
var require_memoize = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var MapCache = require__MapCache();
	/** Error message constants. */
	var FUNC_ERROR_TEXT = "Expected a function";
	/**
	* Creates a function that memoizes the result of `func`. If `resolver` is
	* provided, it determines the cache key for storing the result based on the
	* arguments provided to the memoized function. By default, the first argument
	* provided to the memoized function is used as the map cache key. The `func`
	* is invoked with the `this` binding of the memoized function.
	*
	* **Note:** The cache is exposed as the `cache` property on the memoized
	* function. Its creation may be customized by replacing the `_.memoize.Cache`
	* constructor with one whose instances implement the
	* [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
	* method interface of `clear`, `delete`, `get`, `has`, and `set`.
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Function
	* @param {Function} func The function to have its output memoized.
	* @param {Function} [resolver] The function to resolve the cache key.
	* @returns {Function} Returns the new memoized function.
	* @example
	*
	* var object = { 'a': 1, 'b': 2 };
	* var other = { 'c': 3, 'd': 4 };
	*
	* var values = _.memoize(_.values);
	* values(object);
	* // => [1, 2]
	*
	* values(other);
	* // => [3, 4]
	*
	* object.a = 2;
	* values(object);
	* // => [1, 2]
	*
	* // Modify the result cache.
	* values.cache.set(object, ['a', 'b']);
	* values(object);
	* // => ['a', 'b']
	*
	* // Replace `_.memoize.Cache`.
	* _.memoize.Cache = WeakMap;
	*/
	function memoize(func, resolver) {
		if (typeof func != "function" || resolver != null && typeof resolver != "function") throw new TypeError(FUNC_ERROR_TEXT);
		var memoized = function() {
			var args = arguments, key = resolver ? resolver.apply(this, args) : args[0], cache = memoized.cache;
			if (cache.has(key)) return cache.get(key);
			var result = func.apply(this, args);
			memoized.cache = cache.set(key, result) || cache;
			return result;
		};
		memoized.cache = new (memoize.Cache || MapCache)();
		return memoized;
	}
	memoize.Cache = MapCache;
	module.exports = memoize;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_memoizeCapped.js
var require__memoizeCapped = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var memoize = require_memoize();
	/** Used as the maximum memoize cache size. */
	var MAX_MEMOIZE_SIZE = 500;
	/**
	* A specialized version of `_.memoize` which clears the memoized function's
	* cache when it exceeds `MAX_MEMOIZE_SIZE`.
	*
	* @private
	* @param {Function} func The function to have its output memoized.
	* @returns {Function} Returns the new memoized function.
	*/
	function memoizeCapped(func) {
		var result = memoize(func, function(key) {
			if (cache.size === MAX_MEMOIZE_SIZE) cache.clear();
			return key;
		});
		var cache = result.cache;
		return result;
	}
	module.exports = memoizeCapped;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_stringToPath.js
var require__stringToPath = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var memoizeCapped = require__memoizeCapped();
	/** Used to match property names within property paths. */
	var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
	/** Used to match backslashes in property paths. */
	var reEscapeChar = /\\(\\)?/g;
	module.exports = memoizeCapped(function(string) {
		var result = [];
		if (string.charCodeAt(0) === 46) result.push("");
		string.replace(rePropName, function(match, number, quote, subString) {
			result.push(quote ? subString.replace(reEscapeChar, "$1") : number || match);
		});
		return result;
	});
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseToString.js
var require__baseToString = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Symbol = require__Symbol(), arrayMap = require__arrayMap(), isArray = require_isArray(), isSymbol = require_isSymbol();
	/** Used as references for various `Number` constants. */
	var INFINITY = Infinity;
	/** Used to convert symbols to primitives and strings. */
	var symbolProto = Symbol ? Symbol.prototype : void 0, symbolToString = symbolProto ? symbolProto.toString : void 0;
	/**
	* The base implementation of `_.toString` which doesn't convert nullish
	* values to empty strings.
	*
	* @private
	* @param {*} value The value to process.
	* @returns {string} Returns the string.
	*/
	function baseToString(value) {
		if (typeof value == "string") return value;
		if (isArray(value)) return arrayMap(value, baseToString) + "";
		if (isSymbol(value)) return symbolToString ? symbolToString.call(value) : "";
		var result = value + "";
		return result == "0" && 1 / value == -INFINITY ? "-0" : result;
	}
	module.exports = baseToString;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/toString.js
var require_toString = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseToString = require__baseToString();
	/**
	* Converts `value` to a string. An empty string is returned for `null`
	* and `undefined` values. The sign of `-0` is preserved.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to convert.
	* @returns {string} Returns the converted string.
	* @example
	*
	* _.toString(null);
	* // => ''
	*
	* _.toString(-0);
	* // => '-0'
	*
	* _.toString([1, 2, 3]);
	* // => '1,2,3'
	*/
	function toString(value) {
		return value == null ? "" : baseToString(value);
	}
	module.exports = toString;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_castPath.js
var require__castPath = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isArray = require_isArray(), isKey = require__isKey(), stringToPath = require__stringToPath(), toString = require_toString();
	/**
	* Casts `value` to a path array if it's not one.
	*
	* @private
	* @param {*} value The value to inspect.
	* @param {Object} [object] The object to query keys on.
	* @returns {Array} Returns the cast property path array.
	*/
	function castPath(value, object) {
		if (isArray(value)) return value;
		return isKey(value, object) ? [value] : stringToPath(toString(value));
	}
	module.exports = castPath;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_toKey.js
var require__toKey = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isSymbol = require_isSymbol();
	/** Used as references for various `Number` constants. */
	var INFINITY = Infinity;
	/**
	* Converts `value` to a string key if it's not a string or symbol.
	*
	* @private
	* @param {*} value The value to inspect.
	* @returns {string|symbol} Returns the key.
	*/
	function toKey(value) {
		if (typeof value == "string" || isSymbol(value)) return value;
		var result = value + "";
		return result == "0" && 1 / value == -INFINITY ? "-0" : result;
	}
	module.exports = toKey;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseGet.js
var require__baseGet = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var castPath = require__castPath(), toKey = require__toKey();
	/**
	* The base implementation of `_.get` without support for default values.
	*
	* @private
	* @param {Object} object The object to query.
	* @param {Array|string} path The path of the property to get.
	* @returns {*} Returns the resolved value.
	*/
	function baseGet(object, path) {
		path = castPath(path, object);
		var index = 0, length = path.length;
		while (object != null && index < length) object = object[toKey(path[index++])];
		return index && index == length ? object : void 0;
	}
	module.exports = baseGet;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/get.js
var require_get = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseGet = require__baseGet();
	/**
	* Gets the value at `path` of `object`. If the resolved value is
	* `undefined`, the `defaultValue` is returned in its place.
	*
	* @static
	* @memberOf _
	* @since 3.7.0
	* @category Object
	* @param {Object} object The object to query.
	* @param {Array|string} path The path of the property to get.
	* @param {*} [defaultValue] The value returned for `undefined` resolved values.
	* @returns {*} Returns the resolved value.
	* @example
	*
	* var object = { 'a': [{ 'b': { 'c': 3 } }] };
	*
	* _.get(object, 'a[0].b.c');
	* // => 3
	*
	* _.get(object, ['a', '0', 'b', 'c']);
	* // => 3
	*
	* _.get(object, 'a.b.c', 'default');
	* // => 'default'
	*/
	function get(object, path, defaultValue) {
		var result = object == null ? void 0 : baseGet(object, path);
		return result === void 0 ? defaultValue : result;
	}
	module.exports = get;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseHasIn.js
var require__baseHasIn = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* The base implementation of `_.hasIn` without support for deep paths.
	*
	* @private
	* @param {Object} [object] The object to query.
	* @param {Array|string} key The key to check.
	* @returns {boolean} Returns `true` if `key` exists, else `false`.
	*/
	function baseHasIn(object, key) {
		return object != null && key in Object(object);
	}
	module.exports = baseHasIn;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_hasPath.js
var require__hasPath = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var castPath = require__castPath(), isArguments = require_isArguments(), isArray = require_isArray(), isIndex = require__isIndex(), isLength = require_isLength(), toKey = require__toKey();
	/**
	* Checks if `path` exists on `object`.
	*
	* @private
	* @param {Object} object The object to query.
	* @param {Array|string} path The path to check.
	* @param {Function} hasFunc The function to check properties.
	* @returns {boolean} Returns `true` if `path` exists, else `false`.
	*/
	function hasPath(object, path, hasFunc) {
		path = castPath(path, object);
		var index = -1, length = path.length, result = false;
		while (++index < length) {
			var key = toKey(path[index]);
			if (!(result = object != null && hasFunc(object, key))) break;
			object = object[key];
		}
		if (result || ++index != length) return result;
		length = object == null ? 0 : object.length;
		return !!length && isLength(length) && isIndex(key, length) && (isArray(object) || isArguments(object));
	}
	module.exports = hasPath;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/hasIn.js
var require_hasIn = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseHasIn = require__baseHasIn(), hasPath = require__hasPath();
	/**
	* Checks if `path` is a direct or inherited property of `object`.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Object
	* @param {Object} object The object to query.
	* @param {Array|string} path The path to check.
	* @returns {boolean} Returns `true` if `path` exists, else `false`.
	* @example
	*
	* var object = _.create({ 'a': _.create({ 'b': 2 }) });
	*
	* _.hasIn(object, 'a');
	* // => true
	*
	* _.hasIn(object, 'a.b');
	* // => true
	*
	* _.hasIn(object, ['a', 'b']);
	* // => true
	*
	* _.hasIn(object, 'b');
	* // => false
	*/
	function hasIn(object, path) {
		return object != null && hasPath(object, path, baseHasIn);
	}
	module.exports = hasIn;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseMatchesProperty.js
var require__baseMatchesProperty = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseIsEqual = require__baseIsEqual(), get = require_get(), hasIn = require_hasIn(), isKey = require__isKey(), isStrictComparable = require__isStrictComparable(), matchesStrictComparable = require__matchesStrictComparable(), toKey = require__toKey();
	/** Used to compose bitmasks for value comparisons. */
	var COMPARE_PARTIAL_FLAG = 1, COMPARE_UNORDERED_FLAG = 2;
	/**
	* The base implementation of `_.matchesProperty` which doesn't clone `srcValue`.
	*
	* @private
	* @param {string} path The path of the property to get.
	* @param {*} srcValue The value to match.
	* @returns {Function} Returns the new spec function.
	*/
	function baseMatchesProperty(path, srcValue) {
		if (isKey(path) && isStrictComparable(srcValue)) return matchesStrictComparable(toKey(path), srcValue);
		return function(object) {
			var objValue = get(object, path);
			return objValue === void 0 && objValue === srcValue ? hasIn(object, path) : baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG);
		};
	}
	module.exports = baseMatchesProperty;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseProperty.js
var require__baseProperty = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* The base implementation of `_.property` without support for deep paths.
	*
	* @private
	* @param {string} key The key of the property to get.
	* @returns {Function} Returns the new accessor function.
	*/
	function baseProperty(key) {
		return function(object) {
			return object == null ? void 0 : object[key];
		};
	}
	module.exports = baseProperty;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_basePropertyDeep.js
var require__basePropertyDeep = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseGet = require__baseGet();
	/**
	* A specialized version of `baseProperty` which supports deep paths.
	*
	* @private
	* @param {Array|string} path The path of the property to get.
	* @returns {Function} Returns the new accessor function.
	*/
	function basePropertyDeep(path) {
		return function(object) {
			return baseGet(object, path);
		};
	}
	module.exports = basePropertyDeep;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/property.js
var require_property = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseProperty = require__baseProperty(), basePropertyDeep = require__basePropertyDeep(), isKey = require__isKey(), toKey = require__toKey();
	/**
	* Creates a function that returns the value at `path` of a given object.
	*
	* @static
	* @memberOf _
	* @since 2.4.0
	* @category Util
	* @param {Array|string} path The path of the property to get.
	* @returns {Function} Returns the new accessor function.
	* @example
	*
	* var objects = [
	*   { 'a': { 'b': 2 } },
	*   { 'a': { 'b': 1 } }
	* ];
	*
	* _.map(objects, _.property('a.b'));
	* // => [2, 1]
	*
	* _.map(_.sortBy(objects, _.property(['a', 'b'])), 'a.b');
	* // => [1, 2]
	*/
	function property(path) {
		return isKey(path) ? baseProperty(toKey(path)) : basePropertyDeep(path);
	}
	module.exports = property;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseIteratee.js
var require__baseIteratee = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseMatches = require__baseMatches(), baseMatchesProperty = require__baseMatchesProperty(), identity = require_identity(), isArray = require_isArray(), property = require_property();
	/**
	* The base implementation of `_.iteratee`.
	*
	* @private
	* @param {*} [value=_.identity] The value to convert to an iteratee.
	* @returns {Function} Returns the iteratee.
	*/
	function baseIteratee(value) {
		if (typeof value == "function") return value;
		if (value == null) return identity;
		if (typeof value == "object") return isArray(value) ? baseMatchesProperty(value[0], value[1]) : baseMatches(value);
		return property(value);
	}
	module.exports = baseIteratee;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_createBaseEach.js
var require__createBaseEach = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isArrayLike = require_isArrayLike();
	/**
	* Creates a `baseEach` or `baseEachRight` function.
	*
	* @private
	* @param {Function} eachFunc The function to iterate over a collection.
	* @param {boolean} [fromRight] Specify iterating from right to left.
	* @returns {Function} Returns the new base function.
	*/
	function createBaseEach(eachFunc, fromRight) {
		return function(collection, iteratee) {
			if (collection == null) return collection;
			if (!isArrayLike(collection)) return eachFunc(collection, iteratee);
			var length = collection.length, index = fromRight ? length : -1, iterable = Object(collection);
			while (fromRight ? index-- : ++index < length) if (iteratee(iterable[index], index, iterable) === false) break;
			return collection;
		};
	}
	module.exports = createBaseEach;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseEach.js
var require__baseEach = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseForOwn = require__baseForOwn();
	module.exports = require__createBaseEach()(baseForOwn);
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseMap.js
var require__baseMap = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseEach = require__baseEach(), isArrayLike = require_isArrayLike();
	/**
	* The base implementation of `_.map` without support for iteratee shorthands.
	*
	* @private
	* @param {Array|Object} collection The collection to iterate over.
	* @param {Function} iteratee The function invoked per iteration.
	* @returns {Array} Returns the new mapped array.
	*/
	function baseMap(collection, iteratee) {
		var index = -1, result = isArrayLike(collection) ? Array(collection.length) : [];
		baseEach(collection, function(value, key, collection) {
			result[++index] = iteratee(value, key, collection);
		});
		return result;
	}
	module.exports = baseMap;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/map.js
var require_map = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var arrayMap = require__arrayMap(), baseIteratee = require__baseIteratee(), baseMap = require__baseMap(), isArray = require_isArray();
	/**
	* Creates an array of values by running each element in `collection` thru
	* `iteratee`. The iteratee is invoked with three arguments:
	* (value, index|key, collection).
	*
	* Many lodash methods are guarded to work as iteratees for methods like
	* `_.every`, `_.filter`, `_.map`, `_.mapValues`, `_.reject`, and `_.some`.
	*
	* The guarded methods are:
	* `ary`, `chunk`, `curry`, `curryRight`, `drop`, `dropRight`, `every`,
	* `fill`, `invert`, `parseInt`, `random`, `range`, `rangeRight`, `repeat`,
	* `sampleSize`, `slice`, `some`, `sortBy`, `split`, `take`, `takeRight`,
	* `template`, `trim`, `trimEnd`, `trimStart`, and `words`
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Collection
	* @param {Array|Object} collection The collection to iterate over.
	* @param {Function} [iteratee=_.identity] The function invoked per iteration.
	* @returns {Array} Returns the new mapped array.
	* @example
	*
	* function square(n) {
	*   return n * n;
	* }
	*
	* _.map([4, 8], square);
	* // => [16, 64]
	*
	* _.map({ 'a': 4, 'b': 8 }, square);
	* // => [16, 64] (iteration order is not guaranteed)
	*
	* var users = [
	*   { 'user': 'barney' },
	*   { 'user': 'fred' }
	* ];
	*
	* // The `_.property` iteratee shorthand.
	* _.map(users, 'user');
	* // => ['barney', 'fred']
	*/
	function map(collection, iteratee) {
		return (isArray(collection) ? arrayMap : baseMap)(collection, baseIteratee(iteratee, 3));
	}
	module.exports = map;
}));
//#endregion
//#region node_modules/.pnpm/reactcss@1.2.3_react@19.2.0/node_modules/reactcss/lib/flattenNames.js
var require_flattenNames = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.flattenNames = void 0;
	var _isString3 = _interopRequireDefault(require_isString());
	var _forOwn3 = _interopRequireDefault(require_forOwn());
	var _isPlainObject3 = _interopRequireDefault(require_isPlainObject());
	var _map3 = _interopRequireDefault(require_map());
	function _interopRequireDefault(obj) {
		return obj && obj.__esModule ? obj : { default: obj };
	}
	exports.default = exports.flattenNames = function flattenNames() {
		var things = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : [];
		var names = [];
		(0, _map3.default)(things, function(thing) {
			if (Array.isArray(thing)) flattenNames(thing).map(function(name) {
				return names.push(name);
			});
			else if ((0, _isPlainObject3.default)(thing)) (0, _forOwn3.default)(thing, function(value, key) {
				value === true && names.push(key);
				names.push(key + "-" + value);
			});
			else if ((0, _isString3.default)(thing)) names.push(thing);
		});
		return names;
	};
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_arrayEach.js
var require__arrayEach = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* A specialized version of `_.forEach` for arrays without support for
	* iteratee shorthands.
	*
	* @private
	* @param {Array} [array] The array to iterate over.
	* @param {Function} iteratee The function invoked per iteration.
	* @returns {Array} Returns `array`.
	*/
	function arrayEach(array, iteratee) {
		var index = -1, length = array == null ? 0 : array.length;
		while (++index < length) if (iteratee(array[index], index, array) === false) break;
		return array;
	}
	module.exports = arrayEach;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_defineProperty.js
var require__defineProperty = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var getNative = require__getNative();
	module.exports = function() {
		try {
			var func = getNative(Object, "defineProperty");
			func({}, "", {});
			return func;
		} catch (e) {}
	}();
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseAssignValue.js
var require__baseAssignValue = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var defineProperty = require__defineProperty();
	/**
	* The base implementation of `assignValue` and `assignMergeValue` without
	* value checks.
	*
	* @private
	* @param {Object} object The object to modify.
	* @param {string} key The key of the property to assign.
	* @param {*} value The value to assign.
	*/
	function baseAssignValue(object, key, value) {
		if (key == "__proto__" && defineProperty) defineProperty(object, key, {
			"configurable": true,
			"enumerable": true,
			"value": value,
			"writable": true
		});
		else object[key] = value;
	}
	module.exports = baseAssignValue;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_assignValue.js
var require__assignValue = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseAssignValue = require__baseAssignValue(), eq = require_eq();
	/** Used to check objects for own properties. */
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	/**
	* Assigns `value` to `key` of `object` if the existing value is not equivalent
	* using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	* for equality comparisons.
	*
	* @private
	* @param {Object} object The object to modify.
	* @param {string} key The key of the property to assign.
	* @param {*} value The value to assign.
	*/
	function assignValue(object, key, value) {
		var objValue = object[key];
		if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) || value === void 0 && !(key in object)) baseAssignValue(object, key, value);
	}
	module.exports = assignValue;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_copyObject.js
var require__copyObject = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var assignValue = require__assignValue(), baseAssignValue = require__baseAssignValue();
	/**
	* Copies properties of `source` to `object`.
	*
	* @private
	* @param {Object} source The object to copy properties from.
	* @param {Array} props The property identifiers to copy.
	* @param {Object} [object={}] The object to copy properties to.
	* @param {Function} [customizer] The function to customize copied values.
	* @returns {Object} Returns `object`.
	*/
	function copyObject(source, props, object, customizer) {
		var isNew = !object;
		object || (object = {});
		var index = -1, length = props.length;
		while (++index < length) {
			var key = props[index];
			var newValue = customizer ? customizer(object[key], source[key], key, object, source) : void 0;
			if (newValue === void 0) newValue = source[key];
			if (isNew) baseAssignValue(object, key, newValue);
			else assignValue(object, key, newValue);
		}
		return object;
	}
	module.exports = copyObject;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseAssign.js
var require__baseAssign = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var copyObject = require__copyObject(), keys = require_keys();
	/**
	* The base implementation of `_.assign` without support for multiple sources
	* or `customizer` functions.
	*
	* @private
	* @param {Object} object The destination object.
	* @param {Object} source The source object.
	* @returns {Object} Returns `object`.
	*/
	function baseAssign(object, source) {
		return object && copyObject(source, keys(source), object);
	}
	module.exports = baseAssign;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_nativeKeysIn.js
var require__nativeKeysIn = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* This function is like
	* [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
	* except that it includes inherited enumerable properties.
	*
	* @private
	* @param {Object} object The object to query.
	* @returns {Array} Returns the array of property names.
	*/
	function nativeKeysIn(object) {
		var result = [];
		if (object != null) for (var key in Object(object)) result.push(key);
		return result;
	}
	module.exports = nativeKeysIn;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseKeysIn.js
var require__baseKeysIn = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isObject = require_isObject(), isPrototype = require__isPrototype(), nativeKeysIn = require__nativeKeysIn();
	/** Used to check objects for own properties. */
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	/**
	* The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
	*
	* @private
	* @param {Object} object The object to query.
	* @returns {Array} Returns the array of property names.
	*/
	function baseKeysIn(object) {
		if (!isObject(object)) return nativeKeysIn(object);
		var isProto = isPrototype(object), result = [];
		for (var key in object) if (!(key == "constructor" && (isProto || !hasOwnProperty.call(object, key)))) result.push(key);
		return result;
	}
	module.exports = baseKeysIn;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/keysIn.js
var require_keysIn = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var arrayLikeKeys = require__arrayLikeKeys(), baseKeysIn = require__baseKeysIn(), isArrayLike = require_isArrayLike();
	/**
	* Creates an array of the own and inherited enumerable property names of `object`.
	*
	* **Note:** Non-object values are coerced to objects.
	*
	* @static
	* @memberOf _
	* @since 3.0.0
	* @category Object
	* @param {Object} object The object to query.
	* @returns {Array} Returns the array of property names.
	* @example
	*
	* function Foo() {
	*   this.a = 1;
	*   this.b = 2;
	* }
	*
	* Foo.prototype.c = 3;
	*
	* _.keysIn(new Foo);
	* // => ['a', 'b', 'c'] (iteration order is not guaranteed)
	*/
	function keysIn(object) {
		return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
	}
	module.exports = keysIn;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseAssignIn.js
var require__baseAssignIn = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var copyObject = require__copyObject(), keysIn = require_keysIn();
	/**
	* The base implementation of `_.assignIn` without support for multiple sources
	* or `customizer` functions.
	*
	* @private
	* @param {Object} object The destination object.
	* @param {Object} source The source object.
	* @returns {Object} Returns `object`.
	*/
	function baseAssignIn(object, source) {
		return object && copyObject(source, keysIn(source), object);
	}
	module.exports = baseAssignIn;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_cloneBuffer.js
var require__cloneBuffer = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var root = require__root();
	/** Detect free variable `exports`. */
	var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
	/** Detect free variable `module`. */
	var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
	/** Built-in value references. */
	var Buffer = freeModule && freeModule.exports === freeExports ? root.Buffer : void 0, allocUnsafe = Buffer ? Buffer.allocUnsafe : void 0;
	/**
	* Creates a clone of  `buffer`.
	*
	* @private
	* @param {Buffer} buffer The buffer to clone.
	* @param {boolean} [isDeep] Specify a deep clone.
	* @returns {Buffer} Returns the cloned buffer.
	*/
	function cloneBuffer(buffer, isDeep) {
		if (isDeep) return buffer.slice();
		var length = buffer.length, result = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);
		buffer.copy(result);
		return result;
	}
	module.exports = cloneBuffer;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_copyArray.js
var require__copyArray = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Copies the values of `source` to `array`.
	*
	* @private
	* @param {Array} source The array to copy values from.
	* @param {Array} [array=[]] The array to copy values to.
	* @returns {Array} Returns `array`.
	*/
	function copyArray(source, array) {
		var index = -1, length = source.length;
		array || (array = Array(length));
		while (++index < length) array[index] = source[index];
		return array;
	}
	module.exports = copyArray;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_copySymbols.js
var require__copySymbols = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var copyObject = require__copyObject(), getSymbols = require__getSymbols();
	/**
	* Copies own symbols of `source` to `object`.
	*
	* @private
	* @param {Object} source The object to copy symbols from.
	* @param {Object} [object={}] The object to copy symbols to.
	* @returns {Object} Returns `object`.
	*/
	function copySymbols(source, object) {
		return copyObject(source, getSymbols(source), object);
	}
	module.exports = copySymbols;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_getSymbolsIn.js
var require__getSymbolsIn = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var arrayPush = require__arrayPush(), getPrototype = require__getPrototype(), getSymbols = require__getSymbols(), stubArray = require_stubArray();
	module.exports = !Object.getOwnPropertySymbols ? stubArray : function(object) {
		var result = [];
		while (object) {
			arrayPush(result, getSymbols(object));
			object = getPrototype(object);
		}
		return result;
	};
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_copySymbolsIn.js
var require__copySymbolsIn = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var copyObject = require__copyObject(), getSymbolsIn = require__getSymbolsIn();
	/**
	* Copies own and inherited symbols of `source` to `object`.
	*
	* @private
	* @param {Object} source The object to copy symbols from.
	* @param {Object} [object={}] The object to copy symbols to.
	* @returns {Object} Returns `object`.
	*/
	function copySymbolsIn(source, object) {
		return copyObject(source, getSymbolsIn(source), object);
	}
	module.exports = copySymbolsIn;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_getAllKeysIn.js
var require__getAllKeysIn = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseGetAllKeys = require__baseGetAllKeys(), getSymbolsIn = require__getSymbolsIn(), keysIn = require_keysIn();
	/**
	* Creates an array of own and inherited enumerable property names and
	* symbols of `object`.
	*
	* @private
	* @param {Object} object The object to query.
	* @returns {Array} Returns the array of property names and symbols.
	*/
	function getAllKeysIn(object) {
		return baseGetAllKeys(object, keysIn, getSymbolsIn);
	}
	module.exports = getAllKeysIn;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_initCloneArray.js
var require__initCloneArray = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/** Used to check objects for own properties. */
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	/**
	* Initializes an array clone.
	*
	* @private
	* @param {Array} array The array to clone.
	* @returns {Array} Returns the initialized clone.
	*/
	function initCloneArray(array) {
		var length = array.length, result = new array.constructor(length);
		if (length && typeof array[0] == "string" && hasOwnProperty.call(array, "index")) {
			result.index = array.index;
			result.input = array.input;
		}
		return result;
	}
	module.exports = initCloneArray;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_cloneArrayBuffer.js
var require__cloneArrayBuffer = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Uint8Array = require__Uint8Array();
	/**
	* Creates a clone of `arrayBuffer`.
	*
	* @private
	* @param {ArrayBuffer} arrayBuffer The array buffer to clone.
	* @returns {ArrayBuffer} Returns the cloned array buffer.
	*/
	function cloneArrayBuffer(arrayBuffer) {
		var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
		new Uint8Array(result).set(new Uint8Array(arrayBuffer));
		return result;
	}
	module.exports = cloneArrayBuffer;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_cloneDataView.js
var require__cloneDataView = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var cloneArrayBuffer = require__cloneArrayBuffer();
	/**
	* Creates a clone of `dataView`.
	*
	* @private
	* @param {Object} dataView The data view to clone.
	* @param {boolean} [isDeep] Specify a deep clone.
	* @returns {Object} Returns the cloned data view.
	*/
	function cloneDataView(dataView, isDeep) {
		var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
		return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
	}
	module.exports = cloneDataView;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_cloneRegExp.js
var require__cloneRegExp = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/** Used to match `RegExp` flags from their coerced string values. */
	var reFlags = /\w*$/;
	/**
	* Creates a clone of `regexp`.
	*
	* @private
	* @param {Object} regexp The regexp to clone.
	* @returns {Object} Returns the cloned regexp.
	*/
	function cloneRegExp(regexp) {
		var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
		result.lastIndex = regexp.lastIndex;
		return result;
	}
	module.exports = cloneRegExp;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_cloneSymbol.js
var require__cloneSymbol = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Symbol = require__Symbol();
	/** Used to convert symbols to primitives and strings. */
	var symbolProto = Symbol ? Symbol.prototype : void 0, symbolValueOf = symbolProto ? symbolProto.valueOf : void 0;
	/**
	* Creates a clone of the `symbol` object.
	*
	* @private
	* @param {Object} symbol The symbol object to clone.
	* @returns {Object} Returns the cloned symbol object.
	*/
	function cloneSymbol(symbol) {
		return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
	}
	module.exports = cloneSymbol;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_cloneTypedArray.js
var require__cloneTypedArray = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var cloneArrayBuffer = require__cloneArrayBuffer();
	/**
	* Creates a clone of `typedArray`.
	*
	* @private
	* @param {Object} typedArray The typed array to clone.
	* @param {boolean} [isDeep] Specify a deep clone.
	* @returns {Object} Returns the cloned typed array.
	*/
	function cloneTypedArray(typedArray, isDeep) {
		var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
		return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
	}
	module.exports = cloneTypedArray;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_initCloneByTag.js
var require__initCloneByTag = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var cloneArrayBuffer = require__cloneArrayBuffer(), cloneDataView = require__cloneDataView(), cloneRegExp = require__cloneRegExp(), cloneSymbol = require__cloneSymbol(), cloneTypedArray = require__cloneTypedArray();
	/** `Object#toString` result references. */
	var boolTag = "[object Boolean]", dateTag = "[object Date]", mapTag = "[object Map]", numberTag = "[object Number]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]";
	var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
	/**
	* Initializes an object clone based on its `toStringTag`.
	*
	* **Note:** This function only supports cloning values with tags of
	* `Boolean`, `Date`, `Error`, `Map`, `Number`, `RegExp`, `Set`, or `String`.
	*
	* @private
	* @param {Object} object The object to clone.
	* @param {string} tag The `toStringTag` of the object to clone.
	* @param {boolean} [isDeep] Specify a deep clone.
	* @returns {Object} Returns the initialized clone.
	*/
	function initCloneByTag(object, tag, isDeep) {
		var Ctor = object.constructor;
		switch (tag) {
			case arrayBufferTag: return cloneArrayBuffer(object);
			case boolTag:
			case dateTag: return new Ctor(+object);
			case dataViewTag: return cloneDataView(object, isDeep);
			case float32Tag:
			case float64Tag:
			case int8Tag:
			case int16Tag:
			case int32Tag:
			case uint8Tag:
			case uint8ClampedTag:
			case uint16Tag:
			case uint32Tag: return cloneTypedArray(object, isDeep);
			case mapTag: return new Ctor();
			case numberTag:
			case stringTag: return new Ctor(object);
			case regexpTag: return cloneRegExp(object);
			case setTag: return new Ctor();
			case symbolTag: return cloneSymbol(object);
		}
	}
	module.exports = initCloneByTag;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseCreate.js
var require__baseCreate = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isObject = require_isObject();
	/** Built-in value references. */
	var objectCreate = Object.create;
	module.exports = function() {
		function object() {}
		return function(proto) {
			if (!isObject(proto)) return {};
			if (objectCreate) return objectCreate(proto);
			object.prototype = proto;
			var result = new object();
			object.prototype = void 0;
			return result;
		};
	}();
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_initCloneObject.js
var require__initCloneObject = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseCreate = require__baseCreate(), getPrototype = require__getPrototype(), isPrototype = require__isPrototype();
	/**
	* Initializes an object clone.
	*
	* @private
	* @param {Object} object The object to clone.
	* @returns {Object} Returns the initialized clone.
	*/
	function initCloneObject(object) {
		return typeof object.constructor == "function" && !isPrototype(object) ? baseCreate(getPrototype(object)) : {};
	}
	module.exports = initCloneObject;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseIsMap.js
var require__baseIsMap = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var getTag = require__getTag(), isObjectLike = require_isObjectLike();
	/** `Object#toString` result references. */
	var mapTag = "[object Map]";
	/**
	* The base implementation of `_.isMap` without Node.js optimizations.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a map, else `false`.
	*/
	function baseIsMap(value) {
		return isObjectLike(value) && getTag(value) == mapTag;
	}
	module.exports = baseIsMap;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/isMap.js
var require_isMap = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseIsMap = require__baseIsMap(), baseUnary = require__baseUnary(), nodeUtil = require__nodeUtil();
	var nodeIsMap = nodeUtil && nodeUtil.isMap;
	module.exports = nodeIsMap ? baseUnary(nodeIsMap) : baseIsMap;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseIsSet.js
var require__baseIsSet = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var getTag = require__getTag(), isObjectLike = require_isObjectLike();
	/** `Object#toString` result references. */
	var setTag = "[object Set]";
	/**
	* The base implementation of `_.isSet` without Node.js optimizations.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a set, else `false`.
	*/
	function baseIsSet(value) {
		return isObjectLike(value) && getTag(value) == setTag;
	}
	module.exports = baseIsSet;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/isSet.js
var require_isSet = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseIsSet = require__baseIsSet(), baseUnary = require__baseUnary(), nodeUtil = require__nodeUtil();
	var nodeIsSet = nodeUtil && nodeUtil.isSet;
	module.exports = nodeIsSet ? baseUnary(nodeIsSet) : baseIsSet;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/_baseClone.js
var require__baseClone = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Stack = require__Stack(), arrayEach = require__arrayEach(), assignValue = require__assignValue(), baseAssign = require__baseAssign(), baseAssignIn = require__baseAssignIn(), cloneBuffer = require__cloneBuffer(), copyArray = require__copyArray(), copySymbols = require__copySymbols(), copySymbolsIn = require__copySymbolsIn(), getAllKeys = require__getAllKeys(), getAllKeysIn = require__getAllKeysIn(), getTag = require__getTag(), initCloneArray = require__initCloneArray(), initCloneByTag = require__initCloneByTag(), initCloneObject = require__initCloneObject(), isArray = require_isArray(), isBuffer = require_isBuffer(), isMap = require_isMap(), isObject = require_isObject(), isSet = require_isSet(), keys = require_keys(), keysIn = require_keysIn();
	/** Used to compose bitmasks for cloning. */
	var CLONE_DEEP_FLAG = 1, CLONE_FLAT_FLAG = 2, CLONE_SYMBOLS_FLAG = 4;
	/** `Object#toString` result references. */
	var argsTag = "[object Arguments]", arrayTag = "[object Array]", boolTag = "[object Boolean]", dateTag = "[object Date]", errorTag = "[object Error]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", mapTag = "[object Map]", numberTag = "[object Number]", objectTag = "[object Object]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]", weakMapTag = "[object WeakMap]";
	var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
	/** Used to identify `toStringTag` values supported by `_.clone`. */
	var cloneableTags = {};
	cloneableTags[argsTag] = cloneableTags[arrayTag] = cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] = cloneableTags[boolTag] = cloneableTags[dateTag] = cloneableTags[float32Tag] = cloneableTags[float64Tag] = cloneableTags[int8Tag] = cloneableTags[int16Tag] = cloneableTags[int32Tag] = cloneableTags[mapTag] = cloneableTags[numberTag] = cloneableTags[objectTag] = cloneableTags[regexpTag] = cloneableTags[setTag] = cloneableTags[stringTag] = cloneableTags[symbolTag] = cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] = cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
	cloneableTags[errorTag] = cloneableTags[funcTag] = cloneableTags[weakMapTag] = false;
	/**
	* The base implementation of `_.clone` and `_.cloneDeep` which tracks
	* traversed objects.
	*
	* @private
	* @param {*} value The value to clone.
	* @param {boolean} bitmask The bitmask flags.
	*  1 - Deep clone
	*  2 - Flatten inherited properties
	*  4 - Clone symbols
	* @param {Function} [customizer] The function to customize cloning.
	* @param {string} [key] The key of `value`.
	* @param {Object} [object] The parent object of `value`.
	* @param {Object} [stack] Tracks traversed objects and their clone counterparts.
	* @returns {*} Returns the cloned value.
	*/
	function baseClone(value, bitmask, customizer, key, object, stack) {
		var result, isDeep = bitmask & CLONE_DEEP_FLAG, isFlat = bitmask & CLONE_FLAT_FLAG, isFull = bitmask & CLONE_SYMBOLS_FLAG;
		if (customizer) result = object ? customizer(value, key, object, stack) : customizer(value);
		if (result !== void 0) return result;
		if (!isObject(value)) return value;
		var isArr = isArray(value);
		if (isArr) {
			result = initCloneArray(value);
			if (!isDeep) return copyArray(value, result);
		} else {
			var tag = getTag(value), isFunc = tag == funcTag || tag == genTag;
			if (isBuffer(value)) return cloneBuffer(value, isDeep);
			if (tag == objectTag || tag == argsTag || isFunc && !object) {
				result = isFlat || isFunc ? {} : initCloneObject(value);
				if (!isDeep) return isFlat ? copySymbolsIn(value, baseAssignIn(result, value)) : copySymbols(value, baseAssign(result, value));
			} else {
				if (!cloneableTags[tag]) return object ? value : {};
				result = initCloneByTag(value, tag, isDeep);
			}
		}
		stack || (stack = new Stack());
		var stacked = stack.get(value);
		if (stacked) return stacked;
		stack.set(value, result);
		if (isSet(value)) value.forEach(function(subValue) {
			result.add(baseClone(subValue, bitmask, customizer, subValue, value, stack));
		});
		else if (isMap(value)) value.forEach(function(subValue, key) {
			result.set(key, baseClone(subValue, bitmask, customizer, key, value, stack));
		});
		var props = isArr ? void 0 : (isFull ? isFlat ? getAllKeysIn : getAllKeys : isFlat ? keysIn : keys)(value);
		arrayEach(props || value, function(subValue, key) {
			if (props) {
				key = subValue;
				subValue = value[key];
			}
			assignValue(result, key, baseClone(subValue, bitmask, customizer, key, value, stack));
		});
		return result;
	}
	module.exports = baseClone;
}));
//#endregion
//#region node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/cloneDeep.js
var require_cloneDeep = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var baseClone = require__baseClone();
	/** Used to compose bitmasks for cloning. */
	var CLONE_DEEP_FLAG = 1, CLONE_SYMBOLS_FLAG = 4;
	/**
	* This method is like `_.clone` except that it recursively clones `value`.
	*
	* @static
	* @memberOf _
	* @since 1.0.0
	* @category Lang
	* @param {*} value The value to recursively clone.
	* @returns {*} Returns the deep cloned value.
	* @see _.clone
	* @example
	*
	* var objects = [{ 'a': 1 }, { 'b': 2 }];
	*
	* var deep = _.cloneDeep(objects);
	* console.log(deep[0] === objects[0]);
	* // => false
	*/
	function cloneDeep(value) {
		return baseClone(value, CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG);
	}
	module.exports = cloneDeep;
}));
//#endregion
//#region node_modules/.pnpm/reactcss@1.2.3_react@19.2.0/node_modules/reactcss/lib/mergeClasses.js
var require_mergeClasses = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.mergeClasses = void 0;
	var _forOwn3 = _interopRequireDefault(require_forOwn());
	var _cloneDeep3 = _interopRequireDefault(require_cloneDeep());
	var _extends = Object.assign || function(target) {
		for (var i = 1; i < arguments.length; i++) {
			var source = arguments[i];
			for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
		}
		return target;
	};
	function _interopRequireDefault(obj) {
		return obj && obj.__esModule ? obj : { default: obj };
	}
	exports.default = exports.mergeClasses = function mergeClasses(classes) {
		var activeNames = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : [];
		var styles = classes.default && (0, _cloneDeep3.default)(classes.default) || {};
		activeNames.map(function(name) {
			var toMerge = classes[name];
			if (toMerge) (0, _forOwn3.default)(toMerge, function(value, key) {
				if (!styles[key]) styles[key] = {};
				styles[key] = _extends({}, styles[key], toMerge[key]);
			});
			return name;
		});
		return styles;
	};
}));
//#endregion
//#region node_modules/.pnpm/reactcss@1.2.3_react@19.2.0/node_modules/reactcss/lib/autoprefix.js
var require_autoprefix = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.autoprefix = void 0;
	var _forOwn3 = _interopRequireDefault(require_forOwn());
	var _extends = Object.assign || function(target) {
		for (var i = 1; i < arguments.length; i++) {
			var source = arguments[i];
			for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
		}
		return target;
	};
	function _interopRequireDefault(obj) {
		return obj && obj.__esModule ? obj : { default: obj };
	}
	var transforms = {
		borderRadius: function borderRadius(value) {
			return {
				msBorderRadius: value,
				MozBorderRadius: value,
				OBorderRadius: value,
				WebkitBorderRadius: value,
				borderRadius: value
			};
		},
		boxShadow: function boxShadow(value) {
			return {
				msBoxShadow: value,
				MozBoxShadow: value,
				OBoxShadow: value,
				WebkitBoxShadow: value,
				boxShadow: value
			};
		},
		userSelect: function userSelect(value) {
			return {
				WebkitTouchCallout: value,
				KhtmlUserSelect: value,
				MozUserSelect: value,
				msUserSelect: value,
				WebkitUserSelect: value,
				userSelect: value
			};
		},
		flex: function flex(value) {
			return {
				WebkitBoxFlex: value,
				MozBoxFlex: value,
				WebkitFlex: value,
				msFlex: value,
				flex: value
			};
		},
		flexBasis: function flexBasis(value) {
			return {
				WebkitFlexBasis: value,
				flexBasis: value
			};
		},
		justifyContent: function justifyContent(value) {
			return {
				WebkitJustifyContent: value,
				justifyContent: value
			};
		},
		transition: function transition(value) {
			return {
				msTransition: value,
				MozTransition: value,
				OTransition: value,
				WebkitTransition: value,
				transition: value
			};
		},
		transform: function transform(value) {
			return {
				msTransform: value,
				MozTransform: value,
				OTransform: value,
				WebkitTransform: value,
				transform: value
			};
		},
		absolute: function absolute(value) {
			var direction = value && value.split(" ");
			return {
				position: "absolute",
				top: direction && direction[0],
				right: direction && direction[1],
				bottom: direction && direction[2],
				left: direction && direction[3]
			};
		},
		extend: function extend(name, otherElementStyles) {
			var otherStyle = otherElementStyles[name];
			if (otherStyle) return otherStyle;
			return { "extend": name };
		}
	};
	exports.default = exports.autoprefix = function autoprefix(elements) {
		var prefixed = {};
		(0, _forOwn3.default)(elements, function(styles, element) {
			var expanded = {};
			(0, _forOwn3.default)(styles, function(value, key) {
				var transform = transforms[key];
				if (transform) expanded = _extends({}, expanded, transform(value));
				else expanded[key] = value;
			});
			prefixed[element] = expanded;
		});
		return prefixed;
	};
}));
//#endregion
//#region node_modules/.pnpm/reactcss@1.2.3_react@19.2.0/node_modules/reactcss/lib/components/hover.js
var require_hover = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.hover = void 0;
	var _extends = Object.assign || function(target) {
		for (var i = 1; i < arguments.length; i++) {
			var source = arguments[i];
			for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
		}
		return target;
	};
	var _react2 = _interopRequireDefault(require_react());
	function _interopRequireDefault(obj) {
		return obj && obj.__esModule ? obj : { default: obj };
	}
	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
	}
	function _possibleConstructorReturn(self, call) {
		if (!self) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
		return call && (typeof call === "object" || typeof call === "function") ? call : self;
	}
	function _inherits(subClass, superClass) {
		if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
		subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
			value: subClass,
			enumerable: false,
			writable: true,
			configurable: true
		} });
		if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
	}
	exports.default = exports.hover = function hover(Component) {
		var Span = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "span";
		return function(_React$Component) {
			_inherits(Hover, _React$Component);
			function Hover() {
				var _ref;
				var _temp, _this, _ret;
				_classCallCheck(this, Hover);
				for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) args[_key] = arguments[_key];
				return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = Hover.__proto__ || Object.getPrototypeOf(Hover)).call.apply(_ref, [this].concat(args))), _this), _this.state = { hover: false }, _this.handleMouseOver = function() {
					return _this.setState({ hover: true });
				}, _this.handleMouseOut = function() {
					return _this.setState({ hover: false });
				}, _this.render = function() {
					return _react2.default.createElement(Span, {
						onMouseOver: _this.handleMouseOver,
						onMouseOut: _this.handleMouseOut
					}, _react2.default.createElement(Component, _extends({}, _this.props, _this.state)));
				}, _temp), _possibleConstructorReturn(_this, _ret);
			}
			return Hover;
		}(_react2.default.Component);
	};
}));
//#endregion
//#region node_modules/.pnpm/reactcss@1.2.3_react@19.2.0/node_modules/reactcss/lib/components/active.js
var require_active = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.active = void 0;
	var _extends = Object.assign || function(target) {
		for (var i = 1; i < arguments.length; i++) {
			var source = arguments[i];
			for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
		}
		return target;
	};
	var _react2 = _interopRequireDefault(require_react());
	function _interopRequireDefault(obj) {
		return obj && obj.__esModule ? obj : { default: obj };
	}
	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
	}
	function _possibleConstructorReturn(self, call) {
		if (!self) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
		return call && (typeof call === "object" || typeof call === "function") ? call : self;
	}
	function _inherits(subClass, superClass) {
		if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
		subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
			value: subClass,
			enumerable: false,
			writable: true,
			configurable: true
		} });
		if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
	}
	exports.default = exports.active = function active(Component) {
		var Span = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "span";
		return function(_React$Component) {
			_inherits(Active, _React$Component);
			function Active() {
				var _ref;
				var _temp, _this, _ret;
				_classCallCheck(this, Active);
				for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) args[_key] = arguments[_key];
				return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = Active.__proto__ || Object.getPrototypeOf(Active)).call.apply(_ref, [this].concat(args))), _this), _this.state = { active: false }, _this.handleMouseDown = function() {
					return _this.setState({ active: true });
				}, _this.handleMouseUp = function() {
					return _this.setState({ active: false });
				}, _this.render = function() {
					return _react2.default.createElement(Span, {
						onMouseDown: _this.handleMouseDown,
						onMouseUp: _this.handleMouseUp
					}, _react2.default.createElement(Component, _extends({}, _this.props, _this.state)));
				}, _temp), _possibleConstructorReturn(_this, _ret);
			}
			return Active;
		}(_react2.default.Component);
	};
}));
//#endregion
//#region node_modules/.pnpm/reactcss@1.2.3_react@19.2.0/node_modules/reactcss/lib/loop.js
var require_loop = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = function loopable(i, length) {
		var props = {};
		var setProp = function setProp(name) {
			props[name] = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : true;
		};
		i === 0 && setProp("first-child");
		i === length - 1 && setProp("last-child");
		(i === 0 || i % 2 === 0) && setProp("even");
		Math.abs(i % 2) === 1 && setProp("odd");
		setProp("nth-child", i);
		return props;
	};
}));
//#endregion
//#region node_modules/.pnpm/reactcss@1.2.3_react@19.2.0/node_modules/reactcss/lib/index.js
var require_lib = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ReactCSS = exports.loop = exports.handleActive = exports.handleHover = exports.hover = void 0;
	var _flattenNames2 = _interopRequireDefault(require_flattenNames());
	var _mergeClasses2 = _interopRequireDefault(require_mergeClasses());
	var _autoprefix2 = _interopRequireDefault(require_autoprefix());
	var _hover3 = _interopRequireDefault(require_hover());
	var _active2 = _interopRequireDefault(require_active());
	var _loop3 = _interopRequireDefault(require_loop());
	function _interopRequireDefault(obj) {
		return obj && obj.__esModule ? obj : { default: obj };
	}
	exports.hover = _hover3.default;
	exports.handleHover = _hover3.default;
	exports.handleActive = _active2.default;
	exports.loop = _loop3.default;
	exports.default = exports.ReactCSS = function ReactCSS(classes) {
		for (var _len = arguments.length, activations = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) activations[_key - 1] = arguments[_key];
		var activeNames = (0, _flattenNames2.default)(activations);
		var merged = (0, _mergeClasses2.default)(classes, activeNames);
		return (0, _autoprefix2.default)(merged);
	};
}));
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/helpers/alpha.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_lib = /* @__PURE__ */ __toESM(require_lib());
var calculateChange$2 = function calculateChange(e, hsl, direction, initialA, container) {
	var containerWidth = container.clientWidth;
	var containerHeight = container.clientHeight;
	var x = typeof e.pageX === "number" ? e.pageX : e.touches[0].pageX;
	var y = typeof e.pageY === "number" ? e.pageY : e.touches[0].pageY;
	var left = x - (container.getBoundingClientRect().left + window.pageXOffset);
	var top = y - (container.getBoundingClientRect().top + window.pageYOffset);
	if (direction === "vertical") {
		var a = void 0;
		if (top < 0) a = 0;
		else if (top > containerHeight) a = 1;
		else a = Math.round(top * 100 / containerHeight) / 100;
		if (hsl.a !== a) return {
			h: hsl.h,
			s: hsl.s,
			l: hsl.l,
			a,
			source: "rgb"
		};
	} else {
		var _a = void 0;
		if (left < 0) _a = 0;
		else if (left > containerWidth) _a = 1;
		else _a = Math.round(left * 100 / containerWidth) / 100;
		if (initialA !== _a) return {
			h: hsl.h,
			s: hsl.s,
			l: hsl.l,
			a: _a,
			source: "rgb"
		};
	}
	return null;
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/helpers/checkboard.js
var checkboardCache = {};
var render = function render(c1, c2, size, serverCanvas) {
	if (typeof document === "undefined" && !serverCanvas) return null;
	var canvas = serverCanvas ? new serverCanvas() : document.createElement("canvas");
	canvas.width = size * 2;
	canvas.height = size * 2;
	var ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.fillStyle = c1;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = c2;
	ctx.fillRect(0, 0, size, size);
	ctx.translate(size, size);
	ctx.fillRect(0, 0, size, size);
	return canvas.toDataURL();
};
var get$1 = function get(c1, c2, size, serverCanvas) {
	var key = c1 + "-" + c2 + "-" + size + (serverCanvas ? "-server" : "");
	if (checkboardCache[key]) return checkboardCache[key];
	var checkboard = render(c1, c2, size, serverCanvas);
	checkboardCache[key] = checkboard;
	return checkboard;
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/common/Checkboard.js
var _extends$8 = Object.assign || function(target) {
	for (var i = 1; i < arguments.length; i++) {
		var source = arguments[i];
		for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
	}
	return target;
};
var Checkboard = function Checkboard(_ref) {
	var white = _ref.white, grey = _ref.grey, size = _ref.size, renderers = _ref.renderers, borderRadius = _ref.borderRadius, boxShadow = _ref.boxShadow, children = _ref.children;
	var styles = (0, import_lib.default)({ "default": { grid: {
		borderRadius,
		boxShadow,
		absolute: "0px 0px 0px 0px",
		background: "url(" + get$1(white, grey, size, renderers.canvas) + ") center left"
	} } });
	return (0, import_react.isValidElement)(children) ? import_react.cloneElement(children, _extends$8({}, children.props, { style: _extends$8({}, children.props.style, styles.grid) })) : import_react.createElement("div", { style: styles.grid });
};
Checkboard.defaultProps = {
	size: 8,
	white: "transparent",
	grey: "rgba(0,0,0,.08)",
	renderers: {}
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/common/Alpha.js
var _extends$7 = Object.assign || function(target) {
	for (var i = 1; i < arguments.length; i++) {
		var source = arguments[i];
		for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
	}
	return target;
};
var _createClass$7 = function() {
	function defineProperties(target, props) {
		for (var i = 0; i < props.length; i++) {
			var descriptor = props[i];
			descriptor.enumerable = descriptor.enumerable || false;
			descriptor.configurable = true;
			if ("value" in descriptor) descriptor.writable = true;
			Object.defineProperty(target, descriptor.key, descriptor);
		}
	}
	return function(Constructor, protoProps, staticProps) {
		if (protoProps) defineProperties(Constructor.prototype, protoProps);
		if (staticProps) defineProperties(Constructor, staticProps);
		return Constructor;
	};
}();
function _classCallCheck$7(instance, Constructor) {
	if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _possibleConstructorReturn$7(self, call) {
	if (!self) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return call && (typeof call === "object" || typeof call === "function") ? call : self;
}
function _inherits$7(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		enumerable: false,
		writable: true,
		configurable: true
	} });
	if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}
var Alpha = function(_ref) {
	_inherits$7(Alpha, _ref);
	function Alpha() {
		var _ref2;
		var _temp, _this, _ret;
		_classCallCheck$7(this, Alpha);
		for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) args[_key] = arguments[_key];
		return _ret = (_temp = (_this = _possibleConstructorReturn$7(this, (_ref2 = Alpha.__proto__ || Object.getPrototypeOf(Alpha)).call.apply(_ref2, [this].concat(args))), _this), _this.handleChange = function(e) {
			var change = calculateChange$2(e, _this.props.hsl, _this.props.direction, _this.props.a, _this.container);
			change && typeof _this.props.onChange === "function" && _this.props.onChange(change, e);
		}, _this.handleMouseDown = function(e) {
			_this.handleChange(e);
			window.addEventListener("mousemove", _this.handleChange);
			window.addEventListener("mouseup", _this.handleMouseUp);
		}, _this.handleMouseUp = function() {
			_this.unbindEventListeners();
		}, _this.unbindEventListeners = function() {
			window.removeEventListener("mousemove", _this.handleChange);
			window.removeEventListener("mouseup", _this.handleMouseUp);
		}, _temp), _possibleConstructorReturn$7(_this, _ret);
	}
	_createClass$7(Alpha, [{
		key: "componentWillUnmount",
		value: function componentWillUnmount() {
			this.unbindEventListeners();
		}
	}, {
		key: "render",
		value: function render() {
			var _this2 = this;
			var rgb = this.props.rgb;
			var styles = (0, import_lib.default)({
				"default": {
					alpha: {
						absolute: "0px 0px 0px 0px",
						borderRadius: this.props.radius
					},
					checkboard: {
						absolute: "0px 0px 0px 0px",
						overflow: "hidden",
						borderRadius: this.props.radius
					},
					gradient: {
						absolute: "0px 0px 0px 0px",
						background: "linear-gradient(to right, rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ", 0) 0%,\n           rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ", 1) 100%)",
						boxShadow: this.props.shadow,
						borderRadius: this.props.radius
					},
					container: {
						position: "relative",
						height: "100%",
						margin: "0 3px"
					},
					pointer: {
						position: "absolute",
						left: rgb.a * 100 + "%"
					},
					slider: {
						width: "4px",
						borderRadius: "1px",
						height: "8px",
						boxShadow: "0 0 2px rgba(0, 0, 0, .6)",
						background: "#fff",
						marginTop: "1px",
						transform: "translateX(-2px)"
					}
				},
				"vertical": {
					gradient: { background: "linear-gradient(to bottom, rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ", 0) 0%,\n           rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ", 1) 100%)" },
					pointer: {
						left: 0,
						top: rgb.a * 100 + "%"
					}
				},
				"overwrite": _extends$7({}, this.props.style)
			}, {
				vertical: this.props.direction === "vertical",
				overwrite: true
			});
			return import_react.createElement("div", { style: styles.alpha }, import_react.createElement("div", { style: styles.checkboard }, import_react.createElement(Checkboard, { renderers: this.props.renderers })), import_react.createElement("div", { style: styles.gradient }), import_react.createElement("div", {
				style: styles.container,
				ref: function ref(container) {
					return _this2.container = container;
				},
				onMouseDown: this.handleMouseDown,
				onTouchMove: this.handleChange,
				onTouchStart: this.handleChange
			}, import_react.createElement("div", { style: styles.pointer }, this.props.pointer ? import_react.createElement(this.props.pointer, this.props) : import_react.createElement("div", { style: styles.slider }))));
		}
	}]);
	return Alpha;
}(import_react.PureComponent || import_react.Component);
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/common/EditableInput.js
var _createClass$6 = function() {
	function defineProperties(target, props) {
		for (var i = 0; i < props.length; i++) {
			var descriptor = props[i];
			descriptor.enumerable = descriptor.enumerable || false;
			descriptor.configurable = true;
			if ("value" in descriptor) descriptor.writable = true;
			Object.defineProperty(target, descriptor.key, descriptor);
		}
	}
	return function(Constructor, protoProps, staticProps) {
		if (protoProps) defineProperties(Constructor.prototype, protoProps);
		if (staticProps) defineProperties(Constructor, staticProps);
		return Constructor;
	};
}();
function _defineProperty(obj, key, value) {
	if (key in obj) Object.defineProperty(obj, key, {
		value,
		enumerable: true,
		configurable: true,
		writable: true
	});
	else obj[key] = value;
	return obj;
}
function _classCallCheck$6(instance, Constructor) {
	if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _possibleConstructorReturn$6(self, call) {
	if (!self) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return call && (typeof call === "object" || typeof call === "function") ? call : self;
}
function _inherits$6(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		enumerable: false,
		writable: true,
		configurable: true
	} });
	if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}
var DEFAULT_ARROW_OFFSET = 1;
var UP_KEY_CODE = 38;
var VALID_KEY_CODES = [UP_KEY_CODE, 40];
var isValidKeyCode = function isValidKeyCode(keyCode) {
	return VALID_KEY_CODES.indexOf(keyCode) > -1;
};
var getNumberValue = function getNumberValue(value) {
	return Number(String(value).replace(/%/g, ""));
};
var idCounter = 1;
var EditableInput = function(_ref) {
	_inherits$6(EditableInput, _ref);
	function EditableInput(props) {
		_classCallCheck$6(this, EditableInput);
		var _this = _possibleConstructorReturn$6(this, (EditableInput.__proto__ || Object.getPrototypeOf(EditableInput)).call(this));
		_this.handleBlur = function() {
			if (_this.state.blurValue) _this.setState({
				value: _this.state.blurValue,
				blurValue: null
			});
		};
		_this.handleChange = function(e) {
			_this.setUpdatedValue(e.target.value, e);
		};
		_this.handleKeyDown = function(e) {
			var value = getNumberValue(e.target.value);
			if (!isNaN(value) && isValidKeyCode(e.keyCode)) {
				var offset = _this.getArrowOffset();
				var updatedValue = e.keyCode === UP_KEY_CODE ? value + offset : value - offset;
				_this.setUpdatedValue(updatedValue, e);
			}
		};
		_this.handleDrag = function(e) {
			if (_this.props.dragLabel) {
				var newValue = Math.round(_this.props.value + e.movementX);
				if (newValue >= 0 && newValue <= _this.props.dragMax) _this.props.onChange && _this.props.onChange(_this.getValueObjectWithLabel(newValue), e);
			}
		};
		_this.handleMouseDown = function(e) {
			if (_this.props.dragLabel) {
				e.preventDefault();
				_this.handleDrag(e);
				window.addEventListener("mousemove", _this.handleDrag);
				window.addEventListener("mouseup", _this.handleMouseUp);
			}
		};
		_this.handleMouseUp = function() {
			_this.unbindEventListeners();
		};
		_this.unbindEventListeners = function() {
			window.removeEventListener("mousemove", _this.handleDrag);
			window.removeEventListener("mouseup", _this.handleMouseUp);
		};
		_this.state = {
			value: String(props.value).toUpperCase(),
			blurValue: String(props.value).toUpperCase()
		};
		_this.inputId = "rc-editable-input-" + idCounter++;
		return _this;
	}
	_createClass$6(EditableInput, [
		{
			key: "componentDidUpdate",
			value: function componentDidUpdate(prevProps, prevState) {
				if (this.props.value !== this.state.value && (prevProps.value !== this.props.value || prevState.value !== this.state.value)) if (this.input === document.activeElement) this.setState({ blurValue: String(this.props.value).toUpperCase() });
				else this.setState({
					value: String(this.props.value).toUpperCase(),
					blurValue: !this.state.blurValue && String(this.props.value).toUpperCase()
				});
			}
		},
		{
			key: "componentWillUnmount",
			value: function componentWillUnmount() {
				this.unbindEventListeners();
			}
		},
		{
			key: "getValueObjectWithLabel",
			value: function getValueObjectWithLabel(value) {
				return _defineProperty({}, this.props.label, value);
			}
		},
		{
			key: "getArrowOffset",
			value: function getArrowOffset() {
				return this.props.arrowOffset || DEFAULT_ARROW_OFFSET;
			}
		},
		{
			key: "setUpdatedValue",
			value: function setUpdatedValue(value, e) {
				var onChangeValue = this.props.label ? this.getValueObjectWithLabel(value) : value;
				this.props.onChange && this.props.onChange(onChangeValue, e);
				this.setState({ value });
			}
		},
		{
			key: "render",
			value: function render() {
				var _this2 = this;
				var styles = (0, import_lib.default)({
					"default": { wrap: { position: "relative" } },
					"user-override": {
						wrap: this.props.style && this.props.style.wrap ? this.props.style.wrap : {},
						input: this.props.style && this.props.style.input ? this.props.style.input : {},
						label: this.props.style && this.props.style.label ? this.props.style.label : {}
					},
					"dragLabel-true": { label: { cursor: "ew-resize" } }
				}, { "user-override": true }, this.props);
				return import_react.createElement("div", { style: styles.wrap }, import_react.createElement("input", {
					id: this.inputId,
					style: styles.input,
					ref: function ref(input) {
						return _this2.input = input;
					},
					value: this.state.value,
					onKeyDown: this.handleKeyDown,
					onChange: this.handleChange,
					onBlur: this.handleBlur,
					placeholder: this.props.placeholder,
					spellCheck: "false"
				}), this.props.label && !this.props.hideLabel ? import_react.createElement("label", {
					htmlFor: this.inputId,
					style: styles.label,
					onMouseDown: this.handleMouseDown
				}, this.props.label) : null);
			}
		}
	]);
	return EditableInput;
}(import_react.PureComponent || import_react.Component);
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/helpers/hue.js
var calculateChange$1 = function calculateChange(e, direction, hsl, container) {
	var containerWidth = container.clientWidth;
	var containerHeight = container.clientHeight;
	var x = typeof e.pageX === "number" ? e.pageX : e.touches[0].pageX;
	var y = typeof e.pageY === "number" ? e.pageY : e.touches[0].pageY;
	var left = x - (container.getBoundingClientRect().left + window.pageXOffset);
	var top = y - (container.getBoundingClientRect().top + window.pageYOffset);
	if (direction === "vertical") {
		var h = void 0;
		if (top < 0) h = 359;
		else if (top > containerHeight) h = 0;
		else h = 360 * (-(top * 100 / containerHeight) + 100) / 100;
		if (hsl.h !== h) return {
			h,
			s: hsl.s,
			l: hsl.l,
			a: hsl.a,
			source: "hsl"
		};
	} else {
		var _h = void 0;
		if (left < 0) _h = 0;
		else if (left > containerWidth) _h = 359;
		else _h = 360 * (left * 100 / containerWidth) / 100;
		if (hsl.h !== _h) return {
			h: _h,
			s: hsl.s,
			l: hsl.l,
			a: hsl.a,
			source: "hsl"
		};
	}
	return null;
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/common/Hue.js
var _createClass$5 = function() {
	function defineProperties(target, props) {
		for (var i = 0; i < props.length; i++) {
			var descriptor = props[i];
			descriptor.enumerable = descriptor.enumerable || false;
			descriptor.configurable = true;
			if ("value" in descriptor) descriptor.writable = true;
			Object.defineProperty(target, descriptor.key, descriptor);
		}
	}
	return function(Constructor, protoProps, staticProps) {
		if (protoProps) defineProperties(Constructor.prototype, protoProps);
		if (staticProps) defineProperties(Constructor, staticProps);
		return Constructor;
	};
}();
function _classCallCheck$5(instance, Constructor) {
	if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _possibleConstructorReturn$5(self, call) {
	if (!self) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return call && (typeof call === "object" || typeof call === "function") ? call : self;
}
function _inherits$5(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		enumerable: false,
		writable: true,
		configurable: true
	} });
	if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}
var Hue = function(_ref) {
	_inherits$5(Hue, _ref);
	function Hue() {
		var _ref2;
		var _temp, _this, _ret;
		_classCallCheck$5(this, Hue);
		for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) args[_key] = arguments[_key];
		return _ret = (_temp = (_this = _possibleConstructorReturn$5(this, (_ref2 = Hue.__proto__ || Object.getPrototypeOf(Hue)).call.apply(_ref2, [this].concat(args))), _this), _this.handleChange = function(e) {
			var change = calculateChange$1(e, _this.props.direction, _this.props.hsl, _this.container);
			change && typeof _this.props.onChange === "function" && _this.props.onChange(change, e);
		}, _this.handleMouseDown = function(e) {
			_this.handleChange(e);
			window.addEventListener("mousemove", _this.handleChange);
			window.addEventListener("mouseup", _this.handleMouseUp);
		}, _this.handleMouseUp = function() {
			_this.unbindEventListeners();
		}, _temp), _possibleConstructorReturn$5(_this, _ret);
	}
	_createClass$5(Hue, [
		{
			key: "componentWillUnmount",
			value: function componentWillUnmount() {
				this.unbindEventListeners();
			}
		},
		{
			key: "unbindEventListeners",
			value: function unbindEventListeners() {
				window.removeEventListener("mousemove", this.handleChange);
				window.removeEventListener("mouseup", this.handleMouseUp);
			}
		},
		{
			key: "render",
			value: function render() {
				var _this2 = this;
				var _props$direction = this.props.direction, direction = _props$direction === void 0 ? "horizontal" : _props$direction;
				var styles = (0, import_lib.default)({
					"default": {
						hue: {
							absolute: "0px 0px 0px 0px",
							borderRadius: this.props.radius,
							boxShadow: this.props.shadow
						},
						container: {
							padding: "0 2px",
							position: "relative",
							height: "100%",
							borderRadius: this.props.radius
						},
						pointer: {
							position: "absolute",
							left: this.props.hsl.h * 100 / 360 + "%"
						},
						slider: {
							marginTop: "1px",
							width: "4px",
							borderRadius: "1px",
							height: "8px",
							boxShadow: "0 0 2px rgba(0, 0, 0, .6)",
							background: "#fff",
							transform: "translateX(-2px)"
						}
					},
					"vertical": { pointer: {
						left: "0px",
						top: -(this.props.hsl.h * 100 / 360) + 100 + "%"
					} }
				}, { vertical: direction === "vertical" });
				return import_react.createElement("div", { style: styles.hue }, import_react.createElement("div", {
					className: "hue-" + direction,
					style: styles.container,
					ref: function ref(container) {
						return _this2.container = container;
					},
					onMouseDown: this.handleMouseDown,
					onTouchMove: this.handleChange,
					onTouchStart: this.handleChange
				}, import_react.createElement("style", null, "\n            .hue-horizontal {\n              background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0\n                33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);\n              background: -webkit-linear-gradient(to right, #f00 0%, #ff0\n                17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);\n            }\n\n            .hue-vertical {\n              background: linear-gradient(to top, #f00 0%, #ff0 17%, #0f0 33%,\n                #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);\n              background: -webkit-linear-gradient(to top, #f00 0%, #ff0 17%,\n                #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);\n            }\n          "), import_react.createElement("div", { style: styles.pointer }, this.props.pointer ? import_react.createElement(this.props.pointer, this.props) : import_react.createElement("div", { style: styles.slider }))));
			}
		}
	]);
	return Hue;
}(import_react.PureComponent || import_react.Component);
//#endregion
//#region node_modules/.pnpm/react-is@16.13.1/node_modules/react-is/cjs/react-is.development.js
/** @license React v16.13.1
* react-is.development.js
*
* Copyright (c) Facebook, Inc. and its affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_is_development = /* @__PURE__ */ __commonJSMin(((exports) => {
	(function() {
		"use strict";
		var hasSymbol = typeof Symbol === "function" && Symbol.for;
		var REACT_ELEMENT_TYPE = hasSymbol ? Symbol.for("react.element") : 60103;
		var REACT_PORTAL_TYPE = hasSymbol ? Symbol.for("react.portal") : 60106;
		var REACT_FRAGMENT_TYPE = hasSymbol ? Symbol.for("react.fragment") : 60107;
		var REACT_STRICT_MODE_TYPE = hasSymbol ? Symbol.for("react.strict_mode") : 60108;
		var REACT_PROFILER_TYPE = hasSymbol ? Symbol.for("react.profiler") : 60114;
		var REACT_PROVIDER_TYPE = hasSymbol ? Symbol.for("react.provider") : 60109;
		var REACT_CONTEXT_TYPE = hasSymbol ? Symbol.for("react.context") : 60110;
		var REACT_ASYNC_MODE_TYPE = hasSymbol ? Symbol.for("react.async_mode") : 60111;
		var REACT_CONCURRENT_MODE_TYPE = hasSymbol ? Symbol.for("react.concurrent_mode") : 60111;
		var REACT_FORWARD_REF_TYPE = hasSymbol ? Symbol.for("react.forward_ref") : 60112;
		var REACT_SUSPENSE_TYPE = hasSymbol ? Symbol.for("react.suspense") : 60113;
		var REACT_SUSPENSE_LIST_TYPE = hasSymbol ? Symbol.for("react.suspense_list") : 60120;
		var REACT_MEMO_TYPE = hasSymbol ? Symbol.for("react.memo") : 60115;
		var REACT_LAZY_TYPE = hasSymbol ? Symbol.for("react.lazy") : 60116;
		var REACT_BLOCK_TYPE = hasSymbol ? Symbol.for("react.block") : 60121;
		var REACT_FUNDAMENTAL_TYPE = hasSymbol ? Symbol.for("react.fundamental") : 60117;
		var REACT_RESPONDER_TYPE = hasSymbol ? Symbol.for("react.responder") : 60118;
		var REACT_SCOPE_TYPE = hasSymbol ? Symbol.for("react.scope") : 60119;
		function isValidElementType(type) {
			return typeof type === "string" || typeof type === "function" || type === REACT_FRAGMENT_TYPE || type === REACT_CONCURRENT_MODE_TYPE || type === REACT_PROFILER_TYPE || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || typeof type === "object" && type !== null && (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_FUNDAMENTAL_TYPE || type.$$typeof === REACT_RESPONDER_TYPE || type.$$typeof === REACT_SCOPE_TYPE || type.$$typeof === REACT_BLOCK_TYPE);
		}
		function typeOf(object) {
			if (typeof object === "object" && object !== null) {
				var $$typeof = object.$$typeof;
				switch ($$typeof) {
					case REACT_ELEMENT_TYPE:
						var type = object.type;
						switch (type) {
							case REACT_ASYNC_MODE_TYPE:
							case REACT_CONCURRENT_MODE_TYPE:
							case REACT_FRAGMENT_TYPE:
							case REACT_PROFILER_TYPE:
							case REACT_STRICT_MODE_TYPE:
							case REACT_SUSPENSE_TYPE: return type;
							default:
								var $$typeofType = type && type.$$typeof;
								switch ($$typeofType) {
									case REACT_CONTEXT_TYPE:
									case REACT_FORWARD_REF_TYPE:
									case REACT_LAZY_TYPE:
									case REACT_MEMO_TYPE:
									case REACT_PROVIDER_TYPE: return $$typeofType;
									default: return $$typeof;
								}
						}
					case REACT_PORTAL_TYPE: return $$typeof;
				}
			}
		}
		var AsyncMode = REACT_ASYNC_MODE_TYPE;
		var ConcurrentMode = REACT_CONCURRENT_MODE_TYPE;
		var ContextConsumer = REACT_CONTEXT_TYPE;
		var ContextProvider = REACT_PROVIDER_TYPE;
		var Element = REACT_ELEMENT_TYPE;
		var ForwardRef = REACT_FORWARD_REF_TYPE;
		var Fragment = REACT_FRAGMENT_TYPE;
		var Lazy = REACT_LAZY_TYPE;
		var Memo = REACT_MEMO_TYPE;
		var Portal = REACT_PORTAL_TYPE;
		var Profiler = REACT_PROFILER_TYPE;
		var StrictMode = REACT_STRICT_MODE_TYPE;
		var Suspense = REACT_SUSPENSE_TYPE;
		var hasWarnedAboutDeprecatedIsAsyncMode = false;
		function isAsyncMode(object) {
			if (!hasWarnedAboutDeprecatedIsAsyncMode) {
				hasWarnedAboutDeprecatedIsAsyncMode = true;
				console["warn"]("The ReactIs.isAsyncMode() alias has been deprecated, and will be removed in React 17+. Update your code to use ReactIs.isConcurrentMode() instead. It has the exact same API.");
			}
			return isConcurrentMode(object) || typeOf(object) === REACT_ASYNC_MODE_TYPE;
		}
		function isConcurrentMode(object) {
			return typeOf(object) === REACT_CONCURRENT_MODE_TYPE;
		}
		function isContextConsumer(object) {
			return typeOf(object) === REACT_CONTEXT_TYPE;
		}
		function isContextProvider(object) {
			return typeOf(object) === REACT_PROVIDER_TYPE;
		}
		function isElement(object) {
			return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
		}
		function isForwardRef(object) {
			return typeOf(object) === REACT_FORWARD_REF_TYPE;
		}
		function isFragment(object) {
			return typeOf(object) === REACT_FRAGMENT_TYPE;
		}
		function isLazy(object) {
			return typeOf(object) === REACT_LAZY_TYPE;
		}
		function isMemo(object) {
			return typeOf(object) === REACT_MEMO_TYPE;
		}
		function isPortal(object) {
			return typeOf(object) === REACT_PORTAL_TYPE;
		}
		function isProfiler(object) {
			return typeOf(object) === REACT_PROFILER_TYPE;
		}
		function isStrictMode(object) {
			return typeOf(object) === REACT_STRICT_MODE_TYPE;
		}
		function isSuspense(object) {
			return typeOf(object) === REACT_SUSPENSE_TYPE;
		}
		exports.AsyncMode = AsyncMode;
		exports.ConcurrentMode = ConcurrentMode;
		exports.ContextConsumer = ContextConsumer;
		exports.ContextProvider = ContextProvider;
		exports.Element = Element;
		exports.ForwardRef = ForwardRef;
		exports.Fragment = Fragment;
		exports.Lazy = Lazy;
		exports.Memo = Memo;
		exports.Portal = Portal;
		exports.Profiler = Profiler;
		exports.StrictMode = StrictMode;
		exports.Suspense = Suspense;
		exports.isAsyncMode = isAsyncMode;
		exports.isConcurrentMode = isConcurrentMode;
		exports.isContextConsumer = isContextConsumer;
		exports.isContextProvider = isContextProvider;
		exports.isElement = isElement;
		exports.isForwardRef = isForwardRef;
		exports.isFragment = isFragment;
		exports.isLazy = isLazy;
		exports.isMemo = isMemo;
		exports.isPortal = isPortal;
		exports.isProfiler = isProfiler;
		exports.isStrictMode = isStrictMode;
		exports.isSuspense = isSuspense;
		exports.isValidElementType = isValidElementType;
		exports.typeOf = typeOf;
	})();
}));
//#endregion
//#region node_modules/.pnpm/react-is@16.13.1/node_modules/react-is/index.js
var require_react_is = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_react_is_development();
}));
//#endregion
//#region node_modules/.pnpm/object-assign@4.1.1/node_modules/object-assign/index.js
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/
var require_object_assign = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var getOwnPropertySymbols = Object.getOwnPropertySymbols;
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	var propIsEnumerable = Object.prototype.propertyIsEnumerable;
	function toObject(val) {
		if (val === null || val === void 0) throw new TypeError("Object.assign cannot be called with null or undefined");
		return Object(val);
	}
	function shouldUseNative() {
		try {
			if (!Object.assign) return false;
			var test1 = /* @__PURE__ */ new String("abc");
			test1[5] = "de";
			if (Object.getOwnPropertyNames(test1)[0] === "5") return false;
			var test2 = {};
			for (var i = 0; i < 10; i++) test2["_" + String.fromCharCode(i)] = i;
			if (Object.getOwnPropertyNames(test2).map(function(n) {
				return test2[n];
			}).join("") !== "0123456789") return false;
			var test3 = {};
			"abcdefghijklmnopqrst".split("").forEach(function(letter) {
				test3[letter] = letter;
			});
			if (Object.keys(Object.assign({}, test3)).join("") !== "abcdefghijklmnopqrst") return false;
			return true;
		} catch (err) {
			return false;
		}
	}
	module.exports = shouldUseNative() ? Object.assign : function(target, source) {
		var from;
		var to = toObject(target);
		var symbols;
		for (var s = 1; s < arguments.length; s++) {
			from = Object(arguments[s]);
			for (var key in from) if (hasOwnProperty.call(from, key)) to[key] = from[key];
			if (getOwnPropertySymbols) {
				symbols = getOwnPropertySymbols(from);
				for (var i = 0; i < symbols.length; i++) if (propIsEnumerable.call(from, symbols[i])) to[symbols[i]] = from[symbols[i]];
			}
		}
		return to;
	};
}));
//#endregion
//#region node_modules/.pnpm/prop-types@15.8.1/node_modules/prop-types/lib/ReactPropTypesSecret.js
/**
* Copyright (c) 2013-present, Facebook, Inc.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_ReactPropTypesSecret = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED";
}));
//#endregion
//#region node_modules/.pnpm/prop-types@15.8.1/node_modules/prop-types/lib/has.js
var require_has = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = Function.call.bind(Object.prototype.hasOwnProperty);
}));
//#endregion
//#region node_modules/.pnpm/prop-types@15.8.1/node_modules/prop-types/checkPropTypes.js
/**
* Copyright (c) 2013-present, Facebook, Inc.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_checkPropTypes = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var printWarning = function() {};
	var ReactPropTypesSecret = require_ReactPropTypesSecret();
	var loggedTypeFailures = {};
	var has = require_has();
	printWarning = function(text) {
		var message = "Warning: " + text;
		if (typeof console !== "undefined") console.error(message);
		try {
			throw new Error(message);
		} catch (x) {}
	};
	/**
	* Assert that the values match with the type specs.
	* Error messages are memorized and will only be shown once.
	*
	* @param {object} typeSpecs Map of name to a ReactPropType
	* @param {object} values Runtime values that need to be type-checked
	* @param {string} location e.g. "prop", "context", "child context"
	* @param {string} componentName Name of the component for error messages.
	* @param {?Function} getStack Returns the component stack.
	* @private
	*/
	function checkPropTypes(typeSpecs, values, location, componentName, getStack) {
		for (var typeSpecName in typeSpecs) if (has(typeSpecs, typeSpecName)) {
			var error;
			try {
				if (typeof typeSpecs[typeSpecName] !== "function") {
					var err = Error((componentName || "React class") + ": " + location + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
					err.name = "Invariant Violation";
					throw err;
				}
				error = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, ReactPropTypesSecret);
			} catch (ex) {
				error = ex;
			}
			if (error && !(error instanceof Error)) printWarning((componentName || "React class") + ": type specification of " + location + " `" + typeSpecName + "` is invalid; the type checker function must return `null` or an `Error` but returned a " + typeof error + ". You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).");
			if (error instanceof Error && !(error.message in loggedTypeFailures)) {
				loggedTypeFailures[error.message] = true;
				var stack = getStack ? getStack() : "";
				printWarning("Failed " + location + " type: " + error.message + (stack != null ? stack : ""));
			}
		}
	}
	/**
	* Resets warning cache when testing.
	*
	* @private
	*/
	checkPropTypes.resetWarningCache = function() {
		loggedTypeFailures = {};
	};
	module.exports = checkPropTypes;
}));
//#endregion
//#region node_modules/.pnpm/prop-types@15.8.1/node_modules/prop-types/factoryWithTypeCheckers.js
/**
* Copyright (c) 2013-present, Facebook, Inc.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_factoryWithTypeCheckers = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ReactIs = require_react_is();
	var assign = require_object_assign();
	var ReactPropTypesSecret = require_ReactPropTypesSecret();
	var has = require_has();
	var checkPropTypes = require_checkPropTypes();
	var printWarning = function() {};
	printWarning = function(text) {
		var message = "Warning: " + text;
		if (typeof console !== "undefined") console.error(message);
		try {
			throw new Error(message);
		} catch (x) {}
	};
	function emptyFunctionThatReturnsNull() {
		return null;
	}
	module.exports = function(isValidElement, throwOnDirectAccess) {
		var ITERATOR_SYMBOL = typeof Symbol === "function" && Symbol.iterator;
		var FAUX_ITERATOR_SYMBOL = "@@iterator";
		/**
		* Returns the iterator method function contained on the iterable object.
		*
		* Be sure to invoke the function with the iterable as context:
		*
		*     var iteratorFn = getIteratorFn(myIterable);
		*     if (iteratorFn) {
		*       var iterator = iteratorFn.call(myIterable);
		*       ...
		*     }
		*
		* @param {?object} maybeIterable
		* @return {?function}
		*/
		function getIteratorFn(maybeIterable) {
			var iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);
			if (typeof iteratorFn === "function") return iteratorFn;
		}
		/**
		* Collection of methods that allow declaration and validation of props that are
		* supplied to React components. Example usage:
		*
		*   var Props = require('ReactPropTypes');
		*   var MyArticle = React.createClass({
		*     propTypes: {
		*       // An optional string prop named "description".
		*       description: Props.string,
		*
		*       // A required enum prop named "category".
		*       category: Props.oneOf(['News','Photos']).isRequired,
		*
		*       // A prop named "dialog" that requires an instance of Dialog.
		*       dialog: Props.instanceOf(Dialog).isRequired
		*     },
		*     render: function() { ... }
		*   });
		*
		* A more formal specification of how these methods are used:
		*
		*   type := array|bool|func|object|number|string|oneOf([...])|instanceOf(...)
		*   decl := ReactPropTypes.{type}(.isRequired)?
		*
		* Each and every declaration produces a function with the same signature. This
		* allows the creation of custom validation functions. For example:
		*
		*  var MyLink = React.createClass({
		*    propTypes: {
		*      // An optional string or URI prop named "href".
		*      href: function(props, propName, componentName) {
		*        var propValue = props[propName];
		*        if (propValue != null && typeof propValue !== 'string' &&
		*            !(propValue instanceof URI)) {
		*          return new Error(
		*            'Expected a string or an URI for ' + propName + ' in ' +
		*            componentName
		*          );
		*        }
		*      }
		*    },
		*    render: function() {...}
		*  });
		*
		* @internal
		*/
		var ANONYMOUS = "<<anonymous>>";
		var ReactPropTypes = {
			array: createPrimitiveTypeChecker("array"),
			bigint: createPrimitiveTypeChecker("bigint"),
			bool: createPrimitiveTypeChecker("boolean"),
			func: createPrimitiveTypeChecker("function"),
			number: createPrimitiveTypeChecker("number"),
			object: createPrimitiveTypeChecker("object"),
			string: createPrimitiveTypeChecker("string"),
			symbol: createPrimitiveTypeChecker("symbol"),
			any: createAnyTypeChecker(),
			arrayOf: createArrayOfTypeChecker,
			element: createElementTypeChecker(),
			elementType: createElementTypeTypeChecker(),
			instanceOf: createInstanceTypeChecker,
			node: createNodeChecker(),
			objectOf: createObjectOfTypeChecker,
			oneOf: createEnumTypeChecker,
			oneOfType: createUnionTypeChecker,
			shape: createShapeTypeChecker,
			exact: createStrictShapeTypeChecker
		};
		/**
		* inlined Object.is polyfill to avoid requiring consumers ship their own
		* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
		*/
		function is(x, y) {
			if (x === y) return x !== 0 || 1 / x === 1 / y;
			else return x !== x && y !== y;
		}
		/**
		* We use an Error-like object for backward compatibility as people may call
		* PropTypes directly and inspect their output. However, we don't use real
		* Errors anymore. We don't inspect their stack anyway, and creating them
		* is prohibitively expensive if they are created too often, such as what
		* happens in oneOfType() for any type before the one that matched.
		*/
		function PropTypeError(message, data) {
			this.message = message;
			this.data = data && typeof data === "object" ? data : {};
			this.stack = "";
		}
		PropTypeError.prototype = Error.prototype;
		function createChainableTypeChecker(validate) {
			var manualPropTypeCallCache = {};
			var manualPropTypeWarningCount = 0;
			function checkType(isRequired, props, propName, componentName, location, propFullName, secret) {
				componentName = componentName || ANONYMOUS;
				propFullName = propFullName || propName;
				if (secret !== ReactPropTypesSecret) {
					if (throwOnDirectAccess) {
						var err = /* @__PURE__ */ new Error("Calling PropTypes validators directly is not supported by the `prop-types` package. Use `PropTypes.checkPropTypes()` to call them. Read more at http://fb.me/use-check-prop-types");
						err.name = "Invariant Violation";
						throw err;
					} else if (typeof console !== "undefined") {
						var cacheKey = componentName + ":" + propName;
						if (!manualPropTypeCallCache[cacheKey] && manualPropTypeWarningCount < 3) {
							printWarning("You are manually calling a React.PropTypes validation function for the `" + propFullName + "` prop on `" + componentName + "`. This is deprecated and will throw in the standalone `prop-types` package. You may be seeing this warning due to a third-party PropTypes library. See https://fb.me/react-warning-dont-call-proptypes for details.");
							manualPropTypeCallCache[cacheKey] = true;
							manualPropTypeWarningCount++;
						}
					}
				}
				if (props[propName] == null) {
					if (isRequired) {
						if (props[propName] === null) return new PropTypeError("The " + location + " `" + propFullName + "` is marked as required " + ("in `" + componentName + "`, but its value is `null`."));
						return new PropTypeError("The " + location + " `" + propFullName + "` is marked as required in " + ("`" + componentName + "`, but its value is `undefined`."));
					}
					return null;
				} else return validate(props, propName, componentName, location, propFullName);
			}
			var chainedCheckType = checkType.bind(null, false);
			chainedCheckType.isRequired = checkType.bind(null, true);
			return chainedCheckType;
		}
		function createPrimitiveTypeChecker(expectedType) {
			function validate(props, propName, componentName, location, propFullName, secret) {
				var propValue = props[propName];
				if (getPropType(propValue) !== expectedType) {
					var preciseType = getPreciseType(propValue);
					return new PropTypeError("Invalid " + location + " `" + propFullName + "` of type " + ("`" + preciseType + "` supplied to `" + componentName + "`, expected ") + ("`" + expectedType + "`."), { expectedType });
				}
				return null;
			}
			return createChainableTypeChecker(validate);
		}
		function createAnyTypeChecker() {
			return createChainableTypeChecker(emptyFunctionThatReturnsNull);
		}
		function createArrayOfTypeChecker(typeChecker) {
			function validate(props, propName, componentName, location, propFullName) {
				if (typeof typeChecker !== "function") return new PropTypeError("Property `" + propFullName + "` of component `" + componentName + "` has invalid PropType notation inside arrayOf.");
				var propValue = props[propName];
				if (!Array.isArray(propValue)) {
					var propType = getPropType(propValue);
					return new PropTypeError("Invalid " + location + " `" + propFullName + "` of type " + ("`" + propType + "` supplied to `" + componentName + "`, expected an array."));
				}
				for (var i = 0; i < propValue.length; i++) {
					var error = typeChecker(propValue, i, componentName, location, propFullName + "[" + i + "]", ReactPropTypesSecret);
					if (error instanceof Error) return error;
				}
				return null;
			}
			return createChainableTypeChecker(validate);
		}
		function createElementTypeChecker() {
			function validate(props, propName, componentName, location, propFullName) {
				var propValue = props[propName];
				if (!isValidElement(propValue)) {
					var propType = getPropType(propValue);
					return new PropTypeError("Invalid " + location + " `" + propFullName + "` of type " + ("`" + propType + "` supplied to `" + componentName + "`, expected a single ReactElement."));
				}
				return null;
			}
			return createChainableTypeChecker(validate);
		}
		function createElementTypeTypeChecker() {
			function validate(props, propName, componentName, location, propFullName) {
				var propValue = props[propName];
				if (!ReactIs.isValidElementType(propValue)) {
					var propType = getPropType(propValue);
					return new PropTypeError("Invalid " + location + " `" + propFullName + "` of type " + ("`" + propType + "` supplied to `" + componentName + "`, expected a single ReactElement type."));
				}
				return null;
			}
			return createChainableTypeChecker(validate);
		}
		function createInstanceTypeChecker(expectedClass) {
			function validate(props, propName, componentName, location, propFullName) {
				if (!(props[propName] instanceof expectedClass)) {
					var expectedClassName = expectedClass.name || ANONYMOUS;
					var actualClassName = getClassName(props[propName]);
					return new PropTypeError("Invalid " + location + " `" + propFullName + "` of type " + ("`" + actualClassName + "` supplied to `" + componentName + "`, expected ") + ("instance of `" + expectedClassName + "`."));
				}
				return null;
			}
			return createChainableTypeChecker(validate);
		}
		function createEnumTypeChecker(expectedValues) {
			if (!Array.isArray(expectedValues)) {
				if (arguments.length > 1) printWarning("Invalid arguments supplied to oneOf, expected an array, got " + arguments.length + " arguments. A common mistake is to write oneOf(x, y, z) instead of oneOf([x, y, z]).");
				else printWarning("Invalid argument supplied to oneOf, expected an array.");
				return emptyFunctionThatReturnsNull;
			}
			function validate(props, propName, componentName, location, propFullName) {
				var propValue = props[propName];
				for (var i = 0; i < expectedValues.length; i++) if (is(propValue, expectedValues[i])) return null;
				var valuesString = JSON.stringify(expectedValues, function replacer(key, value) {
					if (getPreciseType(value) === "symbol") return String(value);
					return value;
				});
				return new PropTypeError("Invalid " + location + " `" + propFullName + "` of value `" + String(propValue) + "` " + ("supplied to `" + componentName + "`, expected one of " + valuesString + "."));
			}
			return createChainableTypeChecker(validate);
		}
		function createObjectOfTypeChecker(typeChecker) {
			function validate(props, propName, componentName, location, propFullName) {
				if (typeof typeChecker !== "function") return new PropTypeError("Property `" + propFullName + "` of component `" + componentName + "` has invalid PropType notation inside objectOf.");
				var propValue = props[propName];
				var propType = getPropType(propValue);
				if (propType !== "object") return new PropTypeError("Invalid " + location + " `" + propFullName + "` of type " + ("`" + propType + "` supplied to `" + componentName + "`, expected an object."));
				for (var key in propValue) if (has(propValue, key)) {
					var error = typeChecker(propValue, key, componentName, location, propFullName + "." + key, ReactPropTypesSecret);
					if (error instanceof Error) return error;
				}
				return null;
			}
			return createChainableTypeChecker(validate);
		}
		function createUnionTypeChecker(arrayOfTypeCheckers) {
			if (!Array.isArray(arrayOfTypeCheckers)) {
				printWarning("Invalid argument supplied to oneOfType, expected an instance of array.");
				return emptyFunctionThatReturnsNull;
			}
			for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
				var checker = arrayOfTypeCheckers[i];
				if (typeof checker !== "function") {
					printWarning("Invalid argument supplied to oneOfType. Expected an array of check functions, but received " + getPostfixForTypeWarning(checker) + " at index " + i + ".");
					return emptyFunctionThatReturnsNull;
				}
			}
			function validate(props, propName, componentName, location, propFullName) {
				var expectedTypes = [];
				for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
					var checker = arrayOfTypeCheckers[i];
					var checkerResult = checker(props, propName, componentName, location, propFullName, ReactPropTypesSecret);
					if (checkerResult == null) return null;
					if (checkerResult.data && has(checkerResult.data, "expectedType")) expectedTypes.push(checkerResult.data.expectedType);
				}
				var expectedTypesMessage = expectedTypes.length > 0 ? ", expected one of type [" + expectedTypes.join(", ") + "]" : "";
				return new PropTypeError("Invalid " + location + " `" + propFullName + "` supplied to " + ("`" + componentName + "`" + expectedTypesMessage + "."));
			}
			return createChainableTypeChecker(validate);
		}
		function createNodeChecker() {
			function validate(props, propName, componentName, location, propFullName) {
				if (!isNode(props[propName])) return new PropTypeError("Invalid " + location + " `" + propFullName + "` supplied to " + ("`" + componentName + "`, expected a ReactNode."));
				return null;
			}
			return createChainableTypeChecker(validate);
		}
		function invalidValidatorError(componentName, location, propFullName, key, type) {
			return new PropTypeError((componentName || "React class") + ": " + location + " type `" + propFullName + "." + key + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + type + "`.");
		}
		function createShapeTypeChecker(shapeTypes) {
			function validate(props, propName, componentName, location, propFullName) {
				var propValue = props[propName];
				var propType = getPropType(propValue);
				if (propType !== "object") return new PropTypeError("Invalid " + location + " `" + propFullName + "` of type `" + propType + "` " + ("supplied to `" + componentName + "`, expected `object`."));
				for (var key in shapeTypes) {
					var checker = shapeTypes[key];
					if (typeof checker !== "function") return invalidValidatorError(componentName, location, propFullName, key, getPreciseType(checker));
					var error = checker(propValue, key, componentName, location, propFullName + "." + key, ReactPropTypesSecret);
					if (error) return error;
				}
				return null;
			}
			return createChainableTypeChecker(validate);
		}
		function createStrictShapeTypeChecker(shapeTypes) {
			function validate(props, propName, componentName, location, propFullName) {
				var propValue = props[propName];
				var propType = getPropType(propValue);
				if (propType !== "object") return new PropTypeError("Invalid " + location + " `" + propFullName + "` of type `" + propType + "` " + ("supplied to `" + componentName + "`, expected `object`."));
				for (var key in assign({}, props[propName], shapeTypes)) {
					var checker = shapeTypes[key];
					if (has(shapeTypes, key) && typeof checker !== "function") return invalidValidatorError(componentName, location, propFullName, key, getPreciseType(checker));
					if (!checker) return new PropTypeError("Invalid " + location + " `" + propFullName + "` key `" + key + "` supplied to `" + componentName + "`.\nBad object: " + JSON.stringify(props[propName], null, "  ") + "\nValid keys: " + JSON.stringify(Object.keys(shapeTypes), null, "  "));
					var error = checker(propValue, key, componentName, location, propFullName + "." + key, ReactPropTypesSecret);
					if (error) return error;
				}
				return null;
			}
			return createChainableTypeChecker(validate);
		}
		function isNode(propValue) {
			switch (typeof propValue) {
				case "number":
				case "string":
				case "undefined": return true;
				case "boolean": return !propValue;
				case "object":
					if (Array.isArray(propValue)) return propValue.every(isNode);
					if (propValue === null || isValidElement(propValue)) return true;
					var iteratorFn = getIteratorFn(propValue);
					if (iteratorFn) {
						var iterator = iteratorFn.call(propValue);
						var step;
						if (iteratorFn !== propValue.entries) {
							while (!(step = iterator.next()).done) if (!isNode(step.value)) return false;
						} else while (!(step = iterator.next()).done) {
							var entry = step.value;
							if (entry) {
								if (!isNode(entry[1])) return false;
							}
						}
					} else return false;
					return true;
				default: return false;
			}
		}
		function isSymbol(propType, propValue) {
			if (propType === "symbol") return true;
			if (!propValue) return false;
			if (propValue["@@toStringTag"] === "Symbol") return true;
			if (typeof Symbol === "function" && propValue instanceof Symbol) return true;
			return false;
		}
		function getPropType(propValue) {
			var propType = typeof propValue;
			if (Array.isArray(propValue)) return "array";
			if (propValue instanceof RegExp) return "object";
			if (isSymbol(propType, propValue)) return "symbol";
			return propType;
		}
		function getPreciseType(propValue) {
			if (typeof propValue === "undefined" || propValue === null) return "" + propValue;
			var propType = getPropType(propValue);
			if (propType === "object") {
				if (propValue instanceof Date) return "date";
				else if (propValue instanceof RegExp) return "regexp";
			}
			return propType;
		}
		function getPostfixForTypeWarning(value) {
			var type = getPreciseType(value);
			switch (type) {
				case "array":
				case "object": return "an " + type;
				case "boolean":
				case "date":
				case "regexp": return "a " + type;
				default: return type;
			}
		}
		function getClassName(propValue) {
			if (!propValue.constructor || !propValue.constructor.name) return ANONYMOUS;
			return propValue.constructor.name;
		}
		ReactPropTypes.checkPropTypes = checkPropTypes;
		ReactPropTypes.resetWarningCache = checkPropTypes.resetWarningCache;
		ReactPropTypes.PropTypes = ReactPropTypes;
		return ReactPropTypes;
	};
}));
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_listCacheClear.js
var import_prop_types = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ReactIs = require_react_is();
	module.exports = require_factoryWithTypeCheckers()(ReactIs.isElement, true);
})))());
/**
* Removes all key-value entries from the list cache.
*
* @private
* @name clear
* @memberOf ListCache
*/
function listCacheClear() {
	this.__data__ = [];
	this.size = 0;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/eq.js
/**
* Performs a
* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
* comparison between two values to determine if they are equivalent.
*
* @static
* @memberOf _
* @since 4.0.0
* @category Lang
* @param {*} value The value to compare.
* @param {*} other The other value to compare.
* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
* @example
*
* var object = { 'a': 1 };
* var other = { 'a': 1 };
*
* _.eq(object, object);
* // => true
*
* _.eq(object, other);
* // => false
*
* _.eq('a', 'a');
* // => true
*
* _.eq('a', Object('a'));
* // => false
*
* _.eq(NaN, NaN);
* // => true
*/
function eq(value, other) {
	return value === other || value !== value && other !== other;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_assocIndexOf.js
/**
* Gets the index at which the `key` is found in `array` of key-value pairs.
*
* @private
* @param {Array} array The array to inspect.
* @param {*} key The key to search for.
* @returns {number} Returns the index of the matched value, else `-1`.
*/
function assocIndexOf(array, key) {
	var length = array.length;
	while (length--) if (eq(array[length][0], key)) return length;
	return -1;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_listCacheDelete.js
/** Built-in value references. */
var splice = Array.prototype.splice;
/**
* Removes `key` and its value from the list cache.
*
* @private
* @name delete
* @memberOf ListCache
* @param {string} key The key of the value to remove.
* @returns {boolean} Returns `true` if the entry was removed, else `false`.
*/
function listCacheDelete(key) {
	var data = this.__data__, index = assocIndexOf(data, key);
	if (index < 0) return false;
	if (index == data.length - 1) data.pop();
	else splice.call(data, index, 1);
	--this.size;
	return true;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_listCacheGet.js
/**
* Gets the list cache value for `key`.
*
* @private
* @name get
* @memberOf ListCache
* @param {string} key The key of the value to get.
* @returns {*} Returns the entry value.
*/
function listCacheGet(key) {
	var data = this.__data__, index = assocIndexOf(data, key);
	return index < 0 ? void 0 : data[index][1];
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_listCacheHas.js
/**
* Checks if a list cache value for `key` exists.
*
* @private
* @name has
* @memberOf ListCache
* @param {string} key The key of the entry to check.
* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
*/
function listCacheHas(key) {
	return assocIndexOf(this.__data__, key) > -1;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_listCacheSet.js
/**
* Sets the list cache `key` to `value`.
*
* @private
* @name set
* @memberOf ListCache
* @param {string} key The key of the value to set.
* @param {*} value The value to set.
* @returns {Object} Returns the list cache instance.
*/
function listCacheSet(key, value) {
	var data = this.__data__, index = assocIndexOf(data, key);
	if (index < 0) {
		++this.size;
		data.push([key, value]);
	} else data[index][1] = value;
	return this;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_ListCache.js
/**
* Creates an list cache object.
*
* @private
* @constructor
* @param {Array} [entries] The key-value pairs to cache.
*/
function ListCache(entries) {
	var index = -1, length = entries == null ? 0 : entries.length;
	this.clear();
	while (++index < length) {
		var entry = entries[index];
		this.set(entry[0], entry[1]);
	}
}
ListCache.prototype.clear = listCacheClear;
ListCache.prototype["delete"] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_stackClear.js
/**
* Removes all key-value entries from the stack.
*
* @private
* @name clear
* @memberOf Stack
*/
function stackClear() {
	this.__data__ = new ListCache();
	this.size = 0;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_stackDelete.js
/**
* Removes `key` and its value from the stack.
*
* @private
* @name delete
* @memberOf Stack
* @param {string} key The key of the value to remove.
* @returns {boolean} Returns `true` if the entry was removed, else `false`.
*/
function stackDelete(key) {
	var data = this.__data__, result = data["delete"](key);
	this.size = data.size;
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_stackGet.js
/**
* Gets the stack value for `key`.
*
* @private
* @name get
* @memberOf Stack
* @param {string} key The key of the value to get.
* @returns {*} Returns the entry value.
*/
function stackGet(key) {
	return this.__data__.get(key);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_stackHas.js
/**
* Checks if a stack value for `key` exists.
*
* @private
* @name has
* @memberOf Stack
* @param {string} key The key of the entry to check.
* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
*/
function stackHas(key) {
	return this.__data__.has(key);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_freeGlobal.js
/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_root.js
/** Detect free variable `self`. */
var freeSelf = typeof self == "object" && self && self.Object === Object && self;
/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function("return this")();
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_Symbol.js
/** Built-in value references. */
var Symbol$1 = root.Symbol;
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_getRawTag.js
/** Used for built-in method references. */
var objectProto$4 = Object.prototype;
/** Used to check objects for own properties. */
var hasOwnProperty$11 = objectProto$4.hasOwnProperty;
/**
* Used to resolve the
* [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
* of values.
*/
var nativeObjectToString$1 = objectProto$4.toString;
/** Built-in value references. */
var symToStringTag$1 = Symbol$1 ? Symbol$1.toStringTag : void 0;
/**
* A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
*
* @private
* @param {*} value The value to query.
* @returns {string} Returns the raw `toStringTag`.
*/
function getRawTag(value) {
	var isOwn = hasOwnProperty$11.call(value, symToStringTag$1), tag = value[symToStringTag$1];
	try {
		value[symToStringTag$1] = void 0;
		var unmasked = true;
	} catch (e) {}
	var result = nativeObjectToString$1.call(value);
	if (unmasked) if (isOwn) value[symToStringTag$1] = tag;
	else delete value[symToStringTag$1];
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_objectToString.js
/**
* Used to resolve the
* [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
* of values.
*/
var nativeObjectToString = Object.prototype.toString;
/**
* Converts `value` to a string using `Object.prototype.toString`.
*
* @private
* @param {*} value The value to convert.
* @returns {string} Returns the converted string.
*/
function objectToString(value) {
	return nativeObjectToString.call(value);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseGetTag.js
/** `Object#toString` result references. */
var nullTag = "[object Null]", undefinedTag = "[object Undefined]";
/** Built-in value references. */
var symToStringTag = Symbol$1 ? Symbol$1.toStringTag : void 0;
/**
* The base implementation of `getTag` without fallbacks for buggy environments.
*
* @private
* @param {*} value The value to query.
* @returns {string} Returns the `toStringTag`.
*/
function baseGetTag(value) {
	if (value == null) return value === void 0 ? undefinedTag : nullTag;
	return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/isObject.js
/**
* Checks if `value` is the
* [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
* of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
*
* @static
* @memberOf _
* @since 0.1.0
* @category Lang
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is an object, else `false`.
* @example
*
* _.isObject({});
* // => true
*
* _.isObject([1, 2, 3]);
* // => true
*
* _.isObject(_.noop);
* // => true
*
* _.isObject(null);
* // => false
*/
function isObject(value) {
	var type = typeof value;
	return value != null && (type == "object" || type == "function");
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/isFunction.js
/** `Object#toString` result references. */
var asyncTag = "[object AsyncFunction]", funcTag$1 = "[object Function]", genTag = "[object GeneratorFunction]", proxyTag = "[object Proxy]";
/**
* Checks if `value` is classified as a `Function` object.
*
* @static
* @memberOf _
* @since 0.1.0
* @category Lang
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is a function, else `false`.
* @example
*
* _.isFunction(_);
* // => true
*
* _.isFunction(/abc/);
* // => false
*/
function isFunction(value) {
	if (!isObject(value)) return false;
	var tag = baseGetTag(value);
	return tag == funcTag$1 || tag == genTag || tag == asyncTag || tag == proxyTag;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_coreJsData.js
/** Used to detect overreaching core-js shims. */
var coreJsData = root["__core-js_shared__"];
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_isMasked.js
/** Used to detect methods masquerading as native. */
var maskSrcKey = function() {
	var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
	return uid ? "Symbol(src)_1." + uid : "";
}();
/**
* Checks if `func` has its source masked.
*
* @private
* @param {Function} func The function to check.
* @returns {boolean} Returns `true` if `func` is masked, else `false`.
*/
function isMasked(func) {
	return !!maskSrcKey && maskSrcKey in func;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_toSource.js
/** Used to resolve the decompiled source of functions. */
var funcToString$2 = Function.prototype.toString;
/**
* Converts `func` to its source code.
*
* @private
* @param {Function} func The function to convert.
* @returns {string} Returns the source code.
*/
function toSource(func) {
	if (func != null) {
		try {
			return funcToString$2.call(func);
		} catch (e) {}
		try {
			return func + "";
		} catch (e) {}
	}
	return "";
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseIsNative.js
/**
* Used to match `RegExp`
* [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
*/
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;
/** Used for built-in method references. */
var funcProto$1 = Function.prototype, objectProto$3 = Object.prototype;
/** Used to resolve the decompiled source of functions. */
var funcToString$1 = funcProto$1.toString;
/** Used to check objects for own properties. */
var hasOwnProperty$10 = objectProto$3.hasOwnProperty;
/** Used to detect if a method is native. */
var reIsNative = RegExp("^" + funcToString$1.call(hasOwnProperty$10).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$");
/**
* The base implementation of `_.isNative` without bad shim checks.
*
* @private
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is a native function,
*  else `false`.
*/
function baseIsNative(value) {
	if (!isObject(value) || isMasked(value)) return false;
	return (isFunction(value) ? reIsNative : reIsHostCtor).test(toSource(value));
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_getValue.js
/**
* Gets the value at `key` of `object`.
*
* @private
* @param {Object} [object] The object to query.
* @param {string} key The key of the property to get.
* @returns {*} Returns the property value.
*/
function getValue(object, key) {
	return object == null ? void 0 : object[key];
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_getNative.js
/**
* Gets the native function at `key` of `object`.
*
* @private
* @param {Object} object The object to query.
* @param {string} key The key of the method to get.
* @returns {*} Returns the function if it's native, else `undefined`.
*/
function getNative(object, key) {
	var value = getValue(object, key);
	return baseIsNative(value) ? value : void 0;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_Map.js
var Map = getNative(root, "Map");
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_nativeCreate.js
var nativeCreate = getNative(Object, "create");
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_hashClear.js
/**
* Removes all key-value entries from the hash.
*
* @private
* @name clear
* @memberOf Hash
*/
function hashClear() {
	this.__data__ = nativeCreate ? nativeCreate(null) : {};
	this.size = 0;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_hashDelete.js
/**
* Removes `key` and its value from the hash.
*
* @private
* @name delete
* @memberOf Hash
* @param {Object} hash The hash to modify.
* @param {string} key The key of the value to remove.
* @returns {boolean} Returns `true` if the entry was removed, else `false`.
*/
function hashDelete(key) {
	var result = this.has(key) && delete this.__data__[key];
	this.size -= result ? 1 : 0;
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_hashGet.js
/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED$2 = "__lodash_hash_undefined__";
/** Used to check objects for own properties. */
var hasOwnProperty$9 = Object.prototype.hasOwnProperty;
/**
* Gets the hash value for `key`.
*
* @private
* @name get
* @memberOf Hash
* @param {string} key The key of the value to get.
* @returns {*} Returns the entry value.
*/
function hashGet(key) {
	var data = this.__data__;
	if (nativeCreate) {
		var result = data[key];
		return result === HASH_UNDEFINED$2 ? void 0 : result;
	}
	return hasOwnProperty$9.call(data, key) ? data[key] : void 0;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_hashHas.js
/** Used to check objects for own properties. */
var hasOwnProperty$8 = Object.prototype.hasOwnProperty;
/**
* Checks if a hash value for `key` exists.
*
* @private
* @name has
* @memberOf Hash
* @param {string} key The key of the entry to check.
* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
*/
function hashHas(key) {
	var data = this.__data__;
	return nativeCreate ? data[key] !== void 0 : hasOwnProperty$8.call(data, key);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_hashSet.js
/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED$1 = "__lodash_hash_undefined__";
/**
* Sets the hash `key` to `value`.
*
* @private
* @name set
* @memberOf Hash
* @param {string} key The key of the value to set.
* @param {*} value The value to set.
* @returns {Object} Returns the hash instance.
*/
function hashSet(key, value) {
	var data = this.__data__;
	this.size += this.has(key) ? 0 : 1;
	data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED$1 : value;
	return this;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_Hash.js
/**
* Creates a hash object.
*
* @private
* @constructor
* @param {Array} [entries] The key-value pairs to cache.
*/
function Hash(entries) {
	var index = -1, length = entries == null ? 0 : entries.length;
	this.clear();
	while (++index < length) {
		var entry = entries[index];
		this.set(entry[0], entry[1]);
	}
}
Hash.prototype.clear = hashClear;
Hash.prototype["delete"] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_mapCacheClear.js
/**
* Removes all key-value entries from the map.
*
* @private
* @name clear
* @memberOf MapCache
*/
function mapCacheClear() {
	this.size = 0;
	this.__data__ = {
		"hash": new Hash(),
		"map": new (Map || ListCache)(),
		"string": new Hash()
	};
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_isKeyable.js
/**
* Checks if `value` is suitable for use as unique object key.
*
* @private
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is suitable, else `false`.
*/
function isKeyable(value) {
	var type = typeof value;
	return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_getMapData.js
/**
* Gets the data for `map`.
*
* @private
* @param {Object} map The map to query.
* @param {string} key The reference key.
* @returns {*} Returns the map data.
*/
function getMapData(map, key) {
	var data = map.__data__;
	return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_mapCacheDelete.js
/**
* Removes `key` and its value from the map.
*
* @private
* @name delete
* @memberOf MapCache
* @param {string} key The key of the value to remove.
* @returns {boolean} Returns `true` if the entry was removed, else `false`.
*/
function mapCacheDelete(key) {
	var result = getMapData(this, key)["delete"](key);
	this.size -= result ? 1 : 0;
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_mapCacheGet.js
/**
* Gets the map value for `key`.
*
* @private
* @name get
* @memberOf MapCache
* @param {string} key The key of the value to get.
* @returns {*} Returns the entry value.
*/
function mapCacheGet(key) {
	return getMapData(this, key).get(key);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_mapCacheHas.js
/**
* Checks if a map value for `key` exists.
*
* @private
* @name has
* @memberOf MapCache
* @param {string} key The key of the entry to check.
* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
*/
function mapCacheHas(key) {
	return getMapData(this, key).has(key);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_mapCacheSet.js
/**
* Sets the map `key` to `value`.
*
* @private
* @name set
* @memberOf MapCache
* @param {string} key The key of the value to set.
* @param {*} value The value to set.
* @returns {Object} Returns the map cache instance.
*/
function mapCacheSet(key, value) {
	var data = getMapData(this, key), size = data.size;
	data.set(key, value);
	this.size += data.size == size ? 0 : 1;
	return this;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_MapCache.js
/**
* Creates a map cache object to store key-value pairs.
*
* @private
* @constructor
* @param {Array} [entries] The key-value pairs to cache.
*/
function MapCache(entries) {
	var index = -1, length = entries == null ? 0 : entries.length;
	this.clear();
	while (++index < length) {
		var entry = entries[index];
		this.set(entry[0], entry[1]);
	}
}
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype["delete"] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_stackSet.js
/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;
/**
* Sets the stack `key` to `value`.
*
* @private
* @name set
* @memberOf Stack
* @param {string} key The key of the value to set.
* @param {*} value The value to set.
* @returns {Object} Returns the stack cache instance.
*/
function stackSet(key, value) {
	var data = this.__data__;
	if (data instanceof ListCache) {
		var pairs = data.__data__;
		if (!Map || pairs.length < LARGE_ARRAY_SIZE - 1) {
			pairs.push([key, value]);
			this.size = ++data.size;
			return this;
		}
		data = this.__data__ = new MapCache(pairs);
	}
	data.set(key, value);
	this.size = data.size;
	return this;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_Stack.js
/**
* Creates a stack cache object to store key-value pairs.
*
* @private
* @constructor
* @param {Array} [entries] The key-value pairs to cache.
*/
function Stack(entries) {
	this.size = (this.__data__ = new ListCache(entries)).size;
}
Stack.prototype.clear = stackClear;
Stack.prototype["delete"] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_defineProperty.js
var defineProperty = function() {
	try {
		var func = getNative(Object, "defineProperty");
		func({}, "", {});
		return func;
	} catch (e) {}
}();
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseAssignValue.js
/**
* The base implementation of `assignValue` and `assignMergeValue` without
* value checks.
*
* @private
* @param {Object} object The object to modify.
* @param {string} key The key of the property to assign.
* @param {*} value The value to assign.
*/
function baseAssignValue(object, key, value) {
	if (key == "__proto__" && defineProperty) defineProperty(object, key, {
		"configurable": true,
		"enumerable": true,
		"value": value,
		"writable": true
	});
	else object[key] = value;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_assignMergeValue.js
/**
* This function is like `assignValue` except that it doesn't assign
* `undefined` values.
*
* @private
* @param {Object} object The object to modify.
* @param {string} key The key of the property to assign.
* @param {*} value The value to assign.
*/
function assignMergeValue(object, key, value) {
	if (value !== void 0 && !eq(object[key], value) || value === void 0 && !(key in object)) baseAssignValue(object, key, value);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_createBaseFor.js
/**
* Creates a base function for methods like `_.forIn` and `_.forOwn`.
*
* @private
* @param {boolean} [fromRight] Specify iterating from right to left.
* @returns {Function} Returns the new base function.
*/
function createBaseFor(fromRight) {
	return function(object, iteratee, keysFunc) {
		var index = -1, iterable = Object(object), props = keysFunc(object), length = props.length;
		while (length--) {
			var key = props[fromRight ? length : ++index];
			if (iteratee(iterable[key], key, iterable) === false) break;
		}
		return object;
	};
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseFor.js
/**
* The base implementation of `baseForOwn` which iterates over `object`
* properties returned by `keysFunc` and invokes `iteratee` for each property.
* Iteratee functions may exit iteration early by explicitly returning `false`.
*
* @private
* @param {Object} object The object to iterate over.
* @param {Function} iteratee The function invoked per iteration.
* @param {Function} keysFunc The function to get the keys of `object`.
* @returns {Object} Returns `object`.
*/
var baseFor = createBaseFor();
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_cloneBuffer.js
/** Detect free variable `exports`. */
var freeExports$2 = typeof exports == "object" && exports && !exports.nodeType && exports;
/** Detect free variable `module`. */
var freeModule$2 = freeExports$2 && typeof module == "object" && module && !module.nodeType && module;
/** Built-in value references. */
var Buffer$1 = freeModule$2 && freeModule$2.exports === freeExports$2 ? root.Buffer : void 0, allocUnsafe = Buffer$1 ? Buffer$1.allocUnsafe : void 0;
/**
* Creates a clone of  `buffer`.
*
* @private
* @param {Buffer} buffer The buffer to clone.
* @param {boolean} [isDeep] Specify a deep clone.
* @returns {Buffer} Returns the cloned buffer.
*/
function cloneBuffer(buffer, isDeep) {
	if (isDeep) return buffer.slice();
	var length = buffer.length, result = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);
	buffer.copy(result);
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_Uint8Array.js
/** Built-in value references. */
var Uint8Array = root.Uint8Array;
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_cloneArrayBuffer.js
/**
* Creates a clone of `arrayBuffer`.
*
* @private
* @param {ArrayBuffer} arrayBuffer The array buffer to clone.
* @returns {ArrayBuffer} Returns the cloned array buffer.
*/
function cloneArrayBuffer(arrayBuffer) {
	var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
	new Uint8Array(result).set(new Uint8Array(arrayBuffer));
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_cloneTypedArray.js
/**
* Creates a clone of `typedArray`.
*
* @private
* @param {Object} typedArray The typed array to clone.
* @param {boolean} [isDeep] Specify a deep clone.
* @returns {Object} Returns the cloned typed array.
*/
function cloneTypedArray(typedArray, isDeep) {
	var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
	return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_copyArray.js
/**
* Copies the values of `source` to `array`.
*
* @private
* @param {Array} source The array to copy values from.
* @param {Array} [array=[]] The array to copy values to.
* @returns {Array} Returns `array`.
*/
function copyArray(source, array) {
	var index = -1, length = source.length;
	array || (array = Array(length));
	while (++index < length) array[index] = source[index];
	return array;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseCreate.js
/** Built-in value references. */
var objectCreate = Object.create;
/**
* The base implementation of `_.create` without support for assigning
* properties to the created object.
*
* @private
* @param {Object} proto The object to inherit from.
* @returns {Object} Returns the new object.
*/
var baseCreate = function() {
	function object() {}
	return function(proto) {
		if (!isObject(proto)) return {};
		if (objectCreate) return objectCreate(proto);
		object.prototype = proto;
		var result = new object();
		object.prototype = void 0;
		return result;
	};
}();
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_overArg.js
/**
* Creates a unary function that invokes `func` with its argument transformed.
*
* @private
* @param {Function} func The function to wrap.
* @param {Function} transform The argument transform.
* @returns {Function} Returns the new function.
*/
function overArg(func, transform) {
	return function(arg) {
		return func(transform(arg));
	};
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_getPrototype.js
/** Built-in value references. */
var getPrototype = overArg(Object.getPrototypeOf, Object);
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_isPrototype.js
/** Used for built-in method references. */
var objectProto$2 = Object.prototype;
/**
* Checks if `value` is likely a prototype object.
*
* @private
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
*/
function isPrototype(value) {
	var Ctor = value && value.constructor;
	return value === (typeof Ctor == "function" && Ctor.prototype || objectProto$2);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_initCloneObject.js
/**
* Initializes an object clone.
*
* @private
* @param {Object} object The object to clone.
* @returns {Object} Returns the initialized clone.
*/
function initCloneObject(object) {
	return typeof object.constructor == "function" && !isPrototype(object) ? baseCreate(getPrototype(object)) : {};
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/isObjectLike.js
/**
* Checks if `value` is object-like. A value is object-like if it's not `null`
* and has a `typeof` result of "object".
*
* @static
* @memberOf _
* @since 4.0.0
* @category Lang
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is object-like, else `false`.
* @example
*
* _.isObjectLike({});
* // => true
*
* _.isObjectLike([1, 2, 3]);
* // => true
*
* _.isObjectLike(_.noop);
* // => false
*
* _.isObjectLike(null);
* // => false
*/
function isObjectLike(value) {
	return value != null && typeof value == "object";
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseIsArguments.js
/** `Object#toString` result references. */
var argsTag$2 = "[object Arguments]";
/**
* The base implementation of `_.isArguments`.
*
* @private
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is an `arguments` object,
*/
function baseIsArguments(value) {
	return isObjectLike(value) && baseGetTag(value) == argsTag$2;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/isArguments.js
/** Used for built-in method references. */
var objectProto$1 = Object.prototype;
/** Used to check objects for own properties. */
var hasOwnProperty$7 = objectProto$1.hasOwnProperty;
/** Built-in value references. */
var propertyIsEnumerable$1 = objectProto$1.propertyIsEnumerable;
/**
* Checks if `value` is likely an `arguments` object.
*
* @static
* @memberOf _
* @since 0.1.0
* @category Lang
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is an `arguments` object,
*  else `false`.
* @example
*
* _.isArguments(function() { return arguments; }());
* // => true
*
* _.isArguments([1, 2, 3]);
* // => false
*/
var isArguments = baseIsArguments(function() {
	return arguments;
}()) ? baseIsArguments : function(value) {
	return isObjectLike(value) && hasOwnProperty$7.call(value, "callee") && !propertyIsEnumerable$1.call(value, "callee");
};
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/isArray.js
/**
* Checks if `value` is classified as an `Array` object.
*
* @static
* @memberOf _
* @since 0.1.0
* @category Lang
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is an array, else `false`.
* @example
*
* _.isArray([1, 2, 3]);
* // => true
*
* _.isArray(document.body.children);
* // => false
*
* _.isArray('abc');
* // => false
*
* _.isArray(_.noop);
* // => false
*/
var isArray = Array.isArray;
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/isLength.js
/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER$1 = 9007199254740991;
/**
* Checks if `value` is a valid array-like length.
*
* **Note:** This method is loosely based on
* [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
*
* @static
* @memberOf _
* @since 4.0.0
* @category Lang
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
* @example
*
* _.isLength(3);
* // => true
*
* _.isLength(Number.MIN_VALUE);
* // => false
*
* _.isLength(Infinity);
* // => false
*
* _.isLength('3');
* // => false
*/
function isLength(value) {
	return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER$1;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/isArrayLike.js
/**
* Checks if `value` is array-like. A value is considered array-like if it's
* not a function and has a `value.length` that's an integer greater than or
* equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
*
* @static
* @memberOf _
* @since 4.0.0
* @category Lang
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is array-like, else `false`.
* @example
*
* _.isArrayLike([1, 2, 3]);
* // => true
*
* _.isArrayLike(document.body.children);
* // => true
*
* _.isArrayLike('abc');
* // => true
*
* _.isArrayLike(_.noop);
* // => false
*/
function isArrayLike(value) {
	return value != null && isLength(value.length) && !isFunction(value);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/isArrayLikeObject.js
/**
* This method is like `_.isArrayLike` except that it also checks if `value`
* is an object.
*
* @static
* @memberOf _
* @since 4.0.0
* @category Lang
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is an array-like object,
*  else `false`.
* @example
*
* _.isArrayLikeObject([1, 2, 3]);
* // => true
*
* _.isArrayLikeObject(document.body.children);
* // => true
*
* _.isArrayLikeObject('abc');
* // => false
*
* _.isArrayLikeObject(_.noop);
* // => false
*/
function isArrayLikeObject(value) {
	return isObjectLike(value) && isArrayLike(value);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/stubFalse.js
/**
* This method returns `false`.
*
* @static
* @memberOf _
* @since 4.13.0
* @category Util
* @returns {boolean} Returns `false`.
* @example
*
* _.times(2, _.stubFalse);
* // => [false, false]
*/
function stubFalse() {
	return false;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/isBuffer.js
/** Detect free variable `exports`. */
var freeExports$1 = typeof exports == "object" && exports && !exports.nodeType && exports;
/** Detect free variable `module`. */
var freeModule$1 = freeExports$1 && typeof module == "object" && module && !module.nodeType && module;
/** Built-in value references. */
var Buffer = freeModule$1 && freeModule$1.exports === freeExports$1 ? root.Buffer : void 0;
/**
* Checks if `value` is a buffer.
*
* @static
* @memberOf _
* @since 4.3.0
* @category Lang
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
* @example
*
* _.isBuffer(new Buffer(2));
* // => true
*
* _.isBuffer(new Uint8Array(2));
* // => false
*/
var isBuffer = (Buffer ? Buffer.isBuffer : void 0) || stubFalse;
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/isPlainObject.js
/** `Object#toString` result references. */
var objectTag$3 = "[object Object]";
/** Used for built-in method references. */
var funcProto = Function.prototype, objectProto = Object.prototype;
/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;
/** Used to check objects for own properties. */
var hasOwnProperty$6 = objectProto.hasOwnProperty;
/** Used to infer the `Object` constructor. */
var objectCtorString = funcToString.call(Object);
/**
* Checks if `value` is a plain object, that is, an object created by the
* `Object` constructor or one with a `[[Prototype]]` of `null`.
*
* @static
* @memberOf _
* @since 0.8.0
* @category Lang
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
* @example
*
* function Foo() {
*   this.a = 1;
* }
*
* _.isPlainObject(new Foo);
* // => false
*
* _.isPlainObject([1, 2, 3]);
* // => false
*
* _.isPlainObject({ 'x': 0, 'y': 0 });
* // => true
*
* _.isPlainObject(Object.create(null));
* // => true
*/
function isPlainObject(value) {
	if (!isObjectLike(value) || baseGetTag(value) != objectTag$3) return false;
	var proto = getPrototype(value);
	if (proto === null) return true;
	var Ctor = hasOwnProperty$6.call(proto, "constructor") && proto.constructor;
	return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseIsTypedArray.js
/** `Object#toString` result references. */
var argsTag$1 = "[object Arguments]", arrayTag$1 = "[object Array]", boolTag$1 = "[object Boolean]", dateTag$1 = "[object Date]", errorTag$1 = "[object Error]", funcTag = "[object Function]", mapTag$2 = "[object Map]", numberTag$1 = "[object Number]", objectTag$2 = "[object Object]", regexpTag$1 = "[object RegExp]", setTag$2 = "[object Set]", stringTag$1 = "[object String]", weakMapTag$1 = "[object WeakMap]";
var arrayBufferTag$1 = "[object ArrayBuffer]", dataViewTag$2 = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag$1] = typedArrayTags[arrayTag$1] = typedArrayTags[arrayBufferTag$1] = typedArrayTags[boolTag$1] = typedArrayTags[dataViewTag$2] = typedArrayTags[dateTag$1] = typedArrayTags[errorTag$1] = typedArrayTags[funcTag] = typedArrayTags[mapTag$2] = typedArrayTags[numberTag$1] = typedArrayTags[objectTag$2] = typedArrayTags[regexpTag$1] = typedArrayTags[setTag$2] = typedArrayTags[stringTag$1] = typedArrayTags[weakMapTag$1] = false;
/**
* The base implementation of `_.isTypedArray` without Node.js optimizations.
*
* @private
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
*/
function baseIsTypedArray(value) {
	return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseUnary.js
/**
* The base implementation of `_.unary` without support for storing metadata.
*
* @private
* @param {Function} func The function to cap arguments for.
* @returns {Function} Returns the new capped function.
*/
function baseUnary(func) {
	return function(value) {
		return func(value);
	};
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_nodeUtil.js
/** Detect free variable `exports`. */
var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
/** Detect free variable `process` from Node.js. */
var freeProcess = freeModule && freeModule.exports === freeExports && freeGlobal.process;
/** Used to access faster Node.js helpers. */
var nodeUtil = function() {
	try {
		var types = freeModule && freeModule.require && freeModule.require("util").types;
		if (types) return types;
		return freeProcess && freeProcess.binding && freeProcess.binding("util");
	} catch (e) {}
}();
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/isTypedArray.js
var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
/**
* Checks if `value` is classified as a typed array.
*
* @static
* @memberOf _
* @since 3.0.0
* @category Lang
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
* @example
*
* _.isTypedArray(new Uint8Array);
* // => true
*
* _.isTypedArray([]);
* // => false
*/
var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_safeGet.js
/**
* Gets the value at `key`, unless `key` is "__proto__" or "constructor".
*
* @private
* @param {Object} object The object to query.
* @param {string} key The key of the property to get.
* @returns {*} Returns the property value.
*/
function safeGet(object, key) {
	if (key === "constructor" && typeof object[key] === "function") return;
	if (key == "__proto__") return;
	return object[key];
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_assignValue.js
/** Used to check objects for own properties. */
var hasOwnProperty$5 = Object.prototype.hasOwnProperty;
/**
* Assigns `value` to `key` of `object` if the existing value is not equivalent
* using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
* for equality comparisons.
*
* @private
* @param {Object} object The object to modify.
* @param {string} key The key of the property to assign.
* @param {*} value The value to assign.
*/
function assignValue(object, key, value) {
	var objValue = object[key];
	if (!(hasOwnProperty$5.call(object, key) && eq(objValue, value)) || value === void 0 && !(key in object)) baseAssignValue(object, key, value);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_copyObject.js
/**
* Copies properties of `source` to `object`.
*
* @private
* @param {Object} source The object to copy properties from.
* @param {Array} props The property identifiers to copy.
* @param {Object} [object={}] The object to copy properties to.
* @param {Function} [customizer] The function to customize copied values.
* @returns {Object} Returns `object`.
*/
function copyObject(source, props, object, customizer) {
	var isNew = !object;
	object || (object = {});
	var index = -1, length = props.length;
	while (++index < length) {
		var key = props[index];
		var newValue = customizer ? customizer(object[key], source[key], key, object, source) : void 0;
		if (newValue === void 0) newValue = source[key];
		if (isNew) baseAssignValue(object, key, newValue);
		else assignValue(object, key, newValue);
	}
	return object;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseTimes.js
/**
* The base implementation of `_.times` without support for iteratee shorthands
* or max array length checks.
*
* @private
* @param {number} n The number of times to invoke `iteratee`.
* @param {Function} iteratee The function invoked per iteration.
* @returns {Array} Returns the array of results.
*/
function baseTimes(n, iteratee) {
	var index = -1, result = Array(n);
	while (++index < n) result[index] = iteratee(index);
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_isIndex.js
/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;
/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;
/**
* Checks if `value` is a valid array-like index.
*
* @private
* @param {*} value The value to check.
* @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
* @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
*/
function isIndex(value, length) {
	var type = typeof value;
	length = length == null ? MAX_SAFE_INTEGER : length;
	return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && value > -1 && value % 1 == 0 && value < length;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_arrayLikeKeys.js
/** Used to check objects for own properties. */
var hasOwnProperty$4 = Object.prototype.hasOwnProperty;
/**
* Creates an array of the enumerable property names of the array-like `value`.
*
* @private
* @param {*} value The value to query.
* @param {boolean} inherited Specify returning inherited property names.
* @returns {Array} Returns the array of property names.
*/
function arrayLikeKeys(value, inherited) {
	var isArr = isArray(value), isArg = !isArr && isArguments(value), isBuff = !isArr && !isArg && isBuffer(value), isType = !isArr && !isArg && !isBuff && isTypedArray(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes(value.length, String) : [], length = result.length;
	for (var key in value) if ((inherited || hasOwnProperty$4.call(value, key)) && !(skipIndexes && (key == "length" || isBuff && (key == "offset" || key == "parent") || isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || isIndex(key, length)))) result.push(key);
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_nativeKeysIn.js
/**
* This function is like
* [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
* except that it includes inherited enumerable properties.
*
* @private
* @param {Object} object The object to query.
* @returns {Array} Returns the array of property names.
*/
function nativeKeysIn(object) {
	var result = [];
	if (object != null) for (var key in Object(object)) result.push(key);
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseKeysIn.js
/** Used to check objects for own properties. */
var hasOwnProperty$3 = Object.prototype.hasOwnProperty;
/**
* The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
*
* @private
* @param {Object} object The object to query.
* @returns {Array} Returns the array of property names.
*/
function baseKeysIn(object) {
	if (!isObject(object)) return nativeKeysIn(object);
	var isProto = isPrototype(object), result = [];
	for (var key in object) if (!(key == "constructor" && (isProto || !hasOwnProperty$3.call(object, key)))) result.push(key);
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/keysIn.js
/**
* Creates an array of the own and inherited enumerable property names of `object`.
*
* **Note:** Non-object values are coerced to objects.
*
* @static
* @memberOf _
* @since 3.0.0
* @category Object
* @param {Object} object The object to query.
* @returns {Array} Returns the array of property names.
* @example
*
* function Foo() {
*   this.a = 1;
*   this.b = 2;
* }
*
* Foo.prototype.c = 3;
*
* _.keysIn(new Foo);
* // => ['a', 'b', 'c'] (iteration order is not guaranteed)
*/
function keysIn(object) {
	return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/toPlainObject.js
/**
* Converts `value` to a plain object flattening inherited enumerable string
* keyed properties of `value` to own properties of the plain object.
*
* @static
* @memberOf _
* @since 3.0.0
* @category Lang
* @param {*} value The value to convert.
* @returns {Object} Returns the converted plain object.
* @example
*
* function Foo() {
*   this.b = 2;
* }
*
* Foo.prototype.c = 3;
*
* _.assign({ 'a': 1 }, new Foo);
* // => { 'a': 1, 'b': 2 }
*
* _.assign({ 'a': 1 }, _.toPlainObject(new Foo));
* // => { 'a': 1, 'b': 2, 'c': 3 }
*/
function toPlainObject(value) {
	return copyObject(value, keysIn(value));
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseMergeDeep.js
/**
* A specialized version of `baseMerge` for arrays and objects which performs
* deep merges and tracks traversed objects enabling objects with circular
* references to be merged.
*
* @private
* @param {Object} object The destination object.
* @param {Object} source The source object.
* @param {string} key The key of the value to merge.
* @param {number} srcIndex The index of `source`.
* @param {Function} mergeFunc The function to merge values.
* @param {Function} [customizer] The function to customize assigned values.
* @param {Object} [stack] Tracks traversed source values and their merged
*  counterparts.
*/
function baseMergeDeep(object, source, key, srcIndex, mergeFunc, customizer, stack) {
	var objValue = safeGet(object, key), srcValue = safeGet(source, key), stacked = stack.get(srcValue);
	if (stacked) {
		assignMergeValue(object, key, stacked);
		return;
	}
	var newValue = customizer ? customizer(objValue, srcValue, key + "", object, source, stack) : void 0;
	var isCommon = newValue === void 0;
	if (isCommon) {
		var isArr = isArray(srcValue), isBuff = !isArr && isBuffer(srcValue), isTyped = !isArr && !isBuff && isTypedArray(srcValue);
		newValue = srcValue;
		if (isArr || isBuff || isTyped) if (isArray(objValue)) newValue = objValue;
		else if (isArrayLikeObject(objValue)) newValue = copyArray(objValue);
		else if (isBuff) {
			isCommon = false;
			newValue = cloneBuffer(srcValue, true);
		} else if (isTyped) {
			isCommon = false;
			newValue = cloneTypedArray(srcValue, true);
		} else newValue = [];
		else if (isPlainObject(srcValue) || isArguments(srcValue)) {
			newValue = objValue;
			if (isArguments(objValue)) newValue = toPlainObject(objValue);
			else if (!isObject(objValue) || isFunction(objValue)) newValue = initCloneObject(srcValue);
		} else isCommon = false;
	}
	if (isCommon) {
		stack.set(srcValue, newValue);
		mergeFunc(newValue, srcValue, srcIndex, customizer, stack);
		stack["delete"](srcValue);
	}
	assignMergeValue(object, key, newValue);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseMerge.js
/**
* The base implementation of `_.merge` without support for multiple sources.
*
* @private
* @param {Object} object The destination object.
* @param {Object} source The source object.
* @param {number} srcIndex The index of `source`.
* @param {Function} [customizer] The function to customize merged values.
* @param {Object} [stack] Tracks traversed source values and their merged
*  counterparts.
*/
function baseMerge(object, source, srcIndex, customizer, stack) {
	if (object === source) return;
	baseFor(source, function(srcValue, key) {
		stack || (stack = new Stack());
		if (isObject(srcValue)) baseMergeDeep(object, source, key, srcIndex, baseMerge, customizer, stack);
		else {
			var newValue = customizer ? customizer(safeGet(object, key), srcValue, key + "", object, source, stack) : void 0;
			if (newValue === void 0) newValue = srcValue;
			assignMergeValue(object, key, newValue);
		}
	}, keysIn);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/identity.js
/**
* This method returns the first argument it receives.
*
* @static
* @since 0.1.0
* @memberOf _
* @category Util
* @param {*} value Any value.
* @returns {*} Returns `value`.
* @example
*
* var object = { 'a': 1 };
*
* console.log(_.identity(object) === object);
* // => true
*/
function identity(value) {
	return value;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_apply.js
/**
* A faster alternative to `Function#apply`, this function invokes `func`
* with the `this` binding of `thisArg` and the arguments of `args`.
*
* @private
* @param {Function} func The function to invoke.
* @param {*} thisArg The `this` binding of `func`.
* @param {Array} args The arguments to invoke `func` with.
* @returns {*} Returns the result of `func`.
*/
function apply(func, thisArg, args) {
	switch (args.length) {
		case 0: return func.call(thisArg);
		case 1: return func.call(thisArg, args[0]);
		case 2: return func.call(thisArg, args[0], args[1]);
		case 3: return func.call(thisArg, args[0], args[1], args[2]);
	}
	return func.apply(thisArg, args);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_overRest.js
var nativeMax$1 = Math.max;
/**
* A specialized version of `baseRest` which transforms the rest array.
*
* @private
* @param {Function} func The function to apply a rest parameter to.
* @param {number} [start=func.length-1] The start position of the rest parameter.
* @param {Function} transform The rest array transform.
* @returns {Function} Returns the new function.
*/
function overRest(func, start, transform) {
	start = nativeMax$1(start === void 0 ? func.length - 1 : start, 0);
	return function() {
		var args = arguments, index = -1, length = nativeMax$1(args.length - start, 0), array = Array(length);
		while (++index < length) array[index] = args[start + index];
		index = -1;
		var otherArgs = Array(start + 1);
		while (++index < start) otherArgs[index] = args[index];
		otherArgs[start] = transform(array);
		return apply(func, this, otherArgs);
	};
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/constant.js
/**
* Creates a function that returns `value`.
*
* @static
* @memberOf _
* @since 2.4.0
* @category Util
* @param {*} value The value to return from the new function.
* @returns {Function} Returns the new constant function.
* @example
*
* var objects = _.times(2, _.constant({ 'a': 1 }));
*
* console.log(objects);
* // => [{ 'a': 1 }, { 'a': 1 }]
*
* console.log(objects[0] === objects[1]);
* // => true
*/
function constant(value) {
	return function() {
		return value;
	};
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseSetToString.js
/**
* The base implementation of `setToString` without support for hot loop shorting.
*
* @private
* @param {Function} func The function to modify.
* @param {Function} string The `toString` result.
* @returns {Function} Returns `func`.
*/
var baseSetToString = !defineProperty ? identity : function(func, string) {
	return defineProperty(func, "toString", {
		"configurable": true,
		"enumerable": false,
		"value": constant(string),
		"writable": true
	});
};
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_shortOut.js
/** Used to detect hot functions by number of calls within a span of milliseconds. */
var HOT_COUNT = 800, HOT_SPAN = 16;
var nativeNow = Date.now;
/**
* Creates a function that'll short out and invoke `identity` instead
* of `func` when it's called `HOT_COUNT` or more times in `HOT_SPAN`
* milliseconds.
*
* @private
* @param {Function} func The function to restrict.
* @returns {Function} Returns the new shortable function.
*/
function shortOut(func) {
	var count = 0, lastCalled = 0;
	return function() {
		var stamp = nativeNow(), remaining = HOT_SPAN - (stamp - lastCalled);
		lastCalled = stamp;
		if (remaining > 0) {
			if (++count >= HOT_COUNT) return arguments[0];
		} else count = 0;
		return func.apply(void 0, arguments);
	};
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_setToString.js
/**
* Sets the `toString` method of `func` to return `string`.
*
* @private
* @param {Function} func The function to modify.
* @param {Function} string The `toString` result.
* @returns {Function} Returns `func`.
*/
var setToString = shortOut(baseSetToString);
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseRest.js
/**
* The base implementation of `_.rest` which doesn't validate or coerce arguments.
*
* @private
* @param {Function} func The function to apply a rest parameter to.
* @param {number} [start=func.length-1] The start position of the rest parameter.
* @returns {Function} Returns the new function.
*/
function baseRest(func, start) {
	return setToString(overRest(func, start, identity), func + "");
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_isIterateeCall.js
/**
* Checks if the given arguments are from an iteratee call.
*
* @private
* @param {*} value The potential iteratee value argument.
* @param {*} index The potential iteratee index or key argument.
* @param {*} object The potential iteratee object argument.
* @returns {boolean} Returns `true` if the arguments are from an iteratee call,
*  else `false`.
*/
function isIterateeCall(value, index, object) {
	if (!isObject(object)) return false;
	var type = typeof index;
	if (type == "number" ? isArrayLike(object) && isIndex(index, object.length) : type == "string" && index in object) return eq(object[index], value);
	return false;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_createAssigner.js
/**
* Creates a function like `_.assign`.
*
* @private
* @param {Function} assigner The function to assign values.
* @returns {Function} Returns the new assigner function.
*/
function createAssigner(assigner) {
	return baseRest(function(object, sources) {
		var index = -1, length = sources.length, customizer = length > 1 ? sources[length - 1] : void 0, guard = length > 2 ? sources[2] : void 0;
		customizer = assigner.length > 3 && typeof customizer == "function" ? (length--, customizer) : void 0;
		if (guard && isIterateeCall(sources[0], sources[1], guard)) {
			customizer = length < 3 ? void 0 : customizer;
			length = 1;
		}
		object = Object(object);
		while (++index < length) {
			var source = sources[index];
			if (source) assigner(object, source, index, customizer);
		}
		return object;
	});
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/merge.js
/**
* This method is like `_.assign` except that it recursively merges own and
* inherited enumerable string keyed properties of source objects into the
* destination object. Source properties that resolve to `undefined` are
* skipped if a destination value exists. Array and plain object properties
* are merged recursively. Other objects and value types are overridden by
* assignment. Source objects are applied from left to right. Subsequent
* sources overwrite property assignments of previous sources.
*
* **Note:** This method mutates `object`.
*
* @static
* @memberOf _
* @since 0.5.0
* @category Object
* @param {Object} object The destination object.
* @param {...Object} [sources] The source objects.
* @returns {Object} Returns `object`.
* @example
*
* var object = {
*   'a': [{ 'b': 2 }, { 'd': 4 }]
* };
*
* var other = {
*   'a': [{ 'c': 3 }, { 'e': 5 }]
* };
*
* _.merge(object, other);
* // => { 'a': [{ 'b': 2, 'c': 3 }, { 'd': 4, 'e': 5 }] }
*/
var merge = createAssigner(function(object, source, srcIndex) {
	baseMerge(object, source, srcIndex);
});
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/common/Raised.js
var Raised = function Raised(_ref) {
	var zDepth = _ref.zDepth, radius = _ref.radius, background = _ref.background, children = _ref.children, _ref$styles = _ref.styles, passedStyles = _ref$styles === void 0 ? {} : _ref$styles;
	var styles = (0, import_lib.default)(merge({
		"default": {
			wrap: {
				position: "relative",
				display: "inline-block"
			},
			content: { position: "relative" },
			bg: {
				absolute: "0px 0px 0px 0px",
				boxShadow: "0 " + zDepth + "px " + zDepth * 4 + "px rgba(0,0,0,.24)",
				borderRadius: radius,
				background
			}
		},
		"zDepth-0": { bg: { boxShadow: "none" } },
		"zDepth-1": { bg: { boxShadow: "0 2px 10px rgba(0,0,0,.12), 0 2px 5px rgba(0,0,0,.16)" } },
		"zDepth-2": { bg: { boxShadow: "0 6px 20px rgba(0,0,0,.19), 0 8px 17px rgba(0,0,0,.2)" } },
		"zDepth-3": { bg: { boxShadow: "0 17px 50px rgba(0,0,0,.19), 0 12px 15px rgba(0,0,0,.24)" } },
		"zDepth-4": { bg: { boxShadow: "0 25px 55px rgba(0,0,0,.21), 0 16px 28px rgba(0,0,0,.22)" } },
		"zDepth-5": { bg: { boxShadow: "0 40px 77px rgba(0,0,0,.22), 0 27px 24px rgba(0,0,0,.2)" } },
		"square": { bg: { borderRadius: "0" } },
		"circle": { bg: { borderRadius: "50%" } }
	}, passedStyles), { "zDepth-1": zDepth === 1 });
	return import_react.createElement("div", { style: styles.wrap }, import_react.createElement("div", { style: styles.bg }), import_react.createElement("div", { style: styles.content }, children));
};
Raised.propTypes = {
	background: import_prop_types.default.string,
	zDepth: import_prop_types.default.oneOf([
		0,
		1,
		2,
		3,
		4,
		5
	]),
	radius: import_prop_types.default.number,
	styles: import_prop_types.default.object
};
Raised.defaultProps = {
	background: "#fff",
	zDepth: 1,
	radius: 2,
	styles: {}
};
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/now.js
/**
* Gets the timestamp of the number of milliseconds that have elapsed since
* the Unix epoch (1 January 1970 00:00:00 UTC).
*
* @static
* @memberOf _
* @since 2.4.0
* @category Date
* @returns {number} Returns the timestamp.
* @example
*
* _.defer(function(stamp) {
*   console.log(_.now() - stamp);
* }, _.now());
* // => Logs the number of milliseconds it took for the deferred invocation.
*/
var now = function() {
	return root.Date.now();
};
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_trimmedEndIndex.js
/** Used to match a single whitespace character. */
var reWhitespace = /\s/;
/**
* Used by `_.trim` and `_.trimEnd` to get the index of the last non-whitespace
* character of `string`.
*
* @private
* @param {string} string The string to inspect.
* @returns {number} Returns the index of the last non-whitespace character.
*/
function trimmedEndIndex(string) {
	var index = string.length;
	while (index-- && reWhitespace.test(string.charAt(index)));
	return index;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseTrim.js
/** Used to match leading whitespace. */
var reTrimStart = /^\s+/;
/**
* The base implementation of `_.trim`.
*
* @private
* @param {string} string The string to trim.
* @returns {string} Returns the trimmed string.
*/
function baseTrim(string) {
	return string ? string.slice(0, trimmedEndIndex(string) + 1).replace(reTrimStart, "") : string;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/isSymbol.js
/** `Object#toString` result references. */
var symbolTag$1 = "[object Symbol]";
/**
* Checks if `value` is classified as a `Symbol` primitive or object.
*
* @static
* @memberOf _
* @since 4.0.0
* @category Lang
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
* @example
*
* _.isSymbol(Symbol.iterator);
* // => true
*
* _.isSymbol('abc');
* // => false
*/
function isSymbol(value) {
	return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag$1;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/toNumber.js
/** Used as references for various `Number` constants. */
var NAN = NaN;
/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;
/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;
/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;
/**
* Converts `value` to a number.
*
* @static
* @memberOf _
* @since 4.0.0
* @category Lang
* @param {*} value The value to process.
* @returns {number} Returns the number.
* @example
*
* _.toNumber(3.2);
* // => 3.2
*
* _.toNumber(Number.MIN_VALUE);
* // => 5e-324
*
* _.toNumber(Infinity);
* // => Infinity
*
* _.toNumber('3.2');
* // => 3.2
*/
function toNumber(value) {
	if (typeof value == "number") return value;
	if (isSymbol(value)) return NAN;
	if (isObject(value)) {
		var other = typeof value.valueOf == "function" ? value.valueOf() : value;
		value = isObject(other) ? other + "" : other;
	}
	if (typeof value != "string") return value === 0 ? value : +value;
	value = baseTrim(value);
	var isBinary = reIsBinary.test(value);
	return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/debounce.js
/** Error message constants. */
var FUNC_ERROR_TEXT$2 = "Expected a function";
var nativeMax = Math.max, nativeMin = Math.min;
/**
* Creates a debounced function that delays invoking `func` until after `wait`
* milliseconds have elapsed since the last time the debounced function was
* invoked. The debounced function comes with a `cancel` method to cancel
* delayed `func` invocations and a `flush` method to immediately invoke them.
* Provide `options` to indicate whether `func` should be invoked on the
* leading and/or trailing edge of the `wait` timeout. The `func` is invoked
* with the last arguments provided to the debounced function. Subsequent
* calls to the debounced function return the result of the last `func`
* invocation.
*
* **Note:** If `leading` and `trailing` options are `true`, `func` is
* invoked on the trailing edge of the timeout only if the debounced function
* is invoked more than once during the `wait` timeout.
*
* If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
* until to the next tick, similar to `setTimeout` with a timeout of `0`.
*
* See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
* for details over the differences between `_.debounce` and `_.throttle`.
*
* @static
* @memberOf _
* @since 0.1.0
* @category Function
* @param {Function} func The function to debounce.
* @param {number} [wait=0] The number of milliseconds to delay.
* @param {Object} [options={}] The options object.
* @param {boolean} [options.leading=false]
*  Specify invoking on the leading edge of the timeout.
* @param {number} [options.maxWait]
*  The maximum time `func` is allowed to be delayed before it's invoked.
* @param {boolean} [options.trailing=true]
*  Specify invoking on the trailing edge of the timeout.
* @returns {Function} Returns the new debounced function.
* @example
*
* // Avoid costly calculations while the window size is in flux.
* jQuery(window).on('resize', _.debounce(calculateLayout, 150));
*
* // Invoke `sendMail` when clicked, debouncing subsequent calls.
* jQuery(element).on('click', _.debounce(sendMail, 300, {
*   'leading': true,
*   'trailing': false
* }));
*
* // Ensure `batchLog` is invoked once after 1 second of debounced calls.
* var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
* var source = new EventSource('/stream');
* jQuery(source).on('message', debounced);
*
* // Cancel the trailing debounced invocation.
* jQuery(window).on('popstate', debounced.cancel);
*/
function debounce(func, wait, options) {
	var lastArgs, lastThis, maxWait, result, timerId, lastCallTime, lastInvokeTime = 0, leading = false, maxing = false, trailing = true;
	if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT$2);
	wait = toNumber(wait) || 0;
	if (isObject(options)) {
		leading = !!options.leading;
		maxing = "maxWait" in options;
		maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
		trailing = "trailing" in options ? !!options.trailing : trailing;
	}
	function invokeFunc(time) {
		var args = lastArgs, thisArg = lastThis;
		lastArgs = lastThis = void 0;
		lastInvokeTime = time;
		result = func.apply(thisArg, args);
		return result;
	}
	function leadingEdge(time) {
		lastInvokeTime = time;
		timerId = setTimeout(timerExpired, wait);
		return leading ? invokeFunc(time) : result;
	}
	function remainingWait(time) {
		var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime, timeWaiting = wait - timeSinceLastCall;
		return maxing ? nativeMin(timeWaiting, maxWait - timeSinceLastInvoke) : timeWaiting;
	}
	function shouldInvoke(time) {
		var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime;
		return lastCallTime === void 0 || timeSinceLastCall >= wait || timeSinceLastCall < 0 || maxing && timeSinceLastInvoke >= maxWait;
	}
	function timerExpired() {
		var time = now();
		if (shouldInvoke(time)) return trailingEdge(time);
		timerId = setTimeout(timerExpired, remainingWait(time));
	}
	function trailingEdge(time) {
		timerId = void 0;
		if (trailing && lastArgs) return invokeFunc(time);
		lastArgs = lastThis = void 0;
		return result;
	}
	function cancel() {
		if (timerId !== void 0) clearTimeout(timerId);
		lastInvokeTime = 0;
		lastArgs = lastCallTime = lastThis = timerId = void 0;
	}
	function flush() {
		return timerId === void 0 ? result : trailingEdge(now());
	}
	function debounced() {
		var time = now(), isInvoking = shouldInvoke(time);
		lastArgs = arguments;
		lastThis = this;
		lastCallTime = time;
		if (isInvoking) {
			if (timerId === void 0) return leadingEdge(lastCallTime);
			if (maxing) {
				clearTimeout(timerId);
				timerId = setTimeout(timerExpired, wait);
				return invokeFunc(lastCallTime);
			}
		}
		if (timerId === void 0) timerId = setTimeout(timerExpired, wait);
		return result;
	}
	debounced.cancel = cancel;
	debounced.flush = flush;
	return debounced;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/throttle.js
/** Error message constants. */
var FUNC_ERROR_TEXT$1 = "Expected a function";
/**
* Creates a throttled function that only invokes `func` at most once per
* every `wait` milliseconds. The throttled function comes with a `cancel`
* method to cancel delayed `func` invocations and a `flush` method to
* immediately invoke them. Provide `options` to indicate whether `func`
* should be invoked on the leading and/or trailing edge of the `wait`
* timeout. The `func` is invoked with the last arguments provided to the
* throttled function. Subsequent calls to the throttled function return the
* result of the last `func` invocation.
*
* **Note:** If `leading` and `trailing` options are `true`, `func` is
* invoked on the trailing edge of the timeout only if the throttled function
* is invoked more than once during the `wait` timeout.
*
* If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
* until to the next tick, similar to `setTimeout` with a timeout of `0`.
*
* See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
* for details over the differences between `_.throttle` and `_.debounce`.
*
* @static
* @memberOf _
* @since 0.1.0
* @category Function
* @param {Function} func The function to throttle.
* @param {number} [wait=0] The number of milliseconds to throttle invocations to.
* @param {Object} [options={}] The options object.
* @param {boolean} [options.leading=true]
*  Specify invoking on the leading edge of the timeout.
* @param {boolean} [options.trailing=true]
*  Specify invoking on the trailing edge of the timeout.
* @returns {Function} Returns the new throttled function.
* @example
*
* // Avoid excessively updating the position while scrolling.
* jQuery(window).on('scroll', _.throttle(updatePosition, 100));
*
* // Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
* var throttled = _.throttle(renewToken, 300000, { 'trailing': false });
* jQuery(element).on('click', throttled);
*
* // Cancel the trailing throttled invocation.
* jQuery(window).on('popstate', throttled.cancel);
*/
function throttle(func, wait, options) {
	var leading = true, trailing = true;
	if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT$1);
	if (isObject(options)) {
		leading = "leading" in options ? !!options.leading : leading;
		trailing = "trailing" in options ? !!options.trailing : trailing;
	}
	return debounce(func, wait, {
		"leading": leading,
		"maxWait": wait,
		"trailing": trailing
	});
}
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/helpers/saturation.js
var calculateChange = function calculateChange(e, hsl, container) {
	var _container$getBoundin = container.getBoundingClientRect(), containerWidth = _container$getBoundin.width, containerHeight = _container$getBoundin.height;
	var x = typeof e.pageX === "number" ? e.pageX : e.touches[0].pageX;
	var y = typeof e.pageY === "number" ? e.pageY : e.touches[0].pageY;
	var left = x - (container.getBoundingClientRect().left + window.pageXOffset);
	var top = y - (container.getBoundingClientRect().top + window.pageYOffset);
	if (left < 0) left = 0;
	else if (left > containerWidth) left = containerWidth;
	if (top < 0) top = 0;
	else if (top > containerHeight) top = containerHeight;
	var saturation = left / containerWidth;
	var bright = 1 - top / containerHeight;
	return {
		h: hsl.h,
		s: saturation,
		v: bright,
		a: hsl.a,
		source: "hsv"
	};
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/common/Saturation.js
var _createClass$4 = function() {
	function defineProperties(target, props) {
		for (var i = 0; i < props.length; i++) {
			var descriptor = props[i];
			descriptor.enumerable = descriptor.enumerable || false;
			descriptor.configurable = true;
			if ("value" in descriptor) descriptor.writable = true;
			Object.defineProperty(target, descriptor.key, descriptor);
		}
	}
	return function(Constructor, protoProps, staticProps) {
		if (protoProps) defineProperties(Constructor.prototype, protoProps);
		if (staticProps) defineProperties(Constructor, staticProps);
		return Constructor;
	};
}();
function _classCallCheck$4(instance, Constructor) {
	if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _possibleConstructorReturn$4(self, call) {
	if (!self) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return call && (typeof call === "object" || typeof call === "function") ? call : self;
}
function _inherits$4(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		enumerable: false,
		writable: true,
		configurable: true
	} });
	if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}
var Saturation = function(_ref) {
	_inherits$4(Saturation, _ref);
	function Saturation(props) {
		_classCallCheck$4(this, Saturation);
		var _this = _possibleConstructorReturn$4(this, (Saturation.__proto__ || Object.getPrototypeOf(Saturation)).call(this, props));
		_this.handleChange = function(e) {
			typeof _this.props.onChange === "function" && _this.throttle(_this.props.onChange, calculateChange(e, _this.props.hsl, _this.container), e);
		};
		_this.handleMouseDown = function(e) {
			_this.handleChange(e);
			var renderWindow = _this.getContainerRenderWindow();
			renderWindow.addEventListener("mousemove", _this.handleChange);
			renderWindow.addEventListener("mouseup", _this.handleMouseUp);
		};
		_this.handleMouseUp = function() {
			_this.unbindEventListeners();
		};
		_this.throttle = throttle(function(fn, data, e) {
			fn(data, e);
		}, 50);
		return _this;
	}
	_createClass$4(Saturation, [
		{
			key: "componentWillUnmount",
			value: function componentWillUnmount() {
				this.throttle.cancel();
				this.unbindEventListeners();
			}
		},
		{
			key: "getContainerRenderWindow",
			value: function getContainerRenderWindow() {
				var container = this.container;
				var renderWindow = window;
				while (!renderWindow.document.contains(container) && renderWindow.parent !== renderWindow) renderWindow = renderWindow.parent;
				return renderWindow;
			}
		},
		{
			key: "unbindEventListeners",
			value: function unbindEventListeners() {
				var renderWindow = this.getContainerRenderWindow();
				renderWindow.removeEventListener("mousemove", this.handleChange);
				renderWindow.removeEventListener("mouseup", this.handleMouseUp);
			}
		},
		{
			key: "render",
			value: function render() {
				var _this2 = this;
				var _ref2 = this.props.style || {}, color = _ref2.color, white = _ref2.white, black = _ref2.black, pointer = _ref2.pointer, circle = _ref2.circle;
				var styles = (0, import_lib.default)({
					"default": {
						color: {
							absolute: "0px 0px 0px 0px",
							background: "hsl(" + this.props.hsl.h + ",100%, 50%)",
							borderRadius: this.props.radius
						},
						white: {
							absolute: "0px 0px 0px 0px",
							borderRadius: this.props.radius
						},
						black: {
							absolute: "0px 0px 0px 0px",
							boxShadow: this.props.shadow,
							borderRadius: this.props.radius
						},
						pointer: {
							position: "absolute",
							top: -(this.props.hsv.v * 100) + 100 + "%",
							left: this.props.hsv.s * 100 + "%",
							cursor: "default"
						},
						circle: {
							width: "4px",
							height: "4px",
							boxShadow: "0 0 0 1.5px #fff, inset 0 0 1px 1px rgba(0,0,0,.3),\n            0 0 1px 2px rgba(0,0,0,.4)",
							borderRadius: "50%",
							cursor: "hand",
							transform: "translate(-2px, -2px)"
						}
					},
					"custom": {
						color,
						white,
						black,
						pointer,
						circle
					}
				}, { "custom": !!this.props.style });
				return import_react.createElement("div", {
					style: styles.color,
					ref: function ref(container) {
						return _this2.container = container;
					},
					onMouseDown: this.handleMouseDown,
					onTouchMove: this.handleChange,
					onTouchStart: this.handleChange
				}, import_react.createElement("style", null, "\n          .saturation-white {\n            background: -webkit-linear-gradient(to right, #fff, rgba(255,255,255,0));\n            background: linear-gradient(to right, #fff, rgba(255,255,255,0));\n          }\n          .saturation-black {\n            background: -webkit-linear-gradient(to top, #000, rgba(0,0,0,0));\n            background: linear-gradient(to top, #000, rgba(0,0,0,0));\n          }\n        "), import_react.createElement("div", {
					style: styles.white,
					className: "saturation-white"
				}, import_react.createElement("div", {
					style: styles.black,
					className: "saturation-black"
				}), import_react.createElement("div", { style: styles.pointer }, this.props.pointer ? import_react.createElement(this.props.pointer, this.props) : import_react.createElement("div", { style: styles.circle }))));
			}
		}
	]);
	return Saturation;
}(import_react.PureComponent || import_react.Component);
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_arrayEach.js
/**
* A specialized version of `_.forEach` for arrays without support for
* iteratee shorthands.
*
* @private
* @param {Array} [array] The array to iterate over.
* @param {Function} iteratee The function invoked per iteration.
* @returns {Array} Returns `array`.
*/
function arrayEach(array, iteratee) {
	var index = -1, length = array == null ? 0 : array.length;
	while (++index < length) if (iteratee(array[index], index, array) === false) break;
	return array;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_nativeKeys.js
var nativeKeys = overArg(Object.keys, Object);
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseKeys.js
/** Used to check objects for own properties. */
var hasOwnProperty$2 = Object.prototype.hasOwnProperty;
/**
* The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
*
* @private
* @param {Object} object The object to query.
* @returns {Array} Returns the array of property names.
*/
function baseKeys(object) {
	if (!isPrototype(object)) return nativeKeys(object);
	var result = [];
	for (var key in Object(object)) if (hasOwnProperty$2.call(object, key) && key != "constructor") result.push(key);
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/keys.js
/**
* Creates an array of the own enumerable property names of `object`.
*
* **Note:** Non-object values are coerced to objects. See the
* [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
* for more details.
*
* @static
* @since 0.1.0
* @memberOf _
* @category Object
* @param {Object} object The object to query.
* @returns {Array} Returns the array of property names.
* @example
*
* function Foo() {
*   this.a = 1;
*   this.b = 2;
* }
*
* Foo.prototype.c = 3;
*
* _.keys(new Foo);
* // => ['a', 'b'] (iteration order is not guaranteed)
*
* _.keys('hi');
* // => ['0', '1']
*/
function keys(object) {
	return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseForOwn.js
/**
* The base implementation of `_.forOwn` without support for iteratee shorthands.
*
* @private
* @param {Object} object The object to iterate over.
* @param {Function} iteratee The function invoked per iteration.
* @returns {Object} Returns `object`.
*/
function baseForOwn(object, iteratee) {
	return object && baseFor(object, iteratee, keys);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_createBaseEach.js
/**
* Creates a `baseEach` or `baseEachRight` function.
*
* @private
* @param {Function} eachFunc The function to iterate over a collection.
* @param {boolean} [fromRight] Specify iterating from right to left.
* @returns {Function} Returns the new base function.
*/
function createBaseEach(eachFunc, fromRight) {
	return function(collection, iteratee) {
		if (collection == null) return collection;
		if (!isArrayLike(collection)) return eachFunc(collection, iteratee);
		var length = collection.length, index = fromRight ? length : -1, iterable = Object(collection);
		while (fromRight ? index-- : ++index < length) if (iteratee(iterable[index], index, iterable) === false) break;
		return collection;
	};
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseEach.js
/**
* The base implementation of `_.forEach` without support for iteratee shorthands.
*
* @private
* @param {Array|Object} collection The collection to iterate over.
* @param {Function} iteratee The function invoked per iteration.
* @returns {Array|Object} Returns `collection`.
*/
var baseEach = createBaseEach(baseForOwn);
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_castFunction.js
/**
* Casts `value` to `identity` if it's not a function.
*
* @private
* @param {*} value The value to inspect.
* @returns {Function} Returns cast function.
*/
function castFunction(value) {
	return typeof value == "function" ? value : identity;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/forEach.js
/**
* Iterates over elements of `collection` and invokes `iteratee` for each element.
* The iteratee is invoked with three arguments: (value, index|key, collection).
* Iteratee functions may exit iteration early by explicitly returning `false`.
*
* **Note:** As with other "Collections" methods, objects with a "length"
* property are iterated like arrays. To avoid this behavior use `_.forIn`
* or `_.forOwn` for object iteration.
*
* @static
* @memberOf _
* @since 0.1.0
* @alias each
* @category Collection
* @param {Array|Object} collection The collection to iterate over.
* @param {Function} [iteratee=_.identity] The function invoked per iteration.
* @returns {Array|Object} Returns `collection`.
* @see _.forEachRight
* @example
*
* _.forEach([1, 2], function(value) {
*   console.log(value);
* });
* // => Logs `1` then `2`.
*
* _.forEach({ 'a': 1, 'b': 2 }, function(value, key) {
*   console.log(key);
* });
* // => Logs 'a' then 'b' (iteration order is not guaranteed).
*/
function forEach(collection, iteratee) {
	return (isArray(collection) ? arrayEach : baseEach)(collection, castFunction(iteratee));
}
//#endregion
//#region node_modules/.pnpm/tinycolor2@1.6.0/node_modules/tinycolor2/esm/tinycolor.js
function _typeof(obj) {
	"@babel/helpers - typeof";
	return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(obj) {
		return typeof obj;
	} : function(obj) {
		return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
	}, _typeof(obj);
}
var trimLeft = /^\s+/;
var trimRight = /\s+$/;
function tinycolor(color, opts) {
	color = color ? color : "";
	opts = opts || {};
	if (color instanceof tinycolor) return color;
	if (!(this instanceof tinycolor)) return new tinycolor(color, opts);
	var rgb = inputToRGB(color);
	this._originalInput = color, this._r = rgb.r, this._g = rgb.g, this._b = rgb.b, this._a = rgb.a, this._roundA = Math.round(100 * this._a) / 100, this._format = opts.format || rgb.format;
	this._gradientType = opts.gradientType;
	if (this._r < 1) this._r = Math.round(this._r);
	if (this._g < 1) this._g = Math.round(this._g);
	if (this._b < 1) this._b = Math.round(this._b);
	this._ok = rgb.ok;
}
tinycolor.prototype = {
	isDark: function isDark() {
		return this.getBrightness() < 128;
	},
	isLight: function isLight() {
		return !this.isDark();
	},
	isValid: function isValid() {
		return this._ok;
	},
	getOriginalInput: function getOriginalInput() {
		return this._originalInput;
	},
	getFormat: function getFormat() {
		return this._format;
	},
	getAlpha: function getAlpha() {
		return this._a;
	},
	getBrightness: function getBrightness() {
		var rgb = this.toRgb();
		return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1e3;
	},
	getLuminance: function getLuminance() {
		var rgb = this.toRgb();
		var RsRGB = rgb.r / 255, GsRGB = rgb.g / 255, BsRGB = rgb.b / 255, R, G, B;
		if (RsRGB <= .03928) R = RsRGB / 12.92;
		else R = Math.pow((RsRGB + .055) / 1.055, 2.4);
		if (GsRGB <= .03928) G = GsRGB / 12.92;
		else G = Math.pow((GsRGB + .055) / 1.055, 2.4);
		if (BsRGB <= .03928) B = BsRGB / 12.92;
		else B = Math.pow((BsRGB + .055) / 1.055, 2.4);
		return .2126 * R + .7152 * G + .0722 * B;
	},
	setAlpha: function setAlpha(value) {
		this._a = boundAlpha(value);
		this._roundA = Math.round(100 * this._a) / 100;
		return this;
	},
	toHsv: function toHsv() {
		var hsv = rgbToHsv(this._r, this._g, this._b);
		return {
			h: hsv.h * 360,
			s: hsv.s,
			v: hsv.v,
			a: this._a
		};
	},
	toHsvString: function toHsvString() {
		var hsv = rgbToHsv(this._r, this._g, this._b);
		var h = Math.round(hsv.h * 360), s = Math.round(hsv.s * 100), v = Math.round(hsv.v * 100);
		return this._a == 1 ? "hsv(" + h + ", " + s + "%, " + v + "%)" : "hsva(" + h + ", " + s + "%, " + v + "%, " + this._roundA + ")";
	},
	toHsl: function toHsl() {
		var hsl = rgbToHsl(this._r, this._g, this._b);
		return {
			h: hsl.h * 360,
			s: hsl.s,
			l: hsl.l,
			a: this._a
		};
	},
	toHslString: function toHslString() {
		var hsl = rgbToHsl(this._r, this._g, this._b);
		var h = Math.round(hsl.h * 360), s = Math.round(hsl.s * 100), l = Math.round(hsl.l * 100);
		return this._a == 1 ? "hsl(" + h + ", " + s + "%, " + l + "%)" : "hsla(" + h + ", " + s + "%, " + l + "%, " + this._roundA + ")";
	},
	toHex: function toHex(allow3Char) {
		return rgbToHex(this._r, this._g, this._b, allow3Char);
	},
	toHexString: function toHexString(allow3Char) {
		return "#" + this.toHex(allow3Char);
	},
	toHex8: function toHex8(allow4Char) {
		return rgbaToHex(this._r, this._g, this._b, this._a, allow4Char);
	},
	toHex8String: function toHex8String(allow4Char) {
		return "#" + this.toHex8(allow4Char);
	},
	toRgb: function toRgb() {
		return {
			r: Math.round(this._r),
			g: Math.round(this._g),
			b: Math.round(this._b),
			a: this._a
		};
	},
	toRgbString: function toRgbString() {
		return this._a == 1 ? "rgb(" + Math.round(this._r) + ", " + Math.round(this._g) + ", " + Math.round(this._b) + ")" : "rgba(" + Math.round(this._r) + ", " + Math.round(this._g) + ", " + Math.round(this._b) + ", " + this._roundA + ")";
	},
	toPercentageRgb: function toPercentageRgb() {
		return {
			r: Math.round(bound01(this._r, 255) * 100) + "%",
			g: Math.round(bound01(this._g, 255) * 100) + "%",
			b: Math.round(bound01(this._b, 255) * 100) + "%",
			a: this._a
		};
	},
	toPercentageRgbString: function toPercentageRgbString() {
		return this._a == 1 ? "rgb(" + Math.round(bound01(this._r, 255) * 100) + "%, " + Math.round(bound01(this._g, 255) * 100) + "%, " + Math.round(bound01(this._b, 255) * 100) + "%)" : "rgba(" + Math.round(bound01(this._r, 255) * 100) + "%, " + Math.round(bound01(this._g, 255) * 100) + "%, " + Math.round(bound01(this._b, 255) * 100) + "%, " + this._roundA + ")";
	},
	toName: function toName() {
		if (this._a === 0) return "transparent";
		if (this._a < 1) return false;
		return hexNames[rgbToHex(this._r, this._g, this._b, true)] || false;
	},
	toFilter: function toFilter(secondColor) {
		var hex8String = "#" + rgbaToArgbHex(this._r, this._g, this._b, this._a);
		var secondHex8String = hex8String;
		var gradientType = this._gradientType ? "GradientType = 1, " : "";
		if (secondColor) {
			var s = tinycolor(secondColor);
			secondHex8String = "#" + rgbaToArgbHex(s._r, s._g, s._b, s._a);
		}
		return "progid:DXImageTransform.Microsoft.gradient(" + gradientType + "startColorstr=" + hex8String + ",endColorstr=" + secondHex8String + ")";
	},
	toString: function toString(format) {
		var formatSet = !!format;
		format = format || this._format;
		var formattedString = false;
		var hasAlpha = this._a < 1 && this._a >= 0;
		if (!formatSet && hasAlpha && (format === "hex" || format === "hex6" || format === "hex3" || format === "hex4" || format === "hex8" || format === "name")) {
			if (format === "name" && this._a === 0) return this.toName();
			return this.toRgbString();
		}
		if (format === "rgb") formattedString = this.toRgbString();
		if (format === "prgb") formattedString = this.toPercentageRgbString();
		if (format === "hex" || format === "hex6") formattedString = this.toHexString();
		if (format === "hex3") formattedString = this.toHexString(true);
		if (format === "hex4") formattedString = this.toHex8String(true);
		if (format === "hex8") formattedString = this.toHex8String();
		if (format === "name") formattedString = this.toName();
		if (format === "hsl") formattedString = this.toHslString();
		if (format === "hsv") formattedString = this.toHsvString();
		return formattedString || this.toHexString();
	},
	clone: function clone() {
		return tinycolor(this.toString());
	},
	_applyModification: function _applyModification(fn, args) {
		var color = fn.apply(null, [this].concat([].slice.call(args)));
		this._r = color._r;
		this._g = color._g;
		this._b = color._b;
		this.setAlpha(color._a);
		return this;
	},
	lighten: function lighten() {
		return this._applyModification(_lighten, arguments);
	},
	brighten: function brighten() {
		return this._applyModification(_brighten, arguments);
	},
	darken: function darken() {
		return this._applyModification(_darken, arguments);
	},
	desaturate: function desaturate() {
		return this._applyModification(_desaturate, arguments);
	},
	saturate: function saturate() {
		return this._applyModification(_saturate, arguments);
	},
	greyscale: function greyscale() {
		return this._applyModification(_greyscale, arguments);
	},
	spin: function spin() {
		return this._applyModification(_spin, arguments);
	},
	_applyCombination: function _applyCombination(fn, args) {
		return fn.apply(null, [this].concat([].slice.call(args)));
	},
	analogous: function analogous() {
		return this._applyCombination(_analogous, arguments);
	},
	complement: function complement() {
		return this._applyCombination(_complement, arguments);
	},
	monochromatic: function monochromatic() {
		return this._applyCombination(_monochromatic, arguments);
	},
	splitcomplement: function splitcomplement() {
		return this._applyCombination(_splitcomplement, arguments);
	},
	triad: function triad() {
		return this._applyCombination(polyad, [3]);
	},
	tetrad: function tetrad() {
		return this._applyCombination(polyad, [4]);
	}
};
tinycolor.fromRatio = function(color, opts) {
	if (_typeof(color) == "object") {
		var newColor = {};
		for (var i in color) if (color.hasOwnProperty(i)) if (i === "a") newColor[i] = color[i];
		else newColor[i] = convertToPercentage(color[i]);
		color = newColor;
	}
	return tinycolor(color, opts);
};
function inputToRGB(color) {
	var rgb = {
		r: 0,
		g: 0,
		b: 0
	};
	var a = 1;
	var s = null;
	var v = null;
	var l = null;
	var ok = false;
	var format = false;
	if (typeof color == "string") color = stringInputToObject(color);
	if (_typeof(color) == "object") {
		if (isValidCSSUnit(color.r) && isValidCSSUnit(color.g) && isValidCSSUnit(color.b)) {
			rgb = rgbToRgb(color.r, color.g, color.b);
			ok = true;
			format = String(color.r).substr(-1) === "%" ? "prgb" : "rgb";
		} else if (isValidCSSUnit(color.h) && isValidCSSUnit(color.s) && isValidCSSUnit(color.v)) {
			s = convertToPercentage(color.s);
			v = convertToPercentage(color.v);
			rgb = hsvToRgb(color.h, s, v);
			ok = true;
			format = "hsv";
		} else if (isValidCSSUnit(color.h) && isValidCSSUnit(color.s) && isValidCSSUnit(color.l)) {
			s = convertToPercentage(color.s);
			l = convertToPercentage(color.l);
			rgb = hslToRgb(color.h, s, l);
			ok = true;
			format = "hsl";
		}
		if (color.hasOwnProperty("a")) a = color.a;
	}
	a = boundAlpha(a);
	return {
		ok,
		format: color.format || format,
		r: Math.min(255, Math.max(rgb.r, 0)),
		g: Math.min(255, Math.max(rgb.g, 0)),
		b: Math.min(255, Math.max(rgb.b, 0)),
		a
	};
}
function rgbToRgb(r, g, b) {
	return {
		r: bound01(r, 255) * 255,
		g: bound01(g, 255) * 255,
		b: bound01(b, 255) * 255
	};
}
function rgbToHsl(r, g, b) {
	r = bound01(r, 255);
	g = bound01(g, 255);
	b = bound01(b, 255);
	var max = Math.max(r, g, b), min = Math.min(r, g, b);
	var h, s, l = (max + min) / 2;
	if (max == min) h = s = 0;
	else {
		var d = max - min;
		s = l > .5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}
	return {
		h,
		s,
		l
	};
}
function hslToRgb(h, s, l) {
	var r, g, b;
	h = bound01(h, 360);
	s = bound01(s, 100);
	l = bound01(l, 100);
	function hue2rgb(p, q, t) {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	}
	if (s === 0) r = g = b = l;
	else {
		var q = l < .5 ? l * (1 + s) : l + s - l * s;
		var p = 2 * l - q;
		r = hue2rgb(p, q, h + 1 / 3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1 / 3);
	}
	return {
		r: r * 255,
		g: g * 255,
		b: b * 255
	};
}
function rgbToHsv(r, g, b) {
	r = bound01(r, 255);
	g = bound01(g, 255);
	b = bound01(b, 255);
	var max = Math.max(r, g, b), min = Math.min(r, g, b);
	var h, s, v = max;
	var d = max - min;
	s = max === 0 ? 0 : d / max;
	if (max == min) h = 0;
	else {
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}
	return {
		h,
		s,
		v
	};
}
function hsvToRgb(h, s, v) {
	h = bound01(h, 360) * 6;
	s = bound01(s, 100);
	v = bound01(v, 100);
	var i = Math.floor(h), f = h - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s), mod = i % 6, r = [
		v,
		q,
		p,
		p,
		t,
		v
	][mod], g = [
		t,
		v,
		v,
		q,
		p,
		p
	][mod], b = [
		p,
		p,
		t,
		v,
		v,
		q
	][mod];
	return {
		r: r * 255,
		g: g * 255,
		b: b * 255
	};
}
function rgbToHex(r, g, b, allow3Char) {
	var hex = [
		pad2(Math.round(r).toString(16)),
		pad2(Math.round(g).toString(16)),
		pad2(Math.round(b).toString(16))
	];
	if (allow3Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1)) return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0);
	return hex.join("");
}
function rgbaToHex(r, g, b, a, allow4Char) {
	var hex = [
		pad2(Math.round(r).toString(16)),
		pad2(Math.round(g).toString(16)),
		pad2(Math.round(b).toString(16)),
		pad2(convertDecimalToHex(a))
	];
	if (allow4Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1) && hex[3].charAt(0) == hex[3].charAt(1)) return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0) + hex[3].charAt(0);
	return hex.join("");
}
function rgbaToArgbHex(r, g, b, a) {
	return [
		pad2(convertDecimalToHex(a)),
		pad2(Math.round(r).toString(16)),
		pad2(Math.round(g).toString(16)),
		pad2(Math.round(b).toString(16))
	].join("");
}
tinycolor.equals = function(color1, color2) {
	if (!color1 || !color2) return false;
	return tinycolor(color1).toRgbString() == tinycolor(color2).toRgbString();
};
tinycolor.random = function() {
	return tinycolor.fromRatio({
		r: Math.random(),
		g: Math.random(),
		b: Math.random()
	});
};
function _desaturate(color, amount) {
	amount = amount === 0 ? 0 : amount || 10;
	var hsl = tinycolor(color).toHsl();
	hsl.s -= amount / 100;
	hsl.s = clamp01(hsl.s);
	return tinycolor(hsl);
}
function _saturate(color, amount) {
	amount = amount === 0 ? 0 : amount || 10;
	var hsl = tinycolor(color).toHsl();
	hsl.s += amount / 100;
	hsl.s = clamp01(hsl.s);
	return tinycolor(hsl);
}
function _greyscale(color) {
	return tinycolor(color).desaturate(100);
}
function _lighten(color, amount) {
	amount = amount === 0 ? 0 : amount || 10;
	var hsl = tinycolor(color).toHsl();
	hsl.l += amount / 100;
	hsl.l = clamp01(hsl.l);
	return tinycolor(hsl);
}
function _brighten(color, amount) {
	amount = amount === 0 ? 0 : amount || 10;
	var rgb = tinycolor(color).toRgb();
	rgb.r = Math.max(0, Math.min(255, rgb.r - Math.round(255 * -(amount / 100))));
	rgb.g = Math.max(0, Math.min(255, rgb.g - Math.round(255 * -(amount / 100))));
	rgb.b = Math.max(0, Math.min(255, rgb.b - Math.round(255 * -(amount / 100))));
	return tinycolor(rgb);
}
function _darken(color, amount) {
	amount = amount === 0 ? 0 : amount || 10;
	var hsl = tinycolor(color).toHsl();
	hsl.l -= amount / 100;
	hsl.l = clamp01(hsl.l);
	return tinycolor(hsl);
}
function _spin(color, amount) {
	var hsl = tinycolor(color).toHsl();
	var hue = (hsl.h + amount) % 360;
	hsl.h = hue < 0 ? 360 + hue : hue;
	return tinycolor(hsl);
}
function _complement(color) {
	var hsl = tinycolor(color).toHsl();
	hsl.h = (hsl.h + 180) % 360;
	return tinycolor(hsl);
}
function polyad(color, number) {
	if (isNaN(number) || number <= 0) throw new Error("Argument to polyad must be a positive number");
	var hsl = tinycolor(color).toHsl();
	var result = [tinycolor(color)];
	var step = 360 / number;
	for (var i = 1; i < number; i++) result.push(tinycolor({
		h: (hsl.h + i * step) % 360,
		s: hsl.s,
		l: hsl.l
	}));
	return result;
}
function _splitcomplement(color) {
	var hsl = tinycolor(color).toHsl();
	var h = hsl.h;
	return [
		tinycolor(color),
		tinycolor({
			h: (h + 72) % 360,
			s: hsl.s,
			l: hsl.l
		}),
		tinycolor({
			h: (h + 216) % 360,
			s: hsl.s,
			l: hsl.l
		})
	];
}
function _analogous(color, results, slices) {
	results = results || 6;
	slices = slices || 30;
	var hsl = tinycolor(color).toHsl();
	var part = 360 / slices;
	var ret = [tinycolor(color)];
	for (hsl.h = (hsl.h - (part * results >> 1) + 720) % 360; --results;) {
		hsl.h = (hsl.h + part) % 360;
		ret.push(tinycolor(hsl));
	}
	return ret;
}
function _monochromatic(color, results) {
	results = results || 6;
	var hsv = tinycolor(color).toHsv();
	var h = hsv.h, s = hsv.s, v = hsv.v;
	var ret = [];
	var modification = 1 / results;
	while (results--) {
		ret.push(tinycolor({
			h,
			s,
			v
		}));
		v = (v + modification) % 1;
	}
	return ret;
}
tinycolor.mix = function(color1, color2, amount) {
	amount = amount === 0 ? 0 : amount || 50;
	var rgb1 = tinycolor(color1).toRgb();
	var rgb2 = tinycolor(color2).toRgb();
	var p = amount / 100;
	return tinycolor({
		r: (rgb2.r - rgb1.r) * p + rgb1.r,
		g: (rgb2.g - rgb1.g) * p + rgb1.g,
		b: (rgb2.b - rgb1.b) * p + rgb1.b,
		a: (rgb2.a - rgb1.a) * p + rgb1.a
	});
};
tinycolor.readability = function(color1, color2) {
	var c1 = tinycolor(color1);
	var c2 = tinycolor(color2);
	return (Math.max(c1.getLuminance(), c2.getLuminance()) + .05) / (Math.min(c1.getLuminance(), c2.getLuminance()) + .05);
};
tinycolor.isReadable = function(color1, color2, wcag2) {
	var readability = tinycolor.readability(color1, color2);
	var wcag2Parms, out = false;
	wcag2Parms = validateWCAG2Parms(wcag2);
	switch (wcag2Parms.level + wcag2Parms.size) {
		case "AAsmall":
		case "AAAlarge":
			out = readability >= 4.5;
			break;
		case "AAlarge":
			out = readability >= 3;
			break;
		case "AAAsmall":
			out = readability >= 7;
			break;
	}
	return out;
};
tinycolor.mostReadable = function(baseColor, colorList, args) {
	var bestColor = null;
	var bestScore = 0;
	var readability;
	var includeFallbackColors, level, size;
	args = args || {};
	includeFallbackColors = args.includeFallbackColors;
	level = args.level;
	size = args.size;
	for (var i = 0; i < colorList.length; i++) {
		readability = tinycolor.readability(baseColor, colorList[i]);
		if (readability > bestScore) {
			bestScore = readability;
			bestColor = tinycolor(colorList[i]);
		}
	}
	if (tinycolor.isReadable(baseColor, bestColor, {
		level,
		size
	}) || !includeFallbackColors) return bestColor;
	else {
		args.includeFallbackColors = false;
		return tinycolor.mostReadable(baseColor, ["#fff", "#000"], args);
	}
};
var names = tinycolor.names = {
	aliceblue: "f0f8ff",
	antiquewhite: "faebd7",
	aqua: "0ff",
	aquamarine: "7fffd4",
	azure: "f0ffff",
	beige: "f5f5dc",
	bisque: "ffe4c4",
	black: "000",
	blanchedalmond: "ffebcd",
	blue: "00f",
	blueviolet: "8a2be2",
	brown: "a52a2a",
	burlywood: "deb887",
	burntsienna: "ea7e5d",
	cadetblue: "5f9ea0",
	chartreuse: "7fff00",
	chocolate: "d2691e",
	coral: "ff7f50",
	cornflowerblue: "6495ed",
	cornsilk: "fff8dc",
	crimson: "dc143c",
	cyan: "0ff",
	darkblue: "00008b",
	darkcyan: "008b8b",
	darkgoldenrod: "b8860b",
	darkgray: "a9a9a9",
	darkgreen: "006400",
	darkgrey: "a9a9a9",
	darkkhaki: "bdb76b",
	darkmagenta: "8b008b",
	darkolivegreen: "556b2f",
	darkorange: "ff8c00",
	darkorchid: "9932cc",
	darkred: "8b0000",
	darksalmon: "e9967a",
	darkseagreen: "8fbc8f",
	darkslateblue: "483d8b",
	darkslategray: "2f4f4f",
	darkslategrey: "2f4f4f",
	darkturquoise: "00ced1",
	darkviolet: "9400d3",
	deeppink: "ff1493",
	deepskyblue: "00bfff",
	dimgray: "696969",
	dimgrey: "696969",
	dodgerblue: "1e90ff",
	firebrick: "b22222",
	floralwhite: "fffaf0",
	forestgreen: "228b22",
	fuchsia: "f0f",
	gainsboro: "dcdcdc",
	ghostwhite: "f8f8ff",
	gold: "ffd700",
	goldenrod: "daa520",
	gray: "808080",
	green: "008000",
	greenyellow: "adff2f",
	grey: "808080",
	honeydew: "f0fff0",
	hotpink: "ff69b4",
	indianred: "cd5c5c",
	indigo: "4b0082",
	ivory: "fffff0",
	khaki: "f0e68c",
	lavender: "e6e6fa",
	lavenderblush: "fff0f5",
	lawngreen: "7cfc00",
	lemonchiffon: "fffacd",
	lightblue: "add8e6",
	lightcoral: "f08080",
	lightcyan: "e0ffff",
	lightgoldenrodyellow: "fafad2",
	lightgray: "d3d3d3",
	lightgreen: "90ee90",
	lightgrey: "d3d3d3",
	lightpink: "ffb6c1",
	lightsalmon: "ffa07a",
	lightseagreen: "20b2aa",
	lightskyblue: "87cefa",
	lightslategray: "789",
	lightslategrey: "789",
	lightsteelblue: "b0c4de",
	lightyellow: "ffffe0",
	lime: "0f0",
	limegreen: "32cd32",
	linen: "faf0e6",
	magenta: "f0f",
	maroon: "800000",
	mediumaquamarine: "66cdaa",
	mediumblue: "0000cd",
	mediumorchid: "ba55d3",
	mediumpurple: "9370db",
	mediumseagreen: "3cb371",
	mediumslateblue: "7b68ee",
	mediumspringgreen: "00fa9a",
	mediumturquoise: "48d1cc",
	mediumvioletred: "c71585",
	midnightblue: "191970",
	mintcream: "f5fffa",
	mistyrose: "ffe4e1",
	moccasin: "ffe4b5",
	navajowhite: "ffdead",
	navy: "000080",
	oldlace: "fdf5e6",
	olive: "808000",
	olivedrab: "6b8e23",
	orange: "ffa500",
	orangered: "ff4500",
	orchid: "da70d6",
	palegoldenrod: "eee8aa",
	palegreen: "98fb98",
	paleturquoise: "afeeee",
	palevioletred: "db7093",
	papayawhip: "ffefd5",
	peachpuff: "ffdab9",
	peru: "cd853f",
	pink: "ffc0cb",
	plum: "dda0dd",
	powderblue: "b0e0e6",
	purple: "800080",
	rebeccapurple: "663399",
	red: "f00",
	rosybrown: "bc8f8f",
	royalblue: "4169e1",
	saddlebrown: "8b4513",
	salmon: "fa8072",
	sandybrown: "f4a460",
	seagreen: "2e8b57",
	seashell: "fff5ee",
	sienna: "a0522d",
	silver: "c0c0c0",
	skyblue: "87ceeb",
	slateblue: "6a5acd",
	slategray: "708090",
	slategrey: "708090",
	snow: "fffafa",
	springgreen: "00ff7f",
	steelblue: "4682b4",
	tan: "d2b48c",
	teal: "008080",
	thistle: "d8bfd8",
	tomato: "ff6347",
	turquoise: "40e0d0",
	violet: "ee82ee",
	wheat: "f5deb3",
	white: "fff",
	whitesmoke: "f5f5f5",
	yellow: "ff0",
	yellowgreen: "9acd32"
};
var hexNames = tinycolor.hexNames = flip(names);
function flip(o) {
	var flipped = {};
	for (var i in o) if (o.hasOwnProperty(i)) flipped[o[i]] = i;
	return flipped;
}
function boundAlpha(a) {
	a = parseFloat(a);
	if (isNaN(a) || a < 0 || a > 1) a = 1;
	return a;
}
function bound01(n, max) {
	if (isOnePointZero(n)) n = "100%";
	var processPercent = isPercentage(n);
	n = Math.min(max, Math.max(0, parseFloat(n)));
	if (processPercent) n = parseInt(n * max, 10) / 100;
	if (Math.abs(n - max) < 1e-6) return 1;
	return n % max / parseFloat(max);
}
function clamp01(val) {
	return Math.min(1, Math.max(0, val));
}
function parseIntFromHex(val) {
	return parseInt(val, 16);
}
function isOnePointZero(n) {
	return typeof n == "string" && n.indexOf(".") != -1 && parseFloat(n) === 1;
}
function isPercentage(n) {
	return typeof n === "string" && n.indexOf("%") != -1;
}
function pad2(c) {
	return c.length == 1 ? "0" + c : "" + c;
}
function convertToPercentage(n) {
	if (n <= 1) n = n * 100 + "%";
	return n;
}
function convertDecimalToHex(d) {
	return Math.round(parseFloat(d) * 255).toString(16);
}
function convertHexToDecimal(h) {
	return parseIntFromHex(h) / 255;
}
var matchers = function() {
	var CSS_UNIT = "(?:[-\\+]?\\d*\\.\\d+%?)|(?:[-\\+]?\\d+%?)";
	var PERMISSIVE_MATCH3 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
	var PERMISSIVE_MATCH4 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
	return {
		CSS_UNIT: new RegExp(CSS_UNIT),
		rgb: new RegExp("rgb" + PERMISSIVE_MATCH3),
		rgba: new RegExp("rgba" + PERMISSIVE_MATCH4),
		hsl: new RegExp("hsl" + PERMISSIVE_MATCH3),
		hsla: new RegExp("hsla" + PERMISSIVE_MATCH4),
		hsv: new RegExp("hsv" + PERMISSIVE_MATCH3),
		hsva: new RegExp("hsva" + PERMISSIVE_MATCH4),
		hex3: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
		hex6: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
		hex4: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
		hex8: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
	};
}();
function isValidCSSUnit(color) {
	return !!matchers.CSS_UNIT.exec(color);
}
function stringInputToObject(color) {
	color = color.replace(trimLeft, "").replace(trimRight, "").toLowerCase();
	var named = false;
	if (names[color]) {
		color = names[color];
		named = true;
	} else if (color == "transparent") return {
		r: 0,
		g: 0,
		b: 0,
		a: 0,
		format: "name"
	};
	var match;
	if (match = matchers.rgb.exec(color)) return {
		r: match[1],
		g: match[2],
		b: match[3]
	};
	if (match = matchers.rgba.exec(color)) return {
		r: match[1],
		g: match[2],
		b: match[3],
		a: match[4]
	};
	if (match = matchers.hsl.exec(color)) return {
		h: match[1],
		s: match[2],
		l: match[3]
	};
	if (match = matchers.hsla.exec(color)) return {
		h: match[1],
		s: match[2],
		l: match[3],
		a: match[4]
	};
	if (match = matchers.hsv.exec(color)) return {
		h: match[1],
		s: match[2],
		v: match[3]
	};
	if (match = matchers.hsva.exec(color)) return {
		h: match[1],
		s: match[2],
		v: match[3],
		a: match[4]
	};
	if (match = matchers.hex8.exec(color)) return {
		r: parseIntFromHex(match[1]),
		g: parseIntFromHex(match[2]),
		b: parseIntFromHex(match[3]),
		a: convertHexToDecimal(match[4]),
		format: named ? "name" : "hex8"
	};
	if (match = matchers.hex6.exec(color)) return {
		r: parseIntFromHex(match[1]),
		g: parseIntFromHex(match[2]),
		b: parseIntFromHex(match[3]),
		format: named ? "name" : "hex"
	};
	if (match = matchers.hex4.exec(color)) return {
		r: parseIntFromHex(match[1] + "" + match[1]),
		g: parseIntFromHex(match[2] + "" + match[2]),
		b: parseIntFromHex(match[3] + "" + match[3]),
		a: convertHexToDecimal(match[4] + "" + match[4]),
		format: named ? "name" : "hex8"
	};
	if (match = matchers.hex3.exec(color)) return {
		r: parseIntFromHex(match[1] + "" + match[1]),
		g: parseIntFromHex(match[2] + "" + match[2]),
		b: parseIntFromHex(match[3] + "" + match[3]),
		format: named ? "name" : "hex"
	};
	return false;
}
function validateWCAG2Parms(parms) {
	var level, size;
	parms = parms || {
		level: "AA",
		size: "small"
	};
	level = (parms.level || "AA").toUpperCase();
	size = (parms.size || "small").toLowerCase();
	if (level !== "AA" && level !== "AAA") level = "AA";
	if (size !== "small" && size !== "large") size = "small";
	return {
		level,
		size
	};
}
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/helpers/color.js
var simpleCheckForValidColor = function simpleCheckForValidColor(data) {
	var keysToCheck = [
		"r",
		"g",
		"b",
		"a",
		"h",
		"s",
		"l",
		"v"
	];
	var checked = 0;
	var passed = 0;
	forEach(keysToCheck, function(letter) {
		if (data[letter]) {
			checked += 1;
			if (!isNaN(data[letter])) passed += 1;
			if (letter === "s" || letter === "l") {
				if (/^\d+%$/.test(data[letter])) passed += 1;
			}
		}
	});
	return checked === passed ? data : false;
};
var toState = function toState(data, oldHue) {
	var color = data.hex ? tinycolor(data.hex) : tinycolor(data);
	var hsl = color.toHsl();
	var hsv = color.toHsv();
	var rgb = color.toRgb();
	var hex = color.toHex();
	if (hsl.s === 0) {
		hsl.h = oldHue || 0;
		hsv.h = oldHue || 0;
	}
	return {
		hsl,
		hex: hex === "000000" && rgb.a === 0 ? "transparent" : "#" + hex,
		rgb,
		hsv,
		oldHue: data.h || oldHue || hsl.h,
		source: data.source
	};
};
var isValidHex = function isValidHex(hex) {
	if (hex === "transparent") return true;
	var lh = String(hex).charAt(0) === "#" ? 1 : 0;
	return hex.length !== 4 + lh && hex.length < 7 + lh && tinycolor(hex).isValid();
};
var getContrastingColor = function getContrastingColor(data) {
	if (!data) return "#fff";
	var col = toState(data);
	if (col.hex === "transparent") return "rgba(0,0,0,0.4)";
	return (col.rgb.r * 299 + col.rgb.g * 587 + col.rgb.b * 114) / 1e3 >= 128 ? "#000" : "#fff";
};
var isvalidColorString = function isvalidColorString(string, type) {
	var stringWithoutDegree = string.replace("°", "");
	return tinycolor(type + " (" + stringWithoutDegree + ")")._ok;
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/common/ColorWrap.js
var _extends$6 = Object.assign || function(target) {
	for (var i = 1; i < arguments.length; i++) {
		var source = arguments[i];
		for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
	}
	return target;
};
var _createClass$3 = function() {
	function defineProperties(target, props) {
		for (var i = 0; i < props.length; i++) {
			var descriptor = props[i];
			descriptor.enumerable = descriptor.enumerable || false;
			descriptor.configurable = true;
			if ("value" in descriptor) descriptor.writable = true;
			Object.defineProperty(target, descriptor.key, descriptor);
		}
	}
	return function(Constructor, protoProps, staticProps) {
		if (protoProps) defineProperties(Constructor.prototype, protoProps);
		if (staticProps) defineProperties(Constructor, staticProps);
		return Constructor;
	};
}();
function _classCallCheck$3(instance, Constructor) {
	if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _possibleConstructorReturn$3(self, call) {
	if (!self) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return call && (typeof call === "object" || typeof call === "function") ? call : self;
}
function _inherits$3(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		enumerable: false,
		writable: true,
		configurable: true
	} });
	if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}
var ColorWrap = function ColorWrap(Picker) {
	var ColorPicker = function(_ref) {
		_inherits$3(ColorPicker, _ref);
		function ColorPicker(props) {
			_classCallCheck$3(this, ColorPicker);
			var _this = _possibleConstructorReturn$3(this, (ColorPicker.__proto__ || Object.getPrototypeOf(ColorPicker)).call(this));
			_this.handleChange = function(data, event) {
				if (simpleCheckForValidColor(data)) {
					var colors = toState(data, data.h || _this.state.oldHue);
					_this.setState(colors);
					_this.props.onChangeComplete && _this.debounce(_this.props.onChangeComplete, colors, event);
					_this.props.onChange && _this.props.onChange(colors, event);
				}
			};
			_this.handleSwatchHover = function(data, event) {
				if (simpleCheckForValidColor(data)) {
					var colors = toState(data, data.h || _this.state.oldHue);
					_this.props.onSwatchHover && _this.props.onSwatchHover(colors, event);
				}
			};
			_this.state = _extends$6({}, toState(props.color, 0));
			_this.debounce = debounce(function(fn, data, event) {
				fn(data, event);
			}, 100);
			return _this;
		}
		_createClass$3(ColorPicker, [{
			key: "render",
			value: function render() {
				var optionalEvents = {};
				if (this.props.onSwatchHover) optionalEvents.onSwatchHover = this.handleSwatchHover;
				return import_react.createElement(Picker, _extends$6({}, this.props, this.state, { onChange: this.handleChange }, optionalEvents));
			}
		}], [{
			key: "getDerivedStateFromProps",
			value: function getDerivedStateFromProps(nextProps, state) {
				return _extends$6({}, toState(nextProps.color, state.oldHue));
			}
		}]);
		return ColorPicker;
	}(import_react.PureComponent || import_react.Component);
	ColorPicker.propTypes = _extends$6({}, Picker.propTypes);
	ColorPicker.defaultProps = _extends$6({}, Picker.defaultProps, { color: {
		h: 250,
		s: .5,
		l: .2,
		a: 1
	} });
	return ColorPicker;
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/helpers/interaction.js
var _extends$5 = Object.assign || function(target) {
	for (var i = 1; i < arguments.length; i++) {
		var source = arguments[i];
		for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
	}
	return target;
};
var _createClass$2 = function() {
	function defineProperties(target, props) {
		for (var i = 0; i < props.length; i++) {
			var descriptor = props[i];
			descriptor.enumerable = descriptor.enumerable || false;
			descriptor.configurable = true;
			if ("value" in descriptor) descriptor.writable = true;
			Object.defineProperty(target, descriptor.key, descriptor);
		}
	}
	return function(Constructor, protoProps, staticProps) {
		if (protoProps) defineProperties(Constructor.prototype, protoProps);
		if (staticProps) defineProperties(Constructor, staticProps);
		return Constructor;
	};
}();
function _classCallCheck$2(instance, Constructor) {
	if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _possibleConstructorReturn$2(self, call) {
	if (!self) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return call && (typeof call === "object" || typeof call === "function") ? call : self;
}
function _inherits$2(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		enumerable: false,
		writable: true,
		configurable: true
	} });
	if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}
var handleFocus = function handleFocus(Component) {
	var Span = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "span";
	return function(_React$Component) {
		_inherits$2(Focus, _React$Component);
		function Focus() {
			var _ref;
			var _temp, _this, _ret;
			_classCallCheck$2(this, Focus);
			for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) args[_key] = arguments[_key];
			return _ret = (_temp = (_this = _possibleConstructorReturn$2(this, (_ref = Focus.__proto__ || Object.getPrototypeOf(Focus)).call.apply(_ref, [this].concat(args))), _this), _this.state = { focus: false }, _this.handleFocus = function() {
				return _this.setState({ focus: true });
			}, _this.handleBlur = function() {
				return _this.setState({ focus: false });
			}, _temp), _possibleConstructorReturn$2(_this, _ret);
		}
		_createClass$2(Focus, [{
			key: "render",
			value: function render() {
				return import_react.createElement(Span, {
					onFocus: this.handleFocus,
					onBlur: this.handleBlur
				}, import_react.createElement(Component, _extends$5({}, this.props, this.state)));
			}
		}]);
		return Focus;
	}(import_react.Component);
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/common/Swatch.js
var _extends$4 = Object.assign || function(target) {
	for (var i = 1; i < arguments.length; i++) {
		var source = arguments[i];
		for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
	}
	return target;
};
var ENTER = 13;
var Swatch_default = handleFocus(function Swatch(_ref) {
	var color = _ref.color, style = _ref.style, _ref$onClick = _ref.onClick, onClick = _ref$onClick === void 0 ? function() {} : _ref$onClick, onHover = _ref.onHover, _ref$title = _ref.title, title = _ref$title === void 0 ? color : _ref$title, children = _ref.children, focus = _ref.focus, _ref$focusStyle = _ref.focusStyle, focusStyle = _ref$focusStyle === void 0 ? {} : _ref$focusStyle;
	var transparent = color === "transparent";
	var styles = (0, import_lib.default)({ default: { swatch: _extends$4({
		background: color,
		height: "100%",
		width: "100%",
		cursor: "pointer",
		position: "relative",
		outline: "none"
	}, style, focus ? focusStyle : {}) } });
	var handleClick = function handleClick(e) {
		return onClick(color, e);
	};
	var handleKeyDown = function handleKeyDown(e) {
		return e.keyCode === ENTER && onClick(color, e);
	};
	var handleHover = function handleHover(e) {
		return onHover(color, e);
	};
	var optionalEvents = {};
	if (onHover) optionalEvents.onMouseOver = handleHover;
	return import_react.createElement("div", _extends$4({
		style: styles.swatch,
		onClick: handleClick,
		title,
		tabIndex: 0,
		onKeyDown: handleKeyDown
	}, optionalEvents), children, transparent && import_react.createElement(Checkboard, {
		borderRadius: styles.swatch.borderRadius,
		boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)"
	}));
});
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/alpha/AlphaPointer.js
var AlphaPointer = function AlphaPointer(_ref) {
	var direction = _ref.direction;
	var styles = (0, import_lib.default)({
		"default": { picker: {
			width: "18px",
			height: "18px",
			borderRadius: "50%",
			transform: "translate(-9px, -1px)",
			backgroundColor: "rgb(248, 248, 248)",
			boxShadow: "0 1px 4px 0 rgba(0, 0, 0, 0.37)"
		} },
		"vertical": { picker: { transform: "translate(-3px, -9px)" } }
	}, { vertical: direction === "vertical" });
	return import_react.createElement("div", { style: styles.picker });
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/alpha/Alpha.js
var _extends$3 = Object.assign || function(target) {
	for (var i = 1; i < arguments.length; i++) {
		var source = arguments[i];
		for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
	}
	return target;
};
var AlphaPicker = function AlphaPicker(_ref) {
	var rgb = _ref.rgb, hsl = _ref.hsl, width = _ref.width, height = _ref.height, onChange = _ref.onChange, direction = _ref.direction, style = _ref.style, renderers = _ref.renderers, pointer = _ref.pointer, _ref$className = _ref.className, className = _ref$className === void 0 ? "" : _ref$className;
	var styles = (0, import_lib.default)({ "default": {
		picker: {
			position: "relative",
			width,
			height
		},
		alpha: {
			radius: "2px",
			style
		}
	} });
	return import_react.createElement("div", {
		style: styles.picker,
		className: "alpha-picker " + className
	}, import_react.createElement(Alpha, _extends$3({}, styles.alpha, {
		rgb,
		hsl,
		pointer,
		renderers,
		onChange,
		direction
	})));
};
AlphaPicker.defaultProps = {
	width: "316px",
	height: "16px",
	direction: "horizontal",
	pointer: AlphaPointer
};
var Alpha_default = ColorWrap(AlphaPicker);
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_arrayMap.js
/**
* A specialized version of `_.map` for arrays without support for iteratee
* shorthands.
*
* @private
* @param {Array} [array] The array to iterate over.
* @param {Function} iteratee The function invoked per iteration.
* @returns {Array} Returns the new mapped array.
*/
function arrayMap(array, iteratee) {
	var index = -1, length = array == null ? 0 : array.length, result = Array(length);
	while (++index < length) result[index] = iteratee(array[index], index, array);
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_setCacheAdd.js
/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = "__lodash_hash_undefined__";
/**
* Adds `value` to the array cache.
*
* @private
* @name add
* @memberOf SetCache
* @alias push
* @param {*} value The value to cache.
* @returns {Object} Returns the cache instance.
*/
function setCacheAdd(value) {
	this.__data__.set(value, HASH_UNDEFINED);
	return this;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_setCacheHas.js
/**
* Checks if `value` is in the array cache.
*
* @private
* @name has
* @memberOf SetCache
* @param {*} value The value to search for.
* @returns {number} Returns `true` if `value` is found, else `false`.
*/
function setCacheHas(value) {
	return this.__data__.has(value);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_SetCache.js
/**
*
* Creates an array cache object to store unique values.
*
* @private
* @constructor
* @param {Array} [values] The values to cache.
*/
function SetCache(values) {
	var index = -1, length = values == null ? 0 : values.length;
	this.__data__ = new MapCache();
	while (++index < length) this.add(values[index]);
}
SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
SetCache.prototype.has = setCacheHas;
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_arraySome.js
/**
* A specialized version of `_.some` for arrays without support for iteratee
* shorthands.
*
* @private
* @param {Array} [array] The array to iterate over.
* @param {Function} predicate The function invoked per iteration.
* @returns {boolean} Returns `true` if any element passes the predicate check,
*  else `false`.
*/
function arraySome(array, predicate) {
	var index = -1, length = array == null ? 0 : array.length;
	while (++index < length) if (predicate(array[index], index, array)) return true;
	return false;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_cacheHas.js
/**
* Checks if a `cache` value for `key` exists.
*
* @private
* @param {Object} cache The cache to query.
* @param {string} key The key of the entry to check.
* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
*/
function cacheHas(cache, key) {
	return cache.has(key);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_equalArrays.js
/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG$5 = 1, COMPARE_UNORDERED_FLAG$3 = 2;
/**
* A specialized version of `baseIsEqualDeep` for arrays with support for
* partial deep comparisons.
*
* @private
* @param {Array} array The array to compare.
* @param {Array} other The other array to compare.
* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
* @param {Function} customizer The function to customize comparisons.
* @param {Function} equalFunc The function to determine equivalents of values.
* @param {Object} stack Tracks traversed `array` and `other` objects.
* @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
*/
function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
	var isPartial = bitmask & COMPARE_PARTIAL_FLAG$5, arrLength = array.length, othLength = other.length;
	if (arrLength != othLength && !(isPartial && othLength > arrLength)) return false;
	var arrStacked = stack.get(array);
	var othStacked = stack.get(other);
	if (arrStacked && othStacked) return arrStacked == other && othStacked == array;
	var index = -1, result = true, seen = bitmask & COMPARE_UNORDERED_FLAG$3 ? new SetCache() : void 0;
	stack.set(array, other);
	stack.set(other, array);
	while (++index < arrLength) {
		var arrValue = array[index], othValue = other[index];
		if (customizer) var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
		if (compared !== void 0) {
			if (compared) continue;
			result = false;
			break;
		}
		if (seen) {
			if (!arraySome(other, function(othValue, othIndex) {
				if (!cacheHas(seen, othIndex) && (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) return seen.push(othIndex);
			})) {
				result = false;
				break;
			}
		} else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
			result = false;
			break;
		}
	}
	stack["delete"](array);
	stack["delete"](other);
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_mapToArray.js
/**
* Converts `map` to its key-value pairs.
*
* @private
* @param {Object} map The map to convert.
* @returns {Array} Returns the key-value pairs.
*/
function mapToArray(map) {
	var index = -1, result = Array(map.size);
	map.forEach(function(value, key) {
		result[++index] = [key, value];
	});
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_setToArray.js
/**
* Converts `set` to an array of its values.
*
* @private
* @param {Object} set The set to convert.
* @returns {Array} Returns the values.
*/
function setToArray(set) {
	var index = -1, result = Array(set.size);
	set.forEach(function(value) {
		result[++index] = value;
	});
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_equalByTag.js
/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG$4 = 1, COMPARE_UNORDERED_FLAG$2 = 2;
/** `Object#toString` result references. */
var boolTag = "[object Boolean]", dateTag = "[object Date]", errorTag = "[object Error]", mapTag$1 = "[object Map]", numberTag = "[object Number]", regexpTag = "[object RegExp]", setTag$1 = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]";
var arrayBufferTag = "[object ArrayBuffer]", dataViewTag$1 = "[object DataView]";
/** Used to convert symbols to primitives and strings. */
var symbolProto$1 = Symbol$1 ? Symbol$1.prototype : void 0, symbolValueOf = symbolProto$1 ? symbolProto$1.valueOf : void 0;
/**
* A specialized version of `baseIsEqualDeep` for comparing objects of
* the same `toStringTag`.
*
* **Note:** This function only supports comparing values with tags of
* `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
*
* @private
* @param {Object} object The object to compare.
* @param {Object} other The other object to compare.
* @param {string} tag The `toStringTag` of the objects to compare.
* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
* @param {Function} customizer The function to customize comparisons.
* @param {Function} equalFunc The function to determine equivalents of values.
* @param {Object} stack Tracks traversed `object` and `other` objects.
* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
*/
function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
	switch (tag) {
		case dataViewTag$1:
			if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) return false;
			object = object.buffer;
			other = other.buffer;
		case arrayBufferTag:
			if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array(object), new Uint8Array(other))) return false;
			return true;
		case boolTag:
		case dateTag:
		case numberTag: return eq(+object, +other);
		case errorTag: return object.name == other.name && object.message == other.message;
		case regexpTag:
		case stringTag: return object == other + "";
		case mapTag$1: var convert = mapToArray;
		case setTag$1:
			var isPartial = bitmask & COMPARE_PARTIAL_FLAG$4;
			convert || (convert = setToArray);
			if (object.size != other.size && !isPartial) return false;
			var stacked = stack.get(object);
			if (stacked) return stacked == other;
			bitmask |= COMPARE_UNORDERED_FLAG$2;
			stack.set(object, other);
			var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
			stack["delete"](object);
			return result;
		case symbolTag: if (symbolValueOf) return symbolValueOf.call(object) == symbolValueOf.call(other);
	}
	return false;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_arrayPush.js
/**
* Appends the elements of `values` to `array`.
*
* @private
* @param {Array} array The array to modify.
* @param {Array} values The values to append.
* @returns {Array} Returns `array`.
*/
function arrayPush(array, values) {
	var index = -1, length = values.length, offset = array.length;
	while (++index < length) array[offset + index] = values[index];
	return array;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseGetAllKeys.js
/**
* The base implementation of `getAllKeys` and `getAllKeysIn` which uses
* `keysFunc` and `symbolsFunc` to get the enumerable property names and
* symbols of `object`.
*
* @private
* @param {Object} object The object to query.
* @param {Function} keysFunc The function to get the keys of `object`.
* @param {Function} symbolsFunc The function to get the symbols of `object`.
* @returns {Array} Returns the array of property names and symbols.
*/
function baseGetAllKeys(object, keysFunc, symbolsFunc) {
	var result = keysFunc(object);
	return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_arrayFilter.js
/**
* A specialized version of `_.filter` for arrays without support for
* iteratee shorthands.
*
* @private
* @param {Array} [array] The array to iterate over.
* @param {Function} predicate The function invoked per iteration.
* @returns {Array} Returns the new filtered array.
*/
function arrayFilter(array, predicate) {
	var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
	while (++index < length) {
		var value = array[index];
		if (predicate(value, index, array)) result[resIndex++] = value;
	}
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/stubArray.js
/**
* This method returns a new empty array.
*
* @static
* @memberOf _
* @since 4.13.0
* @category Util
* @returns {Array} Returns the new empty array.
* @example
*
* var arrays = _.times(2, _.stubArray);
*
* console.log(arrays);
* // => [[], []]
*
* console.log(arrays[0] === arrays[1]);
* // => false
*/
function stubArray() {
	return [];
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_getSymbols.js
/** Built-in value references. */
var propertyIsEnumerable = Object.prototype.propertyIsEnumerable;
var nativeGetSymbols = Object.getOwnPropertySymbols;
/**
* Creates an array of the own enumerable symbols of `object`.
*
* @private
* @param {Object} object The object to query.
* @returns {Array} Returns the array of symbols.
*/
var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
	if (object == null) return [];
	object = Object(object);
	return arrayFilter(nativeGetSymbols(object), function(symbol) {
		return propertyIsEnumerable.call(object, symbol);
	});
};
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_getAllKeys.js
/**
* Creates an array of own enumerable property names and symbols of `object`.
*
* @private
* @param {Object} object The object to query.
* @returns {Array} Returns the array of property names and symbols.
*/
function getAllKeys(object) {
	return baseGetAllKeys(object, keys, getSymbols);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_equalObjects.js
/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG$3 = 1;
/** Used to check objects for own properties. */
var hasOwnProperty$1 = Object.prototype.hasOwnProperty;
/**
* A specialized version of `baseIsEqualDeep` for objects with support for
* partial deep comparisons.
*
* @private
* @param {Object} object The object to compare.
* @param {Object} other The other object to compare.
* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
* @param {Function} customizer The function to customize comparisons.
* @param {Function} equalFunc The function to determine equivalents of values.
* @param {Object} stack Tracks traversed `object` and `other` objects.
* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
*/
function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
	var isPartial = bitmask & COMPARE_PARTIAL_FLAG$3, objProps = getAllKeys(object), objLength = objProps.length;
	if (objLength != getAllKeys(other).length && !isPartial) return false;
	var index = objLength;
	while (index--) {
		var key = objProps[index];
		if (!(isPartial ? key in other : hasOwnProperty$1.call(other, key))) return false;
	}
	var objStacked = stack.get(object);
	var othStacked = stack.get(other);
	if (objStacked && othStacked) return objStacked == other && othStacked == object;
	var result = true;
	stack.set(object, other);
	stack.set(other, object);
	var skipCtor = isPartial;
	while (++index < objLength) {
		key = objProps[index];
		var objValue = object[key], othValue = other[key];
		if (customizer) var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
		if (!(compared === void 0 ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
			result = false;
			break;
		}
		skipCtor || (skipCtor = key == "constructor");
	}
	if (result && !skipCtor) {
		var objCtor = object.constructor, othCtor = other.constructor;
		if (objCtor != othCtor && "constructor" in object && "constructor" in other && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) result = false;
	}
	stack["delete"](object);
	stack["delete"](other);
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_DataView.js
var DataView = getNative(root, "DataView");
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_Promise.js
var Promise$1 = getNative(root, "Promise");
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_Set.js
var Set = getNative(root, "Set");
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_WeakMap.js
var WeakMap = getNative(root, "WeakMap");
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_getTag.js
/** `Object#toString` result references. */
var mapTag = "[object Map]", objectTag$1 = "[object Object]", promiseTag = "[object Promise]", setTag = "[object Set]", weakMapTag = "[object WeakMap]";
var dataViewTag = "[object DataView]";
/** Used to detect maps, sets, and weakmaps. */
var dataViewCtorString = toSource(DataView), mapCtorString = toSource(Map), promiseCtorString = toSource(Promise$1), setCtorString = toSource(Set), weakMapCtorString = toSource(WeakMap);
/**
* Gets the `toStringTag` of `value`.
*
* @private
* @param {*} value The value to query.
* @returns {string} Returns the `toStringTag`.
*/
var getTag = baseGetTag;
if (DataView && getTag(new DataView(/* @__PURE__ */ new ArrayBuffer(1))) != dataViewTag || Map && getTag(new Map()) != mapTag || Promise$1 && getTag(Promise$1.resolve()) != promiseTag || Set && getTag(new Set()) != setTag || WeakMap && getTag(new WeakMap()) != weakMapTag) getTag = function(value) {
	var result = baseGetTag(value), Ctor = result == objectTag$1 ? value.constructor : void 0, ctorString = Ctor ? toSource(Ctor) : "";
	if (ctorString) switch (ctorString) {
		case dataViewCtorString: return dataViewTag;
		case mapCtorString: return mapTag;
		case promiseCtorString: return promiseTag;
		case setCtorString: return setTag;
		case weakMapCtorString: return weakMapTag;
	}
	return result;
};
var _getTag_default = getTag;
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseIsEqualDeep.js
/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG$2 = 1;
/** `Object#toString` result references. */
var argsTag = "[object Arguments]", arrayTag = "[object Array]", objectTag = "[object Object]";
/** Used to check objects for own properties. */
var hasOwnProperty = Object.prototype.hasOwnProperty;
/**
* A specialized version of `baseIsEqual` for arrays and objects which performs
* deep comparisons and tracks traversed objects enabling objects with circular
* references to be compared.
*
* @private
* @param {Object} object The object to compare.
* @param {Object} other The other object to compare.
* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
* @param {Function} customizer The function to customize comparisons.
* @param {Function} equalFunc The function to determine equivalents of values.
* @param {Object} [stack] Tracks traversed `object` and `other` objects.
* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
*/
function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
	var objIsArr = isArray(object), othIsArr = isArray(other), objTag = objIsArr ? arrayTag : _getTag_default(object), othTag = othIsArr ? arrayTag : _getTag_default(other);
	objTag = objTag == argsTag ? objectTag : objTag;
	othTag = othTag == argsTag ? objectTag : othTag;
	var objIsObj = objTag == objectTag, othIsObj = othTag == objectTag, isSameTag = objTag == othTag;
	if (isSameTag && isBuffer(object)) {
		if (!isBuffer(other)) return false;
		objIsArr = true;
		objIsObj = false;
	}
	if (isSameTag && !objIsObj) {
		stack || (stack = new Stack());
		return objIsArr || isTypedArray(object) ? equalArrays(object, other, bitmask, customizer, equalFunc, stack) : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
	}
	if (!(bitmask & COMPARE_PARTIAL_FLAG$2)) {
		var objIsWrapped = objIsObj && hasOwnProperty.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty.call(other, "__wrapped__");
		if (objIsWrapped || othIsWrapped) {
			var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
			stack || (stack = new Stack());
			return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
		}
	}
	if (!isSameTag) return false;
	stack || (stack = new Stack());
	return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseIsEqual.js
/**
* The base implementation of `_.isEqual` which supports partial comparisons
* and tracks traversed objects.
*
* @private
* @param {*} value The value to compare.
* @param {*} other The other value to compare.
* @param {boolean} bitmask The bitmask flags.
*  1 - Unordered comparison
*  2 - Partial comparison
* @param {Function} [customizer] The function to customize comparisons.
* @param {Object} [stack] Tracks traversed `value` and `other` objects.
* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
*/
function baseIsEqual(value, other, bitmask, customizer, stack) {
	if (value === other) return true;
	if (value == null || other == null || !isObjectLike(value) && !isObjectLike(other)) return value !== value && other !== other;
	return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseIsMatch.js
/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG$1 = 1, COMPARE_UNORDERED_FLAG$1 = 2;
/**
* The base implementation of `_.isMatch` without support for iteratee shorthands.
*
* @private
* @param {Object} object The object to inspect.
* @param {Object} source The object of property values to match.
* @param {Array} matchData The property names, values, and compare flags to match.
* @param {Function} [customizer] The function to customize comparisons.
* @returns {boolean} Returns `true` if `object` is a match, else `false`.
*/
function baseIsMatch(object, source, matchData, customizer) {
	var index = matchData.length, length = index, noCustomizer = !customizer;
	if (object == null) return !length;
	object = Object(object);
	while (index--) {
		var data = matchData[index];
		if (noCustomizer && data[2] ? data[1] !== object[data[0]] : !(data[0] in object)) return false;
	}
	while (++index < length) {
		data = matchData[index];
		var key = data[0], objValue = object[key], srcValue = data[1];
		if (noCustomizer && data[2]) {
			if (objValue === void 0 && !(key in object)) return false;
		} else {
			var stack = new Stack();
			if (customizer) var result = customizer(objValue, srcValue, key, object, source, stack);
			if (!(result === void 0 ? baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG$1 | COMPARE_UNORDERED_FLAG$1, customizer, stack) : result)) return false;
		}
	}
	return true;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_isStrictComparable.js
/**
* Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
*
* @private
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` if suitable for strict
*  equality comparisons, else `false`.
*/
function isStrictComparable(value) {
	return value === value && !isObject(value);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_getMatchData.js
/**
* Gets the property names, values, and compare flags of `object`.
*
* @private
* @param {Object} object The object to query.
* @returns {Array} Returns the match data of `object`.
*/
function getMatchData(object) {
	var result = keys(object), length = result.length;
	while (length--) {
		var key = result[length], value = object[key];
		result[length] = [
			key,
			value,
			isStrictComparable(value)
		];
	}
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_matchesStrictComparable.js
/**
* A specialized version of `matchesProperty` for source values suitable
* for strict equality comparisons, i.e. `===`.
*
* @private
* @param {string} key The key of the property to get.
* @param {*} srcValue The value to match.
* @returns {Function} Returns the new spec function.
*/
function matchesStrictComparable(key, srcValue) {
	return function(object) {
		if (object == null) return false;
		return object[key] === srcValue && (srcValue !== void 0 || key in Object(object));
	};
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseMatches.js
/**
* The base implementation of `_.matches` which doesn't clone `source`.
*
* @private
* @param {Object} source The object of property values to match.
* @returns {Function} Returns the new spec function.
*/
function baseMatches(source) {
	var matchData = getMatchData(source);
	if (matchData.length == 1 && matchData[0][2]) return matchesStrictComparable(matchData[0][0], matchData[0][1]);
	return function(object) {
		return object === source || baseIsMatch(object, source, matchData);
	};
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_isKey.js
/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, reIsPlainProp = /^\w*$/;
/**
* Checks if `value` is a property name and not a property path.
*
* @private
* @param {*} value The value to check.
* @param {Object} [object] The object to query keys on.
* @returns {boolean} Returns `true` if `value` is a property name, else `false`.
*/
function isKey(value, object) {
	if (isArray(value)) return false;
	var type = typeof value;
	if (type == "number" || type == "symbol" || type == "boolean" || value == null || isSymbol(value)) return true;
	return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object(object);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/memoize.js
/** Error message constants. */
var FUNC_ERROR_TEXT = "Expected a function";
/**
* Creates a function that memoizes the result of `func`. If `resolver` is
* provided, it determines the cache key for storing the result based on the
* arguments provided to the memoized function. By default, the first argument
* provided to the memoized function is used as the map cache key. The `func`
* is invoked with the `this` binding of the memoized function.
*
* **Note:** The cache is exposed as the `cache` property on the memoized
* function. Its creation may be customized by replacing the `_.memoize.Cache`
* constructor with one whose instances implement the
* [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
* method interface of `clear`, `delete`, `get`, `has`, and `set`.
*
* @static
* @memberOf _
* @since 0.1.0
* @category Function
* @param {Function} func The function to have its output memoized.
* @param {Function} [resolver] The function to resolve the cache key.
* @returns {Function} Returns the new memoized function.
* @example
*
* var object = { 'a': 1, 'b': 2 };
* var other = { 'c': 3, 'd': 4 };
*
* var values = _.memoize(_.values);
* values(object);
* // => [1, 2]
*
* values(other);
* // => [3, 4]
*
* object.a = 2;
* values(object);
* // => [1, 2]
*
* // Modify the result cache.
* values.cache.set(object, ['a', 'b']);
* values(object);
* // => ['a', 'b']
*
* // Replace `_.memoize.Cache`.
* _.memoize.Cache = WeakMap;
*/
function memoize(func, resolver) {
	if (typeof func != "function" || resolver != null && typeof resolver != "function") throw new TypeError(FUNC_ERROR_TEXT);
	var memoized = function() {
		var args = arguments, key = resolver ? resolver.apply(this, args) : args[0], cache = memoized.cache;
		if (cache.has(key)) return cache.get(key);
		var result = func.apply(this, args);
		memoized.cache = cache.set(key, result) || cache;
		return result;
	};
	memoized.cache = new (memoize.Cache || MapCache)();
	return memoized;
}
memoize.Cache = MapCache;
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_memoizeCapped.js
/** Used as the maximum memoize cache size. */
var MAX_MEMOIZE_SIZE = 500;
/**
* A specialized version of `_.memoize` which clears the memoized function's
* cache when it exceeds `MAX_MEMOIZE_SIZE`.
*
* @private
* @param {Function} func The function to have its output memoized.
* @returns {Function} Returns the new memoized function.
*/
function memoizeCapped(func) {
	var result = memoize(func, function(key) {
		if (cache.size === MAX_MEMOIZE_SIZE) cache.clear();
		return key;
	});
	var cache = result.cache;
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_stringToPath.js
/** Used to match property names within property paths. */
var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;
/**
* Converts `string` to a property path array.
*
* @private
* @param {string} string The string to convert.
* @returns {Array} Returns the property path array.
*/
var stringToPath = memoizeCapped(function(string) {
	var result = [];
	if (string.charCodeAt(0) === 46) result.push("");
	string.replace(rePropName, function(match, number, quote, subString) {
		result.push(quote ? subString.replace(reEscapeChar, "$1") : number || match);
	});
	return result;
});
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseToString.js
/** Used as references for various `Number` constants. */
var INFINITY$1 = Infinity;
/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol$1 ? Symbol$1.prototype : void 0, symbolToString = symbolProto ? symbolProto.toString : void 0;
/**
* The base implementation of `_.toString` which doesn't convert nullish
* values to empty strings.
*
* @private
* @param {*} value The value to process.
* @returns {string} Returns the string.
*/
function baseToString(value) {
	if (typeof value == "string") return value;
	if (isArray(value)) return arrayMap(value, baseToString) + "";
	if (isSymbol(value)) return symbolToString ? symbolToString.call(value) : "";
	var result = value + "";
	return result == "0" && 1 / value == -INFINITY$1 ? "-0" : result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/toString.js
/**
* Converts `value` to a string. An empty string is returned for `null`
* and `undefined` values. The sign of `-0` is preserved.
*
* @static
* @memberOf _
* @since 4.0.0
* @category Lang
* @param {*} value The value to convert.
* @returns {string} Returns the converted string.
* @example
*
* _.toString(null);
* // => ''
*
* _.toString(-0);
* // => '-0'
*
* _.toString([1, 2, 3]);
* // => '1,2,3'
*/
function toString(value) {
	return value == null ? "" : baseToString(value);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_castPath.js
/**
* Casts `value` to a path array if it's not one.
*
* @private
* @param {*} value The value to inspect.
* @param {Object} [object] The object to query keys on.
* @returns {Array} Returns the cast property path array.
*/
function castPath(value, object) {
	if (isArray(value)) return value;
	return isKey(value, object) ? [value] : stringToPath(toString(value));
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_toKey.js
/** Used as references for various `Number` constants. */
var INFINITY = Infinity;
/**
* Converts `value` to a string key if it's not a string or symbol.
*
* @private
* @param {*} value The value to inspect.
* @returns {string|symbol} Returns the key.
*/
function toKey(value) {
	if (typeof value == "string" || isSymbol(value)) return value;
	var result = value + "";
	return result == "0" && 1 / value == -INFINITY ? "-0" : result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseGet.js
/**
* The base implementation of `_.get` without support for default values.
*
* @private
* @param {Object} object The object to query.
* @param {Array|string} path The path of the property to get.
* @returns {*} Returns the resolved value.
*/
function baseGet(object, path) {
	path = castPath(path, object);
	var index = 0, length = path.length;
	while (object != null && index < length) object = object[toKey(path[index++])];
	return index && index == length ? object : void 0;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/get.js
/**
* Gets the value at `path` of `object`. If the resolved value is
* `undefined`, the `defaultValue` is returned in its place.
*
* @static
* @memberOf _
* @since 3.7.0
* @category Object
* @param {Object} object The object to query.
* @param {Array|string} path The path of the property to get.
* @param {*} [defaultValue] The value returned for `undefined` resolved values.
* @returns {*} Returns the resolved value.
* @example
*
* var object = { 'a': [{ 'b': { 'c': 3 } }] };
*
* _.get(object, 'a[0].b.c');
* // => 3
*
* _.get(object, ['a', '0', 'b', 'c']);
* // => 3
*
* _.get(object, 'a.b.c', 'default');
* // => 'default'
*/
function get(object, path, defaultValue) {
	var result = object == null ? void 0 : baseGet(object, path);
	return result === void 0 ? defaultValue : result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseHasIn.js
/**
* The base implementation of `_.hasIn` without support for deep paths.
*
* @private
* @param {Object} [object] The object to query.
* @param {Array|string} key The key to check.
* @returns {boolean} Returns `true` if `key` exists, else `false`.
*/
function baseHasIn(object, key) {
	return object != null && key in Object(object);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_hasPath.js
/**
* Checks if `path` exists on `object`.
*
* @private
* @param {Object} object The object to query.
* @param {Array|string} path The path to check.
* @param {Function} hasFunc The function to check properties.
* @returns {boolean} Returns `true` if `path` exists, else `false`.
*/
function hasPath(object, path, hasFunc) {
	path = castPath(path, object);
	var index = -1, length = path.length, result = false;
	while (++index < length) {
		var key = toKey(path[index]);
		if (!(result = object != null && hasFunc(object, key))) break;
		object = object[key];
	}
	if (result || ++index != length) return result;
	length = object == null ? 0 : object.length;
	return !!length && isLength(length) && isIndex(key, length) && (isArray(object) || isArguments(object));
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/hasIn.js
/**
* Checks if `path` is a direct or inherited property of `object`.
*
* @static
* @memberOf _
* @since 4.0.0
* @category Object
* @param {Object} object The object to query.
* @param {Array|string} path The path to check.
* @returns {boolean} Returns `true` if `path` exists, else `false`.
* @example
*
* var object = _.create({ 'a': _.create({ 'b': 2 }) });
*
* _.hasIn(object, 'a');
* // => true
*
* _.hasIn(object, 'a.b');
* // => true
*
* _.hasIn(object, ['a', 'b']);
* // => true
*
* _.hasIn(object, 'b');
* // => false
*/
function hasIn(object, path) {
	return object != null && hasPath(object, path, baseHasIn);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseMatchesProperty.js
/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1, COMPARE_UNORDERED_FLAG = 2;
/**
* The base implementation of `_.matchesProperty` which doesn't clone `srcValue`.
*
* @private
* @param {string} path The path of the property to get.
* @param {*} srcValue The value to match.
* @returns {Function} Returns the new spec function.
*/
function baseMatchesProperty(path, srcValue) {
	if (isKey(path) && isStrictComparable(srcValue)) return matchesStrictComparable(toKey(path), srcValue);
	return function(object) {
		var objValue = get(object, path);
		return objValue === void 0 && objValue === srcValue ? hasIn(object, path) : baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG);
	};
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseProperty.js
/**
* The base implementation of `_.property` without support for deep paths.
*
* @private
* @param {string} key The key of the property to get.
* @returns {Function} Returns the new accessor function.
*/
function baseProperty(key) {
	return function(object) {
		return object == null ? void 0 : object[key];
	};
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_basePropertyDeep.js
/**
* A specialized version of `baseProperty` which supports deep paths.
*
* @private
* @param {Array|string} path The path of the property to get.
* @returns {Function} Returns the new accessor function.
*/
function basePropertyDeep(path) {
	return function(object) {
		return baseGet(object, path);
	};
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/property.js
/**
* Creates a function that returns the value at `path` of a given object.
*
* @static
* @memberOf _
* @since 2.4.0
* @category Util
* @param {Array|string} path The path of the property to get.
* @returns {Function} Returns the new accessor function.
* @example
*
* var objects = [
*   { 'a': { 'b': 2 } },
*   { 'a': { 'b': 1 } }
* ];
*
* _.map(objects, _.property('a.b'));
* // => [2, 1]
*
* _.map(_.sortBy(objects, _.property(['a', 'b'])), 'a.b');
* // => [1, 2]
*/
function property(path) {
	return isKey(path) ? baseProperty(toKey(path)) : basePropertyDeep(path);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseIteratee.js
/**
* The base implementation of `_.iteratee`.
*
* @private
* @param {*} [value=_.identity] The value to convert to an iteratee.
* @returns {Function} Returns the iteratee.
*/
function baseIteratee(value) {
	if (typeof value == "function") return value;
	if (value == null) return identity;
	if (typeof value == "object") return isArray(value) ? baseMatchesProperty(value[0], value[1]) : baseMatches(value);
	return property(value);
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/_baseMap.js
/**
* The base implementation of `_.map` without support for iteratee shorthands.
*
* @private
* @param {Array|Object} collection The collection to iterate over.
* @param {Function} iteratee The function invoked per iteration.
* @returns {Array} Returns the new mapped array.
*/
function baseMap(collection, iteratee) {
	var index = -1, result = isArrayLike(collection) ? Array(collection.length) : [];
	baseEach(collection, function(value, key, collection) {
		result[++index] = iteratee(value, key, collection);
	});
	return result;
}
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/map.js
/**
* Creates an array of values by running each element in `collection` thru
* `iteratee`. The iteratee is invoked with three arguments:
* (value, index|key, collection).
*
* Many lodash methods are guarded to work as iteratees for methods like
* `_.every`, `_.filter`, `_.map`, `_.mapValues`, `_.reject`, and `_.some`.
*
* The guarded methods are:
* `ary`, `chunk`, `curry`, `curryRight`, `drop`, `dropRight`, `every`,
* `fill`, `invert`, `parseInt`, `random`, `range`, `rangeRight`, `repeat`,
* `sampleSize`, `slice`, `some`, `sortBy`, `split`, `take`, `takeRight`,
* `template`, `trim`, `trimEnd`, `trimStart`, and `words`
*
* @static
* @memberOf _
* @since 0.1.0
* @category Collection
* @param {Array|Object} collection The collection to iterate over.
* @param {Function} [iteratee=_.identity] The function invoked per iteration.
* @returns {Array} Returns the new mapped array.
* @example
*
* function square(n) {
*   return n * n;
* }
*
* _.map([4, 8], square);
* // => [16, 64]
*
* _.map({ 'a': 4, 'b': 8 }, square);
* // => [16, 64] (iteration order is not guaranteed)
*
* var users = [
*   { 'user': 'barney' },
*   { 'user': 'fred' }
* ];
*
* // The `_.property` iteratee shorthand.
* _.map(users, 'user');
* // => ['barney', 'fred']
*/
function map(collection, iteratee) {
	return (isArray(collection) ? arrayMap : baseMap)(collection, baseIteratee(iteratee, 3));
}
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/block/BlockSwatches.js
var BlockSwatches = function BlockSwatches(_ref) {
	var colors = _ref.colors, onClick = _ref.onClick, onSwatchHover = _ref.onSwatchHover;
	var styles = (0, import_lib.default)({ "default": {
		swatches: { marginRight: "-10px" },
		swatch: {
			width: "22px",
			height: "22px",
			float: "left",
			marginRight: "10px",
			marginBottom: "10px",
			borderRadius: "4px"
		},
		clear: { clear: "both" }
	} });
	return import_react.createElement("div", { style: styles.swatches }, map(colors, function(c) {
		return import_react.createElement(Swatch_default, {
			key: c,
			color: c,
			style: styles.swatch,
			onClick,
			onHover: onSwatchHover,
			focusStyle: { boxShadow: "0 0 4px " + c }
		});
	}), import_react.createElement("div", { style: styles.clear }));
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/block/Block.js
var Block = function Block(_ref) {
	var onChange = _ref.onChange, onSwatchHover = _ref.onSwatchHover, hex = _ref.hex, colors = _ref.colors, width = _ref.width, triangle = _ref.triangle, _ref$styles = _ref.styles, passedStyles = _ref$styles === void 0 ? {} : _ref$styles, _ref$className = _ref.className, className = _ref$className === void 0 ? "" : _ref$className;
	var transparent = hex === "transparent";
	var handleChange = function handleChange(hexCode, e) {
		isValidHex(hexCode) && onChange({
			hex: hexCode,
			source: "hex"
		}, e);
	};
	var styles = (0, import_lib.default)(merge({
		"default": {
			card: {
				width,
				background: "#fff",
				boxShadow: "0 1px rgba(0,0,0,.1)",
				borderRadius: "6px",
				position: "relative"
			},
			head: {
				height: "110px",
				background: hex,
				borderRadius: "6px 6px 0 0",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				position: "relative"
			},
			body: { padding: "10px" },
			label: {
				fontSize: "18px",
				color: getContrastingColor(hex),
				position: "relative"
			},
			triangle: {
				width: "0px",
				height: "0px",
				borderStyle: "solid",
				borderWidth: "0 10px 10px 10px",
				borderColor: "transparent transparent " + hex + " transparent",
				position: "absolute",
				top: "-10px",
				left: "50%",
				marginLeft: "-10px"
			},
			input: {
				width: "100%",
				fontSize: "12px",
				color: "#666",
				border: "0px",
				outline: "none",
				height: "22px",
				boxShadow: "inset 0 0 0 1px #ddd",
				borderRadius: "4px",
				padding: "0 7px",
				boxSizing: "border-box"
			}
		},
		"hide-triangle": { triangle: { display: "none" } }
	}, passedStyles), { "hide-triangle": triangle === "hide" });
	return import_react.createElement("div", {
		style: styles.card,
		className: "block-picker " + className
	}, import_react.createElement("div", { style: styles.triangle }), import_react.createElement("div", { style: styles.head }, transparent && import_react.createElement(Checkboard, { borderRadius: "6px 6px 0 0" }), import_react.createElement("div", { style: styles.label }, hex)), import_react.createElement("div", { style: styles.body }, import_react.createElement(BlockSwatches, {
		colors,
		onClick: handleChange,
		onSwatchHover
	}), import_react.createElement(EditableInput, {
		style: { input: styles.input },
		value: hex,
		onChange: handleChange
	})));
};
Block.propTypes = {
	width: import_prop_types.default.oneOfType([import_prop_types.default.string, import_prop_types.default.number]),
	colors: import_prop_types.default.arrayOf(import_prop_types.default.string),
	triangle: import_prop_types.default.oneOf(["top", "hide"]),
	styles: import_prop_types.default.object
};
Block.defaultProps = {
	width: 170,
	colors: [
		"#D9E3F0",
		"#F47373",
		"#697689",
		"#37D67A",
		"#2CCCE4",
		"#555555",
		"#dce775",
		"#ff8a65",
		"#ba68c8"
	],
	triangle: "top",
	styles: {}
};
var Block_default = ColorWrap(Block);
//#endregion
//#region node_modules/.pnpm/material-colors@1.2.6/node_modules/material-colors/dist/colors.es2015.js
var red = {
	"50": "#ffebee",
	"100": "#ffcdd2",
	"200": "#ef9a9a",
	"300": "#e57373",
	"400": "#ef5350",
	"500": "#f44336",
	"600": "#e53935",
	"700": "#d32f2f",
	"800": "#c62828",
	"900": "#b71c1c",
	"a100": "#ff8a80",
	"a200": "#ff5252",
	"a400": "#ff1744",
	"a700": "#d50000"
};
var pink = {
	"50": "#fce4ec",
	"100": "#f8bbd0",
	"200": "#f48fb1",
	"300": "#f06292",
	"400": "#ec407a",
	"500": "#e91e63",
	"600": "#d81b60",
	"700": "#c2185b",
	"800": "#ad1457",
	"900": "#880e4f",
	"a100": "#ff80ab",
	"a200": "#ff4081",
	"a400": "#f50057",
	"a700": "#c51162"
};
var purple = {
	"50": "#f3e5f5",
	"100": "#e1bee7",
	"200": "#ce93d8",
	"300": "#ba68c8",
	"400": "#ab47bc",
	"500": "#9c27b0",
	"600": "#8e24aa",
	"700": "#7b1fa2",
	"800": "#6a1b9a",
	"900": "#4a148c",
	"a100": "#ea80fc",
	"a200": "#e040fb",
	"a400": "#d500f9",
	"a700": "#aa00ff"
};
var deepPurple = {
	"50": "#ede7f6",
	"100": "#d1c4e9",
	"200": "#b39ddb",
	"300": "#9575cd",
	"400": "#7e57c2",
	"500": "#673ab7",
	"600": "#5e35b1",
	"700": "#512da8",
	"800": "#4527a0",
	"900": "#311b92",
	"a100": "#b388ff",
	"a200": "#7c4dff",
	"a400": "#651fff",
	"a700": "#6200ea"
};
var indigo = {
	"50": "#e8eaf6",
	"100": "#c5cae9",
	"200": "#9fa8da",
	"300": "#7986cb",
	"400": "#5c6bc0",
	"500": "#3f51b5",
	"600": "#3949ab",
	"700": "#303f9f",
	"800": "#283593",
	"900": "#1a237e",
	"a100": "#8c9eff",
	"a200": "#536dfe",
	"a400": "#3d5afe",
	"a700": "#304ffe"
};
var blue = {
	"50": "#e3f2fd",
	"100": "#bbdefb",
	"200": "#90caf9",
	"300": "#64b5f6",
	"400": "#42a5f5",
	"500": "#2196f3",
	"600": "#1e88e5",
	"700": "#1976d2",
	"800": "#1565c0",
	"900": "#0d47a1",
	"a100": "#82b1ff",
	"a200": "#448aff",
	"a400": "#2979ff",
	"a700": "#2962ff"
};
var lightBlue = {
	"50": "#e1f5fe",
	"100": "#b3e5fc",
	"200": "#81d4fa",
	"300": "#4fc3f7",
	"400": "#29b6f6",
	"500": "#03a9f4",
	"600": "#039be5",
	"700": "#0288d1",
	"800": "#0277bd",
	"900": "#01579b",
	"a100": "#80d8ff",
	"a200": "#40c4ff",
	"a400": "#00b0ff",
	"a700": "#0091ea"
};
var cyan = {
	"50": "#e0f7fa",
	"100": "#b2ebf2",
	"200": "#80deea",
	"300": "#4dd0e1",
	"400": "#26c6da",
	"500": "#00bcd4",
	"600": "#00acc1",
	"700": "#0097a7",
	"800": "#00838f",
	"900": "#006064",
	"a100": "#84ffff",
	"a200": "#18ffff",
	"a400": "#00e5ff",
	"a700": "#00b8d4"
};
var teal = {
	"50": "#e0f2f1",
	"100": "#b2dfdb",
	"200": "#80cbc4",
	"300": "#4db6ac",
	"400": "#26a69a",
	"500": "#009688",
	"600": "#00897b",
	"700": "#00796b",
	"800": "#00695c",
	"900": "#004d40",
	"a100": "#a7ffeb",
	"a200": "#64ffda",
	"a400": "#1de9b6",
	"a700": "#00bfa5"
};
var green = {
	"50": "#e8f5e9",
	"100": "#c8e6c9",
	"200": "#a5d6a7",
	"300": "#81c784",
	"400": "#66bb6a",
	"500": "#4caf50",
	"600": "#43a047",
	"700": "#388e3c",
	"800": "#2e7d32",
	"900": "#1b5e20",
	"a100": "#b9f6ca",
	"a200": "#69f0ae",
	"a400": "#00e676",
	"a700": "#00c853"
};
var lightGreen = {
	"50": "#f1f8e9",
	"100": "#dcedc8",
	"200": "#c5e1a5",
	"300": "#aed581",
	"400": "#9ccc65",
	"500": "#8bc34a",
	"600": "#7cb342",
	"700": "#689f38",
	"800": "#558b2f",
	"900": "#33691e",
	"a100": "#ccff90",
	"a200": "#b2ff59",
	"a400": "#76ff03",
	"a700": "#64dd17"
};
var lime = {
	"50": "#f9fbe7",
	"100": "#f0f4c3",
	"200": "#e6ee9c",
	"300": "#dce775",
	"400": "#d4e157",
	"500": "#cddc39",
	"600": "#c0ca33",
	"700": "#afb42b",
	"800": "#9e9d24",
	"900": "#827717",
	"a100": "#f4ff81",
	"a200": "#eeff41",
	"a400": "#c6ff00",
	"a700": "#aeea00"
};
var yellow = {
	"50": "#fffde7",
	"100": "#fff9c4",
	"200": "#fff59d",
	"300": "#fff176",
	"400": "#ffee58",
	"500": "#ffeb3b",
	"600": "#fdd835",
	"700": "#fbc02d",
	"800": "#f9a825",
	"900": "#f57f17",
	"a100": "#ffff8d",
	"a200": "#ffff00",
	"a400": "#ffea00",
	"a700": "#ffd600"
};
var amber = {
	"50": "#fff8e1",
	"100": "#ffecb3",
	"200": "#ffe082",
	"300": "#ffd54f",
	"400": "#ffca28",
	"500": "#ffc107",
	"600": "#ffb300",
	"700": "#ffa000",
	"800": "#ff8f00",
	"900": "#ff6f00",
	"a100": "#ffe57f",
	"a200": "#ffd740",
	"a400": "#ffc400",
	"a700": "#ffab00"
};
var orange = {
	"50": "#fff3e0",
	"100": "#ffe0b2",
	"200": "#ffcc80",
	"300": "#ffb74d",
	"400": "#ffa726",
	"500": "#ff9800",
	"600": "#fb8c00",
	"700": "#f57c00",
	"800": "#ef6c00",
	"900": "#e65100",
	"a100": "#ffd180",
	"a200": "#ffab40",
	"a400": "#ff9100",
	"a700": "#ff6d00"
};
var deepOrange = {
	"50": "#fbe9e7",
	"100": "#ffccbc",
	"200": "#ffab91",
	"300": "#ff8a65",
	"400": "#ff7043",
	"500": "#ff5722",
	"600": "#f4511e",
	"700": "#e64a19",
	"800": "#d84315",
	"900": "#bf360c",
	"a100": "#ff9e80",
	"a200": "#ff6e40",
	"a400": "#ff3d00",
	"a700": "#dd2c00"
};
var brown = {
	"50": "#efebe9",
	"100": "#d7ccc8",
	"200": "#bcaaa4",
	"300": "#a1887f",
	"400": "#8d6e63",
	"500": "#795548",
	"600": "#6d4c41",
	"700": "#5d4037",
	"800": "#4e342e",
	"900": "#3e2723"
};
var blueGrey = {
	"50": "#eceff1",
	"100": "#cfd8dc",
	"200": "#b0bec5",
	"300": "#90a4ae",
	"400": "#78909c",
	"500": "#607d8b",
	"600": "#546e7a",
	"700": "#455a64",
	"800": "#37474f",
	"900": "#263238"
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/circle/CircleSwatch.js
var CircleSwatch = function CircleSwatch(_ref) {
	var color = _ref.color, onClick = _ref.onClick, onSwatchHover = _ref.onSwatchHover, hover = _ref.hover, active = _ref.active, circleSize = _ref.circleSize, circleSpacing = _ref.circleSpacing;
	var styles = (0, import_lib.default)({
		"default": {
			swatch: {
				width: circleSize,
				height: circleSize,
				marginRight: circleSpacing,
				marginBottom: circleSpacing,
				transform: "scale(1)",
				transition: "100ms transform ease"
			},
			Swatch: {
				borderRadius: "50%",
				background: "transparent",
				boxShadow: "inset 0 0 0 " + (circleSize / 2 + 1) + "px " + color,
				transition: "100ms box-shadow ease"
			}
		},
		"hover": { swatch: { transform: "scale(1.2)" } },
		"active": { Swatch: { boxShadow: "inset 0 0 0 3px " + color } }
	}, {
		hover,
		active
	});
	return import_react.createElement("div", { style: styles.swatch }, import_react.createElement(Swatch_default, {
		style: styles.Swatch,
		color,
		onClick,
		onHover: onSwatchHover,
		focusStyle: { boxShadow: styles.Swatch.boxShadow + ", 0 0 5px " + color }
	}));
};
CircleSwatch.defaultProps = {
	circleSize: 28,
	circleSpacing: 14
};
var CircleSwatch_default = (0, import_lib.handleHover)(CircleSwatch);
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/circle/Circle.js
var Circle = function Circle(_ref) {
	var width = _ref.width, onChange = _ref.onChange, onSwatchHover = _ref.onSwatchHover, colors = _ref.colors, hex = _ref.hex, circleSize = _ref.circleSize, _ref$styles = _ref.styles, passedStyles = _ref$styles === void 0 ? {} : _ref$styles, circleSpacing = _ref.circleSpacing, _ref$className = _ref.className, className = _ref$className === void 0 ? "" : _ref$className;
	var styles = (0, import_lib.default)(merge({ "default": { card: {
		width,
		display: "flex",
		flexWrap: "wrap",
		marginRight: -circleSpacing,
		marginBottom: -circleSpacing
	} } }, passedStyles));
	var handleChange = function handleChange(hexCode, e) {
		return onChange({
			hex: hexCode,
			source: "hex"
		}, e);
	};
	return import_react.createElement("div", {
		style: styles.card,
		className: "circle-picker " + className
	}, map(colors, function(c) {
		return import_react.createElement(CircleSwatch_default, {
			key: c,
			color: c,
			onClick: handleChange,
			onSwatchHover,
			active: hex === c.toLowerCase(),
			circleSize,
			circleSpacing
		});
	}));
};
Circle.propTypes = {
	width: import_prop_types.default.oneOfType([import_prop_types.default.string, import_prop_types.default.number]),
	circleSize: import_prop_types.default.number,
	circleSpacing: import_prop_types.default.number,
	styles: import_prop_types.default.object
};
Circle.defaultProps = {
	width: 252,
	circleSize: 28,
	circleSpacing: 14,
	colors: [
		red["500"],
		pink["500"],
		purple["500"],
		deepPurple["500"],
		indigo["500"],
		blue["500"],
		lightBlue["500"],
		cyan["500"],
		teal["500"],
		green["500"],
		lightGreen["500"],
		lime["500"],
		yellow["500"],
		amber["500"],
		orange["500"],
		deepOrange["500"],
		brown["500"],
		blueGrey["500"]
	],
	styles: {}
};
var Circle_default = ColorWrap(Circle);
//#endregion
//#region node_modules/.pnpm/lodash-es@4.17.22/node_modules/lodash-es/isUndefined.js
/**
* Checks if `value` is `undefined`.
*
* @static
* @since 0.1.0
* @memberOf _
* @category Lang
* @param {*} value The value to check.
* @returns {boolean} Returns `true` if `value` is `undefined`, else `false`.
* @example
*
* _.isUndefined(void 0);
* // => true
*
* _.isUndefined(null);
* // => false
*/
function isUndefined(value) {
	return value === void 0;
}
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/chrome/ChromeFields.js
var import_UnfoldMoreHorizontalIcon = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var _extends = Object.assign || function(target) {
		for (var i = 1; i < arguments.length; i++) {
			var source = arguments[i];
			for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
		}
		return target;
	};
	var _react2 = _interopRequireDefault(require_react());
	function _interopRequireDefault(obj) {
		return obj && obj.__esModule ? obj : { default: obj };
	}
	function _objectWithoutProperties(obj, keys) {
		var target = {};
		for (var i in obj) {
			if (keys.indexOf(i) >= 0) continue;
			if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
			target[i] = obj[i];
		}
		return target;
	}
	var DEFAULT_SIZE = 24;
	exports.default = function(_ref) {
		var _ref$fill = _ref.fill, fill = _ref$fill === void 0 ? "currentColor" : _ref$fill, _ref$width = _ref.width, width = _ref$width === void 0 ? DEFAULT_SIZE : _ref$width, _ref$height = _ref.height, height = _ref$height === void 0 ? DEFAULT_SIZE : _ref$height, _ref$style = _ref.style, style = _ref$style === void 0 ? {} : _ref$style, props = _objectWithoutProperties(_ref, [
			"fill",
			"width",
			"height",
			"style"
		]);
		return _react2.default.createElement("svg", _extends({
			viewBox: "0 0 " + DEFAULT_SIZE + " " + DEFAULT_SIZE,
			style: _extends({
				fill,
				width,
				height
			}, style)
		}, props), _react2.default.createElement("path", { d: "M12,18.17L8.83,15L7.42,16.41L12,21L16.59,16.41L15.17,15M12,5.83L15.17,9L16.58,7.59L12,3L7.41,7.59L8.83,9L12,5.83Z" }));
	};
})))());
var _createClass$1 = function() {
	function defineProperties(target, props) {
		for (var i = 0; i < props.length; i++) {
			var descriptor = props[i];
			descriptor.enumerable = descriptor.enumerable || false;
			descriptor.configurable = true;
			if ("value" in descriptor) descriptor.writable = true;
			Object.defineProperty(target, descriptor.key, descriptor);
		}
	}
	return function(Constructor, protoProps, staticProps) {
		if (protoProps) defineProperties(Constructor.prototype, protoProps);
		if (staticProps) defineProperties(Constructor, staticProps);
		return Constructor;
	};
}();
function _classCallCheck$1(instance, Constructor) {
	if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _possibleConstructorReturn$1(self, call) {
	if (!self) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return call && (typeof call === "object" || typeof call === "function") ? call : self;
}
function _inherits$1(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		enumerable: false,
		writable: true,
		configurable: true
	} });
	if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}
var ChromeFields = function(_React$Component) {
	_inherits$1(ChromeFields, _React$Component);
	function ChromeFields(props) {
		_classCallCheck$1(this, ChromeFields);
		var _this = _possibleConstructorReturn$1(this, (ChromeFields.__proto__ || Object.getPrototypeOf(ChromeFields)).call(this));
		_this.toggleViews = function() {
			if (_this.state.view === "hex") _this.setState({ view: "rgb" });
			else if (_this.state.view === "rgb") _this.setState({ view: "hsl" });
			else if (_this.state.view === "hsl") if (_this.props.hsl.a === 1) _this.setState({ view: "hex" });
			else _this.setState({ view: "rgb" });
		};
		_this.handleChange = function(data, e) {
			if (data.hex) isValidHex(data.hex) && _this.props.onChange({
				hex: data.hex,
				source: "hex"
			}, e);
			else if (data.r || data.g || data.b) _this.props.onChange({
				r: data.r || _this.props.rgb.r,
				g: data.g || _this.props.rgb.g,
				b: data.b || _this.props.rgb.b,
				source: "rgb"
			}, e);
			else if (data.a) {
				if (data.a < 0) data.a = 0;
				else if (data.a > 1) data.a = 1;
				_this.props.onChange({
					h: _this.props.hsl.h,
					s: _this.props.hsl.s,
					l: _this.props.hsl.l,
					a: Math.round(data.a * 100) / 100,
					source: "rgb"
				}, e);
			} else if (data.h || data.s || data.l) {
				if (typeof data.s === "string" && data.s.includes("%")) data.s = data.s.replace("%", "");
				if (typeof data.l === "string" && data.l.includes("%")) data.l = data.l.replace("%", "");
				if (data.s == 1) data.s = .01;
				else if (data.l == 1) data.l = .01;
				_this.props.onChange({
					h: data.h || _this.props.hsl.h,
					s: Number(!isUndefined(data.s) ? data.s : _this.props.hsl.s),
					l: Number(!isUndefined(data.l) ? data.l : _this.props.hsl.l),
					source: "hsl"
				}, e);
			}
		};
		_this.showHighlight = function(e) {
			e.currentTarget.style.background = "#eee";
		};
		_this.hideHighlight = function(e) {
			e.currentTarget.style.background = "transparent";
		};
		if (props.hsl.a !== 1 && props.view === "hex") _this.state = { view: "rgb" };
		else _this.state = { view: props.view };
		return _this;
	}
	_createClass$1(ChromeFields, [{
		key: "render",
		value: function render() {
			var _this2 = this;
			var styles = (0, import_lib.default)({
				"default": {
					wrap: {
						paddingTop: "16px",
						display: "flex"
					},
					fields: {
						flex: "1",
						display: "flex",
						marginLeft: "-6px"
					},
					field: {
						paddingLeft: "6px",
						width: "100%"
					},
					alpha: {
						paddingLeft: "6px",
						width: "100%"
					},
					toggle: {
						width: "32px",
						textAlign: "right",
						position: "relative"
					},
					icon: {
						marginRight: "-4px",
						marginTop: "12px",
						cursor: "pointer",
						position: "relative"
					},
					iconHighlight: {
						position: "absolute",
						width: "24px",
						height: "28px",
						background: "#eee",
						borderRadius: "4px",
						top: "10px",
						left: "12px",
						display: "none"
					},
					input: {
						fontSize: "11px",
						color: "#333",
						width: "100%",
						borderRadius: "2px",
						border: "none",
						boxShadow: "inset 0 0 0 1px #dadada",
						height: "21px",
						textAlign: "center"
					},
					label: {
						textTransform: "uppercase",
						fontSize: "11px",
						lineHeight: "11px",
						color: "#969696",
						textAlign: "center",
						display: "block",
						marginTop: "12px"
					},
					svg: {
						fill: "#333",
						width: "24px",
						height: "24px",
						border: "1px transparent solid",
						borderRadius: "5px"
					}
				},
				"disableAlpha": { alpha: { display: "none" } }
			}, this.props, this.state);
			var fields = void 0;
			if (this.state.view === "hex") fields = import_react.createElement("div", {
				style: styles.fields,
				className: "flexbox-fix"
			}, import_react.createElement("div", { style: styles.field }, import_react.createElement(EditableInput, {
				style: {
					input: styles.input,
					label: styles.label
				},
				label: "hex",
				value: this.props.hex,
				onChange: this.handleChange
			})));
			else if (this.state.view === "rgb") fields = import_react.createElement("div", {
				style: styles.fields,
				className: "flexbox-fix"
			}, import_react.createElement("div", { style: styles.field }, import_react.createElement(EditableInput, {
				style: {
					input: styles.input,
					label: styles.label
				},
				label: "r",
				value: this.props.rgb.r,
				onChange: this.handleChange
			})), import_react.createElement("div", { style: styles.field }, import_react.createElement(EditableInput, {
				style: {
					input: styles.input,
					label: styles.label
				},
				label: "g",
				value: this.props.rgb.g,
				onChange: this.handleChange
			})), import_react.createElement("div", { style: styles.field }, import_react.createElement(EditableInput, {
				style: {
					input: styles.input,
					label: styles.label
				},
				label: "b",
				value: this.props.rgb.b,
				onChange: this.handleChange
			})), import_react.createElement("div", { style: styles.alpha }, import_react.createElement(EditableInput, {
				style: {
					input: styles.input,
					label: styles.label
				},
				label: "a",
				value: this.props.rgb.a,
				arrowOffset: .01,
				onChange: this.handleChange
			})));
			else if (this.state.view === "hsl") fields = import_react.createElement("div", {
				style: styles.fields,
				className: "flexbox-fix"
			}, import_react.createElement("div", { style: styles.field }, import_react.createElement(EditableInput, {
				style: {
					input: styles.input,
					label: styles.label
				},
				label: "h",
				value: Math.round(this.props.hsl.h),
				onChange: this.handleChange
			})), import_react.createElement("div", { style: styles.field }, import_react.createElement(EditableInput, {
				style: {
					input: styles.input,
					label: styles.label
				},
				label: "s",
				value: Math.round(this.props.hsl.s * 100) + "%",
				onChange: this.handleChange
			})), import_react.createElement("div", { style: styles.field }, import_react.createElement(EditableInput, {
				style: {
					input: styles.input,
					label: styles.label
				},
				label: "l",
				value: Math.round(this.props.hsl.l * 100) + "%",
				onChange: this.handleChange
			})), import_react.createElement("div", { style: styles.alpha }, import_react.createElement(EditableInput, {
				style: {
					input: styles.input,
					label: styles.label
				},
				label: "a",
				value: this.props.hsl.a,
				arrowOffset: .01,
				onChange: this.handleChange
			})));
			return import_react.createElement("div", {
				style: styles.wrap,
				className: "flexbox-fix"
			}, fields, import_react.createElement("div", { style: styles.toggle }, import_react.createElement("div", {
				style: styles.icon,
				onClick: this.toggleViews,
				ref: function ref(icon) {
					return _this2.icon = icon;
				}
			}, import_react.createElement(import_UnfoldMoreHorizontalIcon.default, {
				style: styles.svg,
				onMouseOver: this.showHighlight,
				onMouseEnter: this.showHighlight,
				onMouseOut: this.hideHighlight
			}))));
		}
	}], [{
		key: "getDerivedStateFromProps",
		value: function getDerivedStateFromProps(nextProps, state) {
			if (nextProps.hsl.a !== 1 && state.view === "hex") return { view: "rgb" };
			return null;
		}
	}]);
	return ChromeFields;
}(import_react.Component);
ChromeFields.defaultProps = { view: "hex" };
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/chrome/ChromePointer.js
var ChromePointer = function ChromePointer() {
	var styles = (0, import_lib.default)({ "default": { picker: {
		width: "12px",
		height: "12px",
		borderRadius: "6px",
		transform: "translate(-6px, -1px)",
		backgroundColor: "rgb(248, 248, 248)",
		boxShadow: "0 1px 4px 0 rgba(0, 0, 0, 0.37)"
	} } });
	return import_react.createElement("div", { style: styles.picker });
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/chrome/ChromePointerCircle.js
var ChromePointerCircle = function ChromePointerCircle() {
	var styles = (0, import_lib.default)({ "default": { picker: {
		width: "12px",
		height: "12px",
		borderRadius: "6px",
		boxShadow: "inset 0 0 0 1px #fff",
		transform: "translate(-6px, -6px)"
	} } });
	return import_react.createElement("div", { style: styles.picker });
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/chrome/Chrome.js
var Chrome = function Chrome(_ref) {
	var width = _ref.width, onChange = _ref.onChange, disableAlpha = _ref.disableAlpha, rgb = _ref.rgb, hsl = _ref.hsl, hsv = _ref.hsv, hex = _ref.hex, renderers = _ref.renderers, _ref$styles = _ref.styles, passedStyles = _ref$styles === void 0 ? {} : _ref$styles, _ref$className = _ref.className, className = _ref$className === void 0 ? "" : _ref$className, defaultView = _ref.defaultView;
	var styles = (0, import_lib.default)(merge({
		"default": {
			picker: {
				width,
				background: "#fff",
				borderRadius: "2px",
				boxShadow: "0 0 2px rgba(0,0,0,.3), 0 4px 8px rgba(0,0,0,.3)",
				boxSizing: "initial",
				fontFamily: "Menlo"
			},
			saturation: {
				width: "100%",
				paddingBottom: "55%",
				position: "relative",
				borderRadius: "2px 2px 0 0",
				overflow: "hidden"
			},
			Saturation: { radius: "2px 2px 0 0" },
			body: { padding: "16px 16px 12px" },
			controls: { display: "flex" },
			color: { width: "32px" },
			swatch: {
				marginTop: "6px",
				width: "16px",
				height: "16px",
				borderRadius: "8px",
				position: "relative",
				overflow: "hidden"
			},
			active: {
				absolute: "0px 0px 0px 0px",
				borderRadius: "8px",
				boxShadow: "inset 0 0 0 1px rgba(0,0,0,.1)",
				background: "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + rgb.a + ")",
				zIndex: "2"
			},
			toggles: { flex: "1" },
			hue: {
				height: "10px",
				position: "relative",
				marginBottom: "8px"
			},
			Hue: { radius: "2px" },
			alpha: {
				height: "10px",
				position: "relative"
			},
			Alpha: { radius: "2px" }
		},
		"disableAlpha": {
			color: { width: "22px" },
			alpha: { display: "none" },
			hue: { marginBottom: "0px" },
			swatch: {
				width: "10px",
				height: "10px",
				marginTop: "0px"
			}
		}
	}, passedStyles), { disableAlpha });
	return import_react.createElement("div", {
		style: styles.picker,
		className: "chrome-picker " + className
	}, import_react.createElement("div", { style: styles.saturation }, import_react.createElement(Saturation, {
		style: styles.Saturation,
		hsl,
		hsv,
		pointer: ChromePointerCircle,
		onChange
	})), import_react.createElement("div", { style: styles.body }, import_react.createElement("div", {
		style: styles.controls,
		className: "flexbox-fix"
	}, import_react.createElement("div", { style: styles.color }, import_react.createElement("div", { style: styles.swatch }, import_react.createElement("div", { style: styles.active }), import_react.createElement(Checkboard, { renderers }))), import_react.createElement("div", { style: styles.toggles }, import_react.createElement("div", { style: styles.hue }, import_react.createElement(Hue, {
		style: styles.Hue,
		hsl,
		pointer: ChromePointer,
		onChange
	})), import_react.createElement("div", { style: styles.alpha }, import_react.createElement(Alpha, {
		style: styles.Alpha,
		rgb,
		hsl,
		pointer: ChromePointer,
		renderers,
		onChange
	})))), import_react.createElement(ChromeFields, {
		rgb,
		hsl,
		hex,
		view: defaultView,
		onChange,
		disableAlpha
	})));
};
Chrome.propTypes = {
	width: import_prop_types.default.oneOfType([import_prop_types.default.string, import_prop_types.default.number]),
	disableAlpha: import_prop_types.default.bool,
	styles: import_prop_types.default.object,
	defaultView: import_prop_types.default.oneOf([
		"hex",
		"rgb",
		"hsl"
	])
};
Chrome.defaultProps = {
	width: 225,
	disableAlpha: false,
	styles: {}
};
var Chrome_default = ColorWrap(Chrome);
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/compact/CompactColor.js
var CompactColor = function CompactColor(_ref) {
	var color = _ref.color, _ref$onClick = _ref.onClick, onClick = _ref$onClick === void 0 ? function() {} : _ref$onClick, onSwatchHover = _ref.onSwatchHover, active = _ref.active;
	var styles = (0, import_lib.default)({
		"default": {
			color: {
				background: color,
				width: "15px",
				height: "15px",
				float: "left",
				marginRight: "5px",
				marginBottom: "5px",
				position: "relative",
				cursor: "pointer"
			},
			dot: {
				absolute: "5px 5px 5px 5px",
				background: getContrastingColor(color),
				borderRadius: "50%",
				opacity: "0"
			}
		},
		"active": { dot: { opacity: "1" } },
		"color-#FFFFFF": {
			color: { boxShadow: "inset 0 0 0 1px #ddd" },
			dot: { background: "#000" }
		},
		"transparent": { dot: { background: "#000" } }
	}, {
		active,
		"color-#FFFFFF": color === "#FFFFFF",
		"transparent": color === "transparent"
	});
	return import_react.createElement(Swatch_default, {
		style: styles.color,
		color,
		onClick,
		onHover: onSwatchHover,
		focusStyle: { boxShadow: "0 0 4px " + color }
	}, import_react.createElement("div", { style: styles.dot }));
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/compact/CompactFields.js
var CompactFields = function CompactFields(_ref) {
	var hex = _ref.hex, rgb = _ref.rgb, onChange = _ref.onChange;
	var styles = (0, import_lib.default)({ "default": {
		fields: {
			display: "flex",
			paddingBottom: "6px",
			paddingRight: "5px",
			position: "relative"
		},
		active: {
			position: "absolute",
			top: "6px",
			left: "5px",
			height: "9px",
			width: "9px",
			background: hex
		},
		HEXwrap: {
			flex: "6",
			position: "relative"
		},
		HEXinput: {
			width: "80%",
			padding: "0px",
			paddingLeft: "20%",
			border: "none",
			outline: "none",
			background: "none",
			fontSize: "12px",
			color: "#333",
			height: "16px"
		},
		HEXlabel: { display: "none" },
		RGBwrap: {
			flex: "3",
			position: "relative"
		},
		RGBinput: {
			width: "70%",
			padding: "0px",
			paddingLeft: "30%",
			border: "none",
			outline: "none",
			background: "none",
			fontSize: "12px",
			color: "#333",
			height: "16px"
		},
		RGBlabel: {
			position: "absolute",
			top: "3px",
			left: "0px",
			lineHeight: "16px",
			textTransform: "uppercase",
			fontSize: "12px",
			color: "#999"
		}
	} });
	var handleChange = function handleChange(data, e) {
		if (data.r || data.g || data.b) onChange({
			r: data.r || rgb.r,
			g: data.g || rgb.g,
			b: data.b || rgb.b,
			source: "rgb"
		}, e);
		else onChange({
			hex: data.hex,
			source: "hex"
		}, e);
	};
	return import_react.createElement("div", {
		style: styles.fields,
		className: "flexbox-fix"
	}, import_react.createElement("div", { style: styles.active }), import_react.createElement(EditableInput, {
		style: {
			wrap: styles.HEXwrap,
			input: styles.HEXinput,
			label: styles.HEXlabel
		},
		label: "hex",
		value: hex,
		onChange: handleChange
	}), import_react.createElement(EditableInput, {
		style: {
			wrap: styles.RGBwrap,
			input: styles.RGBinput,
			label: styles.RGBlabel
		},
		label: "r",
		value: rgb.r,
		onChange: handleChange
	}), import_react.createElement(EditableInput, {
		style: {
			wrap: styles.RGBwrap,
			input: styles.RGBinput,
			label: styles.RGBlabel
		},
		label: "g",
		value: rgb.g,
		onChange: handleChange
	}), import_react.createElement(EditableInput, {
		style: {
			wrap: styles.RGBwrap,
			input: styles.RGBinput,
			label: styles.RGBlabel
		},
		label: "b",
		value: rgb.b,
		onChange: handleChange
	}));
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/compact/Compact.js
var Compact = function Compact(_ref) {
	var onChange = _ref.onChange, onSwatchHover = _ref.onSwatchHover, colors = _ref.colors, hex = _ref.hex, rgb = _ref.rgb, _ref$styles = _ref.styles, passedStyles = _ref$styles === void 0 ? {} : _ref$styles, _ref$className = _ref.className, className = _ref$className === void 0 ? "" : _ref$className;
	var styles = (0, import_lib.default)(merge({ "default": {
		Compact: {
			background: "#f6f6f6",
			radius: "4px"
		},
		compact: {
			paddingTop: "5px",
			paddingLeft: "5px",
			boxSizing: "initial",
			width: "240px"
		},
		clear: { clear: "both" }
	} }, passedStyles));
	var handleChange = function handleChange(data, e) {
		if (data.hex) isValidHex(data.hex) && onChange({
			hex: data.hex,
			source: "hex"
		}, e);
		else onChange(data, e);
	};
	return import_react.createElement(Raised, {
		style: styles.Compact,
		styles: passedStyles
	}, import_react.createElement("div", {
		style: styles.compact,
		className: "compact-picker " + className
	}, import_react.createElement("div", null, map(colors, function(c) {
		return import_react.createElement(CompactColor, {
			key: c,
			color: c,
			active: c.toLowerCase() === hex,
			onClick: handleChange,
			onSwatchHover
		});
	}), import_react.createElement("div", { style: styles.clear })), import_react.createElement(CompactFields, {
		hex,
		rgb,
		onChange: handleChange
	})));
};
Compact.propTypes = {
	colors: import_prop_types.default.arrayOf(import_prop_types.default.string),
	styles: import_prop_types.default.object
};
Compact.defaultProps = {
	colors: [
		"#4D4D4D",
		"#999999",
		"#FFFFFF",
		"#F44E3B",
		"#FE9200",
		"#FCDC00",
		"#DBDF00",
		"#A4DD00",
		"#68CCCA",
		"#73D8FF",
		"#AEA1FF",
		"#FDA1FF",
		"#333333",
		"#808080",
		"#cccccc",
		"#D33115",
		"#E27300",
		"#FCC400",
		"#B0BC00",
		"#68BC00",
		"#16A5A5",
		"#009CE0",
		"#7B64FF",
		"#FA28FF",
		"#000000",
		"#666666",
		"#B3B3B3",
		"#9F0500",
		"#C45100",
		"#FB9E00",
		"#808900",
		"#194D33",
		"#0C797D",
		"#0062B1",
		"#653294",
		"#AB149E"
	],
	styles: {}
};
var Compact_default = ColorWrap(Compact);
var GithubSwatch_default = (0, import_lib.handleHover)(function GithubSwatch(_ref) {
	var hover = _ref.hover, color = _ref.color, onClick = _ref.onClick, onSwatchHover = _ref.onSwatchHover;
	var hoverSwatch = {
		position: "relative",
		zIndex: "2",
		outline: "2px solid #fff",
		boxShadow: "0 0 5px 2px rgba(0,0,0,0.25)"
	};
	var styles = (0, import_lib.default)({
		"default": { swatch: {
			width: "25px",
			height: "25px",
			fontSize: "0"
		} },
		"hover": { swatch: hoverSwatch }
	}, { hover });
	return import_react.createElement("div", { style: styles.swatch }, import_react.createElement(Swatch_default, {
		color,
		onClick,
		onHover: onSwatchHover,
		focusStyle: hoverSwatch
	}));
});
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/github/Github.js
var Github = function Github(_ref) {
	var width = _ref.width, colors = _ref.colors, onChange = _ref.onChange, onSwatchHover = _ref.onSwatchHover, triangle = _ref.triangle, _ref$styles = _ref.styles, passedStyles = _ref$styles === void 0 ? {} : _ref$styles, _ref$className = _ref.className, className = _ref$className === void 0 ? "" : _ref$className;
	var styles = (0, import_lib.default)(merge({
		"default": {
			card: {
				width,
				background: "#fff",
				border: "1px solid rgba(0,0,0,0.2)",
				boxShadow: "0 3px 12px rgba(0,0,0,0.15)",
				borderRadius: "4px",
				position: "relative",
				padding: "5px",
				display: "flex",
				flexWrap: "wrap"
			},
			triangle: {
				position: "absolute",
				border: "7px solid transparent",
				borderBottomColor: "#fff"
			},
			triangleShadow: {
				position: "absolute",
				border: "8px solid transparent",
				borderBottomColor: "rgba(0,0,0,0.15)"
			}
		},
		"hide-triangle": {
			triangle: { display: "none" },
			triangleShadow: { display: "none" }
		},
		"top-left-triangle": {
			triangle: {
				top: "-14px",
				left: "10px"
			},
			triangleShadow: {
				top: "-16px",
				left: "9px"
			}
		},
		"top-right-triangle": {
			triangle: {
				top: "-14px",
				right: "10px"
			},
			triangleShadow: {
				top: "-16px",
				right: "9px"
			}
		},
		"bottom-left-triangle": {
			triangle: {
				top: "35px",
				left: "10px",
				transform: "rotate(180deg)"
			},
			triangleShadow: {
				top: "37px",
				left: "9px",
				transform: "rotate(180deg)"
			}
		},
		"bottom-right-triangle": {
			triangle: {
				top: "35px",
				right: "10px",
				transform: "rotate(180deg)"
			},
			triangleShadow: {
				top: "37px",
				right: "9px",
				transform: "rotate(180deg)"
			}
		}
	}, passedStyles), {
		"hide-triangle": triangle === "hide",
		"top-left-triangle": triangle === "top-left",
		"top-right-triangle": triangle === "top-right",
		"bottom-left-triangle": triangle === "bottom-left",
		"bottom-right-triangle": triangle === "bottom-right"
	});
	var handleChange = function handleChange(hex, e) {
		return onChange({
			hex,
			source: "hex"
		}, e);
	};
	return import_react.createElement("div", {
		style: styles.card,
		className: "github-picker " + className
	}, import_react.createElement("div", { style: styles.triangleShadow }), import_react.createElement("div", { style: styles.triangle }), map(colors, function(c) {
		return import_react.createElement(GithubSwatch_default, {
			color: c,
			key: c,
			onClick: handleChange,
			onSwatchHover
		});
	}));
};
Github.propTypes = {
	width: import_prop_types.default.oneOfType([import_prop_types.default.string, import_prop_types.default.number]),
	colors: import_prop_types.default.arrayOf(import_prop_types.default.string),
	triangle: import_prop_types.default.oneOf([
		"hide",
		"top-left",
		"top-right",
		"bottom-left",
		"bottom-right"
	]),
	styles: import_prop_types.default.object
};
Github.defaultProps = {
	width: 200,
	colors: [
		"#B80000",
		"#DB3E00",
		"#FCCB00",
		"#008B02",
		"#006B76",
		"#1273DE",
		"#004DCF",
		"#5300EB",
		"#EB9694",
		"#FAD0C3",
		"#FEF3BD",
		"#C1E1C5",
		"#BEDADC",
		"#C4DEF6",
		"#BED3F3",
		"#D4C4FB"
	],
	triangle: "top-left",
	styles: {}
};
var Github_default = ColorWrap(Github);
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/hue/HuePointer.js
var SliderPointer$1 = function SliderPointer(_ref) {
	var direction = _ref.direction;
	var styles = (0, import_lib.default)({
		"default": { picker: {
			width: "18px",
			height: "18px",
			borderRadius: "50%",
			transform: "translate(-9px, -1px)",
			backgroundColor: "rgb(248, 248, 248)",
			boxShadow: "0 1px 4px 0 rgba(0, 0, 0, 0.37)"
		} },
		"vertical": { picker: { transform: "translate(-3px, -9px)" } }
	}, { vertical: direction === "vertical" });
	return import_react.createElement("div", { style: styles.picker });
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/hue/Hue.js
var _extends$2 = Object.assign || function(target) {
	for (var i = 1; i < arguments.length; i++) {
		var source = arguments[i];
		for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
	}
	return target;
};
var HuePicker = function HuePicker(_ref) {
	var width = _ref.width, height = _ref.height, onChange = _ref.onChange, hsl = _ref.hsl, direction = _ref.direction, pointer = _ref.pointer, _ref$styles = _ref.styles, passedStyles = _ref$styles === void 0 ? {} : _ref$styles, _ref$className = _ref.className, className = _ref$className === void 0 ? "" : _ref$className;
	var styles = (0, import_lib.default)(merge({ "default": {
		picker: {
			position: "relative",
			width,
			height
		},
		hue: { radius: "2px" }
	} }, passedStyles));
	return import_react.createElement("div", {
		style: styles.picker,
		className: "hue-picker " + className
	}, import_react.createElement(Hue, _extends$2({}, styles.hue, {
		hsl,
		pointer,
		onChange: function handleChange(data) {
			return onChange({
				a: 1,
				h: data.h,
				l: .5,
				s: 1
			});
		},
		direction
	})));
};
HuePicker.propTypes = { styles: import_prop_types.default.object };
HuePicker.defaultProps = {
	width: "316px",
	height: "16px",
	direction: "horizontal",
	pointer: SliderPointer$1,
	styles: {}
};
var Hue_default = ColorWrap(HuePicker);
var Material_default = ColorWrap(function Material(_ref) {
	var onChange = _ref.onChange, hex = _ref.hex, rgb = _ref.rgb, _ref$styles = _ref.styles, passedStyles = _ref$styles === void 0 ? {} : _ref$styles, _ref$className = _ref.className, className = _ref$className === void 0 ? "" : _ref$className;
	var styles = (0, import_lib.default)(merge({ "default": {
		material: {
			width: "98px",
			height: "98px",
			padding: "16px",
			fontFamily: "Roboto"
		},
		HEXwrap: { position: "relative" },
		HEXinput: {
			width: "100%",
			marginTop: "12px",
			fontSize: "15px",
			color: "#333",
			padding: "0px",
			border: "0px",
			borderBottom: "2px solid " + hex,
			outline: "none",
			height: "30px"
		},
		HEXlabel: {
			position: "absolute",
			top: "0px",
			left: "0px",
			fontSize: "11px",
			color: "#999999",
			textTransform: "capitalize"
		},
		Hex: { style: {} },
		RGBwrap: { position: "relative" },
		RGBinput: {
			width: "100%",
			marginTop: "12px",
			fontSize: "15px",
			color: "#333",
			padding: "0px",
			border: "0px",
			borderBottom: "1px solid #eee",
			outline: "none",
			height: "30px"
		},
		RGBlabel: {
			position: "absolute",
			top: "0px",
			left: "0px",
			fontSize: "11px",
			color: "#999999",
			textTransform: "capitalize"
		},
		split: {
			display: "flex",
			marginRight: "-10px",
			paddingTop: "11px"
		},
		third: {
			flex: "1",
			paddingRight: "10px"
		}
	} }, passedStyles));
	var handleChange = function handleChange(data, e) {
		if (data.hex) isValidHex(data.hex) && onChange({
			hex: data.hex,
			source: "hex"
		}, e);
		else if (data.r || data.g || data.b) onChange({
			r: data.r || rgb.r,
			g: data.g || rgb.g,
			b: data.b || rgb.b,
			source: "rgb"
		}, e);
	};
	return import_react.createElement(Raised, { styles: passedStyles }, import_react.createElement("div", {
		style: styles.material,
		className: "material-picker " + className
	}, import_react.createElement(EditableInput, {
		style: {
			wrap: styles.HEXwrap,
			input: styles.HEXinput,
			label: styles.HEXlabel
		},
		label: "hex",
		value: hex,
		onChange: handleChange
	}), import_react.createElement("div", {
		style: styles.split,
		className: "flexbox-fix"
	}, import_react.createElement("div", { style: styles.third }, import_react.createElement(EditableInput, {
		style: {
			wrap: styles.RGBwrap,
			input: styles.RGBinput,
			label: styles.RGBlabel
		},
		label: "r",
		value: rgb.r,
		onChange: handleChange
	})), import_react.createElement("div", { style: styles.third }, import_react.createElement(EditableInput, {
		style: {
			wrap: styles.RGBwrap,
			input: styles.RGBinput,
			label: styles.RGBlabel
		},
		label: "g",
		value: rgb.g,
		onChange: handleChange
	})), import_react.createElement("div", { style: styles.third }, import_react.createElement(EditableInput, {
		style: {
			wrap: styles.RGBwrap,
			input: styles.RGBinput,
			label: styles.RGBlabel
		},
		label: "b",
		value: rgb.b,
		onChange: handleChange
	})))));
});
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/photoshop/PhotoshopFields.js
var PhotoshopPicker = function PhotoshopPicker(_ref) {
	var onChange = _ref.onChange, rgb = _ref.rgb, hsv = _ref.hsv, hex = _ref.hex;
	var styles = (0, import_lib.default)({ "default": {
		fields: {
			paddingTop: "5px",
			paddingBottom: "9px",
			width: "80px",
			position: "relative"
		},
		divider: { height: "5px" },
		RGBwrap: { position: "relative" },
		RGBinput: {
			marginLeft: "40%",
			width: "40%",
			height: "18px",
			border: "1px solid #888888",
			boxShadow: "inset 0 1px 1px rgba(0,0,0,.1), 0 1px 0 0 #ECECEC",
			marginBottom: "5px",
			fontSize: "13px",
			paddingLeft: "3px",
			marginRight: "10px"
		},
		RGBlabel: {
			left: "0px",
			top: "0px",
			width: "34px",
			textTransform: "uppercase",
			fontSize: "13px",
			height: "18px",
			lineHeight: "22px",
			position: "absolute"
		},
		HEXwrap: { position: "relative" },
		HEXinput: {
			marginLeft: "20%",
			width: "80%",
			height: "18px",
			border: "1px solid #888888",
			boxShadow: "inset 0 1px 1px rgba(0,0,0,.1), 0 1px 0 0 #ECECEC",
			marginBottom: "6px",
			fontSize: "13px",
			paddingLeft: "3px"
		},
		HEXlabel: {
			position: "absolute",
			top: "0px",
			left: "0px",
			width: "14px",
			textTransform: "uppercase",
			fontSize: "13px",
			height: "18px",
			lineHeight: "22px"
		},
		fieldSymbols: {
			position: "absolute",
			top: "5px",
			right: "-7px",
			fontSize: "13px"
		},
		symbol: {
			height: "20px",
			lineHeight: "22px",
			paddingBottom: "7px"
		}
	} });
	var handleChange = function handleChange(data, e) {
		if (data["#"]) isValidHex(data["#"]) && onChange({
			hex: data["#"],
			source: "hex"
		}, e);
		else if (data.r || data.g || data.b) onChange({
			r: data.r || rgb.r,
			g: data.g || rgb.g,
			b: data.b || rgb.b,
			source: "rgb"
		}, e);
		else if (data.h || data.s || data.v) onChange({
			h: data.h || hsv.h,
			s: data.s || hsv.s,
			v: data.v || hsv.v,
			source: "hsv"
		}, e);
	};
	return import_react.createElement("div", { style: styles.fields }, import_react.createElement(EditableInput, {
		style: {
			wrap: styles.RGBwrap,
			input: styles.RGBinput,
			label: styles.RGBlabel
		},
		label: "h",
		value: Math.round(hsv.h),
		onChange: handleChange
	}), import_react.createElement(EditableInput, {
		style: {
			wrap: styles.RGBwrap,
			input: styles.RGBinput,
			label: styles.RGBlabel
		},
		label: "s",
		value: Math.round(hsv.s * 100),
		onChange: handleChange
	}), import_react.createElement(EditableInput, {
		style: {
			wrap: styles.RGBwrap,
			input: styles.RGBinput,
			label: styles.RGBlabel
		},
		label: "v",
		value: Math.round(hsv.v * 100),
		onChange: handleChange
	}), import_react.createElement("div", { style: styles.divider }), import_react.createElement(EditableInput, {
		style: {
			wrap: styles.RGBwrap,
			input: styles.RGBinput,
			label: styles.RGBlabel
		},
		label: "r",
		value: rgb.r,
		onChange: handleChange
	}), import_react.createElement(EditableInput, {
		style: {
			wrap: styles.RGBwrap,
			input: styles.RGBinput,
			label: styles.RGBlabel
		},
		label: "g",
		value: rgb.g,
		onChange: handleChange
	}), import_react.createElement(EditableInput, {
		style: {
			wrap: styles.RGBwrap,
			input: styles.RGBinput,
			label: styles.RGBlabel
		},
		label: "b",
		value: rgb.b,
		onChange: handleChange
	}), import_react.createElement("div", { style: styles.divider }), import_react.createElement(EditableInput, {
		style: {
			wrap: styles.HEXwrap,
			input: styles.HEXinput,
			label: styles.HEXlabel
		},
		label: "#",
		value: hex.replace("#", ""),
		onChange: handleChange
	}), import_react.createElement("div", { style: styles.fieldSymbols }, import_react.createElement("div", { style: styles.symbol }, "°"), import_react.createElement("div", { style: styles.symbol }, "%"), import_react.createElement("div", { style: styles.symbol }, "%")));
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/photoshop/PhotoshopPointerCircle.js
var PhotoshopPointerCircle$1 = function PhotoshopPointerCircle(_ref) {
	var hsl = _ref.hsl;
	var styles = (0, import_lib.default)({
		"default": { picker: {
			width: "12px",
			height: "12px",
			borderRadius: "6px",
			boxShadow: "inset 0 0 0 1px #fff",
			transform: "translate(-6px, -6px)"
		} },
		"black-outline": { picker: { boxShadow: "inset 0 0 0 1px #000" } }
	}, { "black-outline": hsl.l > .5 });
	return import_react.createElement("div", { style: styles.picker });
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/photoshop/PhotoshopPointer.js
var PhotoshopPointerCircle = function PhotoshopPointerCircle() {
	var styles = (0, import_lib.default)({ "default": {
		triangle: {
			width: 0,
			height: 0,
			borderStyle: "solid",
			borderWidth: "4px 0 4px 6px",
			borderColor: "transparent transparent transparent #fff",
			position: "absolute",
			top: "1px",
			left: "1px"
		},
		triangleBorder: {
			width: 0,
			height: 0,
			borderStyle: "solid",
			borderWidth: "5px 0 5px 8px",
			borderColor: "transparent transparent transparent #555"
		},
		left: {
			Extend: "triangleBorder",
			transform: "translate(-13px, -4px)"
		},
		leftInside: {
			Extend: "triangle",
			transform: "translate(-8px, -5px)"
		},
		right: {
			Extend: "triangleBorder",
			transform: "translate(20px, -14px) rotate(180deg)"
		},
		rightInside: {
			Extend: "triangle",
			transform: "translate(-8px, -5px)"
		}
	} });
	return import_react.createElement("div", { style: styles.pointer }, import_react.createElement("div", { style: styles.left }, import_react.createElement("div", { style: styles.leftInside })), import_react.createElement("div", { style: styles.right }, import_react.createElement("div", { style: styles.rightInside })));
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/photoshop/PhotoshopButton.js
var PhotoshopButton = function PhotoshopButton(_ref) {
	var onClick = _ref.onClick, label = _ref.label, children = _ref.children, active = _ref.active;
	var styles = (0, import_lib.default)({
		"default": { button: {
			backgroundImage: "linear-gradient(-180deg, #FFFFFF 0%, #E6E6E6 100%)",
			border: "1px solid #878787",
			borderRadius: "2px",
			height: "20px",
			boxShadow: "0 1px 0 0 #EAEAEA",
			fontSize: "14px",
			color: "#000",
			lineHeight: "20px",
			textAlign: "center",
			marginBottom: "10px",
			cursor: "pointer"
		} },
		"active": { button: { boxShadow: "0 0 0 1px #878787" } }
	}, { active });
	return import_react.createElement("div", {
		style: styles.button,
		onClick
	}, label || children);
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/photoshop/PhotoshopPreviews.js
var PhotoshopPreviews = function PhotoshopPreviews(_ref) {
	var rgb = _ref.rgb, currentColor = _ref.currentColor;
	var styles = (0, import_lib.default)({ "default": {
		swatches: {
			border: "1px solid #B3B3B3",
			borderBottom: "1px solid #F0F0F0",
			marginBottom: "2px",
			marginTop: "1px"
		},
		new: {
			height: "34px",
			background: "rgb(" + rgb.r + "," + rgb.g + ", " + rgb.b + ")",
			boxShadow: "inset 1px 0 0 #000, inset -1px 0 0 #000, inset 0 1px 0 #000"
		},
		current: {
			height: "34px",
			background: currentColor,
			boxShadow: "inset 1px 0 0 #000, inset -1px 0 0 #000, inset 0 -1px 0 #000"
		},
		label: {
			fontSize: "14px",
			color: "#000",
			textAlign: "center"
		}
	} });
	return import_react.createElement("div", null, import_react.createElement("div", { style: styles.label }, "new"), import_react.createElement("div", { style: styles.swatches }, import_react.createElement("div", { style: styles.new }), import_react.createElement("div", { style: styles.current })), import_react.createElement("div", { style: styles.label }, "current"));
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/photoshop/Photoshop.js
var _createClass = function() {
	function defineProperties(target, props) {
		for (var i = 0; i < props.length; i++) {
			var descriptor = props[i];
			descriptor.enumerable = descriptor.enumerable || false;
			descriptor.configurable = true;
			if ("value" in descriptor) descriptor.writable = true;
			Object.defineProperty(target, descriptor.key, descriptor);
		}
	}
	return function(Constructor, protoProps, staticProps) {
		if (protoProps) defineProperties(Constructor.prototype, protoProps);
		if (staticProps) defineProperties(Constructor, staticProps);
		return Constructor;
	};
}();
function _classCallCheck(instance, Constructor) {
	if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _possibleConstructorReturn(self, call) {
	if (!self) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return call && (typeof call === "object" || typeof call === "function") ? call : self;
}
function _inherits(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		enumerable: false,
		writable: true,
		configurable: true
	} });
	if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}
var Photoshop = function(_React$Component) {
	_inherits(Photoshop, _React$Component);
	function Photoshop(props) {
		_classCallCheck(this, Photoshop);
		var _this = _possibleConstructorReturn(this, (Photoshop.__proto__ || Object.getPrototypeOf(Photoshop)).call(this));
		_this.state = { currentColor: props.hex };
		return _this;
	}
	_createClass(Photoshop, [{
		key: "render",
		value: function render() {
			var _props = this.props, _props$styles = _props.styles, passedStyles = _props$styles === void 0 ? {} : _props$styles, _props$className = _props.className, className = _props$className === void 0 ? "" : _props$className;
			var styles = (0, import_lib.default)(merge({ "default": {
				picker: {
					background: "#DCDCDC",
					borderRadius: "4px",
					boxShadow: "0 0 0 1px rgba(0,0,0,.25), 0 8px 16px rgba(0,0,0,.15)",
					boxSizing: "initial",
					width: "513px"
				},
				head: {
					backgroundImage: "linear-gradient(-180deg, #F0F0F0 0%, #D4D4D4 100%)",
					borderBottom: "1px solid #B1B1B1",
					boxShadow: "inset 0 1px 0 0 rgba(255,255,255,.2), inset 0 -1px 0 0 rgba(0,0,0,.02)",
					height: "23px",
					lineHeight: "24px",
					borderRadius: "4px 4px 0 0",
					fontSize: "13px",
					color: "#4D4D4D",
					textAlign: "center"
				},
				body: {
					padding: "15px 15px 0",
					display: "flex"
				},
				saturation: {
					width: "256px",
					height: "256px",
					position: "relative",
					border: "2px solid #B3B3B3",
					borderBottom: "2px solid #F0F0F0",
					overflow: "hidden"
				},
				hue: {
					position: "relative",
					height: "256px",
					width: "19px",
					marginLeft: "10px",
					border: "2px solid #B3B3B3",
					borderBottom: "2px solid #F0F0F0"
				},
				controls: {
					width: "180px",
					marginLeft: "10px"
				},
				top: { display: "flex" },
				previews: { width: "60px" },
				actions: {
					flex: "1",
					marginLeft: "20px"
				}
			} }, passedStyles));
			return import_react.createElement("div", {
				style: styles.picker,
				className: "photoshop-picker " + className
			}, import_react.createElement("div", { style: styles.head }, this.props.header), import_react.createElement("div", {
				style: styles.body,
				className: "flexbox-fix"
			}, import_react.createElement("div", { style: styles.saturation }, import_react.createElement(Saturation, {
				hsl: this.props.hsl,
				hsv: this.props.hsv,
				pointer: PhotoshopPointerCircle$1,
				onChange: this.props.onChange
			})), import_react.createElement("div", { style: styles.hue }, import_react.createElement(Hue, {
				direction: "vertical",
				hsl: this.props.hsl,
				pointer: PhotoshopPointerCircle,
				onChange: this.props.onChange
			})), import_react.createElement("div", { style: styles.controls }, import_react.createElement("div", {
				style: styles.top,
				className: "flexbox-fix"
			}, import_react.createElement("div", { style: styles.previews }, import_react.createElement(PhotoshopPreviews, {
				rgb: this.props.rgb,
				currentColor: this.state.currentColor
			})), import_react.createElement("div", { style: styles.actions }, import_react.createElement(PhotoshopButton, {
				label: "OK",
				onClick: this.props.onAccept,
				active: true
			}), import_react.createElement(PhotoshopButton, {
				label: "Cancel",
				onClick: this.props.onCancel
			}), import_react.createElement(PhotoshopPicker, {
				onChange: this.props.onChange,
				rgb: this.props.rgb,
				hsv: this.props.hsv,
				hex: this.props.hex
			}))))));
		}
	}]);
	return Photoshop;
}(import_react.Component);
Photoshop.propTypes = {
	header: import_prop_types.default.string,
	styles: import_prop_types.default.object
};
Photoshop.defaultProps = {
	header: "Color Picker",
	styles: {}
};
var Photoshop_default = ColorWrap(Photoshop);
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/sketch/SketchFields.js
var SketchFields = function SketchFields(_ref) {
	var onChange = _ref.onChange, rgb = _ref.rgb, hsl = _ref.hsl, hex = _ref.hex, disableAlpha = _ref.disableAlpha;
	var styles = (0, import_lib.default)({
		"default": {
			fields: {
				display: "flex",
				paddingTop: "4px"
			},
			single: {
				flex: "1",
				paddingLeft: "6px"
			},
			alpha: {
				flex: "1",
				paddingLeft: "6px"
			},
			double: { flex: "2" },
			input: {
				width: "80%",
				padding: "4px 10% 3px",
				border: "none",
				boxShadow: "inset 0 0 0 1px #ccc",
				fontSize: "11px"
			},
			label: {
				display: "block",
				textAlign: "center",
				fontSize: "11px",
				color: "#222",
				paddingTop: "3px",
				paddingBottom: "4px",
				textTransform: "capitalize"
			}
		},
		"disableAlpha": { alpha: { display: "none" } }
	}, { disableAlpha });
	var handleChange = function handleChange(data, e) {
		if (data.hex) isValidHex(data.hex) && onChange({
			hex: data.hex,
			source: "hex"
		}, e);
		else if (data.r || data.g || data.b) onChange({
			r: data.r || rgb.r,
			g: data.g || rgb.g,
			b: data.b || rgb.b,
			a: rgb.a,
			source: "rgb"
		}, e);
		else if (data.a) {
			if (data.a < 0) data.a = 0;
			else if (data.a > 100) data.a = 100;
			data.a /= 100;
			onChange({
				h: hsl.h,
				s: hsl.s,
				l: hsl.l,
				a: data.a,
				source: "rgb"
			}, e);
		}
	};
	return import_react.createElement("div", {
		style: styles.fields,
		className: "flexbox-fix"
	}, import_react.createElement("div", { style: styles.double }, import_react.createElement(EditableInput, {
		style: {
			input: styles.input,
			label: styles.label
		},
		label: "hex",
		value: hex.replace("#", ""),
		onChange: handleChange
	})), import_react.createElement("div", { style: styles.single }, import_react.createElement(EditableInput, {
		style: {
			input: styles.input,
			label: styles.label
		},
		label: "r",
		value: rgb.r,
		onChange: handleChange,
		dragLabel: "true",
		dragMax: "255"
	})), import_react.createElement("div", { style: styles.single }, import_react.createElement(EditableInput, {
		style: {
			input: styles.input,
			label: styles.label
		},
		label: "g",
		value: rgb.g,
		onChange: handleChange,
		dragLabel: "true",
		dragMax: "255"
	})), import_react.createElement("div", { style: styles.single }, import_react.createElement(EditableInput, {
		style: {
			input: styles.input,
			label: styles.label
		},
		label: "b",
		value: rgb.b,
		onChange: handleChange,
		dragLabel: "true",
		dragMax: "255"
	})), import_react.createElement("div", { style: styles.alpha }, import_react.createElement(EditableInput, {
		style: {
			input: styles.input,
			label: styles.label
		},
		label: "a",
		value: Math.round(rgb.a * 100),
		onChange: handleChange,
		dragLabel: "true",
		dragMax: "100"
	})));
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/sketch/SketchPresetColors.js
var _extends$1 = Object.assign || function(target) {
	for (var i = 1; i < arguments.length; i++) {
		var source = arguments[i];
		for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
	}
	return target;
};
var SketchPresetColors = function SketchPresetColors(_ref) {
	var colors = _ref.colors, _ref$onClick = _ref.onClick, onClick = _ref$onClick === void 0 ? function() {} : _ref$onClick, onSwatchHover = _ref.onSwatchHover;
	var styles = (0, import_lib.default)({
		"default": {
			colors: {
				margin: "0 -10px",
				padding: "10px 0 0 10px",
				borderTop: "1px solid #eee",
				display: "flex",
				flexWrap: "wrap",
				position: "relative"
			},
			swatchWrap: {
				width: "16px",
				height: "16px",
				margin: "0 10px 10px 0"
			},
			swatch: {
				borderRadius: "3px",
				boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)"
			}
		},
		"no-presets": { colors: { display: "none" } }
	}, { "no-presets": !colors || !colors.length });
	var handleClick = function handleClick(hex, e) {
		onClick({
			hex,
			source: "hex"
		}, e);
	};
	return import_react.createElement("div", {
		style: styles.colors,
		className: "flexbox-fix"
	}, colors.map(function(colorObjOrString) {
		var c = typeof colorObjOrString === "string" ? { color: colorObjOrString } : colorObjOrString;
		var key = "" + c.color + (c.title || "");
		return import_react.createElement("div", {
			key,
			style: styles.swatchWrap
		}, import_react.createElement(Swatch_default, _extends$1({}, c, {
			style: styles.swatch,
			onClick: handleClick,
			onHover: onSwatchHover,
			focusStyle: { boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15), 0 0 4px " + c.color }
		})));
	}));
};
SketchPresetColors.propTypes = { colors: import_prop_types.default.arrayOf(import_prop_types.default.oneOfType([import_prop_types.default.string, import_prop_types.default.shape({
	color: import_prop_types.default.string,
	title: import_prop_types.default.string
})])).isRequired };
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/sketch/Sketch.js
var _extends = Object.assign || function(target) {
	for (var i = 1; i < arguments.length; i++) {
		var source = arguments[i];
		for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
	}
	return target;
};
var Sketch = function Sketch(_ref) {
	var width = _ref.width, rgb = _ref.rgb, hex = _ref.hex, hsv = _ref.hsv, hsl = _ref.hsl, onChange = _ref.onChange, onSwatchHover = _ref.onSwatchHover, disableAlpha = _ref.disableAlpha, presetColors = _ref.presetColors, renderers = _ref.renderers, _ref$styles = _ref.styles, passedStyles = _ref$styles === void 0 ? {} : _ref$styles, _ref$className = _ref.className, className = _ref$className === void 0 ? "" : _ref$className;
	var styles = (0, import_lib.default)(merge({
		"default": _extends({
			picker: {
				width,
				padding: "10px 10px 0",
				boxSizing: "initial",
				background: "#fff",
				borderRadius: "4px",
				boxShadow: "0 0 0 1px rgba(0,0,0,.15), 0 8px 16px rgba(0,0,0,.15)"
			},
			saturation: {
				width: "100%",
				paddingBottom: "75%",
				position: "relative",
				overflow: "hidden"
			},
			Saturation: {
				radius: "3px",
				shadow: "inset 0 0 0 1px rgba(0,0,0,.15), inset 0 0 4px rgba(0,0,0,.25)"
			},
			controls: { display: "flex" },
			sliders: {
				padding: "4px 0",
				flex: "1"
			},
			color: {
				width: "24px",
				height: "24px",
				position: "relative",
				marginTop: "4px",
				marginLeft: "4px",
				borderRadius: "3px"
			},
			activeColor: {
				absolute: "0px 0px 0px 0px",
				borderRadius: "2px",
				background: "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + rgb.a + ")",
				boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15), inset 0 0 4px rgba(0,0,0,.25)"
			},
			hue: {
				position: "relative",
				height: "10px",
				overflow: "hidden"
			},
			Hue: {
				radius: "2px",
				shadow: "inset 0 0 0 1px rgba(0,0,0,.15), inset 0 0 4px rgba(0,0,0,.25)"
			},
			alpha: {
				position: "relative",
				height: "10px",
				marginTop: "4px",
				overflow: "hidden"
			},
			Alpha: {
				radius: "2px",
				shadow: "inset 0 0 0 1px rgba(0,0,0,.15), inset 0 0 4px rgba(0,0,0,.25)"
			}
		}, passedStyles),
		"disableAlpha": {
			color: { height: "10px" },
			hue: { height: "10px" },
			alpha: { display: "none" }
		}
	}, passedStyles), { disableAlpha });
	return import_react.createElement("div", {
		style: styles.picker,
		className: "sketch-picker " + className
	}, import_react.createElement("div", { style: styles.saturation }, import_react.createElement(Saturation, {
		style: styles.Saturation,
		hsl,
		hsv,
		onChange
	})), import_react.createElement("div", {
		style: styles.controls,
		className: "flexbox-fix"
	}, import_react.createElement("div", { style: styles.sliders }, import_react.createElement("div", { style: styles.hue }, import_react.createElement(Hue, {
		style: styles.Hue,
		hsl,
		onChange
	})), import_react.createElement("div", { style: styles.alpha }, import_react.createElement(Alpha, {
		style: styles.Alpha,
		rgb,
		hsl,
		renderers,
		onChange
	}))), import_react.createElement("div", { style: styles.color }, import_react.createElement(Checkboard, null), import_react.createElement("div", { style: styles.activeColor }))), import_react.createElement(SketchFields, {
		rgb,
		hsl,
		hex,
		onChange,
		disableAlpha
	}), import_react.createElement(SketchPresetColors, {
		colors: presetColors,
		onClick: onChange,
		onSwatchHover
	}));
};
Sketch.propTypes = {
	disableAlpha: import_prop_types.default.bool,
	width: import_prop_types.default.oneOfType([import_prop_types.default.string, import_prop_types.default.number]),
	styles: import_prop_types.default.object
};
Sketch.defaultProps = {
	disableAlpha: false,
	width: 200,
	styles: {},
	presetColors: [
		"#D0021B",
		"#F5A623",
		"#F8E71C",
		"#8B572A",
		"#7ED321",
		"#417505",
		"#BD10E0",
		"#9013FE",
		"#4A90E2",
		"#50E3C2",
		"#B8E986",
		"#000000",
		"#4A4A4A",
		"#9B9B9B",
		"#FFFFFF"
	]
};
var Sketch_default = ColorWrap(Sketch);
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/slider/SliderSwatch.js
var SliderSwatch = function SliderSwatch(_ref) {
	var hsl = _ref.hsl, offset = _ref.offset, _ref$onClick = _ref.onClick, onClick = _ref$onClick === void 0 ? function() {} : _ref$onClick, active = _ref.active, first = _ref.first, last = _ref.last;
	var styles = (0, import_lib.default)({
		"default": { swatch: {
			height: "12px",
			background: "hsl(" + hsl.h + ", 50%, " + offset * 100 + "%)",
			cursor: "pointer"
		} },
		"first": { swatch: { borderRadius: "2px 0 0 2px" } },
		"last": { swatch: { borderRadius: "0 2px 2px 0" } },
		"active": { swatch: {
			transform: "scaleY(1.8)",
			borderRadius: "3.6px/2px"
		} }
	}, {
		active,
		first,
		last
	});
	return import_react.createElement("div", {
		style: styles.swatch,
		onClick: function handleClick(e) {
			return onClick({
				h: hsl.h,
				s: .5,
				l: offset,
				source: "hsl"
			}, e);
		}
	});
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/slider/SliderSwatches.js
var SliderSwatches = function SliderSwatches(_ref) {
	var onClick = _ref.onClick, hsl = _ref.hsl;
	var styles = (0, import_lib.default)({ "default": {
		swatches: { marginTop: "20px" },
		swatch: {
			boxSizing: "border-box",
			width: "20%",
			paddingRight: "1px",
			float: "left"
		},
		clear: { clear: "both" }
	} });
	var epsilon = .1;
	return import_react.createElement("div", { style: styles.swatches }, import_react.createElement("div", { style: styles.swatch }, import_react.createElement(SliderSwatch, {
		hsl,
		offset: ".80",
		active: Math.abs(hsl.l - .8) < epsilon && Math.abs(hsl.s - .5) < epsilon,
		onClick,
		first: true
	})), import_react.createElement("div", { style: styles.swatch }, import_react.createElement(SliderSwatch, {
		hsl,
		offset: ".65",
		active: Math.abs(hsl.l - .65) < epsilon && Math.abs(hsl.s - .5) < epsilon,
		onClick
	})), import_react.createElement("div", { style: styles.swatch }, import_react.createElement(SliderSwatch, {
		hsl,
		offset: ".50",
		active: Math.abs(hsl.l - .5) < epsilon && Math.abs(hsl.s - .5) < epsilon,
		onClick
	})), import_react.createElement("div", { style: styles.swatch }, import_react.createElement(SliderSwatch, {
		hsl,
		offset: ".35",
		active: Math.abs(hsl.l - .35) < epsilon && Math.abs(hsl.s - .5) < epsilon,
		onClick
	})), import_react.createElement("div", { style: styles.swatch }, import_react.createElement(SliderSwatch, {
		hsl,
		offset: ".20",
		active: Math.abs(hsl.l - .2) < epsilon && Math.abs(hsl.s - .5) < epsilon,
		onClick,
		last: true
	})), import_react.createElement("div", { style: styles.clear }));
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/slider/SliderPointer.js
var SliderPointer = function SliderPointer() {
	var styles = (0, import_lib.default)({ "default": { picker: {
		width: "14px",
		height: "14px",
		borderRadius: "6px",
		transform: "translate(-7px, -1px)",
		backgroundColor: "rgb(248, 248, 248)",
		boxShadow: "0 1px 4px 0 rgba(0, 0, 0, 0.37)"
	} } });
	return import_react.createElement("div", { style: styles.picker });
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/slider/Slider.js
var Slider = function Slider(_ref) {
	var hsl = _ref.hsl, onChange = _ref.onChange, pointer = _ref.pointer, _ref$styles = _ref.styles, passedStyles = _ref$styles === void 0 ? {} : _ref$styles, _ref$className = _ref.className, className = _ref$className === void 0 ? "" : _ref$className;
	var styles = (0, import_lib.default)(merge({ "default": {
		hue: {
			height: "12px",
			position: "relative"
		},
		Hue: { radius: "2px" }
	} }, passedStyles));
	return import_react.createElement("div", {
		style: styles.wrap || {},
		className: "slider-picker " + className
	}, import_react.createElement("div", { style: styles.hue }, import_react.createElement(Hue, {
		style: styles.Hue,
		hsl,
		pointer,
		onChange
	})), import_react.createElement("div", { style: styles.swatches }, import_react.createElement(SliderSwatches, {
		hsl,
		onClick: onChange
	})));
};
Slider.propTypes = { styles: import_prop_types.default.object };
Slider.defaultProps = {
	pointer: SliderPointer,
	styles: {}
};
var Slider_default = ColorWrap(Slider);
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/swatches/SwatchesColor.js
var import_CheckIcon = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var _extends = Object.assign || function(target) {
		for (var i = 1; i < arguments.length; i++) {
			var source = arguments[i];
			for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
		}
		return target;
	};
	var _react2 = _interopRequireDefault(require_react());
	function _interopRequireDefault(obj) {
		return obj && obj.__esModule ? obj : { default: obj };
	}
	function _objectWithoutProperties(obj, keys) {
		var target = {};
		for (var i in obj) {
			if (keys.indexOf(i) >= 0) continue;
			if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
			target[i] = obj[i];
		}
		return target;
	}
	var DEFAULT_SIZE = 24;
	exports.default = function(_ref) {
		var _ref$fill = _ref.fill, fill = _ref$fill === void 0 ? "currentColor" : _ref$fill, _ref$width = _ref.width, width = _ref$width === void 0 ? DEFAULT_SIZE : _ref$width, _ref$height = _ref.height, height = _ref$height === void 0 ? DEFAULT_SIZE : _ref$height, _ref$style = _ref.style, style = _ref$style === void 0 ? {} : _ref$style, props = _objectWithoutProperties(_ref, [
			"fill",
			"width",
			"height",
			"style"
		]);
		return _react2.default.createElement("svg", _extends({
			viewBox: "0 0 " + DEFAULT_SIZE + " " + DEFAULT_SIZE,
			style: _extends({
				fill,
				width,
				height
			}, style)
		}, props), _react2.default.createElement("path", { d: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" }));
	};
})))());
var SwatchesColor = function SwatchesColor(_ref) {
	var color = _ref.color, _ref$onClick = _ref.onClick, onClick = _ref$onClick === void 0 ? function() {} : _ref$onClick, onSwatchHover = _ref.onSwatchHover, first = _ref.first, last = _ref.last, active = _ref.active;
	var styles = (0, import_lib.default)({
		"default": {
			color: {
				width: "40px",
				height: "24px",
				cursor: "pointer",
				background: color,
				marginBottom: "1px"
			},
			check: {
				color: getContrastingColor(color),
				marginLeft: "8px",
				display: "none"
			}
		},
		"first": { color: {
			overflow: "hidden",
			borderRadius: "2px 2px 0 0"
		} },
		"last": { color: {
			overflow: "hidden",
			borderRadius: "0 0 2px 2px"
		} },
		"active": { check: { display: "block" } },
		"color-#FFFFFF": {
			color: { boxShadow: "inset 0 0 0 1px #ddd" },
			check: { color: "#333" }
		},
		"transparent": { check: { color: "#333" } }
	}, {
		first,
		last,
		active,
		"color-#FFFFFF": color === "#FFFFFF",
		"transparent": color === "transparent"
	});
	return import_react.createElement(Swatch_default, {
		color,
		style: styles.color,
		onClick,
		onHover: onSwatchHover,
		focusStyle: { boxShadow: "0 0 4px " + color }
	}, import_react.createElement("div", { style: styles.check }, import_react.createElement(import_CheckIcon.default, null)));
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/swatches/SwatchesGroup.js
var SwatchesGroup = function SwatchesGroup(_ref) {
	var onClick = _ref.onClick, onSwatchHover = _ref.onSwatchHover, group = _ref.group, active = _ref.active;
	var styles = (0, import_lib.default)({ "default": { group: {
		paddingBottom: "10px",
		width: "40px",
		float: "left",
		marginRight: "10px"
	} } });
	return import_react.createElement("div", { style: styles.group }, map(group, function(color, i) {
		return import_react.createElement(SwatchesColor, {
			key: color,
			color,
			active: color.toLowerCase() === active,
			first: i === 0,
			last: i === group.length - 1,
			onClick,
			onSwatchHover
		});
	}));
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/swatches/Swatches.js
var Swatches = function Swatches(_ref) {
	var width = _ref.width, height = _ref.height, onChange = _ref.onChange, onSwatchHover = _ref.onSwatchHover, colors = _ref.colors, hex = _ref.hex, _ref$styles = _ref.styles, passedStyles = _ref$styles === void 0 ? {} : _ref$styles, _ref$className = _ref.className, className = _ref$className === void 0 ? "" : _ref$className;
	var styles = (0, import_lib.default)(merge({ "default": {
		picker: {
			width,
			height
		},
		overflow: {
			height,
			overflowY: "scroll"
		},
		body: { padding: "16px 0 6px 16px" },
		clear: { clear: "both" }
	} }, passedStyles));
	var handleChange = function handleChange(data, e) {
		return onChange({
			hex: data,
			source: "hex"
		}, e);
	};
	return import_react.createElement("div", {
		style: styles.picker,
		className: "swatches-picker " + className
	}, import_react.createElement(Raised, null, import_react.createElement("div", { style: styles.overflow }, import_react.createElement("div", { style: styles.body }, map(colors, function(group) {
		return import_react.createElement(SwatchesGroup, {
			key: group.toString(),
			group,
			active: hex,
			onClick: handleChange,
			onSwatchHover
		});
	}), import_react.createElement("div", { style: styles.clear })))));
};
Swatches.propTypes = {
	width: import_prop_types.default.oneOfType([import_prop_types.default.string, import_prop_types.default.number]),
	height: import_prop_types.default.oneOfType([import_prop_types.default.string, import_prop_types.default.number]),
	colors: import_prop_types.default.arrayOf(import_prop_types.default.arrayOf(import_prop_types.default.string)),
	styles: import_prop_types.default.object
};
Swatches.defaultProps = {
	width: 320,
	height: 240,
	colors: [
		[
			red["900"],
			red["700"],
			red["500"],
			red["300"],
			red["100"]
		],
		[
			pink["900"],
			pink["700"],
			pink["500"],
			pink["300"],
			pink["100"]
		],
		[
			purple["900"],
			purple["700"],
			purple["500"],
			purple["300"],
			purple["100"]
		],
		[
			deepPurple["900"],
			deepPurple["700"],
			deepPurple["500"],
			deepPurple["300"],
			deepPurple["100"]
		],
		[
			indigo["900"],
			indigo["700"],
			indigo["500"],
			indigo["300"],
			indigo["100"]
		],
		[
			blue["900"],
			blue["700"],
			blue["500"],
			blue["300"],
			blue["100"]
		],
		[
			lightBlue["900"],
			lightBlue["700"],
			lightBlue["500"],
			lightBlue["300"],
			lightBlue["100"]
		],
		[
			cyan["900"],
			cyan["700"],
			cyan["500"],
			cyan["300"],
			cyan["100"]
		],
		[
			teal["900"],
			teal["700"],
			teal["500"],
			teal["300"],
			teal["100"]
		],
		[
			"#194D33",
			green["700"],
			green["500"],
			green["300"],
			green["100"]
		],
		[
			lightGreen["900"],
			lightGreen["700"],
			lightGreen["500"],
			lightGreen["300"],
			lightGreen["100"]
		],
		[
			lime["900"],
			lime["700"],
			lime["500"],
			lime["300"],
			lime["100"]
		],
		[
			yellow["900"],
			yellow["700"],
			yellow["500"],
			yellow["300"],
			yellow["100"]
		],
		[
			amber["900"],
			amber["700"],
			amber["500"],
			amber["300"],
			amber["100"]
		],
		[
			orange["900"],
			orange["700"],
			orange["500"],
			orange["300"],
			orange["100"]
		],
		[
			deepOrange["900"],
			deepOrange["700"],
			deepOrange["500"],
			deepOrange["300"],
			deepOrange["100"]
		],
		[
			brown["900"],
			brown["700"],
			brown["500"],
			brown["300"],
			brown["100"]
		],
		[
			blueGrey["900"],
			blueGrey["700"],
			blueGrey["500"],
			blueGrey["300"],
			blueGrey["100"]
		],
		[
			"#000000",
			"#525252",
			"#969696",
			"#D9D9D9",
			"#FFFFFF"
		]
	],
	styles: {}
};
var Swatches_default = ColorWrap(Swatches);
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/twitter/Twitter.js
var Twitter = function Twitter(_ref) {
	var onChange = _ref.onChange, onSwatchHover = _ref.onSwatchHover, hex = _ref.hex, colors = _ref.colors, width = _ref.width, triangle = _ref.triangle, _ref$styles = _ref.styles, passedStyles = _ref$styles === void 0 ? {} : _ref$styles, _ref$className = _ref.className, className = _ref$className === void 0 ? "" : _ref$className;
	var styles = (0, import_lib.default)(merge({
		"default": {
			card: {
				width,
				background: "#fff",
				border: "0 solid rgba(0,0,0,0.25)",
				boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
				borderRadius: "4px",
				position: "relative"
			},
			body: { padding: "15px 9px 9px 15px" },
			label: {
				fontSize: "18px",
				color: "#fff"
			},
			triangle: {
				width: "0px",
				height: "0px",
				borderStyle: "solid",
				borderWidth: "0 9px 10px 9px",
				borderColor: "transparent transparent #fff transparent",
				position: "absolute"
			},
			triangleShadow: {
				width: "0px",
				height: "0px",
				borderStyle: "solid",
				borderWidth: "0 9px 10px 9px",
				borderColor: "transparent transparent rgba(0,0,0,.1) transparent",
				position: "absolute"
			},
			hash: {
				background: "#F0F0F0",
				height: "30px",
				width: "30px",
				borderRadius: "4px 0 0 4px",
				float: "left",
				color: "#98A1A4",
				display: "flex",
				alignItems: "center",
				justifyContent: "center"
			},
			input: {
				width: "100px",
				fontSize: "14px",
				color: "#666",
				border: "0px",
				outline: "none",
				height: "28px",
				boxShadow: "inset 0 0 0 1px #F0F0F0",
				boxSizing: "content-box",
				borderRadius: "0 4px 4px 0",
				float: "left",
				paddingLeft: "8px"
			},
			swatch: {
				width: "30px",
				height: "30px",
				float: "left",
				borderRadius: "4px",
				margin: "0 6px 6px 0"
			},
			clear: { clear: "both" }
		},
		"hide-triangle": {
			triangle: { display: "none" },
			triangleShadow: { display: "none" }
		},
		"top-left-triangle": {
			triangle: {
				top: "-10px",
				left: "12px"
			},
			triangleShadow: {
				top: "-11px",
				left: "12px"
			}
		},
		"top-right-triangle": {
			triangle: {
				top: "-10px",
				right: "12px"
			},
			triangleShadow: {
				top: "-11px",
				right: "12px"
			}
		}
	}, passedStyles), {
		"hide-triangle": triangle === "hide",
		"top-left-triangle": triangle === "top-left",
		"top-right-triangle": triangle === "top-right"
	});
	var handleChange = function handleChange(hexcode, e) {
		isValidHex(hexcode) && onChange({
			hex: hexcode,
			source: "hex"
		}, e);
	};
	return import_react.createElement("div", {
		style: styles.card,
		className: "twitter-picker " + className
	}, import_react.createElement("div", { style: styles.triangleShadow }), import_react.createElement("div", { style: styles.triangle }), import_react.createElement("div", { style: styles.body }, map(colors, function(c, i) {
		return import_react.createElement(Swatch_default, {
			key: i,
			color: c,
			hex: c,
			style: styles.swatch,
			onClick: handleChange,
			onHover: onSwatchHover,
			focusStyle: { boxShadow: "0 0 4px " + c }
		});
	}), import_react.createElement("div", { style: styles.hash }, "#"), import_react.createElement(EditableInput, {
		label: null,
		style: { input: styles.input },
		value: hex.replace("#", ""),
		onChange: handleChange
	}), import_react.createElement("div", { style: styles.clear })));
};
Twitter.propTypes = {
	width: import_prop_types.default.oneOfType([import_prop_types.default.string, import_prop_types.default.number]),
	triangle: import_prop_types.default.oneOf([
		"hide",
		"top-left",
		"top-right"
	]),
	colors: import_prop_types.default.arrayOf(import_prop_types.default.string),
	styles: import_prop_types.default.object
};
Twitter.defaultProps = {
	width: 276,
	colors: [
		"#FF6900",
		"#FCB900",
		"#7BDCB5",
		"#00D084",
		"#8ED1FC",
		"#0693E3",
		"#ABB8C3",
		"#EB144C",
		"#F78DA7",
		"#9900EF"
	],
	triangle: "top-left",
	styles: {}
};
var Twitter_default = ColorWrap(Twitter);
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/google/GooglePointerCircle.js
var GooglePointerCircle = function GooglePointerCircle(props) {
	var styles = (0, import_lib.default)({ "default": { picker: {
		width: "20px",
		height: "20px",
		borderRadius: "22px",
		border: "2px #fff solid",
		transform: "translate(-12px, -13px)",
		background: "hsl(" + Math.round(props.hsl.h) + ", " + Math.round(props.hsl.s * 100) + "%, " + Math.round(props.hsl.l * 100) + "%)"
	} } });
	return import_react.createElement("div", { style: styles.picker });
};
GooglePointerCircle.propTypes = { hsl: import_prop_types.default.shape({
	h: import_prop_types.default.number,
	s: import_prop_types.default.number,
	l: import_prop_types.default.number,
	a: import_prop_types.default.number
}) };
GooglePointerCircle.defaultProps = { hsl: {
	a: 1,
	h: 249.94,
	l: .2,
	s: .5
} };
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/google/GooglePointer.js
var GooglePointer = function GooglePointer(props) {
	var styles = (0, import_lib.default)({ "default": { picker: {
		width: "20px",
		height: "20px",
		borderRadius: "22px",
		transform: "translate(-10px, -7px)",
		background: "hsl(" + Math.round(props.hsl.h) + ", 100%, 50%)",
		border: "2px white solid"
	} } });
	return import_react.createElement("div", { style: styles.picker });
};
GooglePointer.propTypes = { hsl: import_prop_types.default.shape({
	h: import_prop_types.default.number,
	s: import_prop_types.default.number,
	l: import_prop_types.default.number,
	a: import_prop_types.default.number
}) };
GooglePointer.defaultProps = { hsl: {
	a: 1,
	h: 249.94,
	l: .2,
	s: .5
} };
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/google/GoogleFields.js
var GoogleFields = function GoogleFields(_ref) {
	var onChange = _ref.onChange, rgb = _ref.rgb, hsl = _ref.hsl, hex = _ref.hex, hsv = _ref.hsv;
	var handleChange = function handleChange(data, e) {
		if (data.hex) isValidHex(data.hex) && onChange({
			hex: data.hex,
			source: "hex"
		}, e);
		else if (data.rgb) {
			var values = data.rgb.split(",");
			isvalidColorString(data.rgb, "rgb") && onChange({
				r: values[0],
				g: values[1],
				b: values[2],
				a: 1,
				source: "rgb"
			}, e);
		} else if (data.hsv) {
			var _values = data.hsv.split(",");
			if (isvalidColorString(data.hsv, "hsv")) {
				_values[2] = _values[2].replace("%", "");
				_values[1] = _values[1].replace("%", "");
				_values[0] = _values[0].replace("°", "");
				if (_values[1] == 1) _values[1] = .01;
				else if (_values[2] == 1) _values[2] = .01;
				onChange({
					h: Number(_values[0]),
					s: Number(_values[1]),
					v: Number(_values[2]),
					source: "hsv"
				}, e);
			}
		} else if (data.hsl) {
			var _values2 = data.hsl.split(",");
			if (isvalidColorString(data.hsl, "hsl")) {
				_values2[2] = _values2[2].replace("%", "");
				_values2[1] = _values2[1].replace("%", "");
				_values2[0] = _values2[0].replace("°", "");
				if (hsvValue[1] == 1) hsvValue[1] = .01;
				else if (hsvValue[2] == 1) hsvValue[2] = .01;
				onChange({
					h: Number(_values2[0]),
					s: Number(_values2[1]),
					v: Number(_values2[2]),
					source: "hsl"
				}, e);
			}
		}
	};
	var styles = (0, import_lib.default)({ "default": {
		wrap: {
			display: "flex",
			height: "100px",
			marginTop: "4px"
		},
		fields: { width: "100%" },
		column: {
			paddingTop: "10px",
			display: "flex",
			justifyContent: "space-between"
		},
		double: {
			padding: "0px 4.4px",
			boxSizing: "border-box"
		},
		input: {
			width: "100%",
			height: "38px",
			boxSizing: "border-box",
			padding: "4px 10% 3px",
			textAlign: "center",
			border: "1px solid #dadce0",
			fontSize: "11px",
			textTransform: "lowercase",
			borderRadius: "5px",
			outline: "none",
			fontFamily: "Roboto,Arial,sans-serif"
		},
		input2: {
			height: "38px",
			width: "100%",
			border: "1px solid #dadce0",
			boxSizing: "border-box",
			fontSize: "11px",
			textTransform: "lowercase",
			borderRadius: "5px",
			outline: "none",
			paddingLeft: "10px",
			fontFamily: "Roboto,Arial,sans-serif"
		},
		label: {
			textAlign: "center",
			fontSize: "12px",
			background: "#fff",
			position: "absolute",
			textTransform: "uppercase",
			color: "#3c4043",
			width: "35px",
			top: "-6px",
			left: "0",
			right: "0",
			marginLeft: "auto",
			marginRight: "auto",
			fontFamily: "Roboto,Arial,sans-serif"
		},
		label2: {
			left: "10px",
			textAlign: "center",
			fontSize: "12px",
			background: "#fff",
			position: "absolute",
			textTransform: "uppercase",
			color: "#3c4043",
			width: "32px",
			top: "-6px",
			fontFamily: "Roboto,Arial,sans-serif"
		},
		single: {
			flexGrow: "1",
			margin: "0px 4.4px"
		}
	} });
	var rgbValue = rgb.r + ", " + rgb.g + ", " + rgb.b;
	var hslValue = Math.round(hsl.h) + "°, " + Math.round(hsl.s * 100) + "%, " + Math.round(hsl.l * 100) + "%";
	var hsvValue = Math.round(hsv.h) + "°, " + Math.round(hsv.s * 100) + "%, " + Math.round(hsv.v * 100) + "%";
	return import_react.createElement("div", {
		style: styles.wrap,
		className: "flexbox-fix"
	}, import_react.createElement("div", { style: styles.fields }, import_react.createElement("div", { style: styles.double }, import_react.createElement(EditableInput, {
		style: {
			input: styles.input,
			label: styles.label
		},
		label: "hex",
		value: hex,
		onChange: handleChange
	})), import_react.createElement("div", { style: styles.column }, import_react.createElement("div", { style: styles.single }, import_react.createElement(EditableInput, {
		style: {
			input: styles.input2,
			label: styles.label2
		},
		label: "rgb",
		value: rgbValue,
		onChange: handleChange
	})), import_react.createElement("div", { style: styles.single }, import_react.createElement(EditableInput, {
		style: {
			input: styles.input2,
			label: styles.label2
		},
		label: "hsv",
		value: hsvValue,
		onChange: handleChange
	})), import_react.createElement("div", { style: styles.single }, import_react.createElement(EditableInput, {
		style: {
			input: styles.input2,
			label: styles.label2
		},
		label: "hsl",
		value: hslValue,
		onChange: handleChange
	})))));
};
//#endregion
//#region node_modules/.pnpm/react-color@2.19.3_react@19.2.0/node_modules/react-color/es/components/google/Google.js
var Google = function Google(_ref) {
	var width = _ref.width, onChange = _ref.onChange, rgb = _ref.rgb, hsl = _ref.hsl, hsv = _ref.hsv, hex = _ref.hex, header = _ref.header, _ref$styles = _ref.styles, passedStyles = _ref$styles === void 0 ? {} : _ref$styles, _ref$className = _ref.className, className = _ref$className === void 0 ? "" : _ref$className;
	var styles = (0, import_lib.default)(merge({ "default": {
		picker: {
			width,
			background: "#fff",
			border: "1px solid #dfe1e5",
			boxSizing: "initial",
			display: "flex",
			flexWrap: "wrap",
			borderRadius: "8px 8px 0px 0px"
		},
		head: {
			height: "57px",
			width: "100%",
			paddingTop: "16px",
			paddingBottom: "16px",
			paddingLeft: "16px",
			fontSize: "20px",
			boxSizing: "border-box",
			fontFamily: "Roboto-Regular,HelveticaNeue,Arial,sans-serif"
		},
		saturation: {
			width: "70%",
			padding: "0px",
			position: "relative",
			overflow: "hidden"
		},
		swatch: {
			width: "30%",
			height: "228px",
			padding: "0px",
			background: "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", 1)",
			position: "relative",
			overflow: "hidden"
		},
		body: {
			margin: "auto",
			width: "95%"
		},
		controls: {
			display: "flex",
			boxSizing: "border-box",
			height: "52px",
			paddingTop: "22px"
		},
		color: { width: "32px" },
		hue: {
			height: "8px",
			position: "relative",
			margin: "0px 16px 0px 16px",
			width: "100%"
		},
		Hue: { radius: "2px" }
	} }, passedStyles));
	return import_react.createElement("div", {
		style: styles.picker,
		className: "google-picker " + className
	}, import_react.createElement("div", { style: styles.head }, header), import_react.createElement("div", { style: styles.swatch }), import_react.createElement("div", { style: styles.saturation }, import_react.createElement(Saturation, {
		hsl,
		hsv,
		pointer: GooglePointerCircle,
		onChange
	})), import_react.createElement("div", { style: styles.body }, import_react.createElement("div", {
		style: styles.controls,
		className: "flexbox-fix"
	}, import_react.createElement("div", { style: styles.hue }, import_react.createElement(Hue, {
		style: styles.Hue,
		hsl,
		radius: "4px",
		pointer: GooglePointer,
		onChange
	}))), import_react.createElement(GoogleFields, {
		rgb,
		hsl,
		hex,
		hsv,
		onChange
	})));
};
Google.propTypes = {
	width: import_prop_types.default.oneOfType([import_prop_types.default.string, import_prop_types.default.number]),
	styles: import_prop_types.default.object,
	header: import_prop_types.default.string
};
Google.defaultProps = {
	width: 652,
	styles: {},
	header: "Color picker"
};
var Google_default = ColorWrap(Google);
//#endregion
export { Alpha_default as AlphaPicker, Block_default as BlockPicker, Chrome_default as ChromePicker, Chrome_default as default, Circle_default as CirclePicker, Compact_default as CompactPicker, ColorWrap as CustomPicker, Github_default as GithubPicker, Google_default as GooglePicker, Hue_default as HuePicker, Material_default as MaterialPicker, Photoshop_default as PhotoshopPicker, Sketch_default as SketchPicker, Slider_default as SliderPicker, Swatches_default as SwatchesPicker, Twitter_default as TwitterPicker };

//# sourceMappingURL=react-color.js.map