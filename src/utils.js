import { unlink } from "fs/promises";

export async function removeFile(path) {
  try {
    await unlink(path);
  } catch (error) {
    console.log("Error while remove file", error.message);
  }
}

export const logError = (operation, error) => {
  console.error(`${new Date()} - Error while ${operation}: ${error.message}`);
  throw error
}