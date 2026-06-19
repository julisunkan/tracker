// ── EXTENSION BRIDGE ───────────────────────────────────────────────────────
const ext = (() => {
  const isExt = typeof chrome !== 'undefined' && chrome?.runtime?.id;
  return {
    isExt,
    send: (msg) => isExt
      ? new Promise(res => chrome.runtime.sendMessage(msg, r => res(r)))
      : Promise.resolve(null),
    storageGet: (keys) => isExt
      ? new Promise(res => chrome.storage.local.get(keys, res))
      : Promise.resolve({}),
    storageSet: (obj) => isExt
      ? chrome.storage.local.set(obj)
      : Promise.resolve(),
  };
})();

// ── NAV ────────────────────────────────────────────────────────────────────
function showPane(name) {
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pane = document.getElementById('pane-' + name);
  const nav  = document.querySelector(`.nav-item[data-pane="${name}"]`);
  if (pane) pane.classList.add('active');
  if (nav)  nav.classList.add('active');
  if (name === 'filters') loadFilterLists();
  if (name === 'stats')   refreshStats();
  if (name === 'custom')  loadCustomFilters();
  location.hash = name;
}

// ── TOAST ──────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ── GENERAL TOGGLES ────────────────────────────────────────────────────────
function syncToggle(cb) {
  const msgMap = {
    autoReload:       { what: 'setAutoReload',       state: cb.checked },
    showBlockedCount: { what: 'setShowBlockedCount',  state: cb.checked },
    strictBlockMode:  { what: 'setStrictBlockMode',   state: cb.checked },
    developerMode:    { what: 'setDeveloperMode',     state: cb.checked },
  };
  if (msgMap[cb.id]) ext.send(msgMap[cb.id]);
  const labels = {
    autoReload:       cb.checked ? '🔄 Auto-reload on'  : '🔄 Auto-reload off',
    showBlockedCount: cb.checked ? '🔢 Badge counter on'       : '🔢 Badge counter off',
    strictBlockMode:  cb.checked ? '🚫 Strict mode on'   : '🚫 Strict mode off',
    developerMode:    cb.checked ? '🛠️ Developer mode on'    : '🛠️ Developer mode off',
  };
  showToast(labels[cb.id] || `${cb.id}: ${cb.checked ? 'on' : 'off'}`);
}

// ── DEFAULT MODE ───────────────────────────────────────────────────────────
function setDefaultMode(level) {
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
  const el = document.querySelector(`.mode-card[data-level="${level}"]`);
  if (el) el.classList.add('active');
  ext.send({ what: 'setDefaultFilteringMode', level });
  showToast(`Mod implicit: ${['Off','Basic','Optimal','Strict'][level]}`);
}

// ── FILTER LISTS ───────────────────────────────────────────────────────────
const FILTER_LABELS = {
  'adblock-filters':          { name: 'AdBlock Filters',        cat: 'Core' },
  'adblock-badware':          { name: 'AdBlock Badware',        cat: 'Core' },
  'easylist':                 { name: 'EasyList',               cat: 'Core' },
  'easyprivacy':              { name: 'EasyPrivacy',            cat: 'Core' },
  'adguard-mobile':           { name: 'AdGuard Mobile',         cat: 'Extra' },
  'adguard-spyware-url':      { name: 'AdGuard Spyware URL',    cat: 'Extra' },
  'annoyances-cookies':       { name: 'Cookie Banners',         cat: 'Annoyances' },
  'annoyances-notifications': { name: 'Notifications',             cat: 'Annoyances' },
  'annoyances-others':        { name: 'Other Annoyances',         cat: 'Annoyances' },
  'annoyances-overlays':      { name: 'Overlays',            cat: 'Annoyances' },
  'annoyances-social':        { name: 'Social Media',           cat: 'Annoyances' },
  'annoyances-widgets':       { name: 'Widgets',             cat: 'Annoyances' },
  'annoyances-ai':            { name: 'AI Promotion',           cat: 'Annoyances' },
  'pgl':                      { name: 'Peter Lowe (PGL)',       cat: 'Extra' },
  'urlhaus-full':             { name: 'URLhaus (malware)',      cat: 'Security' },
  'block-lan':                { name: 'Block LAN',            cat: 'Security' },
  'dpollock-0':               { name: 'D. Pollock Hosts',       cat: 'Extra' },
  'rou-1':                    { name: '🇷🇴 Romanian',           cat: 'Regional' },
  'deu-0':                    { name: '🇩🇪 German',             cat: 'Regional' },
  'fra-0':                    { name: '🇫🇷 French',             cat: 'Regional' },
  'spa-0':                    { name: '🇪🇸 Spanish',            cat: 'Regional' },
  'rus-0':                    { name: '🇷🇺 Russian',            cat: 'Regional' },
  'chn-0':                    { name: '🇨🇳 Chinese',            cat: 'Regional' },
  'jpn-1':                    { name: '🇯🇵 Japanese',           cat: 'Regional' },
  'kor-1':                    { name: '🇰🇷 Korean',             cat: 'Regional' },
  'pol-0':                    { name: '🇵🇱 Polish',             cat: 'Regional' },
  'ita-0':                    { name: '🇮🇹 Italian',            cat: 'Regional' },
  'spa-1':                    { name: '🇧🇷 Portuguese',         cat: 'Regional' },
  'adblock-experimental':     { name: 'Experimental',           cat: 'Dev' },
  'adblock-tests':            { name: 'Tests',                  cat: 'Dev' },
};

let pendingRulesets = new Set();

async function loadFilterLists() {
  const tbody = document.getElementById('filterBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" class="loading-row">Se încarcă…</td></tr>';
  let enabled = new Set(['adblock-filters','adblock-badware','easylist','easyprivacy']);
  if (ext.isExt) {
    const data = await ext.send({ what: 'getOptionsPageData' });
    if (data?.enabledRulesets) enabled = new Set(data.enabledRulesets);
  }
  pendingRulesets = new Set(enabled);
  renderFilterTable(enabled);
}

function renderFilterTable(enabled) {
  const tbody = document.getElementById('filterBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (const [id, info] of Object.entries(FILTER_LABELS)) {
    const on = enabled.has(id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <label class="switch" style="display:inline-block">
          <input type="checkbox" data-ruleset="${id}" ${on ? 'checked' : ''}>
          <span class="switch-track"></span>
        </label>
      </td>
      <td>
        <div class="filter-name">${info.name}</div>
        <div class="filter-count">${info.cat}</div>
      </td>
      <td><span class="badge ${on ? 'badge-on' : 'badge-off'}">${on ? 'Active' : 'Inactive'}</span></td>`;
    
    const cb = tr.querySelector('input[type="checkbox"]');
    cb.addEventListener('change', () => {
      if (cb.checked) pendingRulesets.add(id);
      else            pendingRulesets.delete(id);
      const badge = tr.querySelector('.badge');
      badge.className = 'badge ' + (cb.checked ? 'badge-on' : 'badge-off');
      badge.textContent = cb.checked ? 'Active' : 'Inactive';
    });
    tbody.appendChild(tr);
  }
}

async function applyFilterChanges() {
  const rulesets = Array.from(pendingRulesets);
  if (ext.isExt) {
    await ext.send({ what: 'applyRulesets', enabledRulesets: rulesets });
  }
  showToast('✅ Filter lists applied! (' + rulesets.length + ' active)');
}

// ── CUSTOM FILTERS ─────────────────────────────────────────────────────────
async function loadCustomFilters() {
  if (!ext.isExt) return;
  const data = await ext.send({ what: 'getAllCustomFilters' });
  const ta = document.getElementById('customFilters');
  if (ta && data) ta.value = data;
}

async function saveCustomFilters() {
  const val = (document.getElementById('customFilters')?.value || '').trim();
  if (ext.isExt) await ext.send({ what: 'addCustomFilters', hostname: '*', filters: val });
  showToast('✅ Custom filters saved');
}

async function clearCustomFilters() {
  if (!confirm('Are you sure you want to clear all custom filters?')) return;
  const ta = document.getElementById('customFilters');
  if (ta) ta.value = '';
  if (ext.isExt) await ext.send({ what: 'removeAllCustomFilters', hostname: '*' });
  showToast('🗑️ Custom filters cleared');
}

// ── STATS ──────────────────────────────────────────────────────────────────
async function refreshStats() {
  if (ext.isExt) {
    const bin = await ext.storageGet(['adsBlocked','cookies','trackers']);
    const s = (k) => (bin[k] || 0).toLocaleString();
    document.getElementById('statAds').textContent      = s('adsBlocked');
    document.getElementById('statTrackers').textContent = s('trackers');
    document.getElementById('statCookies').textContent  = s('cookies');
  } else {
    document.getElementById('statAds').textContent      = (1247).toLocaleString();
    document.getElementById('statTrackers').textContent = (384).toLocaleString();
    document.getElementById('statCookies').textContent  = (92).toLocaleString();
  }
}

async function resetStats() {
  if (!confirm('Reset statistics counters?')) return;
  await ext.storageSet({ adsBlocked: 0, cookies: 0, trackers: 0 });
  ['statAds','statTrackers','statCookies'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '0';
  });
  showToast('🗑️ Statistics reset');
}

// ── BACKUP ─────────────────────────────────────────────────────────────────
async function exportBackup() {
  let config = {
    version: '3.2.1',
    date: new Date().toISOString(),
    enabledRulesets: Array.from(pendingRulesets),
    customFilters: document.getElementById('customFilters')?.value || '',
  };
  if (ext.isExt) {
    const data = await ext.send({ what: 'getOptionsPageData' });
    if (data) Object.assign(config, {
      autoReload:     data.autoReload,
      strictBlock:    data.strictBlockMode,
      developerMode:  data.developerMode,
      enabledRulesets:data.enabledRulesets || [],
    });
  }
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `adblock-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 Backup exported!');
}

function importBackup(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const cfg = JSON.parse(e.target.result);
      if (cfg.enabledRulesets && ext.isExt)
        await ext.send({ what: 'applyRulesets', enabledRulesets: cfg.enabledRulesets });
      if (cfg.customFilters) {
        const ta = document.getElementById('customFilters');
        if (ta) ta.value = cfg.customFilters;
        if (ext.isExt)
          await ext.send({ what: 'addCustomFilters', hostname: '*', filters: cfg.customFilters });
      }
      showToast('📥 Backup restored successfully!');
      loadFilterLists();
    } catch {
      showToast('❌ Invalid file!');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

// ── WIRE ALL LISTENERS ─────────────────────────────────────────────────────
function wireListeners() {
  // Navigation
  document.querySelectorAll('.nav-item[data-pane]').forEach(nav => {
    nav.addEventListener('click', () => showPane(nav.dataset.pane));
  });

  // Mode cards in General pane
  document.querySelectorAll('.mode-card[data-level]').forEach(card => {
    card.addEventListener('click', () => setDefaultMode(parseInt(card.dataset.level)));
  });

  // Toggle checkboxes + rows in General pane
  document.querySelectorAll('.toggle-cb').forEach(cb => {
    const row = cb.closest('.toggle-row');
    if (row) {
      row.addEventListener('click', (e) => {
        if (e.target === cb) return;
        cb.checked = !cb.checked;
        syncToggle(cb);
      });
    }
    cb.addEventListener('change', () => syncToggle(cb));
  });

  // Filter pane buttons
  const applyBtn = document.getElementById('applyFiltersBtn');
  if (applyBtn) applyBtn.addEventListener('click', applyFilterChanges);

  const refreshFiltersBtn = document.getElementById('refreshFiltersBtn');
  if (refreshFiltersBtn) refreshFiltersBtn.addEventListener('click', loadFilterLists);

  // Custom filter buttons
  const saveCustomBtn = document.getElementById('saveCustomBtn');
  if (saveCustomBtn) saveCustomBtn.addEventListener('click', saveCustomFilters);

  const loadCustomBtn = document.getElementById('loadCustomBtn');
  if (loadCustomBtn) loadCustomBtn.addEventListener('click', loadCustomFilters);

  const clearCustomBtn = document.getElementById('clearCustomBtn');
  if (clearCustomBtn) clearCustomBtn.addEventListener('click', clearCustomFilters);

  // Stats buttons
  const refreshStatsBtn = document.getElementById('refreshStatsBtn');
  if (refreshStatsBtn) refreshStatsBtn.addEventListener('click', refreshStats);

  const resetStatsBtn = document.getElementById('resetStatsBtn');
  if (resetStatsBtn) resetStatsBtn.addEventListener('click', resetStats);

  // Backup buttons
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportBackup);

  const importFile = document.getElementById('importFile');
  if (importFile) importFile.addEventListener('change', () => importBackup(importFile));
}

// ── INIT ───────────────────────────────────────────────────────────────────
async function init() {
  wireListeners();

  // Hash routing
  const hash = location.hash.replace('#','');
  const valid = ['general','filters','custom','stats','backup','about'];
  if (valid.includes(hash) && hash !== 'general') showPane(hash);

  if (ext.isExt) {
    const data = await ext.send({ what: 'getOptionsPageData' });
    if (!data) return;
    // Apply toggle states
    [['autoReload','autoReload'],['showBlockedCount','showBlockedCount'],
     ['strictBlockMode','strictBlockMode'],['developerMode','developerMode']].forEach(([key,id]) => {
      const cb = document.getElementById(id);
      if (cb && typeof data[key] === 'boolean') cb.checked = data[key];
    });
    // Apply default mode
    if (typeof data.defaultFilteringMode === 'number') {
      setDefaultMode(data.defaultFilteringMode);
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
