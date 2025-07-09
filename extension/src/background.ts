chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: 'save-thought',
		title: 'Mindapp (Alt m)',
		contexts: ['all'],
	});
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
	// TODO: make it work on pdf pages
	// https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
	if (info.menuItemId === 'save-thought' && tab?.id) {
		chrome.tabs.sendMessage(tab.id, { type: 'save-thought' });
	}
});

type PopupData = {
	body?: string;
	tags?: string[];
};
export type PopupMessage = {
	type: 'init-popup' | 'mindapp-open';
	data: PopupData;
};

let popupData: undefined | PopupData;

chrome.runtime.onMessage.addListener((message: PopupMessage, sender, sendResponse) => {
	if (message.type === 'init-popup') {
		console.log('Save message received:', message.data);
		popupData = message.data;
	}
	if (message.type === 'mindapp-open') {
		sendResponse({ data: popupData });
		popupData = undefined;
	}
});
