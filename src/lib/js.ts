import { browser } from '$app/environment';
import { m } from './paraglide/messages';
import { minute, second } from './time';

export let isTouchScreen = browser ? 'ontouchstart' in window || !!navigator.maxTouchPoints : false;

export let copyToClipboard = (text: string) => {
	if (navigator?.clipboard?.writeText) {
		navigator.clipboard.writeText(text);
	} else {
		let textArea = document.createElement('textarea');
		textArea.value = text;
		document.body.appendChild(textArea);
		textArea.select();
		let success = document.execCommand('copy');
		document.body.removeChild(textArea);
		Promise.resolve(success);
	}
};

export let poll = (
	callback: () => any,
	initialInterval: number = second,
	incrementFunction: (currentInterval: number) => number = (n) => n * 1.5,
	maxInterval: number = minute,
) => {
	let currentInterval = initialInterval;
	let executePoll = async () => {
		if (await callback()) return;
		currentInterval = Math.min(maxInterval, incrementFunction(currentInterval));
		setTimeout(executePoll, currentInterval);
	};
	setTimeout(executePoll, currentInterval);
};

export let debounce = <T extends (...args: any[]) => any>(
	func: T,
	wait: number = 400,
): ((...args: Parameters<T>) => void) => {
	let timeout: NodeJS.Timeout | null = null;
	return function (this: any, ...args: Parameters<T>): void {
		let context = this;
		let later = () => {
			timeout = null;
			func.apply(context, args);
		};
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
};

export let throttle = <T extends unknown[]>(callback: (...args: T) => void, delay: number) => {
	let isWaiting = false;
	return (...args: T) => {
		if (isWaiting) return;
		callback(...args);
		isWaiting = true;
		setTimeout(() => (isWaiting = false), delay);
	};
};

export let isRecord = (value: unknown) =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export let isStringifiedRecord = (value?: string) => {
	try {
		return isRecord(JSON.parse(value!));
	} catch (e) {}
	return false;
};

// prettier-ignore
let KATAKANA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";

// prettier-ignore
let ROMAJI_MAP: Record<string, string> = {
  ア: "a", イ: "i", ウ: "u", エ: "e", オ: "o",
  カ: "ka", キ: "ki", ク: "ku", ケ: "ke", コ: "ko",
  サ: "sa", シ: "shi", ス: "su", セ: "se", ソ: "so",
  タ: "ta", チ: "chi", ツ: "tsu", テ: "te", ト: "to",
  ナ: "na", ニ: "ni", ヌ: "nu", ネ: "ne", ノ: "no",
  ハ: "ha", ヒ: "hi", フ: "fu", ヘ: "he", ホ: "ho",
  マ: "ma", ミ: "mi", ム: "mu", メ: "me", モ: "mo",
  ヤ: "ya", ユ: "yu", ヨ: "yo",
  ラ: "ra", リ: "ri", ル: "ru", レ: "re", ロ: "ro",
  ワ: "wa", ヲ: "wo", ン: "n"
};

let getSeededRandom = (input: string | number, index: number) => {
	let str = String(input) + index;
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
	}
	hash ^= hash >>> 16;
	hash *= 0x85ebca6b;
	hash ^= hash >>> 13;
	hash *= 0xc2b2ae35;
	hash ^= hash >>> 16;
	return hash >>> 0;
};

export let identikana = (input: number, romanized = true) => {
	if (!input) return m.anon();
	let seq: string[] = [];
	for (let i = 0; i < 3; i++) {
		let seed = getSeededRandom(input, i);
		let idx = Math.floor((seed / 0x100000000) * KATAKANA.length);
		seq.push(KATAKANA[idx]);
	}

	if (!romanized) return seq.join('');
	return seq
		.map((k, i) => (!i ? ROMAJI_MAP[k][0].toUpperCase() + ROMAJI_MAP[k].slice(1) : ROMAJI_MAP[k]))
		.join('');
};

export let isStrInt = (s: string) => /^\d+$/.test(s);

let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export let ranStr = (length = 88) =>
	[...Array(length)].map((_) => chars[Math.floor(Math.random() * chars.length)]).join('');

export let sortObjectProps = (obj: Record<string, any>) => {
	Object.keys(obj)
		.sort()
		.forEach((key) => {
			const temp = obj[key];
			delete obj[key];
			obj[key] = temp;
		});
	return obj;
};

export let ranInt = (a: number, b: number) => {
	const min = Math.min(a, b);
	const max = Math.max(a, b);
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

export let supportsCredentiallessIframe =
	typeof HTMLIFrameElement !== 'undefined' && //
	'credentialless' in HTMLIFrameElement.prototype;

export let deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj)) as T;

type UniqueValues<T extends Record<string, number>> = {
	[K in keyof T]: T[K] extends T[Exclude<keyof T, K>] ? never : T[K];
};
export let uniqueMapVals = <const T extends Record<string, number>>(dict: UniqueValues<T>): T =>
	dict;
