import { Configuration, OpenAIApi } from "openai";
import * as dotenv from "dotenv";
import { createReadStream } from "fs";

dotenv.config();

class OpenAI {
  roles = {
    ASSISTANT: "assistant",
    USER: "user",
    SYSTEM: "system",
  };

  constructor(apiKey) {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);
  }

  async chat(messages) {
    try {
      const response = await this.openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages,
      });
      return response.data.choices[0].message;
    } catch (error) {
      console.log("Error while chat GPT", error.message);
    }
  }

  async transcription(filePath) {
    try {
      const response = await this.openai.createTranscription(
        createReadStream(filePath),
        "whisper-1"
      );
      return response.data.text;
    } catch (error) {
      console.log("Error while transcription", error.message);
    }
  }
}

export const openai = new OpenAI(process.env.OPENAI_API_KEY);
