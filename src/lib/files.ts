import fs from 'fs';
import path from 'path';
import { simpleHash } from './js';

export const penFile = (filePath: string, json: string) => {
	fs.writeFileSync(filePath, json);
};

export const penObjectFile = (filePath: string, obj: object, format = true) => {
	penFile(filePath, JSON.stringify(obj, null, format ? 2 : 0));
};

export const parseFile = <T>(filePath: string) => {
	return JSON.parse(fs.readFileSync(filePath).toString()) as T;
};

export const mkdirIfDne = (dirPath: string) => {
	if (!isDirectory(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
		return true;
	}
	return false;
};

export const touchIfDne = (filePath: string, fileContent: string) => {
	const dirPath = path.dirname(filePath);
	mkdirIfDne(dirPath);
	if (!isFile(filePath)) {
		penFile(filePath, fileContent);
		return true;
	}
	return false;
};

export function isFile(path: string) {
	try {
		return fs.statSync(path).isFile();
	} catch (error) {}
	return false;
}

export function isDirectory(path: string) {
	try {
		return fs.statSync(path).isDirectory();
	} catch (error) {}
	return false;
}

export const deleteFile = (path: string, cb: fs.NoParamCallback = () => {}) => {
	try {
		if (isFile(path)) {
			fs.unlink(path, cb);
		} else {
			console.error(`File path does not exist: ${path}`);
		}
	} catch (error) {
		console.error(`Error deleting file path: ${path}`, error);
	}
};

// https://www.perplexity.ai/search/lossless-js-function-to-make-s-xF7XpGNIS9qocsuebEQcEQ
export function toFileNameSafe(fileName: string): string {
	if (fileName.length > 33) {
		fileName = `${fileName.slice(0, 33)}-${simpleHash(fileName)}`;
	}
	const illegalChars = /[<>:"/\\|?*]/g;
	const reservedNames = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

	// Replace illegal characters with Unicode lookalikes
	const safeFileName = fileName.replace(illegalChars, (char) => {
		const replacements: Record<string, string> = {
			'<': '＜',
			'>': '＞',
			':': '：',
			'"': '＂',
			'/': '／',
			'\\': '＼',
			'|': '｜',
			'?': '？',
			'*': '＊',
		};
		return replacements[char] || char;
	});

	// Handle reserved names
	const processedFileName = reservedNames.test(safeFileName) ? `_${safeFileName}` : safeFileName;

	// Remove trailing spaces and periods
	return processedFileName.replace(/[. ]+$/, '');
}
