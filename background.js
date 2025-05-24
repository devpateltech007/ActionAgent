chrome.runtime.onMessage.addListener((msg, sr, sendResponse) => {
  if (msg.type === "logAction") { (async () => { const { log = "" } = await chrome.storage.local.get("log"); await chrome.storage.local.set({ log: log + JSON.stringify(msg.payload) + "\n" }); })(); return; }
  if (msg.type === "executeBatch") { (async () => { try { for (const c of msg.calls) await exec(c); sendResponse({ status: "done" }); } catch (e) { console.error(e); sendResponse({ status: "error", message: e + "" }); } })(); return true; }
  if (msg.type === "getLog") { (async () => { const { log = "" } = await chrome.storage.local.get("log"); sendResponse({ log }); })(); return true; }
});

async function exec(call) {
  const { tool, args = {} } = call; switch (tool) {
    case "open_tab": await chrome.tabs.create({ url: args.url, active: true }); await sleep(800); break;
    case "click": await chrome.scripting.executeScript({ target: { tabId: await tabId() }, args: [args.selector], func: sel => { const find = s => { if (!s) return null; if (typeof s === "string") return document.querySelector(s); const cls = (s.class ?? s.className ?? "").trim().split(/\s+/).filter(Boolean); const list = [...document.querySelectorAll(s.tag || "*")]; return list.find(el => { if (s.id && el.id !== s.id) return false; if (cls.length && !cls.every(t => el.classList.contains(t))) return false; if (s.text && el.textContent.trim() !== s.text) return false; return true; }) }; find(sel)?.click(); } }); break;
    case "type_text": await chrome.scripting.executeScript({ target: { tabId: await tabId() }, args: [args.selector, args.text || "", !!args.pressEnter], func: (sel, val, pE) => { const find = s => { if (!s) return null; if (typeof s === "string") return document.querySelector(s); const cls = (s.class ?? s.className ?? "").trim().split(/\s+/).filter(Boolean); return [...document.querySelectorAll(s.tag || "*")].find(el => { if (s.id && el.id !== s.id) return false; if (cls.length && !cls.every(t => el.classList.contains(t))) return false; if (s.text && el.textContent.trim() !== s.text) return false; return true; }); }; const el = find(sel); if (!el) return; el.focus(); el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); if (pE) ["keydown", "keyup"].forEach(t => el.dispatchEvent(new KeyboardEvent(t, { key: "Enter", bubbles: true }))); } }); break;
    case "press_key": await chrome.scripting.executeScript({ target: { tabId: await tabId() }, args: [args.key || "Enter"], func: k => { const el = document.activeElement; if (el) ["keydown", "keyup"].forEach(t => el.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true }))); } }); break;
    default: throw "Unknown tool " + tool;
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms)); const tabId = async () => { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); if (!t) throw "No active tab"; return t.id; };

