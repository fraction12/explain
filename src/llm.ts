import OpenAI from "openai";

export const PROMPT_VERSION = "v1";

export interface LlmClient {
  explainEntity(input: {
    filePath: string;
    kind: string;
    name: string;
    signature?: string;
    exported: boolean;
    snippet: string;
  }): Promise<string>;
}

export function createLlmClient(config: { apiKey: string; baseUrl: string; model: string }, verbose = false): LlmClient {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  return {
    async explainEntity(input): Promise<string> {
      const systemPrompt =
        "You explain source code entities in plain English for technical and non-technical readers. Be concise, concrete, and avoid hallucinations.";
      const userPrompt = `Entity metadata:\n- file: ${input.filePath}\n- kind: ${input.kind}\n- name: ${input.name}\n- exported: ${String(input.exported)}\n- signature: ${input.signature ?? "n/a"}\n\nCode snippet:\n\n${input.snippet}\n\nRespond with 3-6 sentences covering purpose, key behavior, dependencies, and likely impact.`;

      const maxAttempts = 3;
      let lastError: unknown;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const response = await client.chat.completions.create({
            model: config.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.2,
          });

          const text = response.choices[0]?.message?.content?.trim();
          if (!text) {
            throw new Error("LLM response was empty");
          }

          return text;
        } catch (error) {
          lastError = error;
          if (verbose) {
            // eslint-disable-next-line no-console
            console.warn(`[llm] attempt ${attempt} failed:`, error);
          }
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
          }
        }
      }

      throw lastError instanceof Error ? lastError : new Error("LLM request failed");
    },
  };
}
