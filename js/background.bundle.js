var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// adblock/js/scripting-manager.js
var scripting_manager_exports = {};
__export(scripting_manager_exports, {
  getRegisteredContentScripts: () => getRegisteredContentScripts,
  onWakeupRun: () => onWakeupRun,
  registerInjectables: () => registerInjectables
});

// adblock/js/utils.js
var toBroaderHostname = (hn) => {
  if (hn === "*") {
    return "";
  }
  const pos = hn.indexOf(".");
  return pos !== -1 ? hn.slice(pos + 1) : "*";
};
var isDescendantHostnameOfIter = (hna, iterb) => {
  const setb = iterb instanceof Set ? iterb : new Set(iterb);
  if (setb.has("all-urls") || setb.has("*")) {
    return true;
  }
  let hn = hna;
  while (hn) {
    const pos = hn.indexOf(".");
    if (pos === -1) {
      break;
    }
    hn = hn.slice(pos + 1);
    if (setb.has(hn)) {
      return true;
    }
  }
  return false;
};
var intersectHostnameIters = (itera, iterb) => {
  const setb = iterb instanceof Set ? iterb : new Set(iterb);
  if (setb.has("all-urls") || setb.has("*")) {
    return Array.from(itera);
  }
  const out = [];
  for (const hna of itera) {
    if (setb.has(hna) || isDescendantHostnameOfIter(hna, setb)) {
      out.push(hna);
    }
  }
  return out;
};
var subtractHostnameIters = (itera, iterb) => {
  const setb = iterb instanceof Set ? iterb : new Set(iterb);
  if (setb.has("all-urls") || setb.has("*")) {
    return [];
  }
  const out = [];
  for (const hna of itera) {
    if (setb.has(hna)) {
      continue;
    }
    if (isDescendantHostnameOfIter(hna, setb)) {
      continue;
    }
    out.push(hna);
  }
  return out;
};
var matchFromHostname = (hn) => hn === "*" || hn === "all-urls" ? "<all_urls>" : `*://*.${hn}/*`;
var matchesFromHostnames = (hostnames) => {
  const out = [];
  for (const hn of hostnames) {
    out.push(matchFromHostname(hn));
  }
  return out;
};
var hostnameFromMatch = (origin) => {
  if (origin === "<all_urls>" || origin === "*://*/*") {
    return "all-urls";
  }
  const match = /^[^:]+:\/\/(?:\*\.)?([^/]+)\/\*/.exec(origin);
  if (match === null) {
    return "";
  }
  return match[1];
};
var hostnamesFromMatches = (origins) => {
  const out = [];
  for (const origin of origins) {
    const hn = hostnameFromMatch(origin);
    if (hn === "") {
      continue;
    }
    out.push(hn);
  }
  return out;
};
var deepEquals = (a, b) => {
  switch (typeof a) {
    case "undefined":
    case "boolean":
    case "number":
    case "string":
      return a === b;
  }
  if (typeof b !== "object") {
    return false;
  }
  if (a === null || b === null) {
    return a === b;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (Array.isArray(a) === false || Array.isArray(b) === false) {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (deepEquals(a[i], b[i]) === false) {
        return false;
      }
    }
    return true;
  }
  const akeys = Object.keys(a);
  const bkeys = Object.keys(b);
  if (akeys.length !== bkeys.length) {
    return false;
  }
  for (const k of akeys) {
    if (deepEquals(a[k], b[k]) === false) {
      return false;
    }
  }
  return true;
};
var broadcastMessage = (message) => {
  const bc = new self.BroadcastChannel("AdBlockAll");
  bc.postMessage(message);
};

// adblock/js/ext-compat.js
var webext = self.browser || self.chrome;
var dnr = webext.declarativeNetRequest || {};
function normalizeDNRRules(rules, ruleIds) {
  if (Array.isArray(rules) === false) {
    return rules;
  }
  return Array.isArray(ruleIds) ? rules.filter((rule) => ruleIds.includes(rule.id)) : rules;
}
dnr.setAllowAllRules = async function(id, allowed, notAllowed, reverse, priority) {
  const [
    beforeDynamicRules,
    beforeSessionRules
  ] = await Promise.all([
    dnr.getDynamicRules({ ruleIds: [id + 0] }),
    dnr.getSessionRules({ ruleIds: [id + 1] })
  ]);
  const addDynamicRules = [];
  const addSessionRules = [];
  if (reverse || allowed.length || notAllowed.length) {
    const rule0 = {
      id: id + 0,
      action: { type: "allowAllRequests" },
      condition: {
        resourceTypes: ["main_frame"]
      },
      priority
    };
    if (allowed.length) {
      rule0.condition.requestDomains = allowed.slice();
    } else if (notAllowed.length) {
      rule0.condition.excludedRequestDomains = notAllowed.slice();
    }
    addDynamicRules.push(rule0);
    const rule1 = {
      id: id + 1,
      action: { type: "allow" },
      condition: {
        tabIds: [webext.tabs.TAB_ID_NONE]
      },
      priority
    };
    if (allowed.length) {
      rule1.condition.initiatorDomains = allowed.slice();
    } else if (notAllowed.length) {
      rule1.condition.excludedInitiatorDomains = notAllowed.slice();
    }
    addSessionRules.push(rule1);
  }
  const promises = [];
  const modified = deepEquals(addDynamicRules, beforeDynamicRules) === false;
  if (modified) {
    promises.push(
      dnr.updateDynamicRules({
        addRules: addDynamicRules,
        removeRuleIds: beforeDynamicRules.map((r) => r.id)
      })
    );
  }
  if (deepEquals(addSessionRules, beforeSessionRules) === false) {
    promises.push(
      dnr.updateSessionRules({
        addRules: addSessionRules,
        removeRuleIds: beforeSessionRules.map((r) => r.id)
      })
    );
  }
  return Promise.all(promises).then(() => modified).catch(() => false);
};

// adblock/js/ext.js
var browser = webext;
var i18n = browser.i18n;
var runtime = browser.runtime;
var webextFlavor = (() => {
  const extURL = runtime.getURL("");
  if (extURL.startsWith("safari-web-extension:")) {
    return "safari";
  }
  return extURL.startsWith("moz-extension:") ? "firefox" : "chromium";
})();
var notAnObject = (a) => typeof a !== "object" || a === null;
async function localRead(key) {
  if (notAnObject(browser?.storage?.local)) {
    return;
  }
  try {
    const bin = await browser.storage.local.get(key);
    if (notAnObject(bin)) {
      return;
    }
    return bin[key] ?? void 0;
  } catch {
  }
}
async function localWrite(key, value) {
  if (notAnObject(browser?.storage?.local)) {
    return;
  }
  return browser.storage.local.set({ [key]: value });
}
async function localRemove(keys) {
  if (notAnObject(browser?.storage?.local)) {
    return;
  }
  return browser.storage.local.remove(keys);
}
async function localKeys() {
  if (notAnObject(browser?.storage?.local)) {
    return;
  }
  if (browser.storage.local.getKeys) {
    return browser.storage.local.getKeys();
  }
  const bin = await browser.storage.local.get(null);
  if (notAnObject(bin)) {
    return;
  }
  return Object.keys(bin);
}
async function sessionRead(key) {
  if (notAnObject(browser?.storage?.session)) {
    return;
  }
  try {
    const bin = await browser.storage.session.get(key);
    if (notAnObject(bin)) {
      return;
    }
    return bin[key] ?? void 0;
  } catch {
  }
}
async function sessionWrite(key, value) {
  if (notAnObject(browser?.storage?.session)) {
    return;
  }
  return browser.storage.session.set({ [key]: value });
}
async function sessionRemove(keys) {
  if (notAnObject(browser?.storage?.session)) {
    return;
  }
  return browser.storage.session.remove(keys);
}
async function sessionKeys() {
  if (notAnObject(browser?.storage?.session)) {
    return;
  }
  if (browser.storage.session.getKeys) {
    return browser.storage.session.getKeys();
  }
  const bin = await browser.storage.session.get(null);
  if (notAnObject(bin)) {
    return;
  }
  return Object.keys(bin);
}
async function sessionAccessLevel(level) {
  try {
    browser.storage.session.setAccessLevel(level);
  } catch {
  }
}
async function adminRead(key) {
  if (browser?.storage?.managed instanceof Object === false) {
    return;
  }
  try {
    const bin = await browser.storage.managed.get(key);
    if (notAnObject(bin)) {
      return;
    }
    return bin[key] ?? void 0;
  } catch {
  }
}

// adblock/js/debug.js
var isModern = dnr.onRuleMatchedDebug instanceof Object;
var isSideloaded = (() => {
  const { permissions } = webext.runtime.getManifest();
  return permissions?.includes("declarativeNetRequestFeedback") ?? false;
})();
var CONSOLE_MAX_LINES = 32;
var consoleOutput = [];
sessionRead("console").then((before) => {
  if (Array.isArray(before) === false) {
    return;
  }
  for (const s of before.reverse()) {
    consoleOutput.unshift(s);
  }
  consoleTruncate();
});
var consoleTruncate = () => {
  if (consoleOutput.length <= CONSOLE_MAX_LINES) {
    return;
  }
  consoleOutput.copyWithin(0, -CONSOLE_MAX_LINES);
  consoleOutput.length = CONSOLE_MAX_LINES;
};
var consoleAdd = (...args) => {
  if (args.length === 0) {
    return;
  }
  const now = /* @__PURE__ */ new Date();
  const time = [
    `${now.getUTCMonth() + 1}`.padStart(2, "0"),
    `${now.getUTCDate()}`.padStart(2, "0"),
    ".",
    `${now.getUTCHours()}`.padStart(2, "0"),
    `${now.getUTCMinutes()}`.padStart(2, "0")
  ].join("");
  for (let i = 0; i < args.length; i++) {
    const s = `[${time}]${args[i]}`;
    if (Boolean(s) === false) {
      continue;
    }
    if (s === consoleOutput.at(-1)) {
      continue;
    }
    consoleOutput.push(s);
  }
  consoleTruncate();
  sessionWrite("console", getConsoleOutput());
};
var adblockLog = (...args) => {
  if (isSideloaded !== true) {
    return;
  }
  console.info("[AdBlockAll]", ...args);
};
var adblockErr = (...args) => {
  if (Array.isArray(args) === false) {
    return;
  }
  if (globalThis.ServiceWorkerGlobalScope) {
    consoleAdd(...args);
  }
  if (isSideloaded !== true) {
    return;
  }
  console.error("[AdBlockAll]", ...args);
};
var getConsoleOutput = () => {
  return consoleOutput.slice();
};
var rulesets = /* @__PURE__ */ new Map();
var bufferSize = isSideloaded ? 256 : 1;
var matchedRules = new Array(bufferSize);
matchedRules.fill(null);
var writePtr = 0;
var pruneLongLists = (list) => {
  if (list.length <= 11) {
    return list;
  }
  return [...list.slice(0, 5), "...", ...list.slice(-5)];
};
var getRuleset = async (rulesetId) => {
  if (rulesets.has(rulesetId)) {
    return rulesets.get(rulesetId);
  }
  let rules;
  if (rulesetId === dnr.DYNAMIC_RULESET_ID) {
    rules = await dnr.getDynamicRules().catch(() => void 0);
  } else {
    const _extBase2 = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('') : '';
    const _rulesetUrl = _extBase2 ? (_extBase2 + 'rulesets/main/' + rulesetId + '.json') : ('/rulesets/main/' + rulesetId + '.json');
    const response = await fetch(_rulesetUrl).catch(() => void 0);
    if (response === void 0) {
      return;
    }
    rules = await response.json().catch(
      () => void 0
    ).then(
      (rules2) => normalizeDNRRules(rules2)
    );
  }
  if (Array.isArray(rules) === false) {
    return;
  }
  const ruleset = /* @__PURE__ */ new Map();
  for (const rule of rules) {
    const condition = rule.condition;
    if (condition) {
      if (condition.requestDomains) {
        condition.requestDomains = pruneLongLists(condition.requestDomains);
      }
      if (condition.initiatorDomains) {
        condition.initiatorDomains = pruneLongLists(condition.initiatorDomains);
      }
    }
    const ruleId = rule.id;
    rule.id = `${rulesetId}/${ruleId}`;
    ruleset.set(ruleId, rule);
  }
  rulesets.set(rulesetId, ruleset);
  return ruleset;
};
var getRuleDetails = async (ruleInfo) => {
  const { rulesetId, ruleId } = ruleInfo.rule;
  const ruleset = await getRuleset(rulesetId);
  if (ruleset === void 0) {
    return;
  }
  return { request: ruleInfo.request, rule: ruleset.get(ruleId) };
};
var getMatchedRules = (() => {
  if (isSideloaded !== true) {
    return () => Promise.resolve([]);
  }
  if (isModern) {
    return async (tabId) => {
      const promises = [];
      for (let i = 0; i < bufferSize; i++) {
        const j = (writePtr + i) % bufferSize;
        const ruleInfo = matchedRules[j];
        if (ruleInfo === null) {
          continue;
        }
        if (ruleInfo.request.tabId !== -1) {
          if (ruleInfo.request.tabId !== tabId) {
            continue;
          }
        }
        const promise = getRuleDetails(ruleInfo);
        if (promise === void 0) {
          continue;
        }
        promises.unshift(promise);
      }
      return Promise.all(promises);
    };
  }
  return async (tabId) => {
    if (typeof dnr.getMatchedRules !== "function") {
      return [];
    }
    const matchedRules2 = await dnr.getMatchedRules({ tabId });
    if (matchedRules2 instanceof Object === false) {
      return [];
    }
    const promises = [];
    for (const { tabId: tabId2, rule } of matchedRules2.rulesMatchedInfo) {
      promises.push(getRuleDetails({ request: { tabId: tabId2 }, rule }));
    }
    return Promise.all(promises);
  };
})();
var matchedRuleListener = (ruleInfo) => {
  matchedRules[writePtr] = ruleInfo;
  writePtr = (writePtr + 1) % bufferSize;
};
var toggleDeveloperMode = (state) => {
  if (isSideloaded !== true) {
    return;
  }
  if (isModern === false) {
    return;
  }
  if (state) {
    dnr.onRuleMatchedDebug.addListener(matchedRuleListener);
  } else {
    dnr.onRuleMatchedDebug.removeListener(matchedRuleListener);
  }
};

// adblock/js/fetch.js
function fetchJSON(path) {
  // MV3 service worker: resolve paths relative to extension root using getURL
  const extBase = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL('')
    : '';
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = extBase ? (extBase + normalizedPath + '.json') : (path + '.json');
  return fetch(url).then(
    (response) => response.json()
  ).catch((reason) => {
    adblockErr('fetchJSON/' + reason);
  });
}

// adblock/js/config.js
var rulesetConfig = {
  version: "",
  enabledRulesets: [],
  autoReload: true,
  showBlockedCount: true,
  strictBlockMode: webextFlavor !== "safari",
  developerMode: false,
  hasBroadHostPermissions: true
};
var defaultConfig = Object.assign({}, rulesetConfig);
var process = {
  firstRun: false,
  wakeupRun: false
};
async function loadRulesetConfig() {
  const sessionData = await sessionRead("rulesetConfig");
  if (sessionData) {
    Object.assign(rulesetConfig, sessionData);
    process.wakeupRun = true;
    return;
  }
  const localData = await localRead("rulesetConfig");
  if (localData) {
    Object.assign(rulesetConfig, localData);
    sessionWrite("rulesetConfig", rulesetConfig);
    return;
  }
  sessionWrite("rulesetConfig", rulesetConfig);
  localWrite("rulesetConfig", rulesetConfig);
  process.firstRun = true;
}
async function saveRulesetConfig() {
  sessionWrite("rulesetConfig", rulesetConfig);
  return localWrite("rulesetConfig", rulesetConfig);
}

// adblock/js/ext-utils.js
async function hasBroadHostPermissions() {
  return browser.permissions.getAll().then(
    (permissions) => permissions.origins.includes("<all_urls>") || permissions.origins.includes("*://*/*")
  ).catch(() => false);
}
async function gotoURL(url, type) {
  const pageURL = new URL(url, runtime.getURL("/"));
  const tabs = await browser.tabs.query({
    url: pageURL.href,
    windowType: type !== "popup" ? "normal" : "popup"
  });
  if (Array.isArray(tabs) && tabs.length !== 0) {
    const { windowId, id } = tabs[0];
    return Promise.all([
      browser.windows.update(windowId, { focused: true }),
      browser.tabs.update(id, { active: true })
    ]);
  }
  if (type === "popup") {
    return browser.windows.create({
      type: "popup",
      url: pageURL.href
    });
  }
  return browser.tabs.create({
    active: true,
    url: pageURL.href
  });
}

// adblock/js/mode-manager.js
var MODE_NONE = 0;
var MODE_BASIC = 1;
var MODE_OPTIMAL = 2;
var MODE_COMPLETE = 3;
var defaultFilteringModes = {
  none: [
    "amazon.com",
    "amazon.co.uk",
    "amazon.ca",
    "amazon.de",
    "amazon.fr",
    "amazon.it",
    "amazon.es",
    "amazon.co.jp",
    "amazon.in",
    "amazon.com.br",
    "amazon.com.au",
    "amazon.com.mx",
    "amazon.nl",
    "amazon.sg",
    "amazon.sa",
    "amazon.ae",
    "amazon.pl",
    "amazon.se",
    "amazon.com.be",
    "amazon.eg",
    "amazon.com.tr",
    "etsy.com",
    "aliexpress.com",
    "aliexpress.ru",
    "aliexpress.us",
    "ebay.com",
    "ebay.co.uk",
    "ebay.de",
    "ebay.fr",
    "ebay.it",
    "ebay.es",
    "ebay.ca",
    "ebay.com.au",
    "walmart.com",
    "walmart.ca",
    "apple.com"
  ],
  basic: [],
  optimal: ["all-urls"],
  complete: []
};
var exemptDomains = new Set(defaultFilteringModes.none);
var pruneDescendantHostnamesFromSet = (hostname, hnSet) => {
  for (const hn of hnSet) {
    if (hn.endsWith(hostname) === false) {
      continue;
    }
    if (hn === hostname) {
      continue;
    }
    if (hn.at(-hostname.length - 1) !== ".") {
      continue;
    }
    hnSet.delete(hn);
  }
};
var pruneHostnameFromSet = (hostname, hnSet) => {
  let hn = hostname;
  for (; ; ) {
    hnSet.delete(hn);
    hn = toBroaderHostname(hn);
    if (hn === "*") {
      break;
    }
  }
};
var serializeModeDetails = (details) => {
  return {
    none: Array.from(details.none),
    basic: Array.from(details.basic),
    optimal: Array.from(details.optimal),
    complete: Array.from(details.complete)
  };
};
var unserializeModeDetails = (details) => {
  return {
    none: new Set(details.none),
    basic: new Set(details.basic ?? details.network),
    optimal: new Set(details.optimal ?? details.extendedSpecific),
    complete: new Set(details.complete ?? details.extendedGeneric)
  };
};
function lookupFilteringMode(filteringModes, hostname) {
  const { none, basic, optimal, complete } = filteringModes;
  if (hostname === "all-urls") {
    if (filteringModes.none.has("all-urls")) {
      return MODE_NONE;
    }
    if (filteringModes.basic.has("all-urls")) {
      return MODE_BASIC;
    }
    if (filteringModes.optimal.has("all-urls")) {
      return MODE_OPTIMAL;
    }
    if (filteringModes.complete.has("all-urls")) {
      return MODE_COMPLETE;
    }
    return MODE_BASIC;
  }
  if (none.has(hostname)) {
    return MODE_NONE;
  }
  if (none.has("all-urls") === false) {
    if (isDescendantHostnameOfIter(hostname, none)) {
      return MODE_NONE;
    }
  }
  if (basic.has(hostname)) {
    return MODE_BASIC;
  }
  if (basic.has("all-urls") === false) {
    if (isDescendantHostnameOfIter(hostname, basic)) {
      return MODE_BASIC;
    }
  }
  if (optimal.has(hostname)) {
    return MODE_OPTIMAL;
  }
  if (optimal.has("all-urls") === false) {
    if (isDescendantHostnameOfIter(hostname, optimal)) {
      return MODE_OPTIMAL;
    }
  }
  if (complete.has(hostname)) {
    return MODE_COMPLETE;
  }
  if (complete.has("all-urls") === false) {
    if (isDescendantHostnameOfIter(hostname, complete)) {
      return MODE_COMPLETE;
    }
  }
  return lookupFilteringMode(filteringModes, "all-urls");
}
function applyFilteringMode(filteringModes, hostname, afterLevel) {
  const defaultLevel = lookupFilteringMode(filteringModes, "all-urls");
  if (hostname === "all-urls") {
    if (afterLevel === defaultLevel) {
      return afterLevel;
    }
    switch (afterLevel) {
      case MODE_NONE:
        filteringModes.none.clear();
        filteringModes.none.add("all-urls");
        break;
      case MODE_BASIC:
        filteringModes.basic.clear();
        filteringModes.basic.add("all-urls");
        break;
      case MODE_OPTIMAL:
        filteringModes.optimal.clear();
        filteringModes.optimal.add("all-urls");
        break;
      case MODE_COMPLETE:
        filteringModes.complete.clear();
        filteringModes.complete.add("all-urls");
        break;
    }
    switch (defaultLevel) {
      case MODE_NONE:
        filteringModes.none.delete("all-urls");
        break;
      case MODE_BASIC:
        filteringModes.basic.delete("all-urls");
        break;
      case MODE_OPTIMAL:
        filteringModes.optimal.delete("all-urls");
        break;
      case MODE_COMPLETE:
        filteringModes.complete.delete("all-urls");
        break;
    }
    return lookupFilteringMode(filteringModes, "all-urls");
  }
  const beforeLevel = lookupFilteringMode(filteringModes, hostname);
  if (afterLevel === beforeLevel) {
    return afterLevel;
  }
  const { none, basic, optimal, complete } = filteringModes;
  switch (beforeLevel) {
    case MODE_NONE:
      pruneHostnameFromSet(hostname, none);
      break;
    case MODE_BASIC:
      pruneHostnameFromSet(hostname, basic);
      break;
    case MODE_OPTIMAL:
      pruneHostnameFromSet(hostname, optimal);
      break;
    case MODE_COMPLETE:
      pruneHostnameFromSet(hostname, complete);
      break;
  }
  if (afterLevel !== defaultLevel) {
    switch (afterLevel) {
      case MODE_NONE:
        if (isDescendantHostnameOfIter(hostname, none) === false) {
          filteringModes.none.add(hostname);
          pruneDescendantHostnamesFromSet(hostname, none);
        }
        break;
      case MODE_BASIC:
        if (isDescendantHostnameOfIter(hostname, basic) === false) {
          filteringModes.basic.add(hostname);
          pruneDescendantHostnamesFromSet(hostname, basic);
        }
        break;
      case MODE_OPTIMAL:
        if (isDescendantHostnameOfIter(hostname, optimal) === false) {
          filteringModes.optimal.add(hostname);
          pruneDescendantHostnamesFromSet(hostname, optimal);
        }
        break;
      case MODE_COMPLETE:
        if (isDescendantHostnameOfIter(hostname, complete) === false) {
          filteringModes.complete.add(hostname);
          pruneDescendantHostnamesFromSet(hostname, complete);
        }
        break;
    }
  }
  return lookupFilteringMode(filteringModes, hostname);
}
async function readFilteringModeDetails(bypassCache = false) {
  if (bypassCache === false) {
    if (readFilteringModeDetails.cache) {
      return readFilteringModeDetails.cache;
    }
    const sessionModes = await sessionRead("filteringModeDetails");
    if (sessionModes instanceof Object) {
      readFilteringModeDetails.cache = unserializeModeDetails(sessionModes);
      return readFilteringModeDetails.cache;
    }
  }
  let [
    userModes = structuredClone(defaultFilteringModes),
    adminDefaultFiltering,
    adminNoFiltering
  ] = await Promise.all([
    localRead("filteringModeDetails"),
    adminReadEx("defaultFiltering"),
    adminReadEx("noFiltering")
  ]);
  userModes = unserializeModeDetails(userModes);
  if (adminDefaultFiltering !== void 0) {
    const modefromName = {
      none: MODE_NONE,
      basic: MODE_BASIC,
      optimal: MODE_OPTIMAL,
      complete: MODE_COMPLETE
    };
    const adminDefaultFilteringMode = modefromName[adminDefaultFiltering];
    if (adminDefaultFilteringMode !== void 0) {
      applyFilteringMode(userModes, "all-urls", adminDefaultFilteringMode);
    }
  }
  if (Array.isArray(adminNoFiltering) && adminNoFiltering.length !== 0) {
    if (adminNoFiltering.includes("-*")) {
      userModes.none.clear();
    }
    for (const hn of adminNoFiltering) {
      if (hn.charAt(0) === "-") {
        userModes.none.delete(hn.slice(1));
      } else {
        applyFilteringMode(userModes, hn, 0);
      }
    }
  }
  for (const hn of defaultFilteringModes.none) {
    applyFilteringMode(userModes, hn, MODE_NONE);
  }
  filteringModesToDNR(userModes);
  sessionWrite("filteringModeDetails", serializeModeDetails(userModes));
  readFilteringModeDetails.cache = userModes;
  return userModes;
}
async function writeFilteringModeDetails(afterDetails) {
  await filteringModesToDNR(afterDetails);
  const data = serializeModeDetails(afterDetails);
  localWrite("filteringModeDetails", data);
  sessionWrite("filteringModeDetails", data);
  readFilteringModeDetails.cache = unserializeModeDetails(data);
  return Promise.all([
    getDefaultFilteringMode(),
    hasBroadHostPermissions(),
    localWrite("filteringModeDetails", data),
    sessionWrite("filteringModeDetails", data)
  ]).then((results) => {
    broadcastMessage({
      defaultFilteringMode: results[0],
      hasOmnipotence: results[1],
      filteringModeDetails: readFilteringModeDetails.cache
    });
  });
}
async function getFilteringModeDetails(serializable = false) {
  const actualDetails = await readFilteringModeDetails();
  const out = {
    none: new Set(actualDetails.none),
    basic: new Set(actualDetails.basic),
    optimal: new Set(actualDetails.optimal),
    complete: new Set(actualDetails.complete)
  };
  return serializable ? serializeModeDetails(out) : out;
}
async function setFilteringModeDetails(details) {
  await localWrite("filteringModeDetails", serializeModeDetails(details));
  await readFilteringModeDetails(true);
}
async function getFilteringMode(hostname) {
  const filteringModes = await getFilteringModeDetails();
  return lookupFilteringMode(filteringModes, hostname);
}
async function setFilteringMode(hostname, afterLevel) {
  if (afterLevel !== MODE_NONE && exemptDomains.has(hostname)) {
    return MODE_NONE;
  }
  const filteringModes = await getFilteringModeDetails();
  const level = applyFilteringMode(filteringModes, hostname, afterLevel);
  await writeFilteringModeDetails(filteringModes);
  return level;
}
function getDefaultFilteringMode() {
  return getFilteringMode("all-urls");
}
function setDefaultFilteringMode(afterLevel) {
  return setFilteringMode("all-urls", afterLevel);
}
async function persistHostPermissions(iter) {
  if (iter === void 0) {
    const permissions = await browser.permissions.getAll();
    iter = hostnamesFromMatches(permissions.origins) || [];
  }
  const hostnames = Array.from(iter);
  return hostnames.length !== 0 ? localWrite("permissions.hostnames", hostnames) : localRemove("permissions.hostnames");
}
async function syncWithBrowserPermissions() {
  const [
    beforePermissions,
    afterPermissions,
    beforeMode
  ] = await Promise.all([
    localRead("permissions.hostnames"),
    browser.permissions.getAll(),
    getDefaultFilteringMode()
  ]);
  const beforeAllowedHostnames = new Set(beforePermissions);
  const afterAllowedHostnames = new Set(hostnamesFromMatches(afterPermissions.origins || []));
  await persistHostPermissions(afterAllowedHostnames);
  const hasBroadHostPermissions2 = afterAllowedHostnames.has("all-urls");
  const broadHostPermissionsToggled = hasBroadHostPermissions2 !== rulesetConfig.hasBroadHostPermissions;
  let modified = false;
  if (beforeMode > MODE_BASIC && hasBroadHostPermissions2 === false) {
    await setDefaultFilteringMode(MODE_BASIC);
    modified = true;
  } else if (beforeMode === MODE_BASIC && hasBroadHostPermissions2 && broadHostPermissionsToggled) {
    await setDefaultFilteringMode(MODE_OPTIMAL);
    modified = true;
  }
  if (broadHostPermissionsToggled) {
    rulesetConfig.hasBroadHostPermissions = hasBroadHostPermissions2;
    saveRulesetConfig();
  }
  const afterMode = await getDefaultFilteringMode();
  if (afterMode > MODE_BASIC) {
    return afterMode !== beforeMode;
  }
  const filteringModes = await getFilteringModeDetails();
  if (afterAllowedHostnames.has("all-urls") === false) {
    const { none, basic, optimal, complete } = filteringModes;
    for (const hn of /* @__PURE__ */ new Set([...optimal, ...complete])) {
      if (afterAllowedHostnames.has(hn)) {
        continue;
      }
      if (isDescendantHostnameOfIter(hn, afterAllowedHostnames)) {
        continue;
      }
      applyFilteringMode(filteringModes, hn, afterMode);
      modified = true;
    }
    for (const hn of afterAllowedHostnames) {
      if (beforeAllowedHostnames.has(hn)) {
        continue;
      }
      if (optimal.has(hn) || complete.has(hn)) {
        continue;
      }
      if (basic.has(hn) || none.has(hn)) {
        continue;
      }
      applyFilteringMode(filteringModes, hn, MODE_OPTIMAL);
      modified = true;
    }
    if (modified) {
      await writeFilteringModeDetails(filteringModes);
    }
  }
  return modified;
}

// adblock/js/admin.js
async function loadAdminConfig() {
  const [
    showBlockedCount,
    strictBlockMode
  ] = await Promise.all([
    adminReadEx("showBlockedCount"),
    adminReadEx("strictBlockMode")
  ]);
  applyAdminConfig({ showBlockedCount, strictBlockMode });
}
function applyAdminConfig(config, apply = false) {
  const toApply = [];
  for (const [key, val] of Object.entries(config)) {
    if (typeof val !== typeof rulesetConfig[key]) {
      continue;
    }
    if (val === rulesetConfig[key]) {
      continue;
    }
    rulesetConfig[key] = val;
    toApply.push(key);
  }
  if (toApply.length === 0) {
    return;
  }
  saveRulesetConfig();
  if (apply !== true) {
    return;
  }
  while (toApply.length !== 0) {
    const key = toApply.pop();
    switch (key) {
      case "showBlockedCount": {
        if (typeof dnr.setExtensionActionOptions !== "function") {
          break;
        }
        const { showBlockedCount } = config;
        dnr.setExtensionActionOptions({
          displayActionCountAsBadgeText: showBlockedCount
        });
        broadcastMessage({ showBlockedCount });
        break;
      }
      case "strictBlockMode": {
        const { strictBlockMode } = config;
        setStrictBlockMode(strictBlockMode, true).then(() => {
          broadcastMessage({ strictBlockMode });
        });
        break;
      }
      default:
        break;
    }
  }
}
var adminSettings = {
  keys: /* @__PURE__ */ new Map(),
  timer: void 0,
  change(key, value) {
    this.keys.set(key, value);
    if (this.timer !== void 0) {
      return;
    }
    this.timer = self.setTimeout(() => {
      this.timer = void 0;
      this.process();
    }, 127);
  },
  async process() {
    if (this.keys.has("rulesets")) {
      adblockLog('admin setting "rulesets" changed');
      await enableRulesets(rulesetConfig.enabledRulesets);
      await registerInjectables();
      const results = await Promise.all([
        getAdminRulesets(),
        dnr.getEnabledRulesets()
      ]);
      const [adminRulesets, enabledRulesets] = results;
      broadcastMessage({ adminRulesets, enabledRulesets });
    }
    if (this.keys.has("defaultFiltering")) {
      adblockLog('admin setting "defaultFiltering" changed');
      await readFilteringModeDetails(true);
      await registerInjectables();
      const defaultFilteringMode = await getDefaultFilteringMode();
      broadcastMessage({ defaultFilteringMode });
    }
    if (this.keys.has("noFiltering")) {
      adblockLog('admin setting "noFiltering" changed');
      const filteringModeDetails = await readFilteringModeDetails(true);
      broadcastMessage({ filteringModeDetails });
    }
    if (this.keys.has("showBlockedCount")) {
      adblockLog('admin setting "showBlockedCount" changed');
      const showBlockedCount = this.keys.get("showBlockedCount");
      applyAdminConfig({ showBlockedCount }, true);
    }
    if (this.keys.has("strictBlockMode")) {
      adblockLog('admin setting "strictBlockMode" changed');
      const strictBlockMode = this.keys.get("strictBlockMode");
      applyAdminConfig({ strictBlockMode }, true);
    }
    this.keys.clear();
  }
};
async function getAdminRulesets() {
  const [
    adminList,
    rulesetDetails
  ] = await Promise.all([
    adminReadEx("rulesets"),
    getRulesetDetails()
  ]);
  const adminRulesets = new Set(Array.isArray(adminList) && adminList || []);
  if (adminRulesets.has("-default")) {
    adminRulesets.delete("-default");
    for (const ruleset of rulesetDetails.values()) {
      if (ruleset.enabled !== true) {
        continue;
      }
      if (adminRulesets.has(`+${ruleset.id}`)) {
        continue;
      }
      adminRulesets.add(`-${ruleset.id}`);
    }
  }
  if (adminRulesets.has("+default")) {
    adminRulesets.delete("+default");
    for (const ruleset of rulesetDetails.values()) {
      if (ruleset.enabled !== true) {
        continue;
      }
      if (adminRulesets.has(`-${ruleset.id}`)) {
        continue;
      }
      adminRulesets.add(`+${ruleset.id}`);
    }
  }
  if (adminRulesets.has("-*")) {
    adminRulesets.delete("-*");
    for (const ruleset of rulesetDetails.values()) {
      if (ruleset.enabled) {
        continue;
      }
      if (adminRulesets.has(`+${ruleset.id}`)) {
        continue;
      }
      adminRulesets.add(`-${ruleset.id}`);
    }
  }
  return Array.from(adminRulesets);
}
async function adminReadEx(key) {
  let cacheValue;
  const session = await sessionRead(`admin.${key}`);
  if (session) {
    cacheValue = session.data;
  } else {
    const local = await localRead(`admin.${key}`);
    if (local) {
      cacheValue = local.data;
    }
    localRemove(`admin_${key}`);
  }
  adminRead(key).then(async (value) => {
    const adminKey = `admin.${key}`;
    await Promise.all([
      sessionWrite(adminKey, { data: value }),
      localWrite(adminKey, { data: value })
    ]);
    if (JSON.stringify(value) === JSON.stringify(cacheValue)) {
      return;
    }
    adminSettings.change(key, value);
  });
  return cacheValue;
}

// adblock/js/dnr-parser.js
var validActionValues = [
  "block",
  "redirect",
  "allow",
  "upgradeScheme",
  "modifyHeaders",
  "allowAllRequests"
];
var validBoolValues = [
  "false",
  "true"
];
var validHeaderOpValues = [
  "append",
  "remove",
  "set"
];
var validDomainTypeValues = [
  "firstParty",
  "thirdParty"
];
var validRequestMethodValues = [
  "connect",
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "other"
];
var validResourceTypeValues = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other"
];
function selectParser(scope, rule, node) {
  const parser = perScopeParsers[scope.join(".")];
  if (parser === void 0) {
    return false;
  }
  return parser(scope, rule, node);
}
var perScopeParsers = {
  "": function(scope, rule, node) {
    const { key, val } = node;
    switch (key) {
      case "action":
      case "condition":
        if (val !== void 0) {
          return false;
        }
        rule[key] = {};
        scope.push(key);
        break;
      case "id": {
        const n = parseInt(val, 10);
        if (isNaN(n) || n < 1) {
          return false;
        }
        rule.id = n;
        break;
      }
      case "priority": {
        const n = parseInt(val, 10);
        if (isNaN(n) || n < 1) {
          return false;
        }
        rule.priority = n;
        break;
      }
      default:
        return false;
    }
    return true;
  },
  "action": function(scope, rule, node) {
    const { key, val } = node;
    switch (key) {
      case "type":
        if (validActionValues.includes(val) === false) {
          return false;
        }
        rule.action.type = val;
        break;
      case "redirect":
        rule.action.redirect = {};
        scope.push("redirect");
        break;
      case "requestHeaders":
      case "responseHeaders":
        rule.action[key] = [];
        scope.push(key);
        break;
      default:
        return false;
    }
    return true;
  },
  "action.redirect": function(scope, rule, node) {
    const { key, val } = node;
    switch (key) {
      case "extensionPath":
      case "regexSubstitution":
      case "url":
        rule.action.redirect[key] = val;
        break;
      case "transform":
        rule.action.redirect.transform = {};
        scope.push("transform");
        break;
      default:
        return false;
    }
    return true;
  },
  "action.redirect.transform": function(scope, rule, node) {
    const { key, val } = node;
    switch (key) {
      case "fragment":
      case "host":
      case "path":
      case "port":
      case "query":
      case "scheme": {
        if (val === void 0) {
          return false;
        }
        rule.action.redirect.transform[key] = val;
        break;
      }
      case "queryTransform":
        rule.action.redirect.transform.queryTransform = {};
        scope.push("queryTransform");
        break;
      default:
        return false;
    }
    return true;
  },
  "action.redirect.transform.queryTransform": function(scope, rule, node) {
    const { key, val } = node;
    if (val !== void 0) {
      return false;
    }
    switch (key) {
      case "addOrReplaceParams":
      case "removeParams":
        rule.action.redirect.transform.queryTransform[key] = [];
        scope.push(key);
        break;
      default:
        return false;
    }
    return true;
  },
  "action.redirect.transform.queryTransform.addOrReplaceParams": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    rule.action.redirect.transform.queryTransform.addOrReplaceParams.push({});
    scope.push("@");
    return selectParser(scope, rule, node);
  },
  "action.redirect.transform.queryTransform.addOrReplaceParams.@": function(scope, rule, node) {
    const { key, val } = node;
    if (val === void 0) {
      return false;
    }
    const item = rule.action.redirect.transform.queryTransform.addOrReplaceParams.at(-1);
    switch (key) {
      case "key":
      case "value":
        item[key] = val;
        break;
      case "replaceOnly":
        if (validBoolValues.includes(val) === false) {
          return false;
        }
        item.replaceOnly = val === "true";
        break;
      default:
        return false;
    }
    return true;
  },
  "action.redirect.transform.queryTransform.removeParams": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    rule.action.redirect.transform.queryTransform.removeParams.push(node.val);
    return true;
  },
  "action.requestHeaders": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    rule.action.requestHeaders.push({});
    scope.push("@");
    return selectParser(scope, rule, node);
  },
  "action.requestHeaders.@": function(scope, rule, node) {
    const { key, val } = node;
    const item = rule.action.requestHeaders.at(-1);
    switch (key) {
      case "header":
      case "value":
        item[key] = val;
        break;
      case "operation":
        if (validHeaderOpValues.includes(val) === false) {
          return false;
        }
        item.operation = val;
        break;
      default:
        return false;
    }
    return true;
  },
  "action.responseHeaders": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    rule.action.responseHeaders.push({});
    scope.push("@");
    return selectParser(scope, rule, node);
  },
  "action.responseHeaders.@": function(scope, rule, node) {
    const { key, val } = node;
    const item = rule.action.responseHeaders.at(-1);
    switch (key) {
      case "header":
      case "value":
        item[key] = val;
        break;
      case "operation":
        if (validHeaderOpValues.includes(val) === false) {
          return false;
        }
        item.operation = val;
        break;
      default:
        return false;
    }
    return true;
  },
  "condition": function(scope, rule, node) {
    const { key, val } = node;
    switch (key) {
      case "domainType":
        if (validDomainTypeValues.includes(val) === false) {
          return false;
        }
        rule.condition.domainType = val;
        break;
      case "isUrlFilterCaseSensitive":
        if (validBoolValues.includes(val) === false) {
          return false;
        }
        rule.condition.isUrlFilterCaseSensitive = val === "true";
        break;
      case "regexFilter":
      case "urlFilter":
        if (val === void 0) {
          return false;
        }
        rule.condition[key] = val;
        break;
      case "initiatorDomains":
      case "excludedInitiatorDomains":
      case "requestDomains":
      case "excludedRequestDomains":
      case "resourceTypes":
      case "excludedResourceTypes":
      case "requestMethods":
      case "excludedRequestMethods":
      case "responseHeaders":
      case "excludedResponseHeaders":
        rule.condition[key] = [];
        scope.push(key);
        break;
      case "tabIds":
        rule.condition.tabIds = [];
        scope.push("tabIds");
        break;
      default:
        return false;
    }
    return true;
  },
  "condition.initiatorDomains": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    rule.condition.initiatorDomains.push(node.val);
    return true;
  },
  "condition.excludedInitiatorDomains": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    rule.condition.excludedInitiatorDomains.push(node.val);
    return true;
  },
  "condition.domains": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    rule.condition.domains.push(node.val);
    return true;
  },
  "condition.excludedDomains": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    rule.condition.excludedDomains.push(node.val);
    return true;
  },
  "condition.requestDomains": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    rule.condition.requestDomains.push(node.val);
    return true;
  },
  "condition.excludedRequestDomains": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    rule.condition.excludedRequestDomains.push(node.val);
    return true;
  },
  "condition.resourceTypes": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    if (validResourceTypeValues.includes(node.val) === false) {
      return false;
    }
    rule.condition.resourceTypes.push(node.val);
    return true;
  },
  "condition.excludedResourceTypes": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    if (validResourceTypeValues.includes(node.val) === false) {
      return false;
    }
    rule.condition.excludedResourceTypes.push(node.val);
    return true;
  },
  "condition.requestMethods": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    if (validRequestMethodValues.includes(node.val) === false) {
      return false;
    }
    rule.condition.requestMethods.push(node.val);
    return true;
  },
  "condition.excludedRequestMethods": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    if (validRequestMethodValues.includes(node.val) === false) {
      return false;
    }
    rule.condition.excludedRequestMethods.push(node.val);
    return true;
  },
  "condition.responseHeaders": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    rule.condition.responseHeaders.push({});
    scope.push("@");
    return selectParser(scope, rule, node);
  },
  "condition.responseHeaders.@": function(scope, rule, node) {
    const item = rule.condition.responseHeaders.at(-1);
    switch (node.key) {
      case "header":
        if (node.val === void 0) {
          return false;
        }
        item.header = node.val;
        break;
      case "values":
      case "excludedValues":
        item[node.key] = [];
        scope.push(node.key);
        break;
      default:
        return false;
    }
    return true;
  },
  "condition.responseHeaders.@.values": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    const item = rule.condition.responseHeaders.at(-1);
    item.values.push(node.val);
    return true;
  },
  "condition.responseHeaders.@.excludedValues": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    const item = rule.condition.responseHeaders.at(-1);
    item.excludedValues.push(node.val);
    return true;
  },
  "condition.excludedResponseHeaders": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    rule.condition.excludedResponseHeaders.push({});
    scope.push("@");
    return selectParser(scope, rule, node);
  },
  "condition.excludedResponseHeaders.@": function(scope, rule, node) {
    const item = rule.condition.excludedResponseHeaders.at(-1);
    switch (node.key) {
      case "header":
        if (node.val === void 0) {
          return false;
        }
        item.header = node.val;
        break;
      case "values":
      case "excludedValues":
        item[node.key] = [];
        scope.push(node.key);
        break;
      default:
        return false;
    }
    return true;
  },
  "condition.excludedResponseHeaders.@.values": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    const item = rule.condition.excludedResponseHeaders.at(-1);
    item.values.push(node.val);
    return true;
  },
  "condition.excludedResponseHeaders.@.excludedValues": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    const item = rule.condition.excludedResponseHeaders.at(-1);
    item.excludedValues.push(node.val);
    return true;
  },
  "condition.tabIds": function(scope, rule, node) {
    if (node.list !== true) {
      return false;
    }
    const n = parseInt(node.val, 10);
    if (isNaN(n) || n === 0) {
      return false;
    }
    rule.condition.tabIds.push(n);
  }
};
function depthFromIndent(line) {
  const match = /^\s*/.exec(line);
  const count = match[0].length;
  if ((count & 1) !== 0) {
    return -1;
  }
  return count / 2;
}
function nodeFromLine(line) {
  const match = reNodeParser.exec(line);
  const out = {};
  if (match === null) {
    return out;
  }
  if (match[1]) {
    out.list = true;
  }
  if (match[4]) {
    out.val = match[4].trim();
  } else if (match[3]) {
    out.key = match[2];
    out.val = match[3].trim();
    if (out.val === "''") {
      out.val = "";
    }
    ;
  } else {
    out.key = match[2];
  }
  return out;
}
var reNodeParser = /^\s*(- )?(?:(\S+):( \S.*)?|(\S.*))$/;
function ruleFromLines(lines, indices) {
  const rule = {};
  const bad = [];
  const scope = [];
  for (const i of indices) {
    const line = lines[i];
    const depth = depthFromIndent(line);
    if (depth < 0) {
      bad.push(i);
      continue;
    }
    scope.length = depth;
    const node = nodeFromLine(line);
    const result = selectParser(scope, rule, node);
    if (result === false) {
      bad.push(i);
    }
  }
  if (bad.length !== 0) {
    return { bad };
  }
  return { rule };
}
function rulesFromText(text) {
  const rules = [];
  const bad = [];
  const lines = [...text.split(/\n\r|\r\n|\n|\r/), "---"];
  const indices = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (line.trim().startsWith("#")) {
      continue;
    }
    if (line !== "---" && line !== "...") {
      indices.push(i);
      continue;
    }
    while (indices.length !== 0) {
      const s = lines[indices[0]].trim();
      if (s.length !== 0) {
        break;
      }
      indices.shift();
    }
    while (indices.length !== 0) {
      const s = lines[indices.at(-1)].trim();
      if (s.length !== 0) {
        break;
      }
      indices.pop();
    }
    if (indices.length === 0) {
      continue;
    }
    const result = ruleFromLines(lines, indices);
    if (result.bad) {
      bad.push(...result.bad.slice(0, 4));
    } else if (result.rule) {
      rules.push(result.rule);
    }
    indices.length = 0;
  }
  return { rules, bad };
}

// adblock/js/ruleset-manager.js
var SPECIAL_RULES_REALM = 5e6;
var USER_RULES_BASE_RULE_ID = 9e6;
var USER_RULES_PRIORITY = 1e6;
var TRUSTED_DIRECTIVE_BASE_RULE_ID = 8e6;
var TRUSTED_DIRECTIVE_PRIORITY = USER_RULES_PRIORITY + 1e6;
var STRICTBLOCK_PRIORITY = 29;
var isStrictBlockRule = (rule) => {
  if (rule.priority !== STRICTBLOCK_PRIORITY) {
    return false;
  }
  if (rule.condition?.resourceTypes === void 0) {
    return false;
  }
  if (rule.condition.resourceTypes.length !== 1) {
    return false;
  }
  if (rule.condition.resourceTypes[0] !== "main_frame") {
    return false;
  }
  if (rule.action.type === "redirect") {
    const substitution = rule.action.redirect.regexSubstitution;
    return substitution !== void 0 && substitution.includes("/strictblock.");
  }
  if (rule.action.type === "allow") {
    return Array.isArray(rule.condition?.requestDomains);
  }
  return false;
};
function getRulesetDetails() {
  if (getRulesetDetails.rulesetDetailsPromise !== void 0) {
    return getRulesetDetails.rulesetDetailsPromise;
  }
  getRulesetDetails.rulesetDetailsPromise = fetchJSON("/rulesets/ruleset-details").then((entries) => {
    const rulesMap = new Map(entries.map((entry) => [entry.id, entry]));
    return rulesMap;
  });
  return getRulesetDetails.rulesetDetailsPromise;
}
async function pruneInvalidRegexRules(realm, rulesIn, rejected = []) {
  const validateRegex = (regex) => {
    return dnr.isRegexSupported({ regex, isCaseSensitive: false }).then((result) => {
      pruneInvalidRegexRules.validated.set(regex, result?.reason || true);
      if (result.isSupported) {
        return true;
      }
      rejected.push({ regex, reason: result?.reason });
      return false;
    });
  };
  const toCheck = [];
  for (const rule of rulesIn) {
    if (rule.condition?.regexFilter === void 0) {
      toCheck.push(true);
      continue;
    }
    const { regexFilter } = rule.condition;
    const reason = pruneInvalidRegexRules.validated.get(regexFilter);
    if (reason !== void 0) {
      toCheck.push(reason === true);
      if (reason === true) {
        continue;
      }
      rejected.push({ regex: regexFilter, reason });
      continue;
    }
    toCheck.push(validateRegex(regexFilter));
  }
  const isValid = await Promise.all(toCheck);
  if (rejected.length !== 0) {
    adblockLog(
      `${realm} realm: rejected regexes:
`,
      rejected.map((e) => `${e.regex} \u2192 ${e.reason}`).join("\n")
    );
  }
  return rulesIn.filter((v, i) => isValid[i]);
}
pruneInvalidRegexRules.validated = /* @__PURE__ */ new Map();
async function getDynamicRegexRuleCount() {
  const rules = await dnr.getDynamicRules();
  const regexRules = rules.filter((a) => Boolean(a.condition?.regexFilter));
  return regexRules.length;
}
async function updateRegexRules(currentRules, addRules, removeRuleIds) {
  for (const rule of currentRules) {
    if (rule.id === 0) {
      continue;
    }
    if (rule.id >= SPECIAL_RULES_REALM) {
      continue;
    }
    if (rule.condition.regexFilter === void 0) {
      continue;
    }
    removeRuleIds.push(rule.id);
  }
  const rulesetDetails = await getEnabledRulesetsDetails();
  const toFetch = [];
  for (const details of rulesetDetails) {
    if (details.rules.regex === 0) {
      continue;
    }
    toFetch.push(fetchJSON(`/rulesets/regex/${details.id}`));
  }
  const regexRulesets = await Promise.all(toFetch);
  const allRules = [];
  for (const rules of regexRulesets) {
    if (Array.isArray(rules) === false) {
      continue;
    }
    for (const rule of rules) {
      allRules.push(rule);
    }
  }
  if (allRules.length === 0) {
    return;
  }
  const validRules = await pruneInvalidRegexRules("regexes", allRules);
  if (validRules.length === 0) {
    return;
  }
  adblockLog(`Add ${validRules.length} DNR regex rules`);
  addRules.push(...validRules);
}
async function updateDynamicRules() {
  const currentRules = await dnr.getDynamicRules();
  const removeRuleIds = [];
  for (const rule of currentRules) {
    if (rule.id >= SPECIAL_RULES_REALM) {
      continue;
    }
    removeRuleIds.push(rule.id);
    rule.id = 0;
  }
  const addRules = [];
  await updateRegexRules(currentRules, addRules, removeRuleIds);
  if (addRules.length === 0 && removeRuleIds.length === 0) {
    return;
  }
  const dynamicRegexCountBefore = await getDynamicRegexRuleCount();
  let dynamicRegexCountAfter = 0;
  let ruleId = 1;
  for (const rule of addRules) {
    if (rule?.condition.regexFilter) {
      dynamicRegexCountAfter += 1;
    }
    rule.id = ruleId++;
  }
  if (dynamicRegexCountAfter !== 0) {
    adblockLog(`Using ${dynamicRegexCountAfter}/${dnr.MAX_NUMBER_OF_REGEX_RULES} dynamic regex-based DNR rules`);
  }
  if (dynamicRegexCountAfter > dynamicRegexCountBefore) {
    await clearSessionRules();
  }
  const response = {};
  try {
    await dnr.updateDynamicRules({ addRules, removeRuleIds });
    if (removeRuleIds.length !== 0) {
      adblockLog(`Remove ${removeRuleIds.length} dynamic DNR rules`);
    }
    if (addRules.length !== 0) {
      adblockLog(`Add ${addRules.length} dynamic DNR rules`);
    }
  } catch (reason) {
    adblockErr(`updateDynamicRules/${reason}`);
    response.error = `${reason}`;
  }
  const result = await updateSessionRules();
  if (result?.error) {
    response.error ||= result.error;
  }
  return response;
}
async function getEffectiveDynamicRules() {
  const allRules = await dnr.getDynamicRules();
  const dynamicRules = [];
  for (const rule of allRules) {
    if (rule.id >= USER_RULES_BASE_RULE_ID) {
      continue;
    }
    dynamicRules.push(rule);
  }
  return dynamicRules;
}
async function updateStrictBlockRules(currentRules, addRules, removeRuleIds) {
  for (const rule of currentRules) {
    if (isStrictBlockRule(rule) === false) {
      continue;
    }
    removeRuleIds.push(rule.id);
  }
  if (rulesetConfig.strictBlockMode === false) {
    return;
  }
  if (webextFlavor === "safari") {
    return;
  }
  const [
    hasOmnipotence,
    rulesetDetails,
    permanentlyExcluded = [],
    temporarilyExcluded = []
  ] = await Promise.all([
    hasBroadHostPermissions(),
    getEnabledRulesetsDetails(),
    localRead("excludedStrictBlockHostnames"),
    sessionRead("excludedStrictBlockHostnames")
  ]);
  if (hasOmnipotence === false) {
    localRemove("excludedStrictBlockHostnames");
    sessionRemove("excludedStrictBlockHostnames");
    return;
  }
  const toFetch = [];
  for (const details of rulesetDetails) {
    if (details.rules.strictblock === 0) {
      continue;
    }
    toFetch.push(fetchJSON(`/rulesets/strictblock/${details.id}`));
  }
  const rulesets2 = await Promise.all(toFetch);
  const substitution = `${runtime.getURL("/strictblock.html")}#\\0`;
  const allRules = [];
  for (const rules of rulesets2) {
    if (Array.isArray(rules) === false) {
      continue;
    }
    for (const rule of rules) {
      rule.action.redirect.regexSubstitution = substitution;
      allRules.push(rule);
    }
  }
  const validRules = await pruneInvalidRegexRules("strictblock", allRules);
  if (validRules.length === 0) {
    return;
  }
  adblockLog(`Add ${validRules.length} DNR strictblock rules`);
  for (const rule of validRules) {
    rule.priority = STRICTBLOCK_PRIORITY;
    addRules.push(rule);
  }
  const allExcluded = permanentlyExcluded.concat(temporarilyExcluded);
  if (allExcluded.length === 0) {
    return;
  }
  addRules.unshift({
    action: { type: "allow" },
    condition: {
      requestDomains: allExcluded,
      resourceTypes: ["main_frame"]
    },
    priority: STRICTBLOCK_PRIORITY
  });
  adblockLog(`Add 1 DNR session rule with ${allExcluded.length} for excluded strict-block domains`);
}
async function excludeFromStrictBlock(hostname, permanent) {
  if (typeof hostname !== "string" || hostname === "") {
    return;
  }
  const readFn = permanent ? localRead : sessionRead;
  const hostnames = new Set(await readFn("excludedStrictBlockHostnames"));
  hostnames.add(hostname);
  const writeFn = permanent ? localWrite : sessionWrite;
  await writeFn("excludedStrictBlockHostnames", Array.from(hostnames));
  return updateSessionRules();
}
async function setStrictBlockMode(state, force = false) {
  const newState = Boolean(state);
  if (force === false) {
    if (newState === rulesetConfig.strictBlockMode) {
      return;
    }
  }
  rulesetConfig.strictBlockMode = newState;
  const promises = [saveRulesetConfig()];
  if (newState === false) {
    promises.push(
      localRemove("excludedStrictBlockHostnames"),
      sessionRemove("excludedStrictBlockHostnames")
    );
  }
  await Promise.all(promises);
  return updateSessionRules();
}
async function updateSessionRules() {
  const addRulesUnfiltered = [];
  const removeRuleIds = [];
  const currentRules = await dnr.getSessionRules();
  await updateStrictBlockRules(currentRules, addRulesUnfiltered, removeRuleIds);
  if (addRulesUnfiltered.length === 0 && removeRuleIds.length === 0) {
    return;
  }
  const maxRegexCount = dnr.MAX_NUMBER_OF_REGEX_RULES * 0.95;
  const dynamicRegexCount = await getDynamicRegexRuleCount();
  let regexCount = dynamicRegexCount;
  let ruleId = 1;
  for (const rule of addRulesUnfiltered) {
    rule.id = ruleId++;
    if (Boolean(rule.condition.regexFilter) === false) {
      continue;
    }
    regexCount += 1;
    if (regexCount < maxRegexCount) {
      continue;
    }
    rule.id = 0;
  }
  const sessionRegexCount = regexCount - dynamicRegexCount;
  const addRules = addRulesUnfiltered.filter((a) => a.id !== 0);
  const rejectedRuleCount = addRulesUnfiltered.length - addRules.length;
  if (rejectedRuleCount !== 0) {
    adblockLog(`Too many regex-based filters, ${rejectedRuleCount} session rules dropped`);
  }
  if (sessionRegexCount !== 0) {
    adblockLog(`Using ${sessionRegexCount}/${dnr.MAX_NUMBER_OF_REGEX_RULES} session regex-based DNR rules`);
  }
  const response = {};
  try {
    await dnr.updateSessionRules({ addRules, removeRuleIds });
    if (removeRuleIds.length !== 0) {
      adblockLog(`Remove ${removeRuleIds.length} session DNR rules`);
    }
    if (addRules.length !== 0) {
      adblockLog(`Add ${addRules.length} session DNR rules`);
    }
  } catch (reason) {
    adblockErr(`updateSessionRules/${reason}`);
    response.error = `${reason}`;
  }
  return response;
}
async function clearSessionRules() {
  const currentRules = await dnr.getSessionRules();
  if (currentRules.length === 0) {
    return;
  }
  const removeRuleIds = currentRules.map((a) => a.id);
  return dnr.updateSessionRules({ removeRuleIds });
}
async function getEffectiveSessionRules() {
  const allRules = await dnr.getSessionRules();
  const sessionRules = [];
  for (const rule of allRules) {
    if (rule.id >= USER_RULES_BASE_RULE_ID) {
      continue;
    }
    sessionRules.push(rule);
  }
  return sessionRules;
}
async function filteringModesToDNR(modes) {
  const noneHostnames = /* @__PURE__ */ new Set([...modes.none]);
  const notNoneHostnames = /* @__PURE__ */ new Set([...modes.basic, ...modes.optimal, ...modes.complete]);
  const requestDomains = [];
  const excludedRequestDomains = [];
  const allowEverywhere = noneHostnames.has("all-urls");
  if (allowEverywhere) {
    excludedRequestDomains.push(...notNoneHostnames);
  } else {
    requestDomains.push(...noneHostnames);
  }
  const noneCount = allowEverywhere ? notNoneHostnames.size : noneHostnames.size;
  return dnr.setAllowAllRules(
    TRUSTED_DIRECTIVE_BASE_RULE_ID,
    requestDomains.sort(),
    excludedRequestDomains.sort(),
    allowEverywhere,
    TRUSTED_DIRECTIVE_PRIORITY
  ).then((modified) => {
    if (modified === false) {
      return;
    }
    adblockLog(`${allowEverywhere ? "Enabled" : "Disabled"} DNR filtering for ${noneCount} sites`);
  });
}
async function getDefaultRulesetsFromEnv() {
  const dropCountry = (lang) => {
    const pos = lang.indexOf("-");
    if (pos === -1) {
      return lang;
    }
    return lang.slice(0, pos);
  };
  const langSet = /* @__PURE__ */ new Set();
  for (const lang of navigator.languages.map(dropCountry)) {
    langSet.add(lang);
  }
  langSet.add(dropCountry(i18n.getUILanguage()));
  const reTargetLang = new RegExp(
    `\\b(${Array.from(langSet).join("|")})\\b`
  );
  const reMobile = /\bMobile\b/.test(navigator.userAgent) ? /\bmobile\b/ : null;
  const rulesetDetails = await getRulesetDetails();
  const out = [];
  for (const ruleset of rulesetDetails.values()) {
    const { id, enabled } = ruleset;
    if (enabled) {
      out.push(id);
      continue;
    }
    if (typeof ruleset.lang === "string") {
      if (reTargetLang.test(ruleset.lang)) {
        out.push(id);
        continue;
      }
    }
    if (typeof ruleset.tags === "string") {
      if (reMobile?.test(ruleset.tags)) {
        out.push(id);
        continue;
      }
    }
  }
  return out;
}
async function patchDefaultRulesets() {
  const [
    oldDefaultIds = [],
    newDefaultIds,
    staticRulesetIds
  ] = await Promise.all([
    localRead("defaultRulesetIds"),
    getDefaultRulesetsFromEnv(),
    getStaticRulesets().then((r) => r.map((a) => a.id))
  ]);
  const toAdd = [];
  const toRemove = [];
  for (const id of newDefaultIds) {
    if (oldDefaultIds.includes(id)) {
      continue;
    }
    toAdd.push(id);
  }
  for (const id of oldDefaultIds) {
    if (newDefaultIds.includes(id)) {
      continue;
    }
    toRemove.push(id);
  }
  for (const id of rulesetConfig.enabledRulesets) {
    if (staticRulesetIds.includes(id)) {
      continue;
    }
    toRemove.push(id);
  }
  localWrite("defaultRulesetIds", newDefaultIds);
  if (toAdd.length === 0 && toRemove.length === 0) {
    return;
  }
  const enabledRulesets = new Set(rulesetConfig.enabledRulesets);
  toAdd.forEach((id) => enabledRulesets.add(id));
  toRemove.forEach((id) => enabledRulesets.delete(id));
  const patchedRulesets = Array.from(enabledRulesets);
  adblockLog(`Patched rulesets: ${rulesetConfig.enabledRulesets} => ${patchedRulesets}`);
  rulesetConfig.enabledRulesets = patchedRulesets;
}
async function enableRulesets(ids) {
  const afterIds = new Set(ids);
  const [
    beforeIds,
    adminIds,
    rulesetDetails
  ] = await Promise.all([
    dnr.getEnabledRulesets().then((ids2) => new Set(ids2)),
    getAdminRulesets(),
    getRulesetDetails()
  ]);
  for (const token of adminIds) {
    const c0 = token.charAt(0);
    const id = token.slice(1);
    if (c0 === "+") {
      afterIds.add(id);
    } else if (c0 === "-") {
      afterIds.delete(id);
    }
  }
  const enableRulesetSet = /* @__PURE__ */ new Set();
  const disableRulesetSet = /* @__PURE__ */ new Set();
  for (const id of afterIds) {
    if (beforeIds.has(id)) {
      continue;
    }
    enableRulesetSet.add(id);
  }
  for (const id of beforeIds) {
    if (afterIds.has(id)) {
      continue;
    }
    disableRulesetSet.add(id);
  }
  for (const id of enableRulesetSet) {
    if (rulesetDetails.has(id)) {
      continue;
    }
    enableRulesetSet.delete(id);
  }
  for (const id of disableRulesetSet) {
    if (rulesetDetails.has(id)) {
      continue;
    }
    disableRulesetSet.delete(id);
  }
  if (enableRulesetSet.size === 0 && disableRulesetSet.size === 0) {
    return;
  }
  const enableRulesetIds = Array.from(enableRulesetSet);
  const disableRulesetIds = Array.from(disableRulesetSet);
  if (enableRulesetIds.length !== 0) {
    adblockLog(`Enable rulesets: ${enableRulesetIds}`);
  }
  if (disableRulesetIds.length !== 0) {
    adblockLog(`Disable ruleset: ${disableRulesetIds}`);
  }
  const response = {};
  await dnr.updateEnabledRulesets({
    enableRulesetIds,
    disableRulesetIds
  }).catch((reason) => {
    adblockErr(`updateEnabledRulesets/${reason}`);
    response.error = `${reason}`;
  });
  const result = await updateDynamicRules();
  if (result?.error) {
    response.error ||= result.error;
  }
  await dnr.getEnabledRulesets().then((enabledRulesets) => {
    adblockLog(`Enabled rulesets: ${enabledRulesets}`);
    response.enabledRulesets = enabledRulesets;
    return dnr.getAvailableStaticRuleCount();
  }).then((count) => {
    adblockLog(`Available static rule count: ${count}`);
    response.staticRuleCount = count;
  }).catch((reason) => {
    adblockErr(`getEnabledRulesets/${reason}`);
  });
  return response;
}
async function getStaticRulesets() {
  const manifest = runtime.getManifest();
  return manifest.declarative_net_request.rule_resources;
}
async function getEnabledRulesetsDetails() {
  const [
    ids,
    rulesetDetails
  ] = await Promise.all([
    dnr.getEnabledRulesets(),
    getRulesetDetails()
  ]);
  const out = [];
  for (const id of ids) {
    const ruleset = rulesetDetails.get(id);
    if (ruleset === void 0) {
      continue;
    }
    out.push(ruleset);
  }
  return out;
}
async function getEffectiveUserRules() {
  const allRules = await dnr.getDynamicRules();
  const userRules = [];
  for (const rule of allRules) {
    if (rule.id < USER_RULES_BASE_RULE_ID) {
      continue;
    }
    userRules.push(rule);
  }
  return userRules;
}
async function updateUserRules() {
  const [
    userRules,
    userRulesText = ""
  ] = await Promise.all([
    getEffectiveUserRules(),
    localRead("userDnrRules")
  ]);
  const effectiveRulesText = rulesetConfig.developerMode ? userRulesText : "";
  const parsed = rulesFromText(effectiveRulesText);
  const { rules } = parsed;
  const removeRuleIds = [...userRules.map((a) => a.id)];
  const rejectedRegexes = [];
  const addRules = await pruneInvalidRegexRules("user", rules, rejectedRegexes);
  const out = { added: 0, removed: 0, errors: [] };
  if (rejectedRegexes.length !== 0) {
    rejectedRegexes.forEach(
      (e) => out.errors.push(`regexFilter: ${e.regex} \u2192 ${e.reason}`)
    );
  }
  if (removeRuleIds.length === 0 && addRules.length === 0) {
    await localRemove("userDnrRuleCount");
    return out;
  }
  let ruleId = 0;
  for (const rule of addRules) {
    rule.id = USER_RULES_BASE_RULE_ID + ruleId++;
    rule.priority = (rule.priority || 1) + USER_RULES_PRIORITY;
  }
  try {
    await dnr.updateDynamicRules({ removeRuleIds });
    await dnr.updateDynamicRules({ addRules });
    if (removeRuleIds.length !== 0) {
      adblockLog(`updateUserRules() / Removed ${removeRuleIds.length} dynamic DNR rules`);
    }
    if (addRules.length !== 0) {
      adblockLog(`updateUserRules() / Added ${addRules.length} DNR rules`);
    }
    out.added = addRules.length;
    out.removed = removeRuleIds.length;
  } catch (reason) {
    adblockErr(`updateUserRules/${reason}`);
    out.errors.push(`${reason}`);
  } finally {
    const userRules2 = await getEffectiveUserRules();
    if (userRules2.length === 0) {
      await localRemove("userDnrRuleCount");
    } else {
      await localWrite("userDnrRuleCount", addRules.length);
    }
  }
  return out;
}

// adblock/js/filter-manager.js
async function flushWrites() {
  while (pendingWrites.length !== 0) {
    const promises = pendingWrites;
    pendingWrites.length = 0;
    await Promise.all(promises);
  }
}
async function keysFromStorage() {
  await flushWrites();
  return localKeys();
}
async function readFromStorage(key) {
  await flushWrites();
  return localRead(key);
}
async function writeToStorage(key, value) {
  pendingWrites.push(localWrite(key, value));
}
async function removeFromStorage(key) {
  pendingWrites.push(localRemove(key));
}
var pendingWrites = [];
async function customFiltersFromHostname(hostname) {
  const promises = [];
  let hn = hostname;
  while (hn !== "") {
    promises.push(readFromStorage(`site.${hn}`));
    const pos = hn.indexOf(".");
    if (pos === -1) {
      break;
    }
    hn = hn.slice(pos + 1);
  }
  const results = await Promise.all(promises);
  const out = [];
  for (let i = 0; i < promises.length; i++) {
    const selectors = results[i];
    if (selectors === void 0) {
      continue;
    }
    selectors.forEach((selector) => {
      out.push(selector.startsWith("0") ? selector.slice(1) : selector);
    });
  }
  return out.sort();
}
async function hasCustomFilters(hostname) {
  const selectors = await customFiltersFromHostname(hostname);
  return selectors?.length ?? 0;
}
async function getAllCustomFilterKeys() {
  const storageKeys = await keysFromStorage() || [];
  return storageKeys.filter((a) => a.startsWith("site."));
}
async function getAllCustomFilters() {
  const collect = async (key) => {
    const selectors = await readFromStorage(key);
    return [key.slice(5), selectors.map((a) => a.startsWith("0") ? a.slice(1) : a)];
  };
  const keys = await getAllCustomFilterKeys();
  const promises = keys.map((k) => collect(k));
  return Promise.all(promises);
}
function startCustomFilters(tabId, frameId) {
  return browser.scripting.executeScript({
    files: ["/js/scripting/css-user.js"],
    target: { tabId, frameIds: [frameId] },
    injectImmediately: true
  }).catch((reason) => {
    adblockErr(`startCustomFilters/${reason}`);
  });
}
function terminateCustomFilters(tabId, frameId) {
  return browser.scripting.executeScript({
    files: ["/js/scripting/css-user-terminate.js"],
    target: { tabId, frameIds: [frameId] },
    injectImmediately: true
  }).catch((reason) => {
    adblockErr(`terminateCustomFilters/${reason}`);
  });
}
async function injectCustomFilters(tabId, frameId, hostname) {
  const selectors = await customFiltersFromHostname(hostname);
  if (selectors.length === 0) {
    return;
  }
  const promises = [];
  const plainSelectors = selectors.filter((a) => a.startsWith("{") === false);
  if (plainSelectors.length !== 0) {
    promises.push(
      browser.scripting.insertCSS({
        css: `${plainSelectors.join(",\n")}{display:none!important;}`,
        origin: "USER",
        target: { tabId, frameIds: [frameId] }
      }).catch((reason) => {
        adblockErr(`injectCustomFilters/insertCSS/${reason}`);
      })
    );
  }
  const proceduralSelectors = selectors.filter((a) => a.startsWith("{"));
  if (proceduralSelectors.length !== 0) {
    promises.push(
      browser.scripting.executeScript({
        files: ["/js/scripting/css-procedural-api.js"],
        target: { tabId, frameIds: [frameId] },
        injectImmediately: true
      }).catch((reason) => {
        adblockErr(`injectCustomFilters/executeScript/${reason}`);
      })
    );
  }
  await Promise.all(promises);
  return { plainSelectors, proceduralSelectors };
}
async function registerCustomFilters(context) {
  const siteKeys = await getAllCustomFilterKeys();
  if (siteKeys.length === 0) {
    return;
  }
  const { none } = context.filteringModeDetails;
  let hostnames = siteKeys.map((a) => a.slice(5));
  if (none.has("all-urls")) {
    const { basic, optimal, complete } = context.filteringModeDetails;
    hostnames = intersectHostnameIters(hostnames, [
      ...basic,
      ...optimal,
      ...complete
    ]);
  } else if (none.size !== 0) {
    hostnames = [...subtractHostnameIters(hostnames, none)];
  }
  if (hostnames.length === 0) {
    return;
  }
  const directive = {
    id: "css-user",
    js: ["/js/scripting/css-user.js"],
    matches: matchesFromHostnames(hostnames),
    runAt: "document_start"
  };
  context.toAdd.push(directive);
}
async function addCustomFilters(hostname, toAdd) {
  if (hostname === "") {
    return false;
  }
  const key = `site.${hostname}`;
  const selectors = await readFromStorage(key) || [];
  const countBefore = selectors.length;
  for (const selector of toAdd) {
    if (selectors.includes(selector)) {
      continue;
    }
    selectors.push(selector);
  }
  if (selectors.length === countBefore) {
    return false;
  }
  selectors.sort();
  writeToStorage(key, selectors);
  return true;
}
async function removeAllCustomFilters(hostname) {
  if (hostname === "*") {
    const keys = await getAllCustomFilterKeys();
    if (keys.length === 0) {
      return false;
    }
    for (const key2 of keys) {
      removeFromStorage(key2);
    }
    return true;
  }
  const key = `site.${hostname}`;
  const selectors = await readFromStorage(key) || [];
  removeFromStorage(key);
  return selectors.length !== 0;
}
async function removeCustomFilters(hostname, selectors) {
  const promises = [];
  let hn = hostname;
  while (hn !== "") {
    promises.push(removeCustomFiltersByKey(`site.${hn}`, selectors));
    const pos = hn.indexOf(".");
    if (pos === -1) {
      break;
    }
    hn = hn.slice(pos + 1);
  }
  const results = await Promise.all(promises);
  return results.some((a) => a);
}
async function removeCustomFiltersByKey(key, toRemove) {
  const selectors = await readFromStorage(key);
  if (selectors === void 0) {
    return false;
  }
  const beforeCount = selectors.length;
  for (const selector of toRemove) {
    let i = selectors.indexOf(selector);
    if (i === -1) {
      i = selectors.indexOf(`0${selector}`);
      if (i === -1) {
        continue;
      }
    }
    selectors.splice(i, 1);
  }
  const afterCount = selectors.length;
  if (afterCount === beforeCount) {
    return false;
  }
  if (afterCount !== 0) {
    writeToStorage(key, selectors);
  } else {
    removeFromStorage(key);
  }
  return true;
}

// adblock/js/action.js
var reverseMode = false;
function disableToolbarIcon(tabId) {
  const details = {
    path: {
      "16": "/img/icon_16_off.png",
      "32": "/img/icon_32_off.png",
      "64": "/img/icon_64_off.png",
      "128": "/img/icon_128_off.png"
    }
  };
  if (tabId !== void 0) {
    details.tabId = tabId;
  }
  browser.action.setIcon(details);
}
function enableToolbarIcon(tabId) {
  const details = {
    path: {
      "16": "/img/icon_16.png",
      "32": "/img/icon_32.png",
      "64": "/img/icon_64.png",
      "128": "/img/icon_128.png"
    }
  };
  if (tabId !== void 0) {
    details.tabId = tabId;
  }
  browser.action.setIcon(details);
}
function toggleToolbarIcon(tabId) {
  if (reverseMode) {
    enableToolbarIcon(tabId);
  } else {
    disableToolbarIcon(tabId);
  }
}
async function registerToolbarIconToggler(context) {
  const { none, basic, optimal, complete } = context.filteringModeDetails;
  const reverseModeAfter = none.delete("all-urls");
  const toToggle = reverseModeAfter ? /* @__PURE__ */ new Set([...basic, ...optimal, ...complete]) : none;
  if (reverseModeAfter !== reverseMode) {
    if (reverseModeAfter) {
      disableToolbarIcon();
    } else {
      enableToolbarIcon();
    }
    reverseMode = reverseModeAfter;
  }
  if (toToggle.size === 0) {
    return;
  }
  const directive = {
    id: "toolbar-icon",
    js: ["/js/scripting/toolbar-icon.js"],
    matches: matchesFromHostnames(toToggle),
    runAt: "document_start"
  };
  context.toAdd.push(directive);
}

// adblock/js/scripting-manager.js
var resourceDetailPromises = /* @__PURE__ */ new Map();
function getScriptletDetails() {
  let promise = resourceDetailPromises.get("scriptlet");
  if (promise !== void 0) {
    return promise;
  }
  promise = fetchJSON("/rulesets/scriptlet-details").then(
    (entries) => new Map(entries)
  );
  resourceDetailPromises.set("scriptlet", promise);
  return promise;
}
function getGenericDetails() {
  let promise = resourceDetailPromises.get("generic");
  if (promise !== void 0) {
    return promise;
  }
  promise = fetchJSON("/rulesets/generic-details").then(
    (entries) => new Map(entries)
  );
  resourceDetailPromises.set("generic", promise);
  return promise;
}
var normalizeMatches = (matches) => {
  if (matches.length <= 1) {
    return;
  }
  if (matches.includes("<all_urls>") === false) {
    if (matches.includes("*://*/*") === false) {
      return;
    }
  }
  matches.length = 0;
  matches.push("<all_urls>");
};
async function resetCSSCache() {
  const keys = await sessionKeys();
  return sessionRemove(keys.filter((a) => a.startsWith("cache.css.")));
}
function registerHighGeneric(context, genericDetails) {
  const { filteringModeDetails, rulesetsDetails } = context;
  const excludeHostnames = [];
  const includeHostnames = [];
  const css = [];
  for (const details of rulesetsDetails) {
    const hostnames = genericDetails.get(details.id);
    if (hostnames) {
      if (hostnames.unhide) {
        excludeHostnames.push(...hostnames.unhide);
      }
      if (hostnames.hide) {
        includeHostnames.push(...hostnames.hide);
      }
    }
    const count = details.css?.generichigh || 0;
    if (count === 0) {
      continue;
    }
    css.push(`/rulesets/scripting/generichigh/${details.id}.css`);
  }
  if (css.length === 0) {
    return;
  }
  const { none, basic, optimal, complete } = filteringModeDetails;
  const matches = [];
  const excludeMatches = [];
  if (complete.has("all-urls")) {
    excludeMatches.push(...matchesFromHostnames(none));
    excludeMatches.push(...matchesFromHostnames(basic));
    excludeMatches.push(...matchesFromHostnames(optimal));
    excludeMatches.push(...matchesFromHostnames(excludeHostnames));
    matches.push("<all_urls>");
  } else {
    matches.push(
      ...matchesFromHostnames(
        subtractHostnameIters(
          Array.from(complete),
          excludeHostnames
        )
      )
    );
  }
  if (matches.length === 0) {
    return;
  }
  const directive = {
    id: "css-generichigh",
    css,
    matches,
    allFrames: true,
        matchOriginAsFallback: false,
    runAt: "document_end"
  };
  if (excludeMatches.length !== 0) {
    directive.excludeMatches = excludeMatches;
  }
  context.toAdd.push(directive);
}
function registerGeneric(context, genericDetails) {
  const { filteringModeDetails, rulesetsDetails } = context;
  const excludedByFilter = [];
  const includedByFilter = [];
  const js = [];
  for (const details of rulesetsDetails) {
    const hostnames = genericDetails.get(details.id);
    if (hostnames) {
      if (hostnames.unhide) {
        excludedByFilter.push(...hostnames.unhide);
      }
      if (hostnames.hide) {
        includedByFilter.push(...hostnames.hide);
      }
    }
    const count = details.css?.generic || 0;
    if (count === 0) {
      continue;
    }
    js.push(`/rulesets/scripting/generic/${details.id}.js`);
  }
  if (js.length === 0) {
    return;
  }
  js.unshift("/js/scripting/css-api.js", "/js/scripting/isolated-api.js");
  js.push("/js/scripting/css-generic.js");
  const { none, basic, optimal, complete } = filteringModeDetails;
  const includedByMode = [...complete];
  const excludedByMode = [...none, ...basic, ...optimal];
  if (complete.has("all-urls") === false) {
    const matches2 = [
      ...matchesFromHostnames(
        subtractHostnameIters(includedByMode, excludedByFilter)
      ),
      ...matchesFromHostnames(
        intersectHostnameIters(includedByMode, includedByFilter)
      )
    ];
    if (matches2.length === 0) {
      return;
    }
    const directive = {
      id: "css-generic-some",
      js,
      allFrames: true,
        matchOriginAsFallback: false,
      matches: matches2,
      runAt: "document_idle"
    };
    context.toAdd.push(directive);
    return;
  }
  const excludeMatches = [
    ...matchesFromHostnames(excludedByMode),
    ...matchesFromHostnames(excludedByFilter)
  ];
  const directiveAll = {
    id: "css-generic-all",
    js,
    allFrames: true,
        matchOriginAsFallback: false,
    matches: ["<all_urls>"],
    runAt: "document_idle"
  };
  if (excludeMatches.length !== 0) {
    directiveAll.excludeMatches = excludeMatches;
  }
  context.toAdd.push(directiveAll);
  const matches = [
    ...matchesFromHostnames(
      subtractHostnameIters(includedByFilter, excludedByMode)
    )
  ];
  if (matches.length === 0) {
    return;
  }
  const directiveSome = {
    id: "css-generic-some",
    js,
    allFrames: true,
        matchOriginAsFallback: false,
    matches,
    runAt: "document_idle"
  };
  context.toAdd.push(directiveSome);
}
async function registerCosmetic(realm, context) {
  const { filteringModeDetails, rulesetsDetails } = context;
  {
    const keys = await localKeys();
    localRemove(keys.filter((a) => a.startsWith(`css.${realm}.`)));
  }
  const rulesetIds = [];
  for (const rulesetDetails of rulesetsDetails) {
    const count = rulesetDetails.css?.[realm] || 0;
    if (count === 0) {
      continue;
    }
    rulesetIds.push(rulesetDetails.id);
  }
  if (rulesetIds.length === 0) {
    return;
  }
  const { none, basic, optimal, complete } = filteringModeDetails;
  const matches = [
    ...matchesFromHostnames(optimal),
    ...matchesFromHostnames(complete)
  ];
  if (matches.length === 0) {
    return;
  }
  {
    const promises = [];
    for (const id of rulesetIds) {
      promises.push(
        fetchJSON(`/rulesets/scripting/${realm}/${id}`).then((data) => {
          return localWrite(`css.${realm}.${id}`, data);
        })
      );
    }
    await Promise.all(promises);
  }
  normalizeMatches(matches);
  const realmid = `css-${realm}`;
  const js = rulesetIds.map((id) => `/rulesets/scripting/${realm}/${id}.js`);
  js.unshift("/js/scripting/css-api.js", "/js/scripting/isolated-api.js");
  js.push(`/js/scripting/${realmid}.js`);
  const excludeMatches = [];
  if (none.has("all-urls") === false && basic.has("all-urls") === false) {
    const toExclude = [
      ...matchesFromHostnames(none),
      ...matchesFromHostnames(basic)
    ];
    for (const hn of toExclude) {
      excludeMatches.push(hn);
    }
  }
  const directive = {
    id: realmid,
    js,
    matches,
    allFrames: true,
        matchOriginAsFallback: false,
    runAt: "document_start"
  };
  if (excludeMatches.length !== 0) {
    directive.excludeMatches = excludeMatches;
  }
  context.toAdd.push(directive);
}
function registerScriptlet(context, scriptletDetails) {
  const { filteringModeDetails, rulesetsDetails } = context;
  const hasBroadHostPermission = filteringModeDetails.optimal.has("all-urls") || filteringModeDetails.complete.has("all-urls");
  const permissionRevokedMatches = [
    ...matchesFromHostnames(filteringModeDetails.none),
    ...matchesFromHostnames(filteringModeDetails.basic)
  ];
  const permissionGrantedHostnames = [
    ...filteringModeDetails.optimal,
    ...filteringModeDetails.complete
  ];
  for (const rulesetId of rulesetsDetails.map((v) => v.id)) {
    const worlds = scriptletDetails.get(rulesetId);
    if (worlds === void 0) {
      continue;
    }
    for (const world of Object.keys(worlds)) {
      const id = `${rulesetId}.${world.toLowerCase()}`;
      const matches = [];
      const excludeMatches = [];
      const hostnames = worlds[world];
      let targetHostnames = [];
      if (hasBroadHostPermission) {
        excludeMatches.push(...permissionRevokedMatches);
        targetHostnames = hostnames;
      } else if (permissionGrantedHostnames.length !== 0) {
        if (hostnames.includes("*")) {
          targetHostnames = permissionGrantedHostnames;
        } else {
          targetHostnames = intersectHostnameIters(
            hostnames,
            permissionGrantedHostnames
          );
        }
      }
      if (targetHostnames.length === 0) {
        continue;
      }
      matches.push(...matchesFromHostnames(targetHostnames));
      normalizeMatches(matches);
      const directive = {
        id,
        js: [`/rulesets/scripting/scriptlet/${world.toLowerCase()}/${rulesetId}.js`],
        matches,
        allFrames: true,
        matchOriginAsFallback: false,
        runAt: "document_start",
        world
      };
      if (excludeMatches.length !== 0) {
        directive.excludeMatches = excludeMatches;
      }
      context.toAdd.push(directive);
    }
  }
}
async function registerInjectables() {
  if (browser.scripting === void 0) {
    return false;
  }
  if (registerInjectables.barrier) {
    return true;
  }
  registerInjectables.barrier = true;
  const [
    filteringModeDetails,
    rulesetsDetails,
    scriptletDetails,
    genericDetails
  ] = await Promise.all([
    getFilteringModeDetails(),
    getEnabledRulesetsDetails(),
    getScriptletDetails(),
    getGenericDetails()
  ]);
  const toAdd = [];
  const context = {
    filteringModeDetails,
    rulesetsDetails,
    toAdd
  };
  await Promise.all([
    registerScriptlet(context, scriptletDetails),
    registerCosmetic("specific", context),
    registerCosmetic("procedural", context),
    registerGeneric(context, genericDetails),
    registerHighGeneric(context, genericDetails),
    registerCustomFilters(context),
    registerToolbarIconToggler(context)
  ]);
  adblockLog(`Unregistered all content (css/js)`);
  try {
    await browser.scripting.unregisterContentScripts();
  } catch (reason) {
    adblockErr(`unregisterContentScripts/${reason}`);
  }
  if (toAdd.length !== 0) {
    adblockLog(`Registered ${toAdd.map((v) => v.id)} content (css/js)`);
    try {
      await browser.scripting.registerContentScripts(toAdd);
    } catch (reason) {
      adblockErr(`registerContentScripts/${reason}`);
    }
  }
  await resetCSSCache();
  registerInjectables.barrier = false;
  return true;
}
async function getRegisteredContentScripts() {
  const scripts = await browser.scripting.getRegisteredContentScripts().catch(() => []);
  return scripts.map((a) => a.id);
}
async function onWakeupRun() {
  const cleanupTime = await sessionRead("scripting.manager.cleanup.time") || 0;
  const now = Date.now();
  const since = now - cleanupTime;
  if (since < 15 * 60 * 1e3) {
    return;
  }
  const MAX_CACHE_ENTRY_LOW = 256;
  const MAX_CACHE_ENTRY_HIGH = MAX_CACHE_ENTRY_LOW + Math.max(Math.round(MAX_CACHE_ENTRY_LOW / 8), 8);
  const keys = await sessionKeys() || [];
  const cacheKeys = keys.filter((a) => a.startsWith("cache.css."));
  if (cacheKeys.length < MAX_CACHE_ENTRY_HIGH) {
    return;
  }
  const entries = await Promise.all(cacheKeys.map(async (a) => {
    const entry = await sessionRead(a) || {};
    entry.key = a;
    return entry;
  }));
  entries.sort((a, b) => b.t - a.t);
  sessionRemove(entries.slice(MAX_CACHE_ENTRY_LOW).map((a) => a.key));
  sessionWrite("scripting.manager.cleanup.time", now);
}

// adblock/js/background.js
var ADBLOCK_ORIGIN = runtime.getURL("").replace(/\/$/, "").toLowerCase();
var canShowBlockedCount = typeof dnr.setExtensionActionOptions === "function";
var { registerInjectables: registerInjectables2 } = scripting_manager_exports;
var pendingPermissionRequest;
function getCurrentVersion() {
  return runtime.getManifest().version;
}
async function reloadTab(tabId, url = "") {
  return new Promise((resolve) => {
    self.setTimeout(() => {
      if (url !== "") {
        browser.tabs.update(tabId, { url });
      } else {
        browser.tabs.reload(tabId);
      }
      resolve();
    }, 437);
  });
}
async function onPermissionGrantedThruExtension(details, origins) {
  await persistHostPermissions();
  const defaultMode = await getDefaultFilteringMode();
  if (defaultMode >= MODE_OPTIMAL) {
    return;
  }
  if (Array.isArray(origins) === false) {
    return;
  }
  const hostnames = hostnamesFromMatches(origins);
  if (hostnames.includes(details.hostname) === false) {
    return;
  }
  const beforeLevel = await getFilteringMode(details.hostname);
  if (beforeLevel === details.afterLevel) {
    return;
  }
  const afterLevel = await setFilteringMode(details.hostname, details.afterLevel);
  if (afterLevel !== details.afterLevel) {
    return;
  }
  await registerInjectables2();
  if (rulesetConfig.autoReload !== true) {
    return;
  }
  await reloadTab(details.tabId, details.url);
}
async function onPermissionGrantedThruBrowser(origins) {
  const modified = await syncWithBrowserPermissions();
  if (modified === false) {
    return;
  }
  await registerInjectables2();
  if (rulesetConfig.autoReload !== true) {
    return;
  }
  if (origins.length !== 1) {
    return;
  }
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs?.[0]?.id;
  if (typeof tabId !== "number" || tabId === -1) {
    return;
  }
  const results = await browser.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: () => document.location.hostname
  }).catch(() => {
  });
  const tabHostname = results?.[0]?.result;
  if (typeof tabHostname !== "string") {
    return;
  }
  const hostname = hostnameFromMatch(origins[0]);
  if (tabHostname.endsWith(hostname) === false) {
    return;
  }
  const pos = tabHostname.length - hostname.length;
  if (pos !== 0 && tabHostname.charAt(pos - 1) !== ".") {
    return;
  }
  await reloadTab(tabId);
}
async function onPermissionsAdded(permissions) {
  const details = pendingPermissionRequest;
  pendingPermissionRequest = void 0;
  const { origins = [] } = permissions;
  return details !== void 0 ? onPermissionGrantedThruExtension(details, origins) : onPermissionGrantedThruBrowser(origins);
}
async function onPermissionsRemoved() {
  const modified = await syncWithBrowserPermissions();
  if (modified === false) {
    return false;
  }
  registerInjectables2();
  return true;
}
async function onPermissionsChanged(op, permissions) {
  await isFullyInitialized;
  const { pending } = onPermissionsChanged;
  await Promise.all(pending);
  const promise = op === "removed" ? onPermissionsRemoved() : onPermissionsAdded(permissions);
  pending.push(promise);
}
onPermissionsChanged.pending = [];
function setDeveloperMode(state) {
  rulesetConfig.developerMode = state === true;
  toggleDeveloperMode(rulesetConfig.developerMode);
  broadcastMessage({ developerMode: rulesetConfig.developerMode });
  return Promise.all([
    updateUserRules(),
    saveRulesetConfig()
  ]);
}
function onMessage(request, sender, callback) {
  const tabId = sender?.tab?.id ?? false;
  const frameId = tabId && (sender?.frameId ?? false);
  switch (request.what) {
    case "insertCSS":
      if (frameId === false) {
        return false;
      }
      if (frameId !== 0 && webextFlavor === "safari") {
        return false;
      }
      browser.scripting.insertCSS({
        css: request.css,
        origin: "USER",
        target: { tabId, frameIds: [frameId] }
      }).catch((reason) => {
        adblockErr(`insertCSS/${reason}`);
      });
      return false;
    case "removeCSS":
      if (frameId === false) {
        return false;
      }
      if (frameId !== 0 && webextFlavor === "safari") {
        return false;
      }
      browser.scripting.removeCSS({
        css: request.css,
        origin: "USER",
        target: { tabId, frameIds: [frameId] }
      }).catch((reason) => {
        adblockErr(`removeCSS/${reason}`);
      });
      return false;
    case "toggleToolbarIcon": {
      if (tabId) {
        toggleToolbarIcon(tabId);
      }
      return false;
    }
    case "startCustomFilters":
      if (frameId === false) {
        return false;
      }
      startCustomFilters(tabId, frameId).then(() => {
        callback();
      });
      return true;
    case "terminateCustomFilters":
      if (frameId === false) {
        return false;
      }
      terminateCustomFilters(tabId, frameId).then(() => {
        callback();
      });
      return true;
    case "injectCustomFilters":
      if (frameId === false) {
        return false;
      }
      injectCustomFilters(tabId, frameId, request.hostname).then((selectors) => {
        callback(selectors);
      });
      return true;
    case "injectCSSProceduralAPI":
      browser.scripting.executeScript({
        files: ["/js/scripting/css-procedural-api.js"],
        target: { tabId, frameIds: [frameId] },
        injectImmediately: true
      }).catch((reason) => {
        adblockErr(`executeScript/${reason}`);
      }).then(() => {
        callback();
      });
      return true;
    default:
      break;
  }
  if (sender.origin !== void 0) {
    if (sender.origin.toLowerCase() !== ADBLOCK_ORIGIN) {
      return;
    }
  }
  switch (request.what) {
    case "applyRulesets": {
      enableRulesets(request.enabledRulesets).then((result) => {
        if (result === void 0 || result.error) {
          callback(result);
          return;
        }
        rulesetConfig.enabledRulesets = result.enabledRulesets;
        return saveRulesetConfig().then(() => {
          return registerInjectables2();
        }).then(() => {
          callback(result);
        });
      }).finally(() => {
        broadcastMessage({ enabledRulesets: rulesetConfig.enabledRulesets });
      });
      return true;
    }
    case "getDefaultConfig":
      getDefaultRulesetsFromEnv().then((rulesets2) => {
        callback({
          autoReload: defaultConfig.autoReload,
          developerMode: defaultConfig.developerMode,
          showBlockedCount: defaultConfig.showBlockedCount,
          strictBlockMode: defaultConfig.strictBlockMode,
          rulesets: rulesets2,
          filteringModes: Object.assign(defaultFilteringModes)
        });
      });
      return true;
    case "getOptionsPageData":
      Promise.all([
        hasBroadHostPermissions(),
        getDefaultFilteringMode(),
        getRulesetDetails(),
        dnr.getEnabledRulesets(),
        getAdminRulesets(),
        adminReadEx("disabledFeatures")
      ]).then((results) => {
        const [
          hasOmnipotence,
          defaultFilteringMode,
          rulesetDetails,
          enabledRulesets,
          adminRulesets,
          disabledFeatures
        ] = results;
        callback({
          hasOmnipotence,
          defaultFilteringMode,
          enabledRulesets,
          adminRulesets,
          maxNumberOfEnabledRulesets: dnr.MAX_NUMBER_OF_ENABLED_STATIC_RULESETS,
          rulesetDetails: Array.from(rulesetDetails.values()),
          autoReload: rulesetConfig.autoReload,
          showBlockedCount: rulesetConfig.showBlockedCount,
          canShowBlockedCount,
          strictBlockMode: rulesetConfig.strictBlockMode,
          firstRun: process.firstRun,
          isSideloaded,
          developerMode: rulesetConfig.developerMode,
          disabledFeatures
        });
        process.firstRun = false;
      });
      return true;
    case "getEnabledRulesets":
      dnr.getEnabledRulesets().then((rulesets2) => {
        callback(rulesets2);
      });
      return true;
    case "getRulesetDetails":
      getRulesetDetails().then((rulesetDetails) => {
        callback(Array.from(rulesetDetails.values()));
      });
      return true;
    case "hasBroadHostPermissions":
      hasBroadHostPermissions().then((result) => {
        callback(result);
      });
      return true;
    case "setAutoReload":
      rulesetConfig.autoReload = request.state && true || false;
      saveRulesetConfig().then(() => {
        callback();
        broadcastMessage({ autoReload: rulesetConfig.autoReload });
      });
      return true;
    case "getShowBlockedCount":
      callback(rulesetConfig.showBlockedCount);
      break;
    case "setShowBlockedCount":
      rulesetConfig.showBlockedCount = request.state && true || false;
      if (canShowBlockedCount) {
        dnr.setExtensionActionOptions({
          displayActionCountAsBadgeText: rulesetConfig.showBlockedCount
        });
      }
      saveRulesetConfig().then(() => {
        callback();
        broadcastMessage({ showBlockedCount: rulesetConfig.showBlockedCount });
      });
      return true;
    case "setStrictBlockMode":
      setStrictBlockMode(request.state).then(() => {
        callback();
        broadcastMessage({ strictBlockMode: rulesetConfig.strictBlockMode });
      });
      return true;
    case "setDeveloperMode":
      setDeveloperMode(request.state).then(() => {
        callback();
      });
      return true;
    case "popupPanelData": {
      Promise.all([
        hasBroadHostPermissions(),
        getFilteringMode(request.hostname),
        adminReadEx("disabledFeatures"),
        hasCustomFilters(request.hostname)
      ]).then((results) => {
        callback({
          hasOmnipotence: results[0],
          level: results[1],
          autoReload: rulesetConfig.autoReload,
          isSideloaded,
          developerMode: rulesetConfig.developerMode,
          disabledFeatures: results[2],
          hasCustomFilters: results[3]
        });
      });
      return true;
    }
    case "getFilteringMode": {
      getFilteringMode(request.hostname).then((actualLevel) => {
        callback(actualLevel);
      });
      return true;
    }
    case "gotoURL":
      gotoURL(request.url, request.type);
      break;
    case "setFilteringMode": {
      getFilteringMode(request.hostname).then((beforeLevel) => {
        if (request.level === beforeLevel) {
          return beforeLevel;
        }
        return setFilteringMode(request.hostname, request.level);
      }).then((afterLevel) => {
        registerInjectables2();
        callback(afterLevel);
      });
      return true;
    }
    case "setPendingFilteringMode":
      pendingPermissionRequest = request;
      break;
    case "getDefaultFilteringMode": {
      getDefaultFilteringMode().then((level) => {
        callback(level);
      });
      return true;
    }
    case "setDefaultFilteringMode":
      getDefaultFilteringMode().then(
        (beforeLevel) => setDefaultFilteringMode(request.level).then(
          (afterLevel) => ({ beforeLevel, afterLevel })
        )
      ).then(({ beforeLevel, afterLevel }) => {
        if (afterLevel !== beforeLevel) {
          registerInjectables2();
        }
        callback(afterLevel);
      });
      return true;
    case "getFilteringModeDetails":
      getFilteringModeDetails(true).then((details) => {
        callback(details);
      });
      return true;
    case "setFilteringModeDetails":
      setFilteringModeDetails(request.modes).then(() => {
        registerInjectables2();
        getDefaultFilteringMode().then((defaultFilteringMode) => {
          broadcastMessage({ defaultFilteringMode });
        });
        getFilteringModeDetails(true).then((details) => {
          callback(details);
        });
      });
      return true;
    case "excludeFromStrictBlock": {
      excludeFromStrictBlock(request.hostname, request.permanent).then(() => {
        callback();
      });
      return true;
    }
    case "getMatchedRules":
      getMatchedRules(request.tabId).then((entries) => {
        callback(entries);
      });
      return true;
    case "showMatchedRules":
      browser.windows.create({
        type: "popup",
        url: `/matched-rules.html?tab=${request.tabId}`
      });
      break;
    case "getEffectiveDynamicRules":
      getEffectiveDynamicRules().then((result) => {
        callback(result);
      });
      return true;
    case "getEffectiveSessionRules":
      getEffectiveSessionRules().then((result) => {
        callback(result);
      });
      return true;
    case "getEffectiveUserRules":
      getEffectiveUserRules().then((result) => {
        callback(result);
      });
      return true;
    case "updateUserDnrRules":
      updateUserRules().then((result) => {
        callback(result);
      });
      return true;
    case "addCustomFilters":
      addCustomFilters(request.hostname, request.selectors).then((modified) => {
        if (modified !== true) {
          return;
        }
        return registerInjectables2();
      }).then(() => {
        callback();
      });
      return true;
    case "removeCustomFilters":
      removeCustomFilters(request.hostname, request.selectors).then((modified) => {
        if (modified !== true) {
          return;
        }
        return registerInjectables2();
      }).then(() => {
        callback();
      });
      return true;
    case "removeAllCustomFilters":
      removeAllCustomFilters(request.hostname).then((modified) => {
        if (modified !== true) {
          return;
        }
        return registerInjectables2();
      }).then(() => {
        callback();
      });
      return true;
    case "customFiltersFromHostname":
      customFiltersFromHostname(request.hostname).then((selectors) => {
        callback(selectors);
      });
      return true;
    case "getAllCustomFilters":
      getAllCustomFilters().then((data) => {
        callback(data);
      });
      return true;
    case "getRegisteredContentScripts":
      getRegisteredContentScripts().then((ids) => {
        callback(ids);
      });
      return true;
    case "getConsoleOutput":
      callback(getConsoleOutput());
      break;
    default:
      break;
  }
  return false;
}
function onCommand(command, tab) {
  switch (command) {
    case "enter-zapper-mode": {
      if (browser.scripting === void 0) {
        return;
      }
      browser.scripting.executeScript({
        files: ["/js/scripting/tool-overlay.js", "/js/scripting/zapper.js"],
        target: { tabId: tab.id }
      });
      break;
    }
    case "enter-picker-mode": {
      if (browser.scripting === void 0) {
        return;
      }
      browser.scripting.executeScript({
        files: [
          "/js/scripting/css-procedural-api.js",
          "/js/scripting/tool-overlay.js",
          "/js/scripting/picker.js"
        ],
        target: { tabId: tab.id }
      });
      break;
    }
    default:
      break;
  }
}
async function startSession() {
  const currentVersion = getCurrentVersion();
  const isNewVersion = currentVersion !== rulesetConfig.version;
  await loadAdminConfig();
  if (isNewVersion) {
    adblockLog(`Version change: ${rulesetConfig.version} => ${currentVersion}`);
    rulesetConfig.version = currentVersion;
    await patchDefaultRulesets();
    saveRulesetConfig();
  }
  const rulesetsUpdated = await enableRulesets(rulesetConfig.enabledRulesets);
  if (rulesetsUpdated === void 0) {
    if (isNewVersion) {
      updateDynamicRules();
    } else {
      updateSessionRules();
    }
  }
  const permissionsUpdated = await syncWithBrowserPermissions();
  const shouldInject = isNewVersion || permissionsUpdated || isSideloaded && rulesetConfig.developerMode;
  if (shouldInject) {
    await registerInjectables2();
  }
  sessionAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" });
  if (canShowBlockedCount) {
    dnr.setExtensionActionOptions({
      displayActionCountAsBadgeText: rulesetConfig.showBlockedCount
    });
  }
  if (process.firstRun) {
    const enableOptimal = await hasBroadHostPermissions();
    if (enableOptimal === false) {
      const afterLevel = await setDefaultFilteringMode(MODE_BASIC);
      if (afterLevel === MODE_BASIC) {
        registerInjectables2();
        process.firstRun = false;
      }
    }
  }
  adminReadEx("disabledFeatures").then((items) => {
    if (Array.isArray(items) === false) {
      return;
    }
    if (items.includes("develop")) {
      if (rulesetConfig.developerMode) {
        setDeveloperMode(false);
      }
    }
  });
}
async function start() {
  await loadRulesetConfig();
  if (process.wakeupRun === false) {
    await startSession();
  } else {
    onWakeupRun();
  }
  const scripts = await getRegisteredContentScripts();
  if (scripts.length === 0) {
    registerInjectables2();
  }
  toggleDeveloperMode(rulesetConfig.developerMode);
}
var isFullyInitialized = start().then(() => {
  localRemove("goodStart");
  return false;
}).catch((reason) => {
  adblockErr(reason);
  if (process.wakeupRun) {
    return;
  }
  return localRead("goodStart").then((goodStart) => {
    if (goodStart === false) {
      localRemove("goodStart");
      return false;
    }
    return localWrite("goodStart", false).then(() => true);
  });
}).then((restart) => {
  if (restart !== true) {
    return;
  }
  runtime.reload();
});
runtime.onMessage.addListener((request, sender, callback) => {
  isFullyInitialized.then(() => {
    const r = onMessage(request, sender, callback);
    if (r !== true) {
      callback();
    }
  });
  return true;
});
browser.permissions.onRemoved.addListener((...args) => {
  isFullyInitialized.then(() => {
    onPermissionsChanged("removed", ...args);
  });
});
browser.permissions.onAdded.addListener((...args) => {
  isFullyInitialized.then(() => {
    onPermissionsChanged("added", ...args);
  });
});
browser.commands.onCommand.addListener((...args) => {
  isFullyInitialized.then(() => {
    onCommand(...args);
  });
});

// ── COUNTER ENGINE (injected) ──────────────────────────────────────────────
// Uses getMatchedRules per tab to accumulate real blocked counts
;(function() {
  const STORAGE_KEY_ADS      = 'adsBlocked';
  const STORAGE_KEY_TRACKERS = 'trackers';
  const STORAGE_KEY_COOKIES  = 'cookies';

  // Ruleset IDs that indicate cookies/trackers (rough heuristic)
  const COOKIE_RULESETS   = new Set(['annoyances-cookies']);
  const TRACKER_RULESETS  = new Set(['easyprivacy','adguard-spyware-url','adguard-mobile','pgl']);

  let totals = { adsBlocked: 0, trackers: 0, cookies: 0 };

  // Load persisted totals on startup
  chrome.storage.local.get([STORAGE_KEY_ADS, STORAGE_KEY_TRACKERS, STORAGE_KEY_COOKIES], (r) => {
    totals.adsBlocked = r[STORAGE_KEY_ADS]  || 0;
    totals.trackers   = r[STORAGE_KEY_TRACKERS] || 0;
    totals.cookies    = r[STORAGE_KEY_COOKIES]  || 0;
  });

  function persistTotals() {
    chrome.storage.local.set({
      [STORAGE_KEY_ADS]:      totals.adsBlocked,
      [STORAGE_KEY_TRACKERS]: totals.trackers,
      [STORAGE_KEY_COOKIES]:  totals.cookies,
    });
  }

  // After a page finishes loading, count matched rules for that tab
  async function countMatchedRulesForTab(tabId) {
    if (!chrome.declarativeNetRequest?.getMatchedRules) return;
    try {
      const result = await chrome.declarativeNetRequest.getMatchedRules({ tabId });
      if (!result?.rulesMatchedInfo?.length) return;

      let ads = 0, trackers = 0, cookies = 0;
      for (const info of result.rulesMatchedInfo) {
        const rulesetId = info.rule.rulesetId;
        if (COOKIE_RULESETS.has(rulesetId))        cookies++;
        else if (TRACKER_RULESETS.has(rulesetId))  trackers++;
        else                                        ads++;
      }

      totals.adsBlocked += ads;
      totals.trackers   += trackers;
      totals.cookies    += cookies;
      persistTotals();

      // Update badge
      const total = ads + trackers + cookies;
      if (total > 0) {
        chrome.storage.local.get('ui_showCount', (r) => {
          if (r.ui_showCount === false) return;
          chrome.action.setBadgeText({ text: total > 999 ? '999+' : String(total), tabId });
          chrome.action.setBadgeBackgroundColor({ color: '#00e5c8' });
        });
      }
    } catch (_) {
      // Tab may be closed or restricted — ignore
    }
  }

  // Hook into navigation completed events
  if (chrome.webNavigation?.onCompleted) {
    chrome.webNavigation.onCompleted.addListener((details) => {
      if (details.frameId !== 0) return; // main frame only
      // Small delay to let DNR finalize its matched rules list
      setTimeout(() => countMatchedRulesForTab(details.tabId), 800);
    });
  }

  // Also handle tab switches to update badge
  if (chrome.tabs?.onActivated) {
    chrome.tabs.onActivated.addListener(({ tabId }) => {
      chrome.storage.local.get('ui_showCount', (r) => {
        if (r.ui_showCount === false) {
          chrome.action.setBadgeText({ text: '', tabId });
          return;
        }
      });
    });
  }
})();

// ── FIRST-RUN CLEANUP (removes stale state from old extension installs) ────
;(function() {
  const CURRENT_VERSION = '3.2.1';
  const STALE_KEYS = [
    // Keys that may have been set by older versions of the extension
    'extensionId', 'clientId', 'installId', 'uuid',
    'lastVersion', 'firstInstall',
  ];

  chrome.storage.local.get(['_adblockVersion', 'ui_cookieAccept'], (stored) => {
    const isFirstRun = !stored['_adblockVersion'];
    const prevVersion = stored['_adblockVersion'];

    if (isFirstRun || prevVersion !== CURRENT_VERSION) {
      // Remove stale keys from previous installs
      chrome.storage.local.remove(STALE_KEYS, () => {
        // Set defaults for first run
        const defaults = {};
        if (isFirstRun) {
          // Cookie auto-accept ON by default
          if (stored['ui_cookieAccept'] === undefined) {
            defaults['ui_cookieAccept'] = true;
          }
          defaults['ui_showCount']  = true;
          defaults['ui_autoReload'] = true;
        }
        defaults['_adblockVersion'] = CURRENT_VERSION;
        chrome.storage.local.set(defaults);
      });
    }
  });
})();
