// Add this to your existing background script

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    case "logAction":
      // 1) retrieve existing log (defaults to [])
      chrome.storage.local.get({ actionLog: [] }, ({ actionLog }) => {
        actionLog.push(message.payload);
        // 2) save it back
        chrome.storage.local.set({ actionLog }, () => {
          sendResponse({ status: "ok" });
        });
      });
      return true;  // keep channel open

    case "getLog":
      chrome.storage.local.get({ actionLog: [] }, ({ actionLog }) => {
        // return as a string so the popup can interpolate easily
        sendResponse({ log: JSON.stringify(actionLog, null, 2) });
      });
      return true;

    case "executeBatch":
      // run calls sequentially
      executeBatch(message.calls)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ status: "error", message: err.message }));
      return true;

    case "executeSingle":
      executeSingleTool(message.call)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ status: "error", message: err.message }));
      return true;

    // you can keep other handlers here...
  }
});

function waitForTabLoad(tabId) {
  console.log("Waited for tab ", tabId);
  return new Promise(resolve => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// helper to run an array of calls in order
async function executeBatch(calls) {
  for (const call of calls) {
    const result = await executeSingleTool(call);
    if (result.status === "error") {
      throw new Error(`At call ${JSON.stringify(call)} → ${result.message}`);
    }
  }
  return { status: "done" };
}

// your existing executeSingleTool(...) goes here unchanged
async function executeSingleTool(call) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    switch (call.tool) {
      case "open_tab": {
        // open, then wait for load
        const createdTab = await chrome.tabs.create({ url: call.args.url });
        await waitForTabLoad(createdTab.id);
        return { status: "success" };
      }

      case "wait":
        await new Promise(r => setTimeout(r, call.args.ms));
        return { status: "success" };

      case "click":
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },    // <-- no `world` here
          world: "MAIN",                 // <-- pull `world` up
          func: (selector) => {
            const findElement = sel => {
              if (sel.id) return document.getElementById(sel.id);
              if (sel.name) return document.querySelector(`[name="${sel.name}"]`);
              if (sel.placeholder) return document.querySelector(`[placeholder*="${sel.placeholder}"]`);
              if (sel.class) return document.querySelector(`.${sel.class}`);
              if (sel.tag && sel.text) {
                return Array.from(document.querySelectorAll(sel.tag))
                  .find(el => el.textContent.toLowerCase().includes(sel.text.toLowerCase()));
              }
              if (sel.tag) return document.querySelector(sel.tag);
              return null;
            };
            const el = findElement(selector);
            if (!el) throw new Error("click: element not found " + JSON.stringify(selector));
            el.click();
          },
          args: [call.args.selector]
        });
        return { status: "success" };

    case "type_text":
      // 1) type the text
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world:  "MAIN",
        func: (selector, text) => {
          // inline findElement
          const findElement = sel => {
            if (sel.id) return document.getElementById(sel.id);
            if (sel.name) return document.querySelector(`[name="${sel.name}"]`);
            if (sel.placeholder) return document.querySelector(`[placeholder*="${sel.placeholder}"]`);
            if (sel.class) return document.querySelector(`.${sel.class}`);
            if (sel.tag && sel.text) {
              return Array.from(document.querySelectorAll(sel.tag))
                          .find(el => el.textContent.toLowerCase().includes(sel.text.toLowerCase()));
            }
            if (sel.tag) return document.querySelector(sel.tag);
            return null;
          };

          const el = findElement(selector);
          if (!el) throw new Error("type_text: element not found " + JSON.stringify(selector));

          el.focus();
          el.value = text;
          el.dispatchEvent(new Event("input", { bubbles: true }));

          // 2) immediately submit:
          //    a) real form submit if possible
          if (el.form) {
            el.form.submit();
            return;
          }
          //    b) click a submit button
          const ctx = el.form || document;
          const btn = ctx.querySelector('input[type="submit"], button[type="submit"], button');
          if (btn) {
            btn.click();
            return;
          }
          //    c) fallback to synthetic Enter on the element
          ["keydown","keypress","keyup"].forEach(type => {
            el.dispatchEvent(new KeyboardEvent(type, {
              key: "Enter", code: "Enter",
              charCode: 13, keyCode: 13, which: 13,
              bubbles: true, cancelable: true
            }));
          });
        },
        args: [call.args.selector, call.args.text]
      });
      return { status: "success" };


    case "press_key":
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: (key) => {
          // dispatch on the currently focused element (or body as fallback)
          const el = document.activeElement || document.body;
          ["keydown", "keypress", "keyup"].forEach(type => {
            el.dispatchEvent(new KeyboardEvent(type, {
              key,
              code: key,
              charCode: key === "Enter" ? 13 : key.charCodeAt(0),
              keyCode: key === "Enter" ? 13 : key.charCodeAt(0),
              which: key === "Enter" ? 13 : key.charCodeAt(0),
              bubbles: true,
              cancelable: true
            }));
          });
        },
        args: [call.args.key]
      });
      return { status: "success" };


      default:
        throw new Error(`Unknown tool: ${call.tool}`);
    }

  } catch (e) {
    return { status: "error", message: e.message };
  }
}

// Content script functions (inject these)
function clickElement(selector) {
  console.log("Clicked ", selector);
  const element = findElement(selector);
  if (element) {
    element.click();
    return true;
  }
  throw new Error("Element not found: " + JSON.stringify(selector));
}

function typeText(selector, text, pressEnter) {
  console.log("Typed ", text);
  const element = findElement(selector);
  if (element) {
    element.focus();
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    if (pressEnter) {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
    return true;
  }
  throw new Error("Element not found: " + JSON.stringify(selector));
}

function pressKey(key) {
  console.log("KeyDown ", key);
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  return true;
}

function findElement(selector) {
  // Try different selector strategies
  if (selector.id) {
    return document.getElementById(selector.id);
  }
  if (selector.name) {
    return document.querySelector(`[name="${selector.name}"]`);
  }
  if (selector.placeholder) {
    return document.querySelector(`[placeholder*="${selector.placeholder}"]`);
  }
  if (selector.class) {
    return document.querySelector(`.${selector.class}`);
  }
  if (selector.tag && selector.text) {
    const elements = document.querySelectorAll(selector.tag);
    return Array.from(elements).find(el =>
      el.textContent.toLowerCase().includes(selector.text.toLowerCase())
    );
  }
  if (selector.tag) {
    return document.querySelector(selector.tag);
  }
  return null;
}
