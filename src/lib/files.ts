export async function exportTextAsFile(filename: string, text: string) {
	const url = URL.createObjectURL(new Blob([text]));
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
