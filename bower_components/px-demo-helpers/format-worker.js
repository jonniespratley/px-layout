window.onmessage = function (event) {
	importScripts('<path>/highlight.pack.js');
	var result = self.hljs.highlightAuto(event.data);
	window.postMessage(result.value);
	console.log('format-worker.js', 'onmessage', event);
};
