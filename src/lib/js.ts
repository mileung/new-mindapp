import { toUpperCase } from 'zod/v4';
import { minute, second } from './time';

export function sortObjectProps(obj: Record<string, any>): Record<string, any> {
	// Check if the input is an object and not null
	if (obj !== null && typeof obj === 'object') {
		// Sort the keys of the object
		Object.keys(obj)
			.sort()
			.forEach((key) => {
				let temp = obj[key];
				delete obj[key]; // Remove the original key-value pair
				// Recursively sort if the value is an object
				obj[key] = typeof temp === 'object' && temp !== null ? sortObjectProps(temp) : temp; // Assign sorted value or original value
			});
	}
	return obj; // Return the sorted object
}

export function kebabToCamel(str: string): string {
	return str
		.split('-')
		.map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
		.join('');
}

export function toFilename(input: string): string {
	if (input[0] === '/') return `_${input.slice(1)}.webp`;
	try {
		let url = new URL(input.toLowerCase());
		let prettyUrl = url.host + url.pathname.replace(/\/$/, '');
		return prettyUrl.replace(/[^a-z0-9._-]/g, '_') + '.webp';
	} catch (error) {
		throw new Error(`Invalid URL format: ${error}`);
	}
}

export let hasForeignLang = (route?: string) => route?.length === 2 || route?.[2] === '/';

export let post = (body: object) => ({
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(body),
});

export function copyToClipboard(text: string): void {
	if (navigator?.clipboard?.writeText) {
		navigator.clipboard
			.writeText(text)
			.then(() => true)
			.catch(() => false);
	} else {
		let textArea = document.createElement('textarea');
		textArea.value = text;
		document.body.appendChild(textArea);
		textArea.select();
		let success = document.execCommand('copy');
		document.body.removeChild(textArea);
		Promise.resolve(success);
	}
}

// https://www.perplexity.ai/search/does-js-have-a-built-in-hashin-GruXnPyrTbmSd_xoP0lrFg
export function simpleHash(string: string) {
	let hash = 5381; // Prime number as initial value
	for (let i = 0; i < string.length; i++) {
		let char = string.charCodeAt(i);
		hash = (hash << 5) + hash + char; // 33 * hash + char
		hash = hash & 0x7fffffff; // Keep it positive and within 31 bits
	}
	return hash.toString(36);
}

export function poll(
	callback: () => any,
	initialInterval: number = second,
	incrementFunction: (currentInterval: number) => number = (n) => n * 1.5,
	maxInterval: number = minute,
) {
	let currentInterval = initialInterval;
	let executePoll = async () => {
		if (await callback()) return;
		currentInterval = Math.min(maxInterval, incrementFunction(currentInterval));
		setTimeout(executePoll, currentInterval);
	};
	setTimeout(executePoll, currentInterval);
}

export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number = 400,
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout | null = null;
	return function (this: any, ...args: Parameters<T>): void {
		let context = this;
		let later = function () {
			timeout = null;
			func.apply(context, args);
		};
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

export let throttle = <T extends unknown[]>(callback: (...args: T) => void, delay: number) => {
	let isWaiting = false;
	return (...args: T) => {
		if (isWaiting) return;
		callback(...args);
		isWaiting = true;
		setTimeout(() => (isWaiting = false), delay);
	};
};

export function isRecord(value: unknown) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringifiedRecord(value?: string) {
	try {
		return isRecord(JSON.parse(value!));
	} catch (e) {}
	return false;
}

export let sortUniArr = (a: string[]) => {
	return [...new Set(a)].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
};

export function clone<T>(obj: T): T {
	if (obj === null || obj === undefined) {
		return obj;
	}
	if (Array.isArray(obj)) {
		return obj.map((item) => clone(item)) as unknown as T;
	}
	if (typeof obj === 'object') {
		return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, clone(value)])) as T;
	}
	return obj;
}

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

export function identikana(input: string | number, romanized = true): string {
	// input = '' + Math.random();
	let str = String(input);
	let hash = 5381;
	for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;

	let seq: string[] = [];
	for (let i = 0; i < 3; i++) {
		let seed = ((hash ^ (i * 2654435761)) >>> 0) * 1103515245 + 12345;
		let kana = KATAKANA[(seed >>> 0) % KATAKANA.length];
		seq.push(kana);
		hash = seed >>> 0;
	}

	if (!romanized) return seq.join('');
	return seq
		.map((k, i) => (!i ? ROMAJI_MAP[k][0].toUpperCase() + ROMAJI_MAP[k].slice(1) : ROMAJI_MAP[k]))
		.join('');
}
