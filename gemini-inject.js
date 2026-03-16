// Gemini inject script — runs only on gemini.google.com
// Picks up the pending prompt from storage and injects it

(() => {
    'use strict';

    const MAX_WAIT_MS = 20000;
    const POLL_INTERVAL_MS = 800;

    // Gemini uses a customized contenteditable inside a rich-textarea
    const INPUT_SELECTOR = 'rich-textarea div.ql-editor';

    // ── Persistent logger ──
    function log(message, level = 'info') {
        const entry = `[${new Date().toLocaleTimeString()}] [${level.toUpperCase()}] ${message}`;
        console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[Claude JD Extension] ${message}`);
    }

    // ── Check for pending prompt on load ──

    chrome.storage.local.get(['pendingGemini'], (result) => {
        if (!result.pendingGemini) return;

        const prompt = result.pendingGemini;
        chrome.storage.local.remove('pendingGemini');

        if (document.readyState === 'complete') {
            setTimeout(() => waitForEditor(prompt), 1500);
        } else {
            window.addEventListener('load', () => {
                setTimeout(() => waitForEditor(prompt), 1500);
            });
        }
    });

    function findEditor() {
        return document.querySelector(INPUT_SELECTOR);
    }

    function waitForEditor(prompt) {
        const startTime = Date.now();

        const observer = new MutationObserver(() => {
            const editor = findEditor();
            if (editor) {
                observer.disconnect();
                clearInterval(fallback);
                setTimeout(() => injectPrompt(editor, prompt), 800);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        const fallback = setInterval(() => {
            const editor = findEditor();
            if (editor) {
                clearInterval(fallback);
                observer.disconnect();
                setTimeout(() => injectPrompt(editor, prompt), 800);
                return;
            }
            if (Date.now() - startTime > MAX_WAIT_MS) {
                clearInterval(fallback);
                observer.disconnect();
                clipboardFallback(prompt);
            }
        }, POLL_INTERVAL_MS);
    }

    function injectPrompt(editor, prompt) {
        log('Editor found, injecting prompt...');
        
        try {
            editor.focus();

            navigator.clipboard.writeText(prompt).then(() => {
                if (document.execCommand('insertText', false, prompt)) {
                    log('execCommand success');
                    showToast('✓ Prompt ready — click Send when ready!', true);
                    return;
                }

                // Event fallback
                editor.innerHTML = `<p>${prompt.replace(/\\n/g, '<br>')}</p>`;
                const inputEvent = new Event('input', { bubbles: true });
                editor.dispatchEvent(inputEvent);
                showToast('✓ Prompt ready — click Send when ready!', true);
            });
        } catch (e) {
            clipboardFallback(prompt);
        }
    }

    function clipboardFallback(prompt) {
        navigator.clipboard.writeText(prompt).then(() => {
            showToast('📋 Prompt copied — paste it here', false);
        });
    }

    function showToast(message, isSuccess) {
        const toast = document.createElement('div');
        toast.style.cssText = `
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      z-index: 2147483647; padding: 14px 24px; border-radius: 12px;
      background: ${isSuccess ? 'rgba(46, 125, 50, 0.95)' : 'rgba(50, 50, 50, 0.95)'};
      color: white; font-family: -apple-system, sans-serif; font-size: 14px;
      font-weight: 500; box-shadow: 0 6px 24px rgba(0,0,0,0.35);
      transition: opacity 0.3s, transform 0.3s;
    `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
})();
