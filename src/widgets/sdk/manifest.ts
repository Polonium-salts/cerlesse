export interface WidgetManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: number;
  description: string;
  category:
    | "synthesis"
    | "analysis"
    | "action"
    | "portal"
    | "data"
    | "media"
    | "developer"
    | "location";
  tags: string[];
  capabilities: string[];
  intents: string[];
  keywords: string[];
  examples: string[];
  negativeIntents?: string[];
  requiredData?: string[];
  dataRequirements?: string[];
  layout: {
    defaultWidth: 25 | 50 | 75 | 100;
    minWidth: 25 | 50 | 75 | 100;
    maxWidth: 25 | 50 | 75 | 100;
    preferredHeight?: number;
  };
  agent?: {
    selectable: boolean;
    minConfidence?: number;
    priority?: number;
    flexible?: boolean;
  };
  permissions?: {
    network?: boolean;
    storage?: boolean;
    clipboard?: boolean;
    location?: boolean;
    externalNavigation?: boolean;
  };
  performance?: {
    lazy?: boolean;
    maxLoadMs?: number;
    maxDataMs?: number;
  };
}
