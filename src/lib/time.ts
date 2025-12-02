import { m } from './paraglide/messages';

export let second = 1000;
export let minute = 60 * second;
export let hour = 60 * minute;
export let day = 24 * hour;
export let week = 7 * day;
export let month = 30 * day;
export let year = 365 * day;

let toLocalISOString = (date: Date) => {
	let offset = date.getTimezoneOffset();
	let iso = new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, -1);
	return `${iso}${offset > 0 ? '-' : '+'}${Math.floor(Math.abs(offset) / 60)
		.toString()
		.padStart(2, '0')}:${(Math.abs(offset) % 60).toString().padStart(2, '0')}`;
};

let pad = (n: number) => n.toString().padStart(2, '0');

export let formatMs = (ms: number, iso = false) => {
	let now = Date.now();
	let diff = now - ms;
	if (iso) return toLocalISOString(new Date(ms));

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
	return abs < year ? `${mm}/${dd} ${hh}:${min}` : `${yyyy}/${mm}/${dd}`;
};
