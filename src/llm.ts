import OpenAI from "openai";
import { DomainGroup } from "./types";

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
  generateProjectSummary(
    context: { filePath: string; entityNames: string[]; importCount: number; exportCount: number }[],
  ): Promise<string>;
  clusterDomains(context: { filePath: string; entityNames: string[]; entityKinds: string[] }[]): Promise<DomainGroup[]>;
}

export function createLlmClient(config: { apiKey: string; baseUrl: string; model: string }, verbose = false): LlmClient {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  async function completeWithRetry(systemPrompt: string, userPrompt: string): Promise<string> {
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
  }

  return {
    async explainEntity(input): Promise<string> {
      const systemPrompt =
        "You explain source code entities in plain English for technical and non-technical readers. Be concise, concrete, and avoid hallucinations.";
      const userPrompt = `Entity metadata:\n- file: ${input.filePath}\n- kind: ${input.kind}\n- name: ${input.name}\n- exported: ${String(input.exported)}\n- signature: ${input.signature ?? "n/a"}\n\nCode snippet:\n\n${input.snippet}\n\nRespond with 3-6 sentences covering purpose, key behavior, dependencies, and likely impact.`;

      return completeWithRetry(systemPrompt, userPrompt);
    },

    async generateProjectSummary(context): Promise<string> {
      const systemPrompt =
        "You summarize software projects in plain English for non-technical readers. Be concrete about what the software does, what tech stack it uses, and who it's for. 3-5 sentences max.";
      const lines = context
        .map(
          (entry) =>
            `- ${entry.filePath}\n  entities: ${entry.entityNames.length ? entry.entityNames.join(", ") : "none"}\n  imports: ${entry.importCount}\n  exports: ${entry.exportCount}`,
        )
        .join("\n");
      const userPrompt = `Project file context:\n${lines}\n\nWrite a concise project summary in 3-5 sentences.`;

      return completeWithRetry(systemPrompt, userPrompt);
    },

    async clusterDomains(context): Promise<DomainGroup[]> {
      const systemPrompt =
        "You organize source code files into logical business domains for non-technical documentation. Group by business function, not directory structure. Return valid JSON only.";
      const lines = context
        .map(
          (entry) =>
            `- ${entry.filePath}\n  entities: ${entry.entityNames.length ? entry.entityNames.join(", ") : "none"}\n  kinds: ${entry.entityKinds.length ? entry.entityKinds.join(", ") : "none"}`,
        )
        .join("\n");
      const userPrompt = `Files and entities:\n${lines}\n\nReturn JSON array only in this exact shape:\n[{"name":"Domain Name","emoji":"🔐","description":"One sentence description","files":["src/lib/cors.ts"]}]\n\nRules:\n- Every file must appear in exactly one domain\n- Use 4-8 domains\n- Group by business function, not folder structure`;

      const maxAttempts = 3;
      let lastError: unknown;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          let text = await completeWithRetry(systemPrompt, userPrompt);
          // Strip markdown code fences if present
          text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
          const parsed = JSON.parse(text) as Array<Omit<DomainGroup, "slug"> & { slug?: string }>;
          if (!Array.isArray(parsed)) {
            throw new Error("Domain clustering response was not an array");
          }

          return parsed.map((group) => ({
            name: group.name,
            emoji: group.emoji,
            description: group.description,
            files: group.files,
            slug: group.name.toLowerCase().trim().replace(/\s+/g, "-"),
          }));
        } catch (error) {
          lastError = error;
          if (verbose) {
            // eslint-disable-next-line no-console
            console.warn(`[llm] domain parse attempt ${attempt} failed:`, error);
          }
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
          }
        }
      }

      throw lastError instanceof Error ? lastError : new Error("Domain clustering request failed");
    },
  };
}
