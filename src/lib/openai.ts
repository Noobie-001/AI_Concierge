import OpenAI from "openai";

const globalForOpenAI = globalThis as typeof globalThis & {
  openAIClient?: OpenAI;
};

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  if (!globalForOpenAI.openAIClient) {
    globalForOpenAI.openAIClient = new OpenAI({ apiKey });
  }

  return globalForOpenAI.openAIClient;
}
