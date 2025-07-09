export let suppressScrollbarFlash = () => {
	document.documentElement.classList.add('scrollbar-hidden');
	setTimeout(() => {
		document.documentElement.classList.remove('scrollbar-hidden');
	}, 0);
};

export let scrollToBottom = () => {
	document.documentElement.classList.add('scrollbar-hidden');
	setTimeout(() => {
		window.scrollTo(0, document.body.scrollHeight);
		document.documentElement.classList.remove('scrollbar-hidden');
	}, 0);
};
