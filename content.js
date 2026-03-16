// Content script — runs on all pages except claude.ai
// Detects text selection > 10 lines and shows a floating "Send to Claude" button

(() => {
    'use strict';

    const LINE_THRESHOLD = 10;
    let floatingBtn = null;
    let toastEl = null;

    // ── Helpers ──

    function countLines(text) {
        if (!text || !text.trim()) return 0;
        return text.trim().split(/\r?\n/).length;
    }

    function getSelectedText() {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return '';
        return selection.toString();
    }

    function showToast(message, isError = false) {
        removeToast();
        toastEl = document.createElement('div');
        toastEl.id = 'claude-jd-ext-toast';
        if (isError) toastEl.classList.add('claude-jd-ext-error');
        toastEl.textContent = message;
        document.body.appendChild(toastEl);

        setTimeout(() => {
            if (toastEl) {
                toastEl.classList.add('claude-jd-ext-fade-out');
                setTimeout(() => removeToast(), 300);
            }
        }, 3000);
    }

    function removeToast() {
        if (toastEl && toastEl.parentNode) {
            toastEl.parentNode.removeChild(toastEl);
            toastEl = null;
        }
    }

    // ── Floating Button Container ──

    function createButtons() {
        if (floatingBtn) return;

        floatingBtn = document.createElement('div');
        floatingBtn.id = 'claude-jd-ext-container';

        // Claude Button
        const btnClaude = document.createElement('button');
        btnClaude.className = 'claude-jd-ext-btn claude';
        btnClaude.innerHTML = `
          <span class="claude-jd-ext-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </span>
          Send to Claude
        `;
        btnClaude.addEventListener('click', handleSendToClaude);

        // ChatGPT Button
        const btnChatGPT = document.createElement('button');
        btnChatGPT.className = 'claude-jd-ext-btn chatgpt';
        btnChatGPT.innerHTML = `
          <span class="claude-jd-ext-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.28 9.68a6.25 6.25 0 0 0-1.87-4.22 6.16 6.16 0 0 0-4.14-1.85 6.2 6.2 0 0 0-4.12 1.48A6.27 6.27 0 0 0 8.05 4.1 6.13 6.13 0 0 0 3.78 5.4a6.29 6.29 0 0 0-1.92 4.14 6.28 6.28 0 0 0 1.25 4.34 6.2 6.2 0 0 0 1.95 2.15 6.19 6.19 0 0 0 4.22 1.83h.09a6.16 6.16 0 0 0 4.12-1.46A6.29 6.29 0 0 0 17.6 18.2a6.11 6.11 0 0 0 4.18-1.54 6.29 6.29 0 0 0 1.86-4.18 6.25 6.25 0 0 0-1.36-2.8zM19.14 8.7l-3.32-1.92a4.13 4.13 0 0 1 .47-3.1 4.18 4.18 0 0 1 2.37-1.86v2.33A2.07 2.07 0 0 0 20 5.2a2.03 2.03 0 0 0 .84 2.5l-1.7 1zM7 6.32l3.32-1.92a4.11 4.11 0 0 1 3.54-3 4.15 4.15 0 0 1 3.1 1.7L15 4a2.06 2.06 0 0 0-1.07-1.76A2.06 2.06 0 0 0 11.83 2a2.08 2.08 0 0 0-1.46.6L7 6.32zM3.4 9.67A4.14 4.14 0 0 1 5.44 6a4.12 4.12 0 0 1 4.04-1.03 4.15 4.15 0 0 1 2.7 2v2.32a2.07 2.07 0 0 0-1.66-1 2.07 2.07 0 0 0-1.47.6l1.72-1-.07-.02a2.07 2.07 0 0 0-2.3 3.63l-2-.45a2.07 2.07 0 0 0-1.7-.8M3.1 14.6a4.11 4.11 0 0 1-1-4 4.14 4.14 0 0 1 2-2.73 4.12 4.12 0 0 1 4.1-.17v3.2A2.07 2.07 0 0 0 6.64 12V8.4a2.05 2.05 0 0 0-1.35 1.7 2.08 2.08 0 0 0 1 2l-.12-.02a2.07 2.07 0 0 0 1.13 3.48l-2-.45A2.06 2.06 0 0 0 3.1 14.6zM8.83 17.6a4.13 4.13 0 0 1-2.9-1.25 4.12 4.12 0 0 1-1.2-3v3.74A2.06 2.06 0 0 0 5 18.2a2.05 2.05 0 0 0 .5-1.5l1.7.94.02.04a2.07 2.07 0 0 0 3.1-2l.37.8a2.05 2.05 0 0 0-1.85-.9M16.14 19.3L12.8 21.2a4.14 4.14 0 0 1-3.6 1.15 4.11 4.11 0 0 1-3.1-1.62l1.96-1A2.05 2.05 0 0 0 9.13 22a2.07 2.07 0 0 0 1.5-.6l3.37-1.95A4.12 4.12 0 0 1 18.5 18v-2.36a2.07 2.07 0 0 0 1.63 1.1 2.05 2.05 0 0 0 .84-2.5l-2.8-.75a4.14 4.14 0 0 1-2 5M20 18.33V14.6a4.12 4.12 0 0 1 1-4 4.15 4.15 0 0 1 2 2.72 4.12 4.12 0 0 1-4 4v-3a2.06 2.06 0 0 0 1.6-1.1v3.52a2.05 2.05 0 0 0-1.34-1.7 2.07 2.07 0 0 0-1-2l.14.03a2.07 2.07 0 0 0-1.12-3.48l2.8.75A2.05 2.05 0 0 0 20 18.33zM12 13a1 1 0 1 1-1-1 1 1 0 0 1 1 1z"/></svg>
          </span>
          Send to ChatGPT
        `;
        btnChatGPT.addEventListener('click', (e) => handleSendToOther(e, 'ChatGPT'));

        // Gemini Button
        const btnGemini = document.createElement('button');
        btnGemini.className = 'claude-jd-ext-btn gemini';
        btnGemini.innerHTML = `
          <span class="claude-jd-ext-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C12 7.52 16.48 12 22 12C16.48 12 12 16.48 12 22C12 16.48 7.52 12 2 12C7.52 12 12 7.52 12 2Z"/></svg>
          </span>
          Send to Gemini
        `;
        btnGemini.addEventListener('click', (e) => handleSendToOther(e, 'Gemini'));

        floatingBtn.appendChild(btnClaude);
        floatingBtn.appendChild(btnChatGPT);
        floatingBtn.appendChild(btnGemini);
        
        document.body.appendChild(floatingBtn);
    }

    function removeButtons() {
        if (floatingBtn && floatingBtn.parentNode) {
            floatingBtn.classList.add('claude-jd-ext-fade-out');
            setTimeout(() => {
                if (floatingBtn && floatingBtn.parentNode) {
                    floatingBtn.parentNode.removeChild(floatingBtn);
                    floatingBtn = null;
                }
            }, 300);
        }
    }

    // ── Core Logic ──

    function setButtonProcessing(btn, text) {
        if (btn) {
            btn.classList.add('claude-jd-ext-processing');
            const svg = btn.querySelector('svg').outerHTML;
            btn.innerHTML = `<span class="claude-jd-ext-icon">${svg}</span>${text}`;
        }
    }

    function handleSendToClaude(e) {
        e.preventDefault();
        e.stopPropagation();

        const selectedText = getSelectedText();
        if (countLines(selectedText) < LINE_THRESHOLD) {
            showToast('Selection is less than 10 lines', true);
            return;
        }

        const btn = e.currentTarget;
        setButtonProcessing(btn, 'Sending...');

        // Format the prompt
        const formattedPrompt = `Reset context. New job application. Previous resume modifications don't apply.

Here's the new job description:

${selectedText}

Apply all original resume modification rules from project knowledge.`;

        // Check if Claude URL is configured
        chrome.storage.sync.get(['claudeChatUrl'], (result) => {
            if (!result.claudeChatUrl) {
                showToast('⚠️ Set your Claude chat URL in extension settings first!', true);
                removeButtons();
                return;
            }

            // Store the prompt for the Claude inject script to pick up
            chrome.storage.local.set({ pendingPrompt: formattedPrompt }, () => {
                // Also copy to clipboard as fallback
                navigator.clipboard.writeText(formattedPrompt).catch(() => { });

                // Open Claude chat via background script
                chrome.runtime.sendMessage({ action: 'openClaudeChat' }, (response) => {
                    if (chrome.runtime.lastError || !response?.success) {
                        window.open(result.claudeChatUrl, '_blank', 'popup,width=650,height=750');
                        showToast('✓ Opening Claude — sending your JD...');
                    } else {
                        showToast('✓ Opening Claude — sending your JD...');
                    }
                    removeButtons(); // Remove buttons after click
                });
            });
        });
    }

    function handleSendToOther(e, platformName) {
        e.preventDefault();
        e.stopPropagation();

        const selectedText = getSelectedText();
        if (countLines(selectedText) < LINE_THRESHOLD) {
            showToast('Selection is less than 10 lines', true);
            return;
        }

        const btn = e.currentTarget;

        const actionName = platformName === 'ChatGPT' ? 'openChatGPT' : 'openGemini';
        const storageKey = platformName === 'ChatGPT' ? 'pendingChatGPT' : 'pendingGemini';
        const urlStorageKey = platformName === 'ChatGPT' ? 'chatGptUrl' : 'geminiUrl';

        // Check if platform URL is configured
        chrome.storage.sync.get([urlStorageKey], (result) => {
            if (!result[urlStorageKey]) {
                showToast(`⚠️ Set your ${platformName} chat URL in extension settings first!`, true);
                removeButtons();
                return;
            }

            setButtonProcessing(btn, 'Sending...');

            // Store the raw text for the other platform's inject script
            chrome.storage.local.set({ [storageKey]: selectedText }, () => {
                navigator.clipboard.writeText(selectedText).catch(() => { });

                // Send to background to open/focus tab
                chrome.runtime.sendMessage({ action: actionName }, (response) => {
                    if (chrome.runtime.lastError || !response?.success) {
                        showToast(`⚠️ Failed to open ${platformName}`, true);
                    } else {
                        showToast(`✓ Opening ${platformName}...`);
                    }
                    removeButtons(); // Remove buttons after click
                });
            });
        });
    }

    // ── Selection Listener ──

    let debounceTimer = null;

    function onSelectionChange() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const text = getSelectedText();
            const lines = countLines(text);

            if (lines >= LINE_THRESHOLD) {
                createButtons();
            } else {
                removeButtons();
            }
        }, 300);
    }

    // Listen for selection changes
    document.addEventListener('mouseup', onSelectionChange);
    document.addEventListener('selectionchange', () => {
        // Only remove button if selection is cleared
        const text = getSelectedText();
        if (!text || !text.trim()) {
            removeButtons();
        }
    });

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        clearTimeout(debounceTimer);
    });
})();
