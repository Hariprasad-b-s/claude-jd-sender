// Background service worker — handles opening Claude chat in a popup window

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openClaudeChat') {
    chrome.storage.sync.get(['claudeChatUrl'], (result) => {
      const url = result.claudeChatUrl;
      if (url) {
        // Open as a small popup window instead of a full tab
        chrome.windows.create(
          {
            url: url,
            type: 'popup',
            width: 650,
            height: 750,
            focused: true
          },
          (win) => {
            sendResponse({ success: true, windowId: win.id });
          }
        );
      } else {
        sendResponse({ success: false, error: 'No Claude chat URL configured' });
      }
    });
    return true; // keep message channel open for async response
  }
});
