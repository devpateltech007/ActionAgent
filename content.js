addEventListener("click", e => {
  const target = e.target.closest("button, a, input, [role='button']");
  if (target) {
    chrome.runtime.sendMessage({
      type: "logAction",
      payload: {
        timestamp: new Date().toISOString(),
        action: "click",
        tagName: target.tagName,
        className: target.className,
        text: target.innerText || target.value || "",
        url: location.href,
        htmlSnapshot: target.outerHTML
      }
    });
  }
});

addEventListener("change", e => {
  const t = e.target;
  const isInput =
    (t.tagName === "INPUT" && ["text", "search", "email", "url", "number", "tel"].includes(t.type)) ||
    t.tagName === "TEXTAREA";
  if (isInput && t.type !== "password") {
    chrome.runtime.sendMessage({
      type: "logAction",
      payload: {
        timestamp: new Date().toISOString(),
        action: "input",
        inputType: t.type || "textarea",
        placeholder: t.placeholder,
        value: t.value,
        url: location.href,
        htmlSnapshot: t.outerHTML
      }
    });
  }
});
