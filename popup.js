// Popup settings script

document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('claude-url');
    const saveBtn = document.getElementById('save-btn');
    const statusEl = document.getElementById('status');
    const currentUrlEl = document.getElementById('current-url');

    // Load saved URL
    chrome.storage.sync.get(['claudeChatUrl'], (result) => {
        if (result.claudeChatUrl) {
            urlInput.value = result.claudeChatUrl;
            currentUrlEl.textContent = result.claudeChatUrl;
            currentUrlEl.classList.remove('none');
        } else {
            currentUrlEl.textContent = 'Not configured';
            currentUrlEl.classList.add('none');
        }
    });

    // Save URL
    saveBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();

        // Validation
        if (!url) {
            showStatus('Please enter a Claude chat URL', 'error');
            return;
        }

        if (!url.startsWith('https://claude.ai/')) {
            showStatus('URL must start with https://claude.ai/', 'error');
            return;
        }

        // Save
        chrome.storage.sync.set({ claudeChatUrl: url }, () => {
            showStatus('✓ Settings saved!', 'success');
            currentUrlEl.textContent = url;
            currentUrlEl.classList.remove('none');
        });
    });

    // Enter key to save
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveBtn.click();
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
