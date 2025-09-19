export const bracketRegex = /\[([^\[\]]+)]/g;
export function getTags(input?: string) {
	return (input?.match(bracketRegex) || []).map((match) => match.slice(1, -1));
}
