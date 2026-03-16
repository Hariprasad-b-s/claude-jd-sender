// Background service worker — handles opening/focusing AI chat windows

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openClaudeChat') {
    handleOpenChat('claude', 'https://claude.ai/new', sendResponse);
    return true; // keep message channel open for async response
  } else if (message.action === 'openChatGPT') {
    handleOpenChat('chatgpt', 'https://chatgpt.com/?model=auto', sendResponse);
    return true;
  } else if (message.action === 'openGemini') {
    // Gemini handles new requests well on its base URL, but we can also use /app
    handleOpenChat('gemini', 'https://gemini.google.com/app', sendResponse);
    return true;
  }
});

function handleOpenChat(platform, defaultUrl, sendResponse) {
  const storageKey = platform === 'claude' ? 'claudeChatUrl' : 
                     platform === 'chatgpt' ? 'chatGptUrl' : 'geminiUrl';

  chrome.storage.sync.get([storageKey], (result) => {
    const targetUrl = result[storageKey] || defaultUrl;
    
    // We want to match the exact URL, not just the domain.
    // chrome.tabs.query allows exact URL matching if we pass the full string.
    chrome.tabs.query({ url: targetUrl }, (tabs) => {
      
      // If exact match fails and it's gemini/chatgpt, maybe try a looser match just in case?
      // For now, adhere strictly to the user's configured exact URL as requested.
      if (tabs && tabs.length > 0) {
        // Find the most recently active or just the first one
        const targetTab = tabs[0];
        
        // Focus the window and the tab
        chrome.windows.update(targetTab.windowId, { focused: true }, () => {
          chrome.tabs.update(targetTab.id, { active: true }, () => {
            sendResponse({ success: true, tabId: targetTab.id, reused: true });
          });
        });
      } else {
        // No exact existing tab found, open a new window with that exact URL
        openNewWindow(targetUrl, sendResponse);
      }
    });
  });
}

function openNewWindow(url, sendResponse) {
  chrome.windows.create(
    {
      url: url,
      type: 'popup',
      width: 650,
      height: 750,
      focused: true
    },
    (win) => {
      sendResponse({ success: true, windowId: win.id, reused: false });
    }
  );
}

// Removed getPlatformMatchPattern as we do exact URL matching now.
