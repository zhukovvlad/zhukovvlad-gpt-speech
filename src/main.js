/**
 * @fileoverview Main module for the Telegram bot using Telegraf.js. This bot integrates with OpenAI's
 * services for various functionalities like chatting, transcription, image generation, and querying models.
 * It uses MongoDB for user data management and OpenAI's API for advanced AI features.
 */

import { Telegraf, session, Scenes } from "telegraf";
import { message } from "telegraf/filters";
import { code } from "telegraf/format";
import * as fs from "fs";
import * as dotenv from "dotenv";

import { ogg } from "./ogg.js";
import {
  chatWithBot,
  transcription,
  makeImage,
  askModels,
  roles,
} from "./openai.js";
import {
  findOrCreateUser,
  addOrUpdateArrayField,
  connect,
  disconnect,
  clearArrayField,
} from "./mongo.js";
import { removeFile } from "./utils.js";

dotenv.config();

// Establish MongoDB connection
connect();

/**
 * The main Telegram bot object using Telegraf framework.
 * @type {Telegraf}
 */
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Scenes for managing bot's conversation states
const { BaseScene, Stage } = Scenes;

/**
 * The paint scene for handling image generation requests.
 * @type {BaseScene}
 */
const paintScene = new BaseScene("paint");

// Setting up the paint scene
paintScene.enter((ctx) => {
  ctx.reply(
    "You have entered the paint mode! Write any promt you want. For exit from this mode use command '/quit'"
  );
});

// Handling text messages in the paint scene
paintScene.on(message("text"), async (ctx) => {
  const user = await findOrCreateUser(ctx.chat);

  try {
    if (ctx.message.text === "/quit") {
      ctx.scene.leave();
      ctx.reply("You have left the paint mode");
    } else {
      ctx.reply("I received your promt. Let's try to draw it!");

      const response = await makeImage(ctx.message.text);
      await ctx.replyWithPhoto(response.url);
      await ctx.reply(response.revised_prompt);
    }
  } catch (error) {
    console.error(
      `${new Date()} - OpenAI API painting chat returned error. ${error}`
    );
    ctx.reply(
      `${new Date()} - OpenAI API painting chat returned error. ${
        error.message
      }`
    );
    ctx.scene.enter("paint");
  }
});

// Handling voice messages in the paint scene
paintScene.on(message("voice"), async (ctx) => {
  const user = await findOrCreateUser(ctx.chat);

  try {
    await ctx.reply(
      code("I received your message. Waiting response from server")
    );
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const userId = String(ctx.message.from.id);
    const oggPath = await ogg.create(link.href, userId);
    const mp3Path = await ogg.toMp3(oggPath, userId);

    const text = await transcription(mp3Path);
    await ctx.reply(code(`Your message is: ${text}`));

    await ctx.persistentChatAction("typing", async () => {
      const response = await makeImage(text);

      if (!response) {
        console.error(
          `${new Date()} - OpenAI API voice chat returned undefined`
        );
        return;
      }

      await ctx.replyWithPhoto(response);
      await ctx.reply(response.revised_prompt);
    });

    await removeFile(mp3Path);
  } catch (error) {
    console.error(
      `${new Date()} - OpenAI API voice chat returned error. ${error.message}`
    );
    ctx.reply(
      `${new Date()} - OpenAI API voice chat returned error. ${error.message}`
    );
    ctx.scene.enter("paint");
  }
});

// Quit command for the paint scene
paintScene.command("quit", (ctx) => ctx.scene.leave());

// Setting up stages for the bot
const stage = new Stage([paintScene]);
bot.use(session());
bot.use(stage.middleware());

// Defining bot commands
bot.telegram.setMyCommands([
  {
    command: "start",
    description: "Start bot command",
  },
  {
    command: "clear",
    description: "clear chat context with chatGPT",
  },
  {
    command: "paint",
    description: "give your promt and get result",
  },
]);

// Start command logic
bot.command("start", async (ctx) => {
  try {
    const photoPath = fs.readFileSync("./src/assets/image.png");

    await ctx.replyWithPhoto(
      { source: photoPath },
      {
        caption: `Greetings *${ctx.message.from.first_name}*! Here you can ask questions to the GPT chat, using text or voice messages. We are using *GPT-4-turbo* model API for text responses and "dall-e-3" model for image generation.`,
        parse_mode: "Markdown",
      }
    );
  } catch (error) {
    console.error(`${new Date()} - Something went wrong while start`);
  }
});

// Paint command logic
bot.command("paint", (ctx) => ctx.scene.enter("paint"));

// Clear command logic
bot.command("clear", async (ctx) => {
  const user = await findOrCreateUser(ctx.chat);
  await clearArrayField(user.id, "messages");
  await ctx.reply("I succesfully clearened up all your context");
});

// Models command logic
bot.command("models", async (ctx) => {
  await askModels();
  await ctx.reply(
    "I've asked for all possible chat models. Look into your console"
  );
});

// Handling voice messages globally
bot.on(message("voice"), async (ctx) => {
  const user = await findOrCreateUser(ctx.chat);
  try {
    await ctx.reply(
      code("I received your message. Waiting response from server")
    );
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const userId = String(ctx.message.from.id);
    const oggPath = await ogg.create(link.href, userId);
    const mp3Path = await ogg.toMp3(oggPath, userId);

    const text = await transcription(mp3Path);

    await ctx.reply(code(`Your message is: ${text}`));

    const userQuestion = { role: roles.USER, content: text };
    const updatedUser = await addOrUpdateArrayField(
      user.id,
      "messages",
      userQuestion
    );

    // ctx.sendChatAction("typing");

    // ctx.session.messages.push({ role: openai.roles.USER, content: text });
    await ctx.persistentChatAction("typing", async () => {
      const response = await chatWithBot(updatedUser.messages);

      if (!response) {
        console.error(
          `${new Date()} - OpenAI API voice chat returned undefined`
        );
        return;
      }
      if (!response.message.content) {
        console.error(
          `${new Date()} - OpenAI API voice chat response does not contain 'content'`
        );
        return;
      }
      await ctx.reply(response.message.content);

      const gptAnswer = {
        role: roles.ASSISTANT,
        content: response.message.content,
      };

      await addOrUpdateArrayField(user.id, "messages", gptAnswer);

    });

    await removeFile(mp3Path);
  } catch (error) {
    console.error(
      `${new Date()} - OpenAI API voice chat returned error., ${error.message}`
    );
    ctx.reply(
      `${new Date()} - OpenAI API voice chat returned error. ${error.message}`
    );
  }
});

// Handling text messages globally
bot.on(message("text"), async (ctx) => {
  const user = await findOrCreateUser(ctx.chat);

  try {
    await ctx.reply(
      code("I received your message. Waiting response from server")
    );

    const text = ctx.message.text;

    const userQuestion = { role: roles.USER, content: text };
    const updatedUser = await addOrUpdateArrayField(
      user.id,
      "messages",
      userQuestion
    );

    await ctx.persistentChatAction("typing", async () => {
      const response = await chatWithBot(updatedUser.messages);

      if (!response) {
        console.error(
          `${new Date()} - OpenAI API text chat returned undefined`
        );
        return;
      }
      if (!response.message.content) {
        console.error(
          `${new Date()} - OpenAI API text chat response does not contain 'content'`
        );
        return;
      }
      await ctx.reply(response.message.content);

      const gptAnswer = {
        role: roles.ASSISTANT,
        content: response.message.content,
      };

      await addOrUpdateArrayField(user.id, "messages", gptAnswer);
    });
  } catch (error) {
    console.error("Error while text message", error.message);
  }
});

// Launching the bot
bot.launch();

// Handling SIGINT for graceful shutdown
process.once("SIGINT", async () => {
  await disconnect();
  bot.stop("SIGINT");
});

// Handling SIGTERM for graceful shutdown
process.once("SIGTERM", async () => {
  await disconnect();
  bot.stop("SIGTERM");
});
