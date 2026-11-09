chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "replaceSelection") {
    replaceInSelection();
  }
});

function replaceInSelection() {
  const activeElement = document.activeElement;

  if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
    replaceInTextarea(activeElement);
    return;
  }

  if (activeElement && activeElement.isContentEditable) {
    replaceInContentEditable(activeElement);
    return;
  }

  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const iframeActive = iframeDoc.activeElement;

      if (iframeActive && iframeActive.tagName === 'BODY' && iframeDoc.designMode === 'on') {
        replaceInContentEditable(iframeDoc.body);
        return;
      }
      if (iframeActive && iframeActive.isContentEditable) {
        replaceInContentEditable(iframeActive);
        return;
      }
    } catch (e) { /* cross-origin */ }
  }

  const textarea = document.querySelector('textarea');
  if (textarea) {
    replaceInTextarea(textarea);
    showNotification(chrome.i18n.getMessage('notifySuccessTextarea'));
    return;
  }

  showNotification(chrome.i18n.getMessage('notifyClickHtml'), 'error');
}

function loadRules(callback) {
  chrome.storage.sync.get(['ruleLibrary', 'activeRules'], (result) => {
    const lib = result.ruleLibrary || [];
    const active = result.activeRules || [];
    const rules = active
      .map(id => lib.find(r => r.id === id))
      .filter(Boolean)
      .filter(r => r.tag && r.replacementOpen);
    callback(buildRegexesFromRules(rules));
  });
}

function buildRegexesFromRules(rules) {
  const result = [];

  for (const rule of rules) {
    const flags = 'g' + (rule.caseInsensitive ? 'i' : '');
    const openRegex = new RegExp(escapeRegExp(rule.tag), flags);
    const openRepl = rule.replacementOpen;

    let closeRepl = rule.replacementClose;
    let closeRegex = null;

    const tagNameMatch = rule.tag.match(/^<\s*\/?\s*([a-zA-Z0-9-]+)/);
    const originalTagName = tagNameMatch ? tagNameMatch[1] : null;

    if (!closeRepl && originalTagName) {
      const newTagMatch = openRepl.match(/^<\s*([a-zA-Z0-9-]+)/);
      if (newTagMatch) {
        closeRepl = `</${newTagMatch[1]}>`;
      }
    }

    if (originalTagName && closeRepl) {
      const closeTagString = `</${originalTagName}>`;
      closeRegex = new RegExp(escapeRegExp(closeTagString), flags);
    }

    result.push({ openRegex, openRepl, closeRegex, closeRepl });
  }

  return result;
}

function applyRules(text, compiledRules) {
  let out = text;
  for (const r of compiledRules) {
    out = out.replace(r.openRegex, r.openRepl);
    if (r.closeRegex) {
      out = out.replace(r.closeRegex, r.closeRepl);
    }
  }
  return out;
}

function replaceInTextarea(textarea) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;

  if (start === end) {
    showNotification(chrome.i18n.getMessage('notifySelectFragment'), 'error');
    return;
  }

  const selectedText = value.substring(start, end);

  loadRules((compiledRules) => {
    const replacedText = applyRules(selectedText, compiledRules);

    textarea.value = value.substring(0, start) + replacedText + value.substring(end);

    textarea.selectionStart = start;
    textarea.selectionEnd = start + replacedText.length;
    textarea.focus();

    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    showNotification(chrome.i18n.getMessage('notifySuccess'));
  });
}

function replaceInContentEditable(element) {
  const selection = element.ownerDocument.getSelection();

  if (!selection.rangeCount) {
    showNotification(chrome.i18n.getMessage('notifyClickEditor'), 'error');
    return;
  }

  const range = selection.getRangeAt(0);

  if (range.collapsed) {
    showNotification(chrome.i18n.getMessage('notifySelectFragment'), 'error');
    return;
  }

  const tempContainer = document.createElement('div');
  tempContainer.appendChild(range.cloneContents());
  const selectedHTML = tempContainer.innerHTML;

  loadRules((compiledRules) => {
    const replacedHTML = applyRules(selectedHTML, compiledRules);

    range.deleteContents();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = replacedHTML;

    const fragment = document.createDocumentFragment();
    let lastNode;
    while ((lastNode = tempDiv.firstChild) !== null) {
      fragment.appendChild(lastNode);
    }
    range.insertNode(fragment);

    try {
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(element);
    } catch (e) { /* ignore */ }

    showNotification(chrome.i18n.getMessage('notifySuccess'));
  });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function showNotification(message, type = 'success') {
  const existing = document.getElementById('gust-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'gust-notification';
  notification.textContent = message;

  const bgColor = type === 'error' ? '#f44336' : '#4CAF50';

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 15px 20px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    z-index: 2147483647;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    transition: opacity 0.5s;
  `;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 500);
  }, 2500);
}