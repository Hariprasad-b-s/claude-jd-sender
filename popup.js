// Popup settings script

document.addEventListener('DOMContentLoaded', () => {
    const claudeUrlInput = document.getElementById('claude-url');
    const chatGptUrlInput = document.getElementById('chatgpt-url');
    const geminiUrlInput = document.getElementById('gemini-url');
    const saveBtn = document.getElementById('save-btn');
    const statusEl = document.getElementById('status');
    
    const currentClaudeEl = document.getElementById('current-claude-url');
    const currentChatGptEl = document.getElementById('current-chatgpt-url');
    const currentGeminiEl = document.getElementById('current-gemini-url');

    // Load saved URLs
    chrome.storage.sync.get(['claudeChatUrl', 'chatGptUrl', 'geminiUrl'], (result) => {
        updateDisplay(claudeUrlInput, currentClaudeEl, result.claudeChatUrl);
        updateDisplay(chatGptUrlInput, currentChatGptEl, result.chatGptUrl);
        updateDisplay(geminiUrlInput, currentGeminiEl, result.geminiUrl);
    });

    function updateDisplay(inputEl, displayEl, url) {
        if (url) {
            inputEl.value = url;
            displayEl.textContent = url;
            displayEl.classList.remove('none');
        } else {
            displayEl.textContent = 'Not configured';
            displayEl.classList.add('none');
        }
    }

    // Save URLs
    saveBtn.addEventListener('click', () => {
        const claudeUrl = claudeUrlInput.value.trim();
        const chatGptUrl = chatGptUrlInput.value.trim();
        const geminiUrl = geminiUrlInput.value.trim();

        // Validation - ensure if provided, they match expected domains
        if (claudeUrl && !claudeUrl.startsWith('https://claude.ai/')) {
            showStatus('Claude URL must start with https://claude.ai/', 'error');
            return;
        }

        if (chatGptUrl && !chatGptUrl.startsWith('https://chatgpt.com/')) {
            showStatus('ChatGPT URL must start with https://chatgpt.com/', 'error');
            return;
        }

        if (geminiUrl && !geminiUrl.startsWith('https://gemini.google.com/')) {
            showStatus('Gemini URL must start with https://gemini.google.com/', 'error');
            return;
        }

        // Save
        chrome.storage.sync.set({ 
            claudeChatUrl: claudeUrl,
            chatGptUrl: chatGptUrl,
            geminiUrl: geminiUrl
        }, () => {
            showStatus('✓ Settings saved!', 'success');
            updateDisplay(claudeUrlInput, currentClaudeEl, claudeUrl);
            updateDisplay(chatGptUrlInput, currentChatGptEl, chatGptUrl);
            updateDisplay(geminiUrlInput, currentGeminiEl, geminiUrl);
        });
    });

    // Enter key to save
    [claudeUrlInput, chatGptUrlInput, geminiUrlInput].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveBtn.click();
        });
    });

    function showStatus(message, type) {
        statusEl.textContent = message;
        statusEl.className = 'status ' + type;

        setTimeout(() => {
            statusEl.className = 'status';
        }, 3000);
    }

    // ── Logs viewer ──
    const logsBtn = document.getElementById('logs-btn');
    const logArea = document.getElementById('log-area');
    const clearLogsBtn = document.getElementById('clear-logs-btn');

    logsBtn.addEventListener('click', () => {
        const isVisible = logArea.classList.contains('visible');
        if (isVisible) {
            logArea.classList.remove('visible');
            clearLogsBtn.classList.remove('visible');
            logsBtn.textContent = '📋 View Logs';
        } else {
            chrome.storage.local.get(['extensionLogs'], (result) => {
                const logs = result.extensionLogs || [];
                if (logs.length === 0) {
                    logArea.innerHTML = '<span class="log-empty">No logs yet. Try sending a JD to Claude.</span>';
                } else {
                    logArea.textContent = logs.join('\n');
                    logArea.scrollTop = logArea.scrollHeight;
                }
                logArea.classList.add('visible');
                clearLogsBtn.classList.add('visible');
                logsBtn.textContent = '📋 Hide Logs';
            });
        }
    });

    clearLogsBtn.addEventListener('click', () => {
        chrome.storage.local.remove('extensionLogs', () => {
            logArea.innerHTML = '<span class="log-empty">Logs cleared.</span>';
        });
    });
});
