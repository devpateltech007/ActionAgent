chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "logAction") {
    (async () => {
      const { log = "" } = await chrome.storage.local.get("log");
      await chrome.storage.local.set({ log: log + JSON.stringify(msg.payload) + "\n" });
    })();
    return;
  }

  if (msg.type === "executeBatch") {
    (async () => {
      try {
        for (const call of msg.calls) await executeTool(call);
        sendResponse({ status: "done" });
      } catch (err) {
        console.error("Batch error", err);
        sendResponse({ status: "error", message: err.toString() });
      }
    })();
    return true;
  }

  if (msg.type === "getLog") {
    (async () => {
      const { log = "" } = await chrome.storage.local.get("log");
      sendResponse({ log });
    })();
    return true;
  }
});

async function executeTool(call) {
  const name = call.tool;
  const args = call.args || {};
  switch (name) {
    case "open_tab":
      await chrome.tabs.create({ url: args.url, active: true });
      await sleep(1000);
      break;
    case "click":
      await chrome.scripting.executeScript({
        target: { tabId: await activeTabId() },
        args: [args.selector],
        func: sel => {
          const find = s => {
            if (!s) return null;
            if (typeof s === "string") return document.querySelector(s);
            const list = Array.from(document.querySelectorAll(s.tag || "*"));
            return list.find(el => {
              if (s.id    && el.id !== s.id) return false;
              if (s.class && !el.className.split(/\s+/).includes(s.class)) return false;
              if (s.text  && el.textContent.trim() !== s.text) return false;
              return true;
            }) || null;
          };
          find(sel)?.click();
        }
      });
      break;
    case "type_text":
      await chrome.scripting.executeScript({
        target: { tabId: await activeTabId() },
        args: [args.selector, args.text || "", !!args.pressEnter],
        func: (sel, val, pressEnter) => {
          const find = s => {
            if (!s) return null;
            if (typeof s === "string") return document.querySelector(s);
            const list = Array.from(document.querySelectorAll(s.tag || "*"));
            return list.find(el => {
              if (s.id    && el.id !== s.id) return false;
              if (s.class && !el.className.split(/\s+/).includes(s.class)) return false;
              if (s.text  && el.textContent.trim() !== s.text) return false;
              return true;
            }) || null;
          };
          const el = find(sel);
          if (!el) return;
          el.focus();
          el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          if (pressEnter) ["keydown","keyup"].forEach(t => el.dispatchEvent(new KeyboardEvent(t,{key:"Enter",bubbles:true})));
        }
      });
      break;
    case "press_key":
      await chrome.scripting.executeScript({
        target: { tabId: await activeTabId() },
        args: [args.key || "Enter"],
        func: key => {
          const el = document.activeElement;
          if (el) ["keydown","keyup"].forEach(t => el.dispatchEvent(new KeyboardEvent(t,{key,bubbles:true})));
        }
      });
      break;
    default:
      throw new Error("Unknown tool " + name);
  }
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function activeTabId(){ const [t] = await chrome.tabs.query({active:true,currentWindow:true}); if(!t) throw "No active tab"; return t.id; }
