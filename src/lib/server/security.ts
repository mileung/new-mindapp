import { base64urlnopad } from '@scure/base';
import crypto from 'crypto';

export type Item = string | Record<string, any> | any[];

export function encrypt(obj: object, password: string) {
	const iv = crypto.randomBytes(16);
	// Correct key derivation: get 32 bytes (not base64!) from SHA-256
	const key = crypto.createHash('sha256').update(String(password)).digest().subarray(0, 32);
	const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
	let encrypted = cipher.update(JSON.stringify(obj), 'utf8');
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	return `${base64urlnopad.encode(iv)}:${base64urlnopad.encode(encrypted)}`;
}

export function decrypt(encrypted: string, password: string) {
	const [iv, encryptedText] = encrypted.split(':');
	const key = crypto.createHash('sha256').update(String(password)).digest().subarray(0, 32);
	const decipher = crypto.createDecipheriv('aes-256-ctr', key, base64urlnopad.decode(iv));
	const decrypted = Buffer.concat([
		decipher.update(base64urlnopad.decode(encryptedText)),
		decipher.final(),
	]);
	try {
		return JSON.parse(decrypted.toString('utf8'));
	} catch (error) {
		return;
	}
}

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export function isValidEmail(email: string) {
	return emailRegex.test(email);
}

// Omits 0, O, I, and l for readability
const base58Chars = '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
export const randomBase58 = (length = 50) => {
	let str = '';
	for (let i = 0; i < length; i++) {
		str += base58Chars[Math.floor(Math.random() * base58Chars.length)];
	}
	return str;
};
