import {
  AgentCandidate,
  IAssignmentStrategy,
  StrategySelectionResult,
} from './assignment-strategy.interface';

export interface RoundRobinState {
  lastAssignedEmployeeId?: string;
  assignmentCount?: number;
}

export class RoundRobinStrategy implements IAssignmentStrategy {
  public readonly strategyName = 'round_robin';

  public selectNext(
    candidates: AgentCandidate[],
    rawState?: Record<string, unknown>,
  ): StrategySelectionResult {
    const eligible = candidates.filter((c) => c.weight > 0);
    if (eligible.length === 0) {
      throw new Error('RoundRobinStrategy requires at least one eligible candidate');
    }

    // Deterministic ordering by employeeId
    eligible.sort((a, b) => a.employeeId.localeCompare(b.employeeId));

    const weightsSnapshot: Record<string, number> = {};
    for (const c of eligible) {
      weightsSnapshot[c.employeeId] = c.weight;
    }

    const lastId = rawState?.lastAssignedEmployeeId as string | undefined;
    let nextIndex = 0;

    if (lastId) {
      const lastIndex = eligible.findIndex((c) => c.employeeId === lastId);
      if (lastIndex >= 0) {
        nextIndex = (lastIndex + 1) % eligible.length;
      }
    }

    const selected = eligible[nextIndex] ?? eligible[0]!;
    const previousCount =
      typeof rawState?.assignmentCount === 'number' ? (rawState.assignmentCount as number) : 0;

    const newState: RoundRobinState = {
      lastAssignedEmployeeId: selected.employeeId,
      assignmentCount: previousCount + 1,
    };

    return {
      selectedEmployeeId: selected.employeeId,
      newState: newState as unknown as Record<string, unknown>,
      weightsSnapshot,
    };
  }
}

export const roundRobinStrategy = new RoundRobinStrategy();
