import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "translation",
  name: "多语言翻译",
  version: "1.0.0",
  apiVersion: 1,
  description: "文本翻译、双语释义、发音与例句",
  category: "action",
  tags: [
    "翻译",
    "双语",
    "词典",
    "英语",
    "日语",
    "发音"
  ],
  capabilities: [
    "language_translation",
    "text_translation",
    "bilingual_comparison",
    "pronunciation_guide",
    "dictionary_lookup"
  ],
  intents: [
    "translation"
  ],
  keywords: [
    "翻译",
    "英文",
    "英语",
    "日语",
    "韩语",
    "translate",
    "translation",
    "什么意思"
  ],
  examples: [
    "苹果英语怎么说",
    "hello 中文",
    "这个词是什么意思"
  ],
  dataRequirements: [
    "translation"
  ],
  layout: {
    defaultWidth: 50,
    minWidth: 50,
    maxWidth: 75,
    preferredHeight: 400
  },
  agent: {
    selectable: true,
    minConfidence: 0.75
  },
  permissions: {
    network: true,
    clipboard: true
  }
};
