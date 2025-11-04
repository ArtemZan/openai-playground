import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

app.use(cors());

const openai = new OpenAI({  });

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body || {};
    const safeMessages = Array.isArray(messages) ? messages : [];

    // Convert chat-style messages into Responses API input format
    // For inputs, all content segments should use type "input_text" regardless of role
    const input = safeMessages.map((m) => {
      const role = m.role || "user";
      const text = typeof m.content === "string" ? m.content : String(m.content ?? "");
      return {
        role,
        content: [
          {
            type: "input_text",
            text,
          },
        ],
      };
    });

    // Prepare SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const stream = await openai.responses.stream({
      model: "gpt-5",
      input,
      //service_tier: "priority",
    });

    // Stream output_text deltas as SSE 'data' events (specific event)
    stream.on("response.output_text.delta", (event) => {
      const chunk = typeof event === "string" ? event : (typeof event?.delta === "string" ? event.delta : "");
      if (chunk) {
        res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
      }
    });
    // Also listen to the aggregator 'text' for broader SDK compatibility
    stream.on("text", (chunk) => {
      if (typeof chunk === "string" && chunk) {
        res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
      }
    });

    stream.on("error", (err) => {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ message: err?.message || "stream error" })}\n\n`);
    });

    await stream.done();
    res.write("event: done\n");
    res.write("data: {}\n\n");
    res.end();
  } catch (err) {
    const status = typeof err?.status === "number" ? err.status : 500;
    if (!res.headersSent) {
      res.status(status).json({ error: err?.message || "Server error" });
    } else {
      // If headers already sent, close SSE stream with error
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ message: err?.message || "Server error" })}\n\n`);
      res.end();
    }
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});


