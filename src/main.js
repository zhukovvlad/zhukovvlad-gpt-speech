import { Telegraf, session } from "telegraf";
import { message } from "telegraf/filters";
import { code } from "telegraf/format";
import * as dotenv from "dotenv";
import { ogg } from "./ogg.js";
import { openai } from "./openai.js";

import {
  findOrCreateUser,
  addOrUpdateArrayField,
  connect,
  disconnect,
} from "./mongo.js";
import { removeFile } from "./utils.js";

dotenv.config();

const INITIAL_SESSION = {
  messages: [],
};

connect();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.use(session());

bot.command("new", async (ctx) => {
  ctx.session = INITIAL_SESSION;
  await ctx.reply("I am waiting your voice or text message");
});

bot.command("start", async (ctx) => {
  ctx.session = INITIAL_SESSION;
  await ctx.reply("I am waiting your voice or text message");
});

bot.on(message("voice"), async (ctx) => {
  ctx.session ??= INITIAL_SESSION;
  const user = await findOrCreateUser(ctx.chat);
  try {
    await ctx.reply(
      code("I received your message. Waiting response from server")
    );
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const userId = String(ctx.message.from.id);
    const oggPath = await ogg.create(link.href, userId);
    const mp3Path = await ogg.toMp3(oggPath, userId);

    const text = await openai.transcription(mp3Path);
    await ctx.reply(code(`Your message is: ${text}`));

    const userQuestion = { role: openai.roles.USER, content: text };
    const updatedUser = await addOrUpdateArrayField(
      user.id,
      "messages",
      userQuestion
    );

    ctx.session.messages.push({ role: openai.roles.USER, content: text });
    const response = await openai.chat(updatedUser.messages);
    await removeFile(mp3Path);

    const gptAnswer = {
      role: openai.roles.ASSISTANT,
      content: response.content,
    };

    await addOrUpdateArrayField(user.id, "messages", gptAnswer);

    ctx.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response.content,
    });
    await ctx.reply(response.content);
  } catch (error) {
    console.log("Error while voice message", error.message);
  }
});

bot.on(message("text"), async (ctx) => {
  ctx.session ??= INITIAL_SESSION;
  const user = await findOrCreateUser(ctx.chat);
  // console.log(user);
  // const data = { id: user.id, count: user.count ? ++user.count : 1 };
  // user = await fetchUser(data);
  try {
    await ctx.reply(
      code("I received your message. Waiting response from server")
    );

    const text = ctx.message.text;

    ctx.session.messages.push({ role: openai.roles.USER, content: text });

    const userQuestion = { role: openai.roles.USER, content: text };
    const updatedUser = await addOrUpdateArrayField(
      user.id,
      "messages",
      userQuestion
    );

    const response = await openai.chat(updatedUser.messages);

    const gptAnswer = {
      role: openai.roles.ASSISTANT,
      content: response.content,
    };

    await addOrUpdateArrayField(user.id, "messages", gptAnswer);

    ctx.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response.content,
    });
    await ctx.reply(response.content);
  } catch (error) {
    console.log("Error while text message", error.message);
  }
});

bot.launch();

process.once("SIGINT", async () => {
  await disconnect();
  bot.stop("SIGINT");
});
process.once("SIGTERM", async () => {
  await disconnect();
  bot.stop("SIGTERM");
});
