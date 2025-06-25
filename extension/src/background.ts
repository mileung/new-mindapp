chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: 'save',
		title: 'Mindapp',
		contexts: ['all'],
	});
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
	// TODO: make it work on pdf pages
	// https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
	if (info.menuItemId === 'save' && tab?.id) {
		chrome.tabs.sendMessage(tab.id, { type: 'save' });
	}
});
