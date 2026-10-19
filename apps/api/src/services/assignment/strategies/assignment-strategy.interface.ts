export interface AgentCandidate {
  employeeId: string;
  weight: number;
}

export interface StrategySelectionResult {
  selectedEmployeeId: string;
  newState: Record<string, unknown>;
  weightsSnapshot: Record<string, number>;
}

export interface IAssignmentStrategy {
  readonly strategyName: string;

  /**
   * Selects the next agent deterministically based on candidate weights and stored state.
   */
  selectNext(
    candidates: AgentCandidate[],
    currentState?: Record<string, unknown>,
  ): StrategySelectionResult;
}
