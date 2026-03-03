// Claude inject script — runs only on claude.ai
// Picks up the pending prompt from storage, injects via clipboard paste, and auto-sends

(() => {
    'use strict';

    const MAX_WAIT_MS = 20000;
    const POLL_INTERVAL_MS = 800;

    // Verified selectors from Claude's actual DOM
    const INPUT_SELECTOR = 'div[aria-label="Write your prompt to Claude"]';
    const INPUT_SELECTOR_ALT = 'div.ProseMirror[contenteditable="true"]';
    const INPUT_SELECTOR_TESTID = 'div[data-testid="chat-input"]';
    const SEND_BTN_SELECTOR = 'button[aria-label="Send message"]';

    // ── Persistent logger — saves to chrome.storage.local ──
    function log(message, level = 'info') {
        const entry = `[${new Date().toLocaleTimeString()}] [${level.toUpperCase()}] ${message}`;
        console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[Claude JD Extension] ${message}`);
        chrome.storage.local.get(['extensionLogs'], (result) => {
            const logs = result.extensionLogs || [];
            logs.push(entry);
            if (logs.length > 100) logs.splice(0, logs.length - 100);
            chrome.storage.local.set({ extensionLogs: logs });
        });
    }

    // ── Check for pending prompt on load ──

    chrome.storage.local.get(['pendingPrompt'], (result) => {
        if (!result.pendingPrompt) return;

        const prompt = result.pendingPrompt;
        chrome.storage.local.remove('pendingPrompt');

        if (document.readyState === 'complete') {
            // Extra delay to let Claude's JS fully initialize
            setTimeout(() => waitForEditor(prompt), 2000);
        } else {
            window.addEventListener('load', () => {
                setTimeout(() => waitForEditor(prompt), 2000);
            });
        }
    });

    // ── Find the editor element ──

    function findEditor() {
        return (
            document.querySelector(INPUT_SELECTOR) ||
            document.querySelector(INPUT_SELECTOR_TESTID) ||
            document.querySelector(INPUT_SELECTOR_ALT)
        );
    }

    // ── Wait for editor to exist ──

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

        // Also poll as fallback
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

    // ── Inject prompt into the editor ──

    function injectPrompt(editor, prompt) {
        log('Editor found, injecting prompt...');

        // Focus the editor
        editor.focus();

        // Strategy 1: Simulate a paste event (most reliable for ProseMirror/Tiptap)
        try {
            const clipboardData = new DataTransfer();
            clipboardData.setData('text/plain', prompt);

            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: clipboardData,
            });

            editor.dispatchEvent(pasteEvent);
            log('Strategy 1: Paste event dispatched');
        } catch (e) {
            log('Strategy 1: Paste event failed, trying alternatives...', 'warn');
        }

        // Check if paste worked after a short delay
        setTimeout(() => {
            const hasContent = editor.textContent && editor.textContent.trim().length > 10;

            if (hasContent) {
                log('✓ Content injected via paste (Strategy 1)');
                showToast('✓ Prompt ready — click Send when ready!', true);
            } else {
                // Strategy 2: execCommand insertText
                log('Strategy 2: Trying execCommand...');
                editor.focus();
                editor.innerHTML = '<p><br></p>';

                // Place cursor inside
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(editor);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);

                const success = document.execCommand('insertText', false, prompt);

                if (success && editor.textContent.trim().length > 10) {
                    log('✓ Content injected via execCommand (Strategy 2)');
                    showToast('✓ Prompt ready — click Send when ready!', true);
                } else {
                    // Strategy 3: Write to clipboard and instruct user
                    log('Strategy 3: Trying keyboard simulation...');
                    simulateKeyboardInput(editor, prompt);
                }
            }
        }, 500);
    }

    // ── Strategy 3: Simulate keyboard input char-by-char (truncated for long text) ──

    function simulateKeyboardInput(editor, prompt) {
        editor.focus();

        // For long texts, direct input simulation is too slow
        // Instead, use the clipboard API to write + trigger Cmd+V programmatically
        navigator.clipboard.writeText(prompt).then(() => {
            // Simulate Cmd+V / Ctrl+V
            editor.focus();

            const keyDown = new KeyboardEvent('keydown', {
                key: 'v',
                code: 'KeyV',
                keyCode: 86,
                which: 86,
                metaKey: true, // Cmd on Mac
                ctrlKey: false,
                bubbles: true,
            });

            const keyUp = new KeyboardEvent('keyup', {
                key: 'v',
                code: 'KeyV',
                keyCode: 86,
                which: 86,
                metaKey: true,
                ctrlKey: false,
                bubbles: true,
            });

            editor.dispatchEvent(keyDown);
            editor.dispatchEvent(keyUp);

            // Check if it worked
            setTimeout(() => {
                const hasContent = editor.textContent && editor.textContent.trim().length > 10;
                if (hasContent) {
                    log('✓ Content injected via keyboard simulation (Strategy 3)');
                    showToast('✓ Prompt ready — click Send when ready!', true);
                } else {
                    // Strategy 4: Direct innerHTML manipulation as last resort
                    log('Strategy 4: Trying direct DOM manipulation...');
                    directDomInject(editor, prompt);
                }
            }, 500);
        }).catch(() => {
            directDomInject(editor, prompt);
        });
    }

    // ── Strategy 4: Direct DOM + dispatch synthetic InputEvent ──

    function directDomInject(editor, prompt) {
        editor.focus();

        // Build p-tag HTML
        const html = prompt
            .split('\n')
            .map(line => `<p>${escapeHtml(line) || '<br>'}</p>`)
            .join('');

        editor.innerHTML = html;

        // Dispatch a comprehensive set of events to trigger Tiptap reactivity
        ['beforeinput', 'input', 'textInput', 'change'].forEach(eventName => {
            try {
                if (eventName === 'beforeinput' || eventName === 'input') {
                    editor.dispatchEvent(new InputEvent(eventName, {
                        bubbles: true,
                        cancelable: true,
                        inputType: 'insertFromPaste',
                        data: prompt,
                    }));
                } else {
                    editor.dispatchEvent(new Event(eventName, { bubbles: true }));
                }
            } catch (e) { /* ignore */ }
        });

        log('Strategy 4: Direct DOM inject done');
        showToast('✓ Prompt ready — click Send when ready!', true);
    }



    // ── Helpers ──

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function clipboardFallback(prompt) {
        navigator.clipboard.writeText(prompt).then(() => {
            showToast('📋 Prompt copied — paste with Cmd+V', false);
        }).catch(() => {
            showToast('⚠️ Could not auto-inject. Please type your prompt.', false);
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
