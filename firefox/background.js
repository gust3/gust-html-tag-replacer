const DEFAULT_LIBRARY = [
  {
    id: 'preset-strong',
    tag: '<strong>',
    replacementOpen: '<span style="font-weight: bold;">',
    replacementClose: '</span>',
    caseInsensitive: true
  },
  {
    id: 'preset-b',
    tag: '<b>',
    replacementOpen: '<span style="font-weight: bold;">',
    replacementClose: '</span>',
    caseInsensitive: true
  }
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "replaceTags",
    title: chrome.i18n.getMessage("menuTitle"),
    contexts: ["selection", "editable"]
  });

  chrome.storage.sync.get(['ruleLibrary', 'activeRules'], (result) => {
    chrome.storage.sync.get(['rules'], (legacy) => {
      let library = result.ruleLibrary;
      let active = result.activeRules;

      if (!library) {
        library = DEFAULT_LIBRARY.slice();
        if (legacy.rules && legacy.rules.length) {
          legacy.rules.forEach(r => {
            const normalized = normalizeLegacyRule(r);
            if (normalized) library.push(normalized);
          });
        }
      }
      if (!active) active = [];

      library = dedupeLibrary(library);

      chrome.storage.sync.set({ ruleLibrary: library, activeRules: active });
      chrome.storage.sync.remove(['rules']);
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "replaceTags") {
    chrome.tabs.sendMessage(tab.id, { action: "replaceSelection" });
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "replace-selection") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "replaceSelection" });
      }
    });
  }
});

function normalizeLegacyRule(r) {
  if (!r.from || !r.to) return null;
  return {
    id: 'legacy-' + Math.random().toString(36).slice(2, 10),
    tag: r.from,
    replacementOpen: r.to,
    replacementClose: '',
    caseInsensitive: false
  };
}

function dedupeLibrary(lib) {
  const seen = new Set();
  const out = [];
  for (const r of lib) {
    const key = `${r.tag}\u0000${r.replacementOpen}\u0000${r.replacementClose}\u0000${r.caseInsensitive ? 1 : 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}