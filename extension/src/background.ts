chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: 'context-menu-clicked',
		title: 'Mindapp (Alt m)',
		contexts: ['all'],
	});
});

chrome.action.onClicked.addListener((tab) => {
	if (typeof tab.id === 'number') {
		// Works on pdf pages. document.title is blank tho
		// https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
		chrome.tabs.sendMessage(tab.id, { type: 'extension-icon-clicked' });
	}
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId === 'context-menu-clicked' && typeof tab?.id === 'number') {
		chrome.tabs.sendMessage(tab.id, { type: 'context-menu-clicked' });
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
