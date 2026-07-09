import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.development");

const readEnvValue = (key) => {
  if (!fs.existsSync(envPath)) return "";
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith(`${key}=`)) continue;
    return line.slice(key.length + 1).trim();
  }
  return "";
};

const token = process.env.TELEGRAM_BOT_TOKEN || readEnvValue("TELEGRAM_BOT_TOKEN");

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is missing.");
  process.exit(1);
}

const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const data = await response.json();

if (!data?.ok) {
  console.error("Telegram getUpdates failed:", data);
  process.exit(1);
}

const updates = Array.isArray(data.result) ? data.result : [];

if (!updates.length) {
  console.log("No bot updates found.");
  console.log("1. Open Telegram");
  console.log("2. Message @edutech_main_bot");
  console.log("3. Send /start");
  console.log("4. Run this script again");
  process.exit(0);
}

for (const item of updates) {
  const message = item.message || item.edited_message || item.channel_post || {};
  const chat = message.chat || {};
  const from = message.from || {};
  const summary = {
    update_id: item.update_id,
    chat_id: chat.id || null,
    chat_type: chat.type || "",
    first_name: from.first_name || "",
    username: from.username || chat.username || "",
    text: String(message.text || "").slice(0, 120),
  };
  console.log(JSON.stringify(summary));
}
