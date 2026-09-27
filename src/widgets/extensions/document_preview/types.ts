export interface DocSection {
  id: string;
  heading: string;
  content: string;
  badge?: string;
}

export interface DocumentPreviewData {
  title: string;
  fileType: "pdf" | "markdown" | "doc" | "specification" | "rfc";
  authorOrSource?: string;
  publishDate?: string;
  pageCount?: number;
  readingTimeMinutes?: number;
  tableOfContents?: string[];
  sections: DocSection[];
  downloadUrl?: string;
  externalUrl?: string;
  citationText?: string;
}
