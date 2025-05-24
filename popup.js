const SYSTEM_PROMPT = `You are Action‑Agent.
Return **an array** of tool calls needed to satisfy the user request.
Each item must match one of:
  {"tool":"open_tab","args":{"url":"https://…"}}
  {"tool":"click","args":{"selector":{"tag":"button","text":"Download"}}}
  {"tool":"type_text","args":{"selector":{"name":"q"},"text":"…","pressEnter":true}}
  {"tool":"press_key","args":{"key":"Enter"}}

IMPORTANT RULES:
1. Use specific selectors: name, id, class, or text content
2. For icon sites: look for Download buttons with text "Download" or "Free Download"
3. For search: use {"name":"q"} for Google, {"name":"search_query"} for YouTube
4. Set pressEnter:true when typing search terms
5. Example: [open_tab, type_text, click]

No prose. JSON array only.`;

const chatBox = document.getElementById("chat");
const queryBox = document.getElementById("query");
const sendBtn  = document.getElementById("send");

sendBtn.onclick = async () => {
  const userRequest = queryBox.value.trim();
  if (!userRequest) return;
  append("You", userRequest);
  queryBox.value = "";
  
  const { log } = await chrome.runtime.sendMessage({ type: "getLog" });

  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "Authorization": "Bearer csk-fwptx54vwwcet2j2djjvm2hrhjp5mdj3w9hdkp3d4ektd9yp" 
    },
    body: JSON.stringify({ 
      model: "qwen-3-32b", 
      messages: [
        { role:"system", content: SYSTEM_PROMPT },
        { role:"user", content: `Current page log:\n${log}\n\nUser request: ${userRequest}\n\nGenerate tool calls to fulfill this request. Remember to add wait after opening tabs and use specific selectors.` },
      ]  
    })
  });
  
  if (!res.ok) return append("Agent", `⚠️ API Error ${res.status}`);

  const data = await res.json();
  let rawContent = data.choices[0].message.content.trim();
  
  // Remove any thinking tags or markdown
  rawContent = rawContent.replace(/^<think>[\s\S]*?<\/think>/, "").trim();
  rawContent = rawContent.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
  
  let calls;
  try { 
    calls = JSON.parse(rawContent); 
    if (!Array.isArray(calls)) throw new Error("Not an array"); 
    calls.forEach(call => {
      if (!isValidToolCall(call)) {
        throw new Error(`Invalid tool call: ${JSON.stringify(call)}`);
      }
    }); 
  }
  catch (error) { 
    append("Agent", `⚠️ Invalid tool array: ${error.message}`);
    append("Agent", `Raw response: ${rawContent.slice(0, 200)}...`);
    return;
  }

  append("Agent", `🔧 Executing ${calls.length} tool calls...`);
  append("Agent", `Tools: ${calls.map(c => c.tool).join(" → ")}`);
  
  // Use your existing executeBatch system
  try {
    const exec = await chrome.runtime.sendMessage({ type:"executeBatch", calls });
    if (exec && exec.status === "done") {
      append("Agent", "✅ Complete");
    } else {
      append("Agent", `⚠️ ${exec?.message || 'Failed - check background script'}`);
    }
  } catch (error) {
    append("Agent", `⚠️ Error: ${error.message}`);
  }
};

function isValidToolCall(call) {
  const validTools = ["open_tab", "click", "type_text", "press_key", "wait"];
  
  if (!call || typeof call !== "object" || !validTools.includes(call.tool)) {
    return false;
  }
  
  if (!call.args || typeof call.args !== "object") {
    return false;
  }
  
  // Validate args based on tool type
  switch (call.tool) {
    case "open_tab":
      return typeof call.args.url === "string" && call.args.url.startsWith("http");
    case "wait":
      return typeof call.args.ms === "number" && call.args.ms > 0;
    case "click":
    case "type_text":
      return call.args.selector && typeof call.args.selector === "object";
    case "press_key":
      return typeof call.args.key === "string";
    default:
      return false;
  }
}

function append(who, text) { 
  const timestamp = new Date().toLocaleTimeString();
  chatBox.textContent += `\n[${timestamp}] ${who}: ${text}`; 
  chatBox.scrollTop = chatBox.scrollHeight; 
}

// Add some example queries for testing
window.addEventListener('load', () => {
  append("System", "Action-Agent ready! Try: 'search for cats on Google' or 'open YouTube and search for music'");
});
