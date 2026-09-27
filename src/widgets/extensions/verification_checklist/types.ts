export interface ChecklistItem {
  id: string;
  title: string;
  detail: string;
  checked?: boolean;
}

export interface VerificationChecklistData {
  title?: string;
  description?: string;
  items: ChecklistItem[];
}
