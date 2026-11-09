let ruleLibrary = [];
let activeRules = []; // массив id

document.addEventListener('DOMContentLoaded', () => {
  localizeHtml();
  
  chrome.storage.sync.get(['ruleLibrary', 'activeRules'], (result) => {
    ruleLibrary = dedupeLibrary(result.ruleLibrary || []);
    activeRules = result.activeRules || [];
    activeRules = activeRules.filter(id => ruleLibrary.some(r => r.id === id));
    renderRules();
  });
});

// ---------- Локализация (без innerHTML) ----------
function localizeHtml() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    if (msg) {
      while (el.firstChild) el.removeChild(el.firstChild);
      // Поддерживаем перенос строки <br> для сообщений
      const parts = msg.split('<br>');
      parts.forEach((part, index) => {
        el.appendChild(document.createTextNode(part));
        if (index < parts.length - 1) {
          el.appendChild(document.createElement('br'));
        }
      });
    }
  });
  
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n-title'));
    if (msg) el.title = msg;
  });
}

// ---------- Рендер активных правил ----------
function renderRules() {
  const container = document.getElementById('rules');
  
  // Безопасная очистка контейнера
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  if (activeRules.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty';
    
    // Локализованный текст с переносом строки
    const msg = chrome.i18n.getMessage('emptyActiveRules');
    const parts = msg.split('<br>');
    parts.forEach((part, index) => {
      emptyDiv.appendChild(document.createTextNode(part));
      if (index < parts.length - 1) emptyDiv.appendChild(document.createElement('br'));
    });
    
    container.appendChild(emptyDiv);
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

    // Input: Tag
    const inputTag = document.createElement('input');
    inputTag.type = 'text';
    inputTag.dataset.id = rule.id;
    inputTag.dataset.field = 'tag';
    inputTag.placeholder = msgPhTag;
    inputTag.value = rule.tag;

    // Input: replacementOpen
    const inputOpen = document.createElement('input');
    inputOpen.type = 'text';
    inputOpen.dataset.id = rule.id;
    inputOpen.dataset.field = 'replacementOpen';
    inputOpen.placeholder = msgPhOpen;
    inputOpen.value = rule.replacementOpen;

    // Button Toggle
    const btnToggle = document.createElement('button');
    btnToggle.className = 'toggle';
    btnToggle.dataset.id = rule.id;
    btnToggle.title = msgTitleToggle;
    btnToggle.textContent = '✎';

    // Button Delete
    const btnDelete = document.createElement('button');
    btnDelete.className = 'delete';
    btnDelete.dataset.id = rule.id;
    btnDelete.title = msgTitleDel;
    btnDelete.textContent = '×';

    // Label Checkbox
    const label = document.createElement('label');
    const inputCheck = document.createElement('input');
    inputCheck.type = 'checkbox';
    inputCheck.dataset.id = rule.id;
    inputCheck.dataset.field = 'caseInsensitive';
    inputCheck.checked = rule.caseInsensitive;
    label.appendChild(inputCheck);
    label.appendChild(document.createTextNode(' ' + msgAllCases));

    // Div close-repl
    const divClose = document.createElement('div');
    divClose.className = 'close-repl' + (rule.replacementClose ? ' visible' : '');
    const inputClose = document.createElement('input');
    inputClose.type = 'text';
    inputClose.dataset.id = rule.id;
    inputClose.dataset.field = 'replacementClose';
    inputClose.placeholder = msgPhClose;
    inputClose.value = rule.replacementClose;
    inputClose.style.flex = '1';
    divClose.appendChild(inputClose);

    div.appendChild(inputTag);
    div.appendChild(inputOpen);
    div.appendChild(btnToggle);
    div.appendChild(btnDelete);
    div.appendChild(label);
    div.appendChild(divClose);

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

  // Безопасная очистка контейнера
  while (list.firstChild) {
    list.removeChild(list.firstChild);
  }

  if (ruleLibrary.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty';
    emptyDiv.textContent = chrome.i18n.getMessage('emptyLibrary');
    list.appendChild(emptyDiv);
    return;
  }

  const msgTitleAllCases = chrome.i18n.getMessage('titleAllCasesIcon');
  const msgTitleDel = chrome.i18n.getMessage('titleDeleteLibrary');

  ruleLibrary.forEach(rule => {
    const isActive = activeRules.includes(rule.id);
    
    const item = document.createElement('div');
    item.className = 'lib-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.id = rule.id;
    cb.checked = isActive;

    const codeTag = document.createElement('code');
    codeTag.textContent = rule.tag;

    const arrow = document.createTextNode(' → ');

    const codeRepl = document.createElement('code');
    codeRepl.textContent = rule.replacementOpen;

    item.appendChild(cb);
    item.appendChild(codeTag);
    item.appendChild(arrow);
    item.appendChild(codeRepl);

    if (rule.caseInsensitive) {
      const spanIcon = document.createElement('span');
      spanIcon.title = msgTitleAllCases;
      spanIcon.textContent = '🌐';
      item.appendChild(document.createTextNode(' '));
      item.appendChild(spanIcon);
    }

    const spacer = document.createElement('span');
    spacer.style.flex = '1';
    item.appendChild(spacer);

    const btnDel = document.createElement('button');
    btnDel.className = 'lib-del';
    btnDel.dataset.id = rule.id;
    btnDel.title = msgTitleDel;
    btnDel.textContent = '🗑';
    item.appendChild(btnDel);

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