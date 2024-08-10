chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (
    message.action === "enableCopying" ||
    message.action === "disableCopying"
  ) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: message.action });
    });
  }
});
