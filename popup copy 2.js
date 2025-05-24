const SYSTEM_PROMPT = `You are Action‑Agent.
Return **an array** of tool calls needed to satisfy the user request.
Each item must match one of:
  {"tool":"open_tab","args":{"url":"https://…"}}
  {"tool":"click","args":{"selector":{tag?,id?,class?,text?}}}
  {"tool":"type_text","args":{"selector":{…},"text":"…","pressEnter":bool}}
  {"tool":"press_key","args":{"key":"Enter"}}
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
    headers: { "Content-Type": "application/json", "Authorization": "Bearer csk-fwptx54vwwcet2j2djjvm2hrhjp5mdj3w9hdkp3d4ektd9yp" },
    body: JSON.stringify({ model: "qwen-3-32b", messages: [
      { role:"system", content:SYSTEM_PROMPT },
      { role:"user", content:`Log:\n${log}\n\nRequest: ${userRequest}` }
    ] })
  });
  if (!res.ok) return append("Agent", `⚠️ API ${res.status}`);

  const raw = (await res.text()).trim();
  let calls;
  try { calls = JSON.parse(raw); if (!Array.isArray(calls)) throw 0; calls.forEach(c=>{if(!isValid(c)) throw 0;}); }
  catch { return append("Agent","⚠️ invalid tool array returned\n"+raw.slice(0,120)); }

  append("Agent", `🔧 executing ${calls.length} tool calls…`);
  const exec = await chrome.runtime.sendMessage({ type:"executeBatch", calls });
  if (exec.status === "done") append("Agent", "✅ finished");
  else append("Agent", `⚠️ ${exec.message}`);
};

function isValid(c){
  const tools=["open_tab","click","type_text","press_key"]; return c&&tools.includes(c.tool)&&typeof c.args==="object";
}
function append(who,t){ chatBox.textContent+=`\n${who}: ${t}`; chatBox.scrollTop=chatBox.scrollHeight; }
