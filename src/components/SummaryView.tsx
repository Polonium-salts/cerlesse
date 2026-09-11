import React from "react";
import { SearchResult } from "../types.js";
import { GoogleAIOverview } from "./GoogleAIOverview.js";
import { GoogleOrganicResults } from "./GoogleOrganicResults.js";

interface SummaryViewProps {
  summary: string;
  keyTakeaways: string[];
  followUpQuestions: string[];
  filteredResults: SearchResult[];
  modelUsed: string;
  onFollowUpClick: (question: string) => void;
  query: string;
  onOpenMindMap?: () => void;
  onOpenComparison?: () => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  summary,
  keyTakeaways,
  followUpQuestions,
  filteredResults,
  modelUsed,
  onFollowUpClick,
  query,
  onOpenMindMap,
  onOpenComparison
}) => {
  return (
    <div className="space-y-8">
      {/* Google Gemini AI Overview Card */}
      <GoogleAIOverview
        summary={summary}
        keyTakeaways={keyTakeaways}
        followUpQuestions={followUpQuestions}
        filteredResults={filteredResults}
        modelUsed={modelUsed}
        onFollowUpClick={onFollowUpClick}
        query={query}
        onOpenMindMap={onOpenMindMap}
        onOpenComparison={onOpenComparison}
      />

      {/* Google Organic Search Results List */}
      <GoogleOrganicResults
        results={filteredResults}
        query={query}
      />
    </div>
  );
};
