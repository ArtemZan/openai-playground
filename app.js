const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chat-form");
const promptEl = document.getElementById("prompt");
const sendEl = document.getElementById("send");

const conversation = [];

function appendMessage(role, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `msg msg--${role}`;
  const bubble = document.createElement("div");
  bubble.className = "msg__bubble";
  bubble.textContent = text || "";
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function resizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 200) + "px";
}

promptEl.addEventListener("input", () => resizeTextarea(promptEl));

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = promptEl.value.trim();
  if (!text) return;

  sendEl.disabled = true;
  promptEl.disabled = true;

  // Render user message
  conversation.push({ role: "user", content: text });
  appendMessage("user", text);

  // Render assistant placeholder to stream into
  const assistantBubble = appendMessage("assistant", "");

  try {
    const response = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation }),
    });

    if (!response.ok || !response.body) {
      throw new Error("Network error");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse Server-Sent Events (SSE)
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const eventBlock = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        const lines = eventBlock.split("\n");
        let eventType = "message";
        let dataLine = "";
        for (const line of lines) {
          if (line.startsWith("event:")) eventType = line.slice(6).trim();
          if (line.startsWith("data:")) dataLine += line.slice(5).trim();
        }

        if (eventType === "done") {
          // finalize
          conversation.push({ role: "assistant", content: assistantText });
        } else if (eventType === "error") {
          console.error("SSE error:", dataLine);
        } else {
          try {
            const payload = dataLine ? JSON.parse(dataLine) : {};
            if (payload && typeof payload.delta === "string") {
              assistantText += payload.delta;
              assistantBubble.textContent = assistantText;
              messagesEl.scrollTop = messagesEl.scrollHeight;
            }
          } catch (e) {
            // ignore bad JSON chunks
          }
        }
      }
    }
  } catch (err) {
    console.error(err);
    appendMessage("assistant", "Sorry, something went wrong.");
  } finally {
    sendEl.disabled = false;
    promptEl.disabled = false;
    promptEl.value = "";
    resizeTextarea(promptEl);
    promptEl.focus();
  }
});

// Support Enter to send, Shift+Enter for newline
promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    formEl.requestSubmit();
  }
});


