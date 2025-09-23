chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: 'context-menu-saves-thought',
		title: 'Mindapp (Alt m)',
		contexts: ['all'],
	});
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
	// TODO: make it work on pdf pages
	// https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
	if (info.menuItemId === 'context-menu-saves-thought' && tab?.id) {
		chrome.tabs.sendMessage(tab.id, { type: 'context-menu-saves-thought' });
	}
});

export type PopupMessage = {
	type:
		| '1-content-amd-background-scripts-save-page-info'
		| '3-content-script-retrieves-saved-page-info';
	url: string;
	externalDomString: string;
	selectedPlainText?: string;
	selectedHtmlString?: string;
};

let url: undefined | string;
let externalDomString: undefined | string;
let selectedPlainText: undefined | string;
let selectedHtmlString: undefined | string;

chrome.runtime.onMessage.addListener((message: PopupMessage, sender, sendResponse) => {
	if (message.type === '1-content-amd-background-scripts-save-page-info') {
		url = message.url;
		externalDomString = message.externalDomString;
		selectedPlainText = message.selectedPlainText;
		selectedHtmlString = message.selectedHtmlString;
	}
	if (message.type === '3-content-script-retrieves-saved-page-info') {
		sendResponse({ url, externalDomString, selectedPlainText, selectedHtmlString });
		url = undefined;
		externalDomString = undefined;
		selectedPlainText = undefined;
		selectedHtmlString = undefined;
	}
});
