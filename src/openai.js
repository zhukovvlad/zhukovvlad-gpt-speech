/**
 * @fileoverview This module integrates with OpenAI API for various functionalities
 * like chatting with a bot, transcribing speech, generating images, and querying 
 * available models. It leverages the OpenAI JavaScript client and requires API keys 
 * to be set up in the environment variables.
 */

import * as dotenv from "dotenv";
import OpenAI from "openai";
import { createReadStream } from "fs";

import { logError } from "./utils.js";

dotenv.config();

/**
 * Roles for users in the chat.
 * @enum {string}
 */
const roles = {
  ASSISTANT: "assistant",
  USER: "user",
  SYSTEM: "system",
};

/**
 * Models available for use with OpenAI API.
 * @enum {string}
 */
const models = {
  CHATMODEL: "gpt-4-1106-preview",
  SPEECHMODEL: "whisper-1",
  IMAGEMODEL: "dall-e-3",
};

// Initialize OpenAI client with API key
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Chat with an OpenAI bot using the specified model.
 * @async
 * @param {Object[]} messages - The messages to be sent to the chatbot.
 * @returns {Promise<Object>} The chatbot's response.
 */
const chatWithBot = async (messages) => {
  try {
    const response = await openaiClient.chat.completions.create({
      model: models.CHATMODEL,
      messages,
    });
    return response.choices[0];
  } catch (error) {
    logError("chat GPT", error);
  }
};

/**
 * Transcribes audio from the provided file path using OpenAI's model.
 * @async
 * @param {string} filePath - The file path of the audio to be transcribed.
 * @returns {Promise<string>} The transcribed text.
 */
const transcription = async (filePath) => {
  try {
    const response = await openaiClient.audio.transcriptions.create({
      model: models.SPEECHMODEL,
      file: createReadStream(filePath),
    });
    return response.data.text;
  } catch (error) {
    logError("transcription from voice to text", error);
  }
};

/**
 * Generates an image based on the provided message using OpenAI's model.
 * @async
 * @param {string} message - The prompt message for image generation.
 * @returns {Promise<Object>} The generated image data.
 */
const makeImage = async (message) => {
  try {
    const response = await openaiClient.images.generate({
      model: models.IMAGEMODEL,
      prompt: message,
      n: 1,
      size: "1024x1024",
    });
    return response.data[0];
  } catch (error) {
    logError("creating image", error);
  }
};

/**
 * Retrieves a list of available models from OpenAI.
 * @async
 * @returns {Promise<Object>} A list of available models.
 */
const askModels = async () => {
  try {
    const response = await openaiClient.models.list();
    return response;
  } catch (error) {
    logError("asking for models list", error);
  }
};

export { chatWithBot, transcription, makeImage, askModels, roles };
