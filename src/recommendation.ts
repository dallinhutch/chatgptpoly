export function recommendationMetrics(probability: number, confidence: number, spent: number, shares: number) {
  if (![probability, confidence, spent, shares].every(Number.isFinite) || probability < 0 || probability > 1 || confidence < 0 || confidence > 1 || spent <= 0 || shares <= 0) return null;
  const returnIfWin = (shares - spent) / spent;
  const expectedReturn = (probability * shares - spent) / spent;
  if (probability < 0.8 || confidence < 0.8 || returnIfWin < 0.25 || expectedReturn < 0.10) return null;
  return { probability, confidence, recommendedAmount: spent, shares, returnIfWin, expectedReturn, profitIfWin: shares - spent, maxLoss: spent };
}
