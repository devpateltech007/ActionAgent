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
      case "open_tab":
        await chrome.tabs.create({ url: call.args.url });
        return { status: "success" };
      case "wait":
        await new Promise(r => setTimeout(r, call.args.ms));
        return { status: "success" };
      case "click":
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: clickElement,
          args: [call.args.selector]
        });
        return { status: "success" };
      case "type_text":
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: typeText,
          args: [call.args.selector, call.args.text, call.args.pressEnter]
        });
        return { status: "success" };
      case "press_key":
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: pressKey,
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
  const element = findElement(selector);
  if (element) {
    element.click();
    return true;
  }
  throw new Error("Element not found: " + JSON.stringify(selector));
}

function typeText(selector, text, pressEnter) {
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
