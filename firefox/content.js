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
    
    // Безопасный парсинг HTML без исполнения скриптов
    const parser = new DOMParser();
    const doc = parser.parseFromString(replacedHTML, 'text/html');
    
    const fragment = document.createDocumentFragment();
    while (doc.body.firstChild) {
      fragment.appendChild(doc.body.firstChild);
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