import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";

const MAX_OUTGOING_CHAT_MESSAGES = 10;

const getTrimmedMessages = (messages = []) =>
  (Array.isArray(messages) ? messages : []).slice(-MAX_OUTGOING_CHAT_MESSAGES);

export const sendPlatformAiChatMessage = async (messages = [], context = {}) => {
  const response = await fetch(`${getApiBase()}/ai-chat/messages`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ messages: getTrimmedMessages(messages), context }),
  });

  const data = await parseJsonResponse(response);
  return data?.data || { reply: "", model: "" };
};

export const streamPlatformAiChatMessage = async (
  messages = [],
  context = {},
  { onChunk = () => {}, signal } = {},
) => {
  const payload = { messages: getTrimmedMessages(messages), context };
  let response;

  try {
    response = await fetch(`${getApiBase()}/ai-chat/messages/stream`, {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    const fallback = await sendPlatformAiChatMessage(payload.messages, context);
    if (fallback?.reply) {
      onChunk(fallback.reply);
      return fallback;
    }
    throw error;
  }

  if (!response.ok || !response.body) {
    const fallback = await sendPlatformAiChatMessage(payload.messages, context).catch(() => null);
    if (fallback?.reply) {
      onChunk(fallback.reply);
      return fallback;
    }
    const data = await parseJsonResponse(response);
    return data?.data || { reply: "", model: "" };
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  let model = "";

  const flushEvent = (rawEvent) => {
    const trimmed = String(rawEvent || "").trim();
    if (!trimmed) return;

    const payloads = trimmed
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    payloads.forEach((payload) => {
      if (payload?.type === "chunk" && typeof payload?.delta === "string") {
        reply += payload.delta;
        onChunk(payload.delta);
      }

      if (payload?.type === "done") {
        model = String(payload?.model || "").trim();
        if (!reply && typeof payload?.reply === "string") {
          reply = payload.reply;
        }
      }

      if (payload?.type === "error") {
        throw new Error(payload?.message || "Could not get an assistant reply.");
      }
    });
  };

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    events.forEach(flushEvent);
  }

  if (buffer.trim()) {
    flushEvent(buffer);
  }

  return { reply: String(reply || "").trim(), model };
};
