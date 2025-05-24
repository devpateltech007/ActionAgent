const SYSTEM_PROMPT = `You are Action‑Agent.
You can issue exactly **one** tool call per turn.

Tool: open_tab   args → { "url": "https://…" }
Tool: click      args → { "selector": {tag?,id?,class?,text?} }
Tool: type_text  args → { "selector":{…}, "text":"…", "pressEnter":bool }
Tool: press_key  args → { "key":"Enter" }

Return **only** JSON: {"tool":"…","args":{…}}

the current URL is not always the same hence always open the url in new tab and then perform the required actions in series as per the context provided`;

const chatBox = document.getElementById("chat");
const queryBox = document.getElementById("query");
const sendBtn  = document.getElementById("send");

sendBtn.onclick = () => runAgent(queryBox.value.trim());

async function runAgent(userRequest) {
  if (!userRequest) return;
  append("You", userRequest);
  queryBox.value = "";
  const { log } = await chrome.runtime.sendMessage({ type: "getLog" });

  let done = false; let loopGuard = 0;
  let assistantResponse = "";
  while (!done && loopGuard++ < 10) {
    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer csk-fwptx54vwwcet2j2djjvm2hrhjp5mdj3w9hdkp3d4ektd9yp" },
      body: JSON.stringify({ model: "qwen-3-32b", messages: [
        { role:"system", content:SYSTEM_PROMPT },
        { role:"user", content:`Log:\n${log}\n\nRequest: ${userRequest}` },
        ...(assistantResponse ? [{ role:"assistant", content:assistantResponse }] : [])
      ] })
    });
    if (!res.ok) return append("Agent", `⚠️ API ${res.status}`);
    assistantResponse = (await res.text()).trim();
    try {
      const call = JSON.parse(assistantResponse);
      if (!isValidToolCall(call)) throw new Error("invalid schema");
      append("Agent", `🔧 ${call.tool}`);
      const execRes = await chrome.runtime.sendMessage({ type: "executeTool", call });
      if (execRes.status !== "done") return append("Agent", `⚠️ ${execRes.message}`);
      // tell LLM step complete
      continue; // next loop iteration: send new assistant/context pair
    } catch {
      done = true; // treat as final prose answer
      append("Agent", assistantResponse);
    }
  }
}

function isValidToolCall(c){
  const TOOLS=["open_tab","click","type_text","press_key"];
  return c && TOOLS.includes(c.tool) && typeof c.args==="object";
}

function append(who, text){
  chatBox.textContent += `\n${who}: ${text}`;
  chatBox.scrollTop = chatBox.scroll
}