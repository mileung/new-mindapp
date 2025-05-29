const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export function isValidEmail(email: string) {
	return emailRegex.test(email);
}

// Omits 0, O, I, and l for readability
const base58Chars = '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
export const randomBase58 = (length = 10) => {
	let str = '';
	for (let i = 0; i < length; i++) {
		str += base58Chars[Math.floor(Math.random() * base58Chars.length)];
	}
	return str;
};
