/**
 * Consensus Voting System — uses Borda count ranked voting to resolve
 * conflicts when multiple collaboration modules propose different values
 * for the same motion parameter. This produces fairer, more principled
 * resolutions than simple confidence-weighted averaging.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsensusBallot {
  /** The voter (module ID). */
  voter: string;
  /** The choice being voted for. */
  choice: string;
  /** Confidence weight of this voter (0..1). */
  weight: number;
}

export interface ConsensusResult {
  /** The winning choice. */
  winner: string;
  /** Total Borda score for the winner. */
  score: number;
  /** Consensus strength (0..1) — how decisive the win was. */
  consensusStrength: number;
  /** Full ranking from best to worst. */
  ranking: Array<{ choice: string; score: number; voters: string[] }>;
}

// ---------------------------------------------------------------------------
// Borda Count Implementation
// ---------------------------------------------------------------------------

/**
 * Run a Borda count election on a set of ballots.
 *
 * Each ballot contributes points based on its weight and the number of
 * alternatives it beats. The choice with the highest total score wins.
 *
 * For N choices, the top-ranked choice gets N-1 points, second gets N-2,
 * etc. When a voter only casts one ballot (single choice), that choice
 * receives N-1 points (as if it were their top rank).
 */
export function consensusVote(ballots: ConsensusBallot[]): ConsensusResult | null {
  if (ballots.length === 0) return null;

  // Collect all unique choices
  const choiceSet = new Set(ballots.map((b) => b.choice));
  const choices = [...choiceSet];

  if (choices.length === 1) {
    return {
      winner: choices[0],
      score: ballots.reduce((sum, b) => sum + b.weight, 0),
      consensusStrength: 1.0,
      ranking: [{
        choice: choices[0],
        score: ballots.reduce((sum, b) => sum + b.weight, 0),
        voters: ballots.map((b) => b.voter),
      }],
    };
  }

  const n = choices.length;

  // Build per-voter rankings. Each voter may only have one choice, so
  // we treat their ballot as ranking that choice first and all others
  // below it in alphabetical order (deterministic tie-breaking).
  const votersByChoice = new Map<string, ConsensusBallot[]>();
  for (const b of ballots) {
    const arr = votersByChoice.get(b.choice) ?? [];
    arr.push(b);
    votersByChoice.set(b.choice, arr);
  }

  // Calculate Borda scores: each voter gives (n-1) points to their top
  // choice, (n-2) to the next, etc. Weighted by voter confidence.
  const scores = new Map<string, number>();
  for (const choice of choices) scores.set(choice, 0);

  for (const ballot of ballots) {
    // The voter's own choice gets top rank (n-1 points)
    scores.set(ballot.choice, scores.get(ballot.choice)! + (n - 1) * ballot.weight);

    // All other choices get progressively fewer points, distributed
    // equally among them (since the voter didn't rank them)
    const remaining = choices.filter((c) => c !== ballot.choice);
    const pointsPerRemaining = (n - 2) / Math.max(1, remaining.length);
    for (const c of remaining) {
      scores.set(c, scores.get(c)! + pointsPerRemaining * ballot.weight);
    }
  }

  // Build ranking
  const ranking = choices
    .map((choice) => ({
      choice,
      score: scores.get(choice)!,
      voters: (votersByChoice.get(choice) ?? []).map((b) => b.voter),
    }))
    .sort((a, b) => b.score - a.score);

  const winner = ranking[0];
  const totalScore = ranking.reduce((sum, r) => sum + r.score, 0);
  const consensusStrength = totalScore > 0 ? winner.score / totalScore : 0;

  return {
    winner: winner.choice,
    score: winner.score,
    consensusStrength,
    ranking,
  };
}

/**
 * Resolve a numeric conflict by finding the value closest to the
 * confidence-weighted median, which is more robust to outliers than
 * the mean used by the default merger.
 */
export function resolveNumericConsensus(
  values: Array<{ value: number; weight: number; voter: string }>,
): { winner: number; consensusStrength: number; reasoning: string } {
  if (values.length === 0) {
    return { winner: 0, consensusStrength: 0, reasoning: "no values" };
  }
  if (values.length === 1) {
    return {
      winner: values[0].value,
      consensusStrength: 1.0,
      reasoning: `unanimous (${values[0].voter})`,
    };
  }

  // Sort by value
  const sorted = [...values].sort((a, b) => a.value - b.value);

  // Compute weighted median
  const totalWeight = sorted.reduce((sum, v) => sum + v.weight, 0);
  let cumulative = 0;
  let median = sorted[0].value;
  for (const v of sorted) {
    cumulative += v.weight;
    if (cumulative >= totalWeight / 2) {
      median = v.value;
      break;
    }
  }

  // Consensus strength: how close are the values to each other?
  const mean = values.reduce((sum, v) => sum + v.value * v.weight, 0) / totalWeight;
  const variance = values.reduce((sum, v) => sum + Math.pow(v.value - mean, 2) * v.weight, 0) / totalWeight;
  const stdDev = Math.sqrt(variance);
  const cv = mean !== 0 ? stdDev / Math.abs(mean) : 1; // coefficient of variation
  const consensusStrength = Math.max(0, 1 - cv);

  const reasoning = `weighted median ${median} (mean ${Math.round(mean)}, stdDev ${stdDev.toFixed(1)}, CV ${cv.toFixed(2)})`;

  return { winner: median, consensusStrength, reasoning };
}
