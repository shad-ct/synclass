export interface PollSummary {
  id: string;
  question: string;
  options: string[];
  isActive: boolean;
  createdAt: string;
  closedAt?: string | null;
  responseCount: number;
  optionCounts: number[];
  hasResponded?: boolean;
  selectedOption?: number | null;
}
