const SYSTEM_PROMPT = `You are Action‑Agent. Return ONLY a JSON array of tool calls with the following schemas:
  {"tool":"open_tab","args":{"url":"https://…"}}
  {"tool":"click","args":{"selector":{tag?,id?,class?,text?}}}
  {"tool":"type_text","args":{"selector":{…},"text":"…","pressEnter":bool}}
  {"tool":"press_key","args":{"key":"Enter"}}
No prose, no <think>.`;

const TOOL_CATALOG = ["open_tab", "click", "type_text", "press_key"];

const chat   = document.getElementById("chat");
const query  = document.getElementById("query");
const sendBtn= document.getElementById("send");

sendBtn.onclick = handleSend;

async function handleSend() {
  const userRequest = query.value.trim();
  if (!userRequest) return;
  append("You", userRequest);
  query.value = "";

  const { log } = await chrome.runtime.sendMessage({ type: "getLog" });

  const resp = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer csk-fwptx54vwwcet2j2djjvm2hrhjp5mdj3w9hdkp3d4ektd9yp"
    },
    body: JSON.stringify({
      model: "qwen-3-32b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Log:
${log}

Request: ${userRequest}` }
      ]
    })
  });

  if (!resp.ok) {
    append("Agent", `⚠️ API ${resp.status}`);
    return;
  }

  let text = await resp.text();
  // Strip anything before first [ or {
  const idx = text.search(/[\[{]/);
  if (idx > 0) text = text.slice(idx);

  let calls;
  try {
    calls = JSON.parse(text);
    if (!Array.isArray(calls)) throw 0;
  } catch {
    append("Agent", "⚠️ invalid JSON array returned" + text.slice(0, 120));
    return;
  }

  // Normalize each call for executor compatibility
  const normalized = calls.map(normalizeCall).filter(Boolean);
  if (!normalized.length) {
    append("Agent", "⚠️ no valid tool calls detected");
    return;
  }

  append("Agent", `🔧 executing ${normalized.length} calls…`);
  const execRes = await chrome.runtime.sendMessage({ type: "executeBatch", calls: normalized });
  append("Agent", execRes.status === "done" ? "✅ finished" : `⚠️ ${execRes.message}`);
}

function normalizeCall(raw) {
  if (!raw || typeof raw !== "object" || !TOOL_CATALOG.includes(raw.tool)) return null;
  // If args present and okay, return as‑is
  if (raw.args && typeof raw.args === "object") return { tool: raw.tool, args: raw.args };
  // Legacy format with target
  if (raw.target) {
    const t = raw.target;
    const sel = {
      tag: t.tag || undefined,
      id: t.attributes?.id || undefined,
      class: t.attributes?.class || t.attributes?.className || undefined,
      text: t.text || undefined
    };
    return { tool: "click", args: { selector: sel } };
  }
  return null;
}

function append(who, text) {
  chat.textContent += `
${who}: ${text}`;
  chat.scrollTop = chat.scrollHeight;
}
