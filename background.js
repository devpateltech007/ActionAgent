
// Add this to your existing background script

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "executeSingle") {
    executeSingleTool(message.call)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({
        status: "error", 
        message: error.message
      }));
    return true; // Keep message channel open for async response
  }
  
  // Your existing message handlers...
});

async function executeSingleTool(call) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    switch (call.tool) {
      case "open_tab":
        await chrome.tabs.create({ url: call.args.url });
        return { status: "success" };
        
      case "wait":
        await new Promise(resolve => setTimeout(resolve, call.args.ms));
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
  } catch (error) {
    return { status: "error", message: error.message };
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
