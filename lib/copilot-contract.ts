export const REFUSAL_MESSAGE =
  "I don't have enough data to answer that from your transactions.";

export type CopilotCitation = {
  id: string;
  date: string;
  merchant_name: string | null;
  amount: string;
  category: string | null;
};

export type CopilotAnswer = {
  answer: string;
  citations: CopilotCitation[];
  usedFallback: boolean;
};
