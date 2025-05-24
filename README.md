/*
Directory Structure:
chrome-action-agent/
├── background.js
├── content.js
├── database.js
├── manifest.json
├── popup.html
├── popup.js
*/

/* manifest.json */
{
  "manifest_version": 3,
  "name": "Action Agent",
  "version": "1.0",
  "permissions": [
    "scripting",
    "tabs",
    "storage"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Action Agent"
  }
}

/* background.js */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'logAction') {
    saveAction(message.payload);
  } else if (message.type === 'queryLLM') {
    fetch('https://your-llm-api-endpoint.com/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: message.query })
    })
    .then(res => res.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ error: err.toString() }));
    return true; // keep sendResponse alive
  }
});

function saveAction(action) {
  chrome.storage.local.get({ actions: [] }, (result) => {
    const actions = result.actions;
    actions.push(action);
    chrome.storage.local.set({ actions });
  });
}

/* content.js */
document.addEventListener('click', (e) => {
  const target = e.target.closest('a, button');
  if (target) {
    chrome.runtime.sendMessage({
      type: 'logAction',
      payload: {
        timestamp: new Date().toISOString(),
        action: 'click',
        targetText: target.innerText,
        url: location.href,
        htmlSnapshot: target.outerHTML
      }
    });
  }
});

/* popup.html */
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; padding: 10px; }
    textarea { width: 100%; height: 100px; }
    button { margin-top: 10px; }
  </style>
</head>
<body>
  <h3>Ask Action Agent</h3>
  <textarea id="userQuery"></textarea><br>
  <button id="send">Send</button>
  <pre id="response"></pre>
  <script src="popup.js"></script>
</body>
</html>

/* popup.js */
document.getElementById('send').addEventListener('click', () => {
  const query = document.getElementById('userQuery').value;
  chrome.runtime.sendMessage({ type: 'queryLLM', query }, (response) => {
    document.getElementById('response').textContent = JSON.stringify(response, null, 2);
    if (response.task === 'play_song' && response.platform === 'YouTube Music') {
      chrome.tabs.create({ url: 'https://music.youtube.com/' }, (tab) => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (song) => {
            const input = document.querySelector('input[placeholder="Search"]');
            input.value = song;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => {
              const result = document.querySelector('ytmusic-shelf-renderer ytmusic-responsive-list-item-renderer');
              if (result) result.click();
            }, 3000);
          },
          args: [response.song]
        });
      });
    }
  });
});
