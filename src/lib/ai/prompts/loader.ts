import fs from "node:fs";
import path from "node:path";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");
const cache = new Map<string, string>();

/** Load a markdown prompt from prompts/{name}.md (cached). */
export function loadPrompt(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const filePath = path.join(PROMPTS_DIR, `${name}.md`);
  const content = fs.readFileSync(filePath, "utf8").trim();
  cache.set(name, content);
  return content;
}

/** Replace {{key}} placeholders in a prompt template. */
export function renderPrompt(
  template: string,
  vars: Record<string, string>,
): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );
}

export function clearPromptCacheForTests(): void {
  cache.clear();
}
