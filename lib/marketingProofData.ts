/**
 * Centralized Marketing Proof Figures and Metrics.
 *
 * Ground rule 6: "Every proof figure on this page is a placeholder...
 * They are props in a group labelled 'Proof figures (must be real)'
 * so they can be corrected or emptied in one place."
 *
 * Update these with verified production figures or empty strings ("")
 * to gracefully suppress the badge/proof element.
 */

export interface MarketingProofFigures {
  chromeRating: string;
  installCount: string;
  userCount: string;
  avgAutofillTime: string;
  factsTraced: string;
  heroMatchScore: number;
  oneTimeUnlockPrice: string;
  proMonthlyPrice: string;
  freeApplicationsCount: number;
}

export const PROOF_FIGURES: MarketingProofFigures = {
  chromeRating: "4.8",
  installCount: "1,200+",
  userCount: "3,400+",
  avgAutofillTime: "1.4s",
  factsTraced: "0 invented facts, 31 of 31 traced",
  heroMatchScore: 78,
  oneTimeUnlockPrice: "$2.99",
  proMonthlyPrice: "$19",
  freeApplicationsCount: 2,
};
