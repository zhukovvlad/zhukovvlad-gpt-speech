import { Telegraf, session } from "telegraf";
import { message } from "telegraf/filters";
import { code } from "telegraf/format";
import config from "config";
import * as dotenv from "dotenv"
import { ogg } from "./ogg.js";
import { openai } from "./openai.js";

dotenv.config()

const INITIAL_SESSION = {
  messages: [],
};

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
  try {
    await ctx.reply(
      code("I received your message. Waiting response from server")
    );
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const userId = String(ctx.message.from.id);
    console.log(link.href);
    const oggPath = await ogg.create(link.href, userId);
    const mp3Path = await ogg.toMp3(oggPath, userId);

    const text = await openai.transcription(mp3Path);
    await ctx.reply(code(`Your message is: ${text}`));

	ctx.session.messages.push({role: openai.roles.USER, content: text})
    // const message = [{ role: openai.roles.USER, content: text }];
    const response = await openai.chat(ctx.session.messages);

	ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})
    await ctx.reply(response.content);
  } catch (error) {
    console.log("Error while voice message", error.message);
  }
});

bot.on(message("text"), async (ctx) => {
	ctx.session ??= INITIAL_SESSION;
	try {
	  await ctx.reply(
		code("I received your message. Waiting response from server")
	  );

	  console.log(ctx.session.messages)
	    
	  const text = ctx.message.text;
  
	  ctx.session.messages.push({role: openai.roles.USER, content: text})

	  const response = await openai.chat(ctx.session.messages);
  
	  ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})
	  await ctx.reply(response.content);
	} catch (error) {
	  console.log("Error while voice message", error.message);
	}
  });

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
