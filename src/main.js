import { Telegraf, Markup, session, Scenes } from "telegraf";
import { message } from "telegraf/filters";
import { code } from "telegraf/format";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { ogg } from "./ogg.js";
import { openai } from "./openai.js";

import {
  findOrCreateUser,
  addOrUpdateArrayField,
  connect,
  disconnect,
  clearArrayField,
} from "./mongo.js";
import { removeFile } from "./utils.js";

dotenv.config();

// const INITIAL_SESSION = {
//   messages: [],
// };

connect();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

const { BaseScene, Stage } = Scenes;

const paintScene = new BaseScene("paint");

paintScene.enter((ctx) => {
  ctx.reply(
    "You have entered the paint mode! Write any promt you want. For exit from this mode use command '/quit'"
  );
});
paintScene.on(message("text"), async (ctx) => {
  if (ctx.message.text === "/quit") {
    ctx.scene.leave();
    ctx.reply("You have left the paint mode");
  } else {
    ctx.reply("I received your promt. Let's try to draw it!");
    const response = await openai.makeImage(ctx.message.text);
    await ctx.replyWithPhoto(response);
  }
});
paintScene.command("quit", (ctx) => ctx.scene.leave());

const stage = new Stage([paintScene]);
bot.use(session());
bot.use(stage.middleware());

// bot.use(session());
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

bot.command("start", async (ctx) => {
  // ctx.session = INITIAL_SESSION;
  try {
    const photoPath = fs.readFileSync("./src/assets/image.png");

    await ctx.replyWithPhoto(
      { source: photoPath },
      {
        caption: `Greetings *${ctx.message.from.first_name}*! Here you can ask questions to the GPT chat, using text or voice messages. Unfortunately, we have not yet gained access to the *GPT-4* API and are using the "gpt-3.5-turbo" model for responses.`,
        parse_mode: "Markdown",
        // ...Markup.inlineKeyboard([
        //   Markup.button.callback("Опция 1", "OPTION_1"),
        //   Markup.button.callback("Опция 2", "OPTION_2"),
        // ]),
      }
    );
  } catch (error) {
    console.error(`${new Date()} - Something went wrong while start`);
    throw error;
  }
});

bot.action("OPTION_1", (ctx) => ctx.answerCbQuery("Вы выбрали опцию 1"));
bot.action("OPTION_2", (ctx) => ctx.answerCbQuery("Вы выбрали опцию 2"));

bot.command("paint", (ctx) => ctx.scene.enter("paint"));

bot.command("clear", async (ctx) => {
  const user = await findOrCreateUser(ctx.chat);
  await clearArrayField(user.id, "messages");
  await ctx.reply("I succesfully clearened up all your context");
});

bot.on(message("voice"), async (ctx) => {
  // ctx.session ??= INITIAL_SESSION;
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

    // ctx.sendChatAction("typing");

    // ctx.session.messages.push({ role: openai.roles.USER, content: text });
    await ctx.persistentChatAction("typing", async () => {
      const response = await openai.chat(updatedUser.messages);

      if (!response) {
        console.error(
          `${new Date()} - OpenAI API voice chat returned undefined`
        );
        return;
      }
      if (!response.content) {
        console.error(
          `${new Date()} - OpenAI API voice chat response does not contain 'content'`
        );
        return;
      }

      const gptAnswer = {
        role: openai.roles.ASSISTANT,
        content: response.content,
      };

      await addOrUpdateArrayField(user.id, "messages", gptAnswer);

      await ctx.reply(response.content);
    });
    // const response = await openai.chat(updatedUser.messages);

    // ctx.sendChatAction("typing");

    await removeFile(mp3Path);

    // if (!response) {
    //   console.error(`${new Date()} - OpenAI API voice chat returned undefined`);
    //   return;
    // }
    // if (!response.content) {
    //   console.error(
    //     `${new Date()} - OpenAI API voice chat response does not contain 'content'`
    //   );
    //   return;
    // }

    // const gptAnswer = {
    //   role: openai.roles.ASSISTANT,
    //   content: response.content,
    // };

    // await addOrUpdateArrayField(user.id, "messages", gptAnswer);

    // ctx.session.messages.push({
    //   role: openai.roles.ASSISTANT,
    //   content: response.content,
    // });
    // await ctx.reply(response.content);
  } catch (error) {
    console.log("Error while voice message", error.message);
    ctx.reply(`${new Date()} - OpenAI API voice chat returned error. ${error.message}`)
    throw error
  }
});

bot.on(message("text"), async (ctx) => {
  // ctx.session ??= INITIAL_SESSION;
  const user = await findOrCreateUser(ctx.chat);
  // console.log(user);
  // const data = { id: user.id, count: user.count ? ++user.count : 1 };
  // user = await fetchUser(data);
  try {
    await ctx.reply(
      code("I received your message. Waiting response from server")
    );

    const text = ctx.message.text;

    // ctx.session.messages.push({ role: openai.roles.USER, content: text });

    const userQuestion = { role: openai.roles.USER, content: text };
    const updatedUser = await addOrUpdateArrayField(
      user.id,
      "messages",
      userQuestion
    );

    ctx.sendChatAction("typing");

    const response = await openai.chat(updatedUser.messages);

    ctx.sendChatAction("typing");

    if (!response) {
      console.error(`${new Date()} - OpenAI API text chat returned undefined`);
      return;
    }
    if (!response.content) {
      console.error(
        `${new Date()} - OpenAI API text chat response does not contain 'content'`
      );
      return;
    }

    const gptAnswer = {
      role: openai.roles.ASSISTANT,
      content: response.content,
    };

    await addOrUpdateArrayField(user.id, "messages", gptAnswer);

    // ctx.session.messages.push({
    //   role: openai.roles.ASSISTANT,
    //   content: response.content,
    // });
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
