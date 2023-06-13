import * as dotenv from "dotenv";
import { Configuration, OpenAIApi } from "openai";

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
      apiKey: apiKey,
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
      console.error(`${new Date()} - Error while chat GPT: ${error.message}`);
      throw error;
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
      console.error(
        `${new Date()} - Error while transcription from voice to text ${
          error.message
        }`
      );
      throw error;
    }
  }

  async makeImage(message) {
    try {
      const response = await this.openai.createImage({
        prompt: message,
        n: 1,
        size: "1024x1024",
      });
      return response.data.data[0].url;
    } catch (error) {
      console.error(
        `${new Date()} - Error while creating image ${error.message}`
      );
      throw error;
    }
  }
}

export const openai = new OpenAI(process.env.OPENAI_API_KEY);
