export const second = 1000;
export const minute = 60 * second;
export const hour = 60 * minute;
export const day = 24 * hour;
export const week = 7 * day;
export const month = 30 * day;
export const year = 365 * day;

export function formatMs(ms: number, verbose = false, granular = false): string {
	const now = Date.now();
	const timeDiff = now - ms;
	if (!verbose) {
		if (timeDiff < minute) {
			return '<1m';
		} else if (timeDiff < hour) {
			const minutesAgo = Math.floor(timeDiff / minute);
			return `${minutesAgo}m`;
		} else if (timeDiff < day) {
			const hoursAgo = Math.floor(timeDiff / hour);
			return `${hoursAgo}h`;
		} else if (timeDiff <= week) {
			const daysAgo = Math.floor(timeDiff / day);
			return `${daysAgo}d`;
		}
	}
	const date = new Date(ms);
	const years = date.getFullYear();
	const months = String(date.getMonth() + 1).padStart(2, '0');
	const days = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	if (verbose && granular) {
		const seconds = String(date.getSeconds()).padStart(2, '0');
		const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
		return `${years}-${months}-${days} ${hours}:${minutes}:${seconds}.${milliseconds}`;
	}
	return `${years}-${months}-${days} ${hours}:${minutes}`;
}
