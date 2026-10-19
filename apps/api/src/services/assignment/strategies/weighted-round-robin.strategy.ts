import {
  AgentCandidate,
  IAssignmentStrategy,
  StrategySelectionResult,
} from './assignment-strategy.interface';

export interface WeightedRoundRobinState {
  currentWeights: Record<string, number>;
  lastAssignedEmployeeId?: string;
  assignmentCount?: number;
}

export class WeightedRoundRobinStrategy implements IAssignmentStrategy {
  public readonly strategyName = 'weighted_round_robin';

  public selectNext(
    candidates: AgentCandidate[],
    rawState?: Record<string, unknown>,
  ): StrategySelectionResult {
    // 1. Filter out non-positive weights
    const eligible = candidates.filter((c) => c.weight > 0);
    if (eligible.length === 0) {
      throw new Error('WeightedRoundRobinStrategy requires at least one eligible candidate with weight > 0');
    }

    // Sort deterministically by employeeId to guarantee consistent tie-breaking
    eligible.sort((a, b) => a.employeeId.localeCompare(b.employeeId));

    // 2. Snapshot current weights
    const weightsSnapshot: Record<string, number> = {};
    for (const c of eligible) {
      weightsSnapshot[c.employeeId] = c.weight;
    }

    // 3. Reconcile persisted state
    const reconciledCurrentWeights = this.reconcileState(eligible, rawState);

    // 4. Smooth Weighted Round-Robin (SWRR) execution
    // Step A: currentWeight += effectiveWeight for all candidates
    const totalWeight = eligible.reduce((sum, c) => sum + c.weight, 0);

    for (const candidate of eligible) {
      reconciledCurrentWeights[candidate.employeeId] =
        (reconciledCurrentWeights[candidate.employeeId] ?? 0) + candidate.weight;
    }

    // Step B: Find candidate with highest currentWeight
    let bestCandidate: AgentCandidate = eligible[0]!;
    let maxWeight = reconciledCurrentWeights[bestCandidate.employeeId] ?? -Infinity;

    for (let i = 1; i < eligible.length; i++) {
      const candidate = eligible[i];
      if (!candidate) continue;
      const weight = reconciledCurrentWeights[candidate.employeeId] ?? -Infinity;
      if (weight > maxWeight) {
        maxWeight = weight;
        bestCandidate = candidate;
      } else if (weight === maxWeight) {
        // Deterministic tie-breaker: alphabetical comparison on employeeId
        if (candidate.employeeId.localeCompare(bestCandidate.employeeId) < 0) {
          bestCandidate = candidate;
        }
      }
    }

    // Step C: Subtract totalWeight from selected candidate
    reconciledCurrentWeights[bestCandidate.employeeId] =
      (reconciledCurrentWeights[bestCandidate.employeeId] ?? 0) - totalWeight;

    const previousCount =
      typeof rawState?.assignmentCount === 'number' ? (rawState.assignmentCount as number) : 0;

    const newState: WeightedRoundRobinState = {
      currentWeights: reconciledCurrentWeights,
      lastAssignedEmployeeId: bestCandidate.employeeId,
      assignmentCount: previousCount + 1,
    };

    return {
      selectedEmployeeId: bestCandidate.employeeId,
      newState: newState as unknown as Record<string, unknown>,
      weightsSnapshot,
    };
  }

  /**
   * Reconciles persisted state against current eligible agents.
   * - Retains currentWeight for agents that remain eligible.
   * - Initializes currentWeight = 0 for newly added agents.
   * - Prunes removed or now-ineligible agents.
   */
  private reconcileState(
    eligible: AgentCandidate[],
    rawState?: Record<string, unknown>,
  ): Record<string, number> {
    const rawWeights = (rawState?.currentWeights || {}) as Record<string, unknown>;
    const result: Record<string, number> = {};

    for (const candidate of eligible) {
      const existing = rawWeights[candidate.employeeId];
      if (typeof existing === 'number' && !isNaN(existing)) {
        result[candidate.employeeId] = existing;
      } else {
        // Newly eligible agent starts at 0
        result[candidate.employeeId] = 0;
      }
    }

    return result;
  }
}

export const weightedRoundRobinStrategy = new WeightedRoundRobinStrategy();
