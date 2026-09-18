import type { SearchSynthesisResult, MindMapNode } from "../../../types.js";

export interface MindMapData {
  query: string;
  mindMap?: MindMapNode;
  activeResult?: SearchSynthesisResult;
}
