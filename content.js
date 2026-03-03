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

    // ── Floating Button ──

    function createButton() {
        if (floatingBtn) return;

        floatingBtn = document.createElement('button');
        floatingBtn.id = 'claude-jd-ext-btn';
        floatingBtn.innerHTML = `
      <span class="claude-jd-ext-icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </span>
      Send to Claude
    `;

        floatingBtn.addEventListener('click', handleSendToClaud);
        document.body.appendChild(floatingBtn);
    }

    function removeButton() {
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

    function handleSendToClaud(e) {
        e.preventDefault();
        e.stopPropagation();

        const selectedText = getSelectedText();
        if (countLines(selectedText) < LINE_THRESHOLD) {
            showToast('Selection is less than 10 lines', true);
            return;
        }

        // Show processing state
        if (floatingBtn) {
            floatingBtn.classList.add('claude-jd-ext-processing');
            floatingBtn.innerHTML = `
        <span class="claude-jd-ext-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </span>
        Sending...
      `;
        }

        // Format the prompt
        const formattedPrompt = `Reset context. New job application. Previous resume modifications don't apply.

Here's the new job description:

${selectedText}

Apply all original resume modification rules from project knowledge.`;

        // Check if Claude URL is configured
        chrome.storage.sync.get(['claudeChatUrl'], (result) => {
            if (!result.claudeChatUrl) {
                showToast('⚠️ Set your Claude chat URL in extension settings first!', true);
                resetButton();
                return;
            }

            // Store the prompt for the Claude inject script to pick up
            chrome.storage.local.set({ pendingPrompt: formattedPrompt }, () => {
                // Also copy to clipboard as fallback
                navigator.clipboard.writeText(formattedPrompt).catch(() => { });

                // Timeout in case background worker is inactive
                const timeout = setTimeout(() => {
                    // Background worker didn't respond — open directly
                    window.open(result.claudeChatUrl, '_blank',
                        'popup,width=650,height=750');
                    showToast('✓ Opening Claude — paste prompt if needed');
                    resetButton();
                }, 5000);

                // Open Claude chat via background script
                chrome.runtime.sendMessage({ action: 'openClaudeChat' }, (response) => {
                    clearTimeout(timeout);

                    // Check for runtime errors (worker inactive, etc.)
                    if (chrome.runtime.lastError) {
                        // Fallback: open directly
                        window.open(result.claudeChatUrl, '_blank',
                            'popup,width=650,height=750');
                        showToast('✓ Opening Claude — sending your JD...');
                        resetButton();
                        return;
                    }

                    if (response && response.success) {
                        showToast('✓ Opening Claude — sending your JD...');
                    } else {
                        showToast('⚠️ ' + (response?.error || 'Failed to open Claude'), true);
                    }
                    resetButton();
                });
            });
        });
    }

    function resetButton() {
        if (floatingBtn) {
            floatingBtn.classList.remove('claude-jd-ext-processing');
            floatingBtn.innerHTML = `
        <span class="claude-jd-ext-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </span>
        Send to Claude
      `;
        }
    }

    // ── Selection Listener ──

    let debounceTimer = null;

    function onSelectionChange() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const text = getSelectedText();
            const lines = countLines(text);

            if (lines >= LINE_THRESHOLD) {
                createButton();
            } else {
                removeButton();
            }
        }, 300);
    }

    // Listen for selection changes
    document.addEventListener('mouseup', onSelectionChange);
    document.addEventListener('selectionchange', () => {
        // Only remove button if selection is cleared
        const text = getSelectedText();
        if (!text || !text.trim()) {
            removeButton();
        }
    });

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        clearTimeout(debounceTimer);
    });
})();
