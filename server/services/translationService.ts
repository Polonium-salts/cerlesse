import { translateText } from "../translationAgent.js";

export async function executeTranslation(params: {
  text: string;
  sourceLang?: string;
  targetLang?: string;
  model?: string;
  env?: Record<string, string | undefined>;
}) {
  return translateText({
    text: params.text,
    sourceLang: params.sourceLang,
    targetLang: params.targetLang,
    model: params.model,
    env: params.env
  });
}
