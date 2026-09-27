export interface CodeSnippetItem {
  id: string;
  title: string;
  language: "typescript" | "javascript" | "python" | "bash" | "rust" | "go" | "json";
  code: string;
  output?: string;
  description?: string;
  executionTimeMs?: number;
}

export interface CodePlaygroundData {
  title: string;
  description?: string;
  defaultLanguage: string;
  snippets: CodeSnippetItem[];
  allowEdit?: boolean;
}
