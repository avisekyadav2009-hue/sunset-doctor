// Intentionally outdated example used to demonstrate SunsetDoctor.
import OpenAI from "openai";

const client = new OpenAI();

const model = "gpt-5-2025-08-07";
const savedPrompt = { id: "pmpt_support_v1" };
const hostedWorkflow = { id: "wf_68df4b13b3588190" };

async function run() {
  await client.evals.runs.create("eval_support_v1", {});
  return client.responses.create({
    model,
    input: "Summarize a support ticket.",
    prompt: savedPrompt
  });
}

console.log(model, savedPrompt.id, hostedWorkflow.id);
run();
