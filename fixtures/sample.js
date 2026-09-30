import OpenAI from "openai";
const client = new OpenAI();
const model = "gpt-5-2025-08-07";
// Legacy prompt endpoint still used by this app:
const endpoint = "/v1/prompts";
console.log(model, endpoint);
