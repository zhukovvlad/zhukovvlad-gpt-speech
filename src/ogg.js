/**
 * This code is a JavaScript module that uses the axios
 * library for making HTTP requests, the fs (file system)
 * module for writing to the file system, the path module
 * for manipulating file paths, and the url module for working with URLs.
 * The purpose of the module is to define an OggConverter class
 * that can download a file from a given URL and save it as
 * an Ogg Vorbis file. Here's a commented breakdown of the code:
 */
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import installer from "@ffmpeg-installer/ffmpeg";
import { createWriteStream } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { removeFile } from "./utils.js";

//	Define a variable __dirname to get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

class OggConverter {
  constructor() {
    // Set the path to the FFmpeg executable using the installer package
    ffmpeg.setFfmpegPath(installer.path);
  }

  // Asynchronous create method that accepts a URL and a filename
  async create(url, fileName) {
    try {
      // Resolve the file path to save the Ogg Vorbis file
      const oggPath = resolve(__dirname, "../voices", `${fileName}.ogg`);

      // Make an HTTP GET request using axios to the provided URL, and set the responseType to "stream"
      const response = await axios({
        method: "get",
        url,
        responseType: "stream",
      });

      // Return a new Promise that resolves with the Ogg Vorbis file path
      return new Promise((resolve) => {
        // Create a write stream using the oggPath
        const stream = new createWriteStream(oggPath);

        // Pipe the response data to the write stream
        response.data.pipe(stream);

        // When the write stream finishes, resolve the promise with the oggPath
        stream.on("finish", () => resolve(oggPath));
      });
    } catch (error) {
      // Log any error that occurs during the process
      console.log("Error while creating ogg", error.message);
    }
  }

  // toMp3 method that accepts an input file path and an output file basename
  toMp3(input, output) {
    try {
      // Resolve the output file path for the MP3 file
      const outputPath = resolve(dirname(input), `${output}.mp3`);

      // Return a new Promise that resolves with the MP3 file path
      return new Promise((resolve, reject) => {
        // Use fluent-ffmpeg to convert the input file to an MP3 file
        ffmpeg(input)
          .inputOption("-t 30") // Limit the output duration to 30 seconds
          .output(outputPath) // Set the output file path
          .on("end", () => {
            removeFile(input);
            resolve(outputPath);
          }) // Resolve the promise with the outputPath when the conversion is done
          .on("error", (err) => reject(err.message)) // Reject the promise with the error message if an error occurs
          .run(); // Run the conversion process
      });
    } catch (error) {
      // Log any error that occurs during the process
      console.log("Error while creating mp3", error.message);
    }
  }
}

export const ogg = new OggConverter();
