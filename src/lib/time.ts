import { m } from './paraglide/messages';

export let second = 1000;
export let minute = 60 * second;
export let hour = 60 * minute;
export let day = 24 * hour;
export let week = 7 * day;
export let month = 30 * day;
export let year = 365 * day;

let pad = (n: number) => n.toString().padStart(2, '0');

export let formatMs = (ms: number, downToThe?: '' | 'ms' | 'min' | 'day') => {
	let now = Date.now();
	let diff = now - ms;
	if (downToThe) {
		let date = new Date(ms);
		let yyyy = date.getFullYear();
		let mm = pad(date.getMonth() + 1);
		let dd = pad(date.getDate());
		if (downToThe === 'day') {
			return `${yyyy}-${mm}-${dd}`;
		}
		let hh = pad(date.getHours());
		let min = pad(date.getMinutes());
		if (downToThe === 'ms') {
			let ss = pad(date.getSeconds());
			let mss = ms.toString().slice(-3).padStart(3, '0');
			return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}.${mss}`;
		} else if (downToThe === 'min') {
			return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
		}
	}
	let abs = Math.abs(diff);
	if (abs < minute) return m.lessThanMinAgo();
	if (abs < hour) return m.timeAgoMinutes({ count: Math.floor(abs / minute) });
	if (abs < day) return m.timeAgoHours({ count: Math.floor(abs / hour) });
	if (abs < week) return m.timeAgoDays({ count: Math.floor(abs / day) });
	let date = new Date(ms);
	let yyyy = date.getFullYear();
	let mm = pad(date.getMonth() + 1);
	let dd = pad(date.getDate());
	let hh = pad(date.getHours());
	let min = pad(date.getMinutes());
	return abs < year ? `${mm}-${dd} ${hh}:${min}` : `${yyyy}-${mm}-${dd}`;
};
