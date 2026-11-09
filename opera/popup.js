let ruleLibrary = [];
let activeRules = []; // массив id

document.addEventListener('DOMContentLoaded', () => {
  localizeHtml(); // Перевод статического HTML
  
  chrome.storage.sync.get(['ruleLibrary', 'activeRules'], (result) => {
    ruleLibrary = dedupeLibrary(result.ruleLibrary || []);
    activeRules = result.activeRules || [];
    activeRules = activeRules.filter(id => ruleLibrary.some(r => r.id === id));
    renderRules();
  });
});

// ---------- Локализация ----------
function localizeHtml() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    if (msg) el.innerHTML = msg;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n-title'));
    if (msg) el.title = msg;
  });
}

// ---------- Рендер активных правил ----------
function renderRules() {
  const container = document.getElementById('rules');
  container.innerHTML = '';

  if (activeRules.length === 0) {
    container.innerHTML = `<div class="empty">${chrome.i18n.getMessage('emptyActiveRules')}</div>`;
    renderLibrary();
    return;
  }

  const msgAllCases = chrome.i18n.getMessage('labelAllCases');
  const msgPhTag = chrome.i18n.getMessage('placeholderTag');
  const msgPhOpen = chrome.i18n.getMessage('placeholderReplOpen');
  const msgPhClose = chrome.i18n.getMessage('placeholderReplClose');
  const msgTitleToggle = chrome.i18n.getMessage('titleToggleClose');
  const msgTitleDel = chrome.i18n.getMessage('titleDeleteActive');

  activeRules.forEach((id) => {
    const rule = ruleLibrary.find(r => r.id === id);
    if (!rule) return;

    const div = document.createElement('div');
    div.className = 'rule';
    div.innerHTML = `
      <input type="text" data-id="${escapeAttr(rule.id)}" data-field="tag"
             placeholder="${escapeAttr(msgPhTag)}"
             value="${escapeAttr(rule.tag)}">
      <input type="text" data-id="${escapeAttr(rule.id)}" data-field="replacementOpen"
             placeholder="${escapeAttr(msgPhOpen)}"
             value="${escapeAttr(rule.replacementOpen)}">
      <button class="toggle" data-id="${escapeAttr(rule.id)}" title="${escapeAttr(msgTitleToggle)}">✎</button>
      <button class="delete" data-id="${escapeAttr(rule.id)}" title="${escapeAttr(msgTitleDel)}">×</button>
      <label><input type="checkbox" data-id="${escapeAttr(rule.id)}" data-field="caseInsensitive"
             ${rule.caseInsensitive ? 'checked' : ''}> ${escapeHtml(msgAllCases)}</label>
      <div class="close-repl ${rule.replacementClose ? 'visible' : ''}">
        <input type="text" data-id="${escapeAttr(rule.id)}" data-field="replacementClose"
               placeholder="${escapeAttr(msgPhClose)}"
               value="${escapeAttr(rule.replacementClose)}" style="flex:1;">
      </div>
    `;
    container.appendChild(div);
  });

  bindRuleEvents();
  renderLibrary();
}

function bindRuleEvents() {
  document.querySelectorAll('#rules input[type="text"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field;
      const rule = ruleLibrary.find(r => r.id === id);
      if (!rule) return;
      rule[field] = e.target.value;
      ruleLibrary = dedupeLibrary(ruleLibrary);
      if (!ruleLibrary.some(r => r.id === id)) {
        activeRules = activeRules.filter(a => a !== id);
        renderRules();
      } else {
        renderLibrary();
      }
    });
  });

  document.querySelectorAll('#rules input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const rule = ruleLibrary.find(r => r.id === id);
      if (rule) {
        rule.caseInsensitive = e.target.checked;
        ruleLibrary = dedupeLibrary(ruleLibrary);
        if (!ruleLibrary.some(r => r.id === id)) {
          activeRules = activeRules.filter(a => a !== id);
        }
        renderRules();
      }
    });
  });

  document.querySelectorAll('#rules .delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      activeRules = activeRules.filter(a => a !== id);
      renderRules();
    });
  });

  document.querySelectorAll('#rules .toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const div = e.target.closest('.rule');
      div.querySelector('.close-repl').classList.toggle('visible');
    });
  });
}

// ---------- Рендер базы ----------
function renderLibrary() {
  const list = document.getElementById('libraryList');
  if (!list) return;
  if (!Array.isArray(ruleLibrary)) ruleLibrary = [];

  list.innerHTML = '';

  if (ruleLibrary.length === 0) {
    list.innerHTML = `<div class="empty">${chrome.i18n.getMessage('emptyLibrary')}</div>`;
    return;
  }

  const msgTitleAllCases = chrome.i18n.getMessage('titleAllCasesIcon');
  const msgTitleDel = chrome.i18n.getMessage('titleDeleteLibrary');

  ruleLibrary.forEach(rule => {
    const isActive = activeRules.includes(rule.id);
    const item = document.createElement('div');
    item.className = 'lib-item';
    item.innerHTML = `
      <input type="checkbox" data-id="${escapeAttr(rule.id)}" ${isActive ? 'checked' : ''}>
      <code>${escapeHtml(rule.tag)}</code> →
      <code>${escapeHtml(rule.replacementOpen)}</code>
      ${rule.caseInsensitive ? `<span title="${escapeAttr(msgTitleAllCases)}">🌐</span>` : ''}
      <span style="flex:1"></span>
      <button class="lib-del" data-id="${escapeAttr(rule.id)}" title="${escapeAttr(msgTitleDel)}">🗑</button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) {
        if (!activeRules.includes(id)) activeRules.push(id);
      } else {
        activeRules = activeRules.filter(a => a !== id);
      }
      renderRules();
    });
  });

  list.querySelectorAll('.lib-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      ruleLibrary = ruleLibrary.filter(r => r.id !== id);
      activeRules = activeRules.filter(a => a !== id);
      chrome.storage.sync.set({ ruleLibrary, activeRules }, () => {
        renderRules();
      });
    });
  });
}

// ---------- Добавление нового правила ----------
document.getElementById('addRule').addEventListener('click', () => {
  const newRule = {
    id: 'r-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    tag: '',
    replacementOpen: '',
    replacementClose: '',
    caseInsensitive: true
  };
  ruleLibrary.push(newRule);
  activeRules.push(newRule.id);
  renderRules();
  setTimeout(() => {
    const inputs = document.querySelectorAll('#rules input[data-field="tag"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
});

document.getElementById('openLibrary').addEventListener('click', () => {
  document.getElementById('libraryPanel').classList.toggle('visible');
});

// ---------- Донат ----------
document.getElementById('donateLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://cwteam.ru/donate.html' });
});

// ---------- Сохранение ----------
document.getElementById('save').addEventListener('click', () => {
  ruleLibrary = ruleLibrary.filter(r => r.tag && r.replacementOpen);
  activeRules = activeRules.filter(id => ruleLibrary.some(r => r.id === id));
  ruleLibrary = dedupeLibrary(ruleLibrary);

  chrome.storage.sync.set({ ruleLibrary, activeRules }, () => {
    const btn = document.getElementById('save');
    const original = btn.textContent;
    btn.textContent = chrome.i18n.getMessage('btnSaved');
    btn.style.background = '#2E7D32';
    setTimeout(() => {
      btn.textContent = original;
      btn.style.background = '#4CAF50';
      window.close();
    }, 900);
  });
});

// ---------- Утилиты ----------
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(text) {
  return escapeHtml(text);
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