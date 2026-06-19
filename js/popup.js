// ── EXTENSION BRIDGE ───────────────────────────────────────────────────────
const ext = (() => {
  const isExt = typeof chrome !== 'undefined' && chrome?.runtime?.id;
  return {
    isExt,
    sendMessage: (msg) => isExt
      ? new Promise((res) => chrome.runtime.sendMessage(msg, (r) => res(r)))
      : Promise.resolve(null),
    openOptions: () => isExt
      ? chrome.runtime.openOptionsPage()
      : (window.location.href = 'options.html'),
    storageGet: (keys) => isExt
      ? new Promise((res) => chrome.storage.local.get(keys, res))
      : Promise.resolve({}),
    storageSet: (obj) => isExt
      ? chrome.storage.local.set(obj)
      : Promise.resolve(),
  };
})();

// ── STATE ──────────────────────────────────────────────────────────────────
const state = {
  enabled: true,
  mode: 1,
  hostname: '',
  autoReload: true,
  cookieAccept: true,
  showCount: true,
  strictBlock: false,
  developerMode: false,
  opacity: 100,
  aggr: 70,
  accent: '#00e5c8',
  accent2: '#00b5ff',
  theme: 'dark',
  adsBlocked: 0,
  cookies: 0,
  trackers: 0,
  rules: 48392,
};

const themes = {
  dark:     { bg:'#0d0f14', surface:'#141720', surface2:'#1c2030', surface3:'#232840' },
  midnight: { bg:'#060912', surface:'#0e1020', surface2:'#161828', surface3:'#1e2038' },
  slate:    { bg:'#0f1117', surface:'#171b22', surface2:'#1f242e', surface3:'#282e3c' },
  amoled:   { bg:'#000000', surface:'#0a0a0a', surface2:'#111111', surface3:'#181818' },
  glass:    { bg:'#0a1628', surface:'#0d1e35', surface2:'#132540', surface3:'#1a2f50' },
};

// ── COUNTER ANIMATION ──────────────────────────────────────────────────────
function animateCount(el, target) {
  if (!el) return;
  const start = parseInt(el.textContent.replace(/,/g,'')) || 0;
  const dur = 800, t0 = performance.now(), diff = target - start;
  const step = ts => {
    const pct = Math.min(1, (ts - t0) / dur);
    el.textContent = Math.round(start + diff * (1 - Math.pow(1 - pct, 3))).toLocaleString();
    if (pct < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function refreshCounters() {
  animateCount(document.getElementById('adsBlockedVal'), state.adsBlocked);
  animateCount(document.getElementById('cookiesVal'),    state.cookies);
  animateCount(document.getElementById('trackersVal'),   state.trackers);
  animateCount(document.getElementById('rulesVal'),      state.rules);
}

function simulateLive() {
  if (!state.enabled || ext.isExt) return;
  state.adsBlocked += Math.floor(Math.random() * 3);
  state.cookies    += Math.random() > 0.7 ? 1 : 0;
  state.trackers   += Math.random() > 0.8 ? 1 : 0;
  refreshCounters();
}

// ── APPLY BACKGROUND DATA ──────────────────────────────────────────────────
function applyPopupPanelData(data) {
  if (!data) return;
  if (typeof data.level === 'number') {
    state.mode = data.level;
    document.querySelectorAll('.mode-pill').forEach(p =>
      p.classList.toggle('active', parseInt(p.dataset.level) === data.level));
  }
  if (typeof data.autoReload === 'boolean') {
    state.autoReload = data.autoReload;
    const cb = document.getElementById('autoReload');
    if (cb) cb.checked = data.autoReload;
  }
  if (typeof data.developerMode === 'boolean') state.developerMode = data.developerMode;
}

// ── POWER TOGGLE ───────────────────────────────────────────────────────────
function togglePower() {
  state.enabled = !state.enabled;
  if (ext.isExt && state.hostname) {
    const newLevel = state.enabled ? Math.max(state.mode, 1) : 0;
    ext.sendMessage({ what: 'setFilteringMode', hostname: state.hostname, level: newLevel })
      .then(() => { if (state.autoReload) ext.sendMessage({ what: 'reloadTab' }); });
    if (state.enabled) state.mode = newLevel;
  }
  const ring  = document.getElementById('powerRing');
  const body  = document.getElementById('popupBody');
  const dot   = document.getElementById('statusDot');
  const label = document.getElementById('statusLabel');
  const sub   = document.querySelector('.logo-sub');
  ring.classList.toggle('off',      !state.enabled);
  ring.classList.toggle('active',    state.enabled);
  body.classList.toggle('disabled', !state.enabled);
  dot.style.background = state.enabled ? 'var(--accent)' : 'var(--text-muted)';
  dot.style.animation  = state.enabled ? 'pulse 2s infinite' : 'none';
  label.textContent    = state.enabled ? 'Blocking Active' : 'Disabled';
  sub.textContent      = state.enabled ? 'Protection Active' : 'Protection Off';
  showToast(state.enabled ? '🛡️ AdBlock enabled' : '⛔ AdBlock disabled');
}

// ── MODE PILLS ─────────────────────────────────────────────────────────────
function setMode(level) {
  state.mode = level;
  document.querySelectorAll('.mode-pill').forEach(p =>
    p.classList.toggle('active', parseInt(p.dataset.level) === level));
  if (ext.isExt && state.hostname) {
    ext.sendMessage({ what: 'setFilteringMode', hostname: state.hostname, level })
      .then(() => { if (state.autoReload) ext.sendMessage({ what: 'reloadTab' }); });
  }
  showToast(`Mod: ${['Off','Basic','Optimal','Strict'][level]}`);
}

// ── SWITCH TOGGLES ─────────────────────────────────────────────────────────
function toggleSwitch(id) {
  const cb = document.getElementById(id);
  if (!cb) return;
  cb.checked = !cb.checked;
  saveToggle(cb);
}

function saveToggle(cb) {
  state[cb.id] = cb.checked;
  if (ext.isExt) {
    const msgMap = {
      autoReload:  { what: 'setAutoReload',      state: cb.checked },
      showCount:   { what: 'setShowBlockedCount', state: cb.checked },
      strictBlock: { what: 'setStrictBlockMode',  state: cb.checked },
    };
    if (msgMap[cb.id]) ext.sendMessage(msgMap[cb.id]);
  }
  ext.storageSet({ [`ui_${cb.id}`]: cb.checked });
  const labels = {
    autoReload:   cb.checked ? '🔄 Auto-reload on'       : '🔄 Auto-reload off',
    cookieAccept: cb.checked ? '🍪 Cookie auto-accept on' : '🍪 Cookie banners shown',
    showCount:    cb.checked ? '🔢 Counter visible'            : '🔢 Counter hidden',
    strictBlock:  cb.checked ? '🚫 Strict mode on'        : '🚫 Strict mode off',
  };
  showToast(labels[cb.id] || `${cb.id}: ${cb.checked ? 'on' : 'off'}`);
}

// ── SLIDERS ────────────────────────────────────────────────────────────────
function updateOpacity(val) {
  state.opacity = val;
  const lbl = document.getElementById('opacityLabel');
  if (lbl) lbl.textContent = val + '%';
  document.documentElement.style.setProperty('--popup-opacity', val / 100);
  ext.storageSet({ ui_opacity: val });
}

function updateAggr(val) {
  state.aggr = val;
  const lbl = document.getElementById('aggrLabel');
  if (lbl) lbl.textContent = val + '%';
  ext.storageSet({ ui_aggr: val });
}

// ── ACCENT COLORS ──────────────────────────────────────────────────────────
function setAccent(el) {
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  const [a, a2] = el.dataset.color.split(',');
  applyAccent(a, a2);
}

function setCustomAccent(hex) {
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
  applyAccent(hex, hex + 'aa');
}

function applyAccent(a, a2) {
  document.documentElement.style.setProperty('--accent', a);
  document.documentElement.style.setProperty('--accent2', a2 || a);
  document.documentElement.style.setProperty('--border-accent', a + '40');
  document.documentElement.style.setProperty('--glow', `0 0 20px ${a}25`);
  state.accent = a; state.accent2 = a2;
  ext.storageSet({ ui_accent: a, ui_accent2: a2 });
}

// ── THEMES ─────────────────────────────────────────────────────────────────
function setTheme(el, name) {
  document.querySelectorAll('.theme-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const t = themes[name];
  if (!t) return;
  document.documentElement.style.setProperty('--bg', t.bg);
  document.documentElement.style.setProperty('--surface', t.surface);
  document.documentElement.style.setProperty('--surface2', t.surface2);
  document.documentElement.style.setProperty('--surface3', t.surface3);
  state.theme = name;
  ext.storageSet({ ui_theme: name });
  showToast(`Temă: ${name.charAt(0).toUpperCase() + name.slice(1)}`);
}

// ── TOOLS ──────────────────────────────────────────────────────────────────
async function runTool(tool) {
  if (ext.isExt) {
    const tabs = await new Promise(res => chrome.tabs.query({ active: true, currentWindow: true }, res));
    const tab = tabs?.[0];
    if (!tab) return;
    switch (tool) {
      case 'zapper':
        await ext.sendMessage({ what: 'enter-zapper-mode', tabId: tab.id });
        window.close(); return;
      case 'picker':
        await ext.sendMessage({ what: 'enter-picker-mode', tabId: tab.id });
        window.close(); return;
      case 'unpicker':
        await ext.sendMessage({ what: 'removeAllCustomFilters', hostname: state.hostname });
        showToast('🗑️ Custom filters cleared'); return;
      case 'filters': case 'privacy': case 'backup':
        ext.openOptions(); window.close(); return;
      case 'youtube':
        ext.storageSet({ youtube_blocker: true });
        showToast('▶️ YouTube blocker on'); return;
      case 'stats':
        await ext.sendMessage({ what: 'showMatchedRules', tabId: tab.id }); return;
    }
  }
  const msgs = {
    zapper:'⚡ Element Zapper active', picker:'🎯 Element Picker active',
    unpicker:'🗑️ Filtre șterse', filters:'📋 Filter lists…',
    youtube:'▶️ YouTube blocker active', privacy:'🔐 Privacy settings…',
    stats:'📊 Statistics…', backup:'💾 Backup…',
  };
  showToast(msgs[tool] || `${tool}…`);
}

// ── NAVIGATION BUTTONS ─────────────────────────────────────────────────────
function openDashboard() {
  if (ext.isExt) { ext.openOptions(); window.close(); }
  else window.open('options.html', '_blank');
}

function openReport() {
  if (ext.isExt) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) ext.sendMessage({ what: 'gotoURL',
        url: chrome.runtime.getURL('options.html') + '#report', tabId: tab.id });
    });
    window.close();
  } else showToast('🚩 Report page');
}

function toggleDev() {
  state.developerMode = !state.developerMode;
  if (ext.isExt) ext.sendMessage({ what: 'setDeveloperMode', state: state.developerMode });
  showToast(state.developerMode ? '🛠️ Developer mode on' : '🛠️ Developer mode off');
}

function showMatchedRules() {
  if (ext.isExt) chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) ext.sendMessage({ what: 'showMatchedRules', tabId: tab.id });
  });
  showToast('📡 Matched rules');
}

// ── UI PREFERENCES RESTORE ─────────────────────────────────────────────────
async function restoreUIPrefs() {
  if (!ext.isExt) return;
  const bin = await ext.storageGet([
    'ui_theme','ui_accent','ui_accent2','ui_opacity','ui_aggr',
    'ui_cookieAccept','ui_autoReload','ui_showCount','ui_strictBlock'
  ]);

  if (bin.ui_theme) {
    const el = document.querySelector(`.theme-chip[data-theme="${bin.ui_theme}"]`);
    if (el) setTheme(el, bin.ui_theme);
  }
  if (bin.ui_accent) applyAccent(bin.ui_accent, bin.ui_accent2 || bin.ui_accent);
  if (bin.ui_opacity !== undefined) {
    const s = document.getElementById('opacitySlider');
    if (s) { s.value = bin.ui_opacity; updateOpacity(bin.ui_opacity); }
  }
  if (bin.ui_aggr !== undefined) {
    const s = document.getElementById('aggrSlider');
    if (s) { s.value = bin.ui_aggr; updateAggr(bin.ui_aggr); }
  }

  // Restore toggle states (default ON for cookieAccept, autoReload, showCount)
  const toggleDefaults = {
    cookieAccept: true,
    autoReload:   true,
    showCount:    true,
    strictBlock:  false,
  };
  for (const [id, defaultVal] of Object.entries(toggleDefaults)) {
    const cb = document.getElementById(id);
    if (!cb) continue;
    const stored = bin['ui_' + id];
    cb.checked = stored !== undefined ? stored : defaultVal;
    state[id] = cb.checked;
  }
}

// ── TOAST ──────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ── WIRE ALL EVENT LISTENERS ───────────────────────────────────────────────
function wireListeners() {
  // Power ring
  const powerRing = document.getElementById('powerRing');
  if (powerRing) powerRing.addEventListener('click', togglePower);

  // Header buttons
  const dashBtn = document.querySelector('[title="Dashboard"]');
  if (dashBtn) dashBtn.addEventListener('click', openDashboard);

  const reportBtn = document.querySelector('[title="Report Issue"]');
  if (reportBtn) reportBtn.addEventListener('click', openReport);

  // Mode pills — wire by data-level
  document.querySelectorAll('.mode-pill').forEach(pill => {
    pill.addEventListener('click', () => setMode(parseInt(pill.dataset.level)));
  });

  // Toggle rows — wire by data-toggle (we removed onclick, add data-toggle back via JS)
  const toggleMap = {
    'autoReload': 'autoReload',
    'cookieAccept': 'cookieAccept',
    'showCount': 'showCount',
    'strictBlock': 'strictBlock',
  };
  document.querySelectorAll('.toggle-row').forEach(row => {
    const cb = row.querySelector('input[type="checkbox"]');
    if (!cb) return;
    // Click on row toggles the checkbox
    row.addEventListener('click', (e) => {
      if (e.target === cb) return; // already handled by change event
      cb.checked = !cb.checked;
      saveToggle(cb);
    });
    cb.addEventListener('change', () => saveToggle(cb));
  });

  // Sliders
  const opSlider = document.getElementById('opacitySlider');
  if (opSlider) opSlider.addEventListener('input', (e) => updateOpacity(e.target.value));

  const agSlider = document.getElementById('aggrSlider');
  if (agSlider) agSlider.addEventListener('input', (e) => updateAggr(e.target.value));

  // Color swatches
  document.querySelectorAll('.color-swatch[data-color]').forEach(swatch => {
    swatch.addEventListener('click', () => setAccent(swatch));
  });

  // Custom color picker
  const customColorInput = document.getElementById('customColor');
  if (customColorInput) customColorInput.addEventListener('input', (e) => setCustomAccent(e.target.value));

  // Theme chips
  document.querySelectorAll('.theme-chip[data-theme]').forEach(chip => {
    chip.addEventListener('click', () => setTheme(chip, chip.dataset.theme));
  });

  // Tool buttons
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => runTool(btn.dataset.tool));
  });

  // Footer buttons
  const matchedBtn = document.querySelector('[title="Matched Rules"]');
  if (matchedBtn) matchedBtn.addEventListener('click', showMatchedRules);

  const devBtn = document.querySelector('[title="Developer Mode"]');
  if (devBtn) devBtn.addEventListener('click', toggleDev);
}

// ── INIT ───────────────────────────────────────────────────────────────────
async function init() {
  wireListeners();
  await restoreUIPrefs();

  if (ext.isExt) {
    const [tab] = await new Promise(res =>
      chrome.tabs.query({ active: true, currentWindow: true }, res));
    if (tab?.url) {
      try {
        const url = new URL(tab.url);
        state.hostname = url.hostname;
        const domainEl = document.getElementById('domainText');
        if (domainEl) domainEl.textContent = url.hostname;
      } catch {}
    }
    const data = await ext.sendMessage({ what: 'popupPanelData', hostname: state.hostname });
    applyPopupPanelData(data);
    const stored = await ext.storageGet(['adsBlocked','cookies','trackers']);
    state.adsBlocked = stored.adsBlocked || 0;
    state.cookies    = stored.cookies    || 0;
    state.trackers   = stored.trackers   || 0;
  } else {
    state.adsBlocked = Math.floor(Math.random() * 800) + 200;
    state.cookies    = Math.floor(Math.random() * 40) + 5;
    state.trackers   = Math.floor(Math.random() * 60) + 10;
    setInterval(simulateLive, 3000);
  }

  setTimeout(refreshCounters, 300);
}

init();
