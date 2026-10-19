import { describe, it, expect } from 'vitest';
import {
  WeightedRoundRobinStrategy,
  weightedRoundRobinStrategy,
} from '../../apps/api/src/services/assignment/strategies/weighted-round-robin.strategy';
import { roundRobinStrategy } from '../../apps/api/src/services/assignment/strategies/round-robin.strategy';
import { AgentCandidate } from '../../apps/api/src/services/assignment/strategies/assignment-strategy.interface';

describe('Weighted Round-Robin Algorithm Unit Tests', () => {
  const strategy = new WeightedRoundRobinStrategy();

  // 1. Two agents with equal weights
  it('1. distributes evenly between two agents with equal weights (1:1)', () => {
    const candidates: AgentCandidate[] = [
      { employeeId: 'agent-A', weight: 1 },
      { employeeId: 'agent-B', weight: 1 },
    ];

    let state: Record<string, unknown> | undefined = undefined;
    const history: string[] = [];

    for (let i = 0; i < 10; i++) {
      const result = strategy.selectNext(candidates, state);
      history.push(result.selectedEmployeeId);
      state = result.newState;
    }

    const countA = history.filter((id) => id === 'agent-A').length;
    const countB = history.filter((id) => id === 'agent-B').length;

    expect(countA).toBe(5);
    expect(countB).toBe(5);
    // Smooth alternation
    expect(history.slice(0, 4)).toEqual(['agent-A', 'agent-B', 'agent-A', 'agent-B']);
  });

  // 2. Two agents with weights 1 and 3
  it('2. distributes 25% : 75% for weights 1 and 3', () => {
    const candidates: AgentCandidate[] = [
      { employeeId: 'agent-A', weight: 1 },
      { employeeId: 'agent-B', weight: 3 },
    ];

    let state: Record<string, unknown> | undefined = undefined;
    const history: string[] = [];

    // Cycle length is 1 + 3 = 4
    for (let i = 0; i < 40; i++) {
      const result = strategy.selectNext(candidates, state);
      history.push(result.selectedEmployeeId);
      state = result.newState;
    }

    const countA = history.filter((id) => id === 'agent-A').length;
    const countB = history.filter((id) => id === 'agent-B').length;

    expect(countA).toBe(10); // 25% of 40
    expect(countB).toBe(30); // 75% of 40
  });

  // 3. Three agents with weights 1, 2, and 1
  it('3. distributes 25% : 50% : 25% for weights 1, 2, and 1', () => {
    const candidates: AgentCandidate[] = [
      { employeeId: 'agent-A', weight: 1 },
      { employeeId: 'agent-B', weight: 2 },
      { employeeId: 'agent-C', weight: 1 },
    ];

    let state: Record<string, unknown> | undefined = undefined;
    const history: string[] = [];

    // One complete cycle of 4
    for (let i = 0; i < 4; i++) {
      const result = strategy.selectNext(candidates, state);
      history.push(result.selectedEmployeeId);
      state = result.newState;
    }

    const countA = history.filter((id) => id === 'agent-A').length;
    const countB = history.filter((id) => id === 'agent-B').length;
    const countC = history.filter((id) => id === 'agent-C').length;

    expect(countA).toBe(1);
    expect(countB).toBe(2);
    expect(countC).toBe(1);

    // Over 100 assignments
    for (let i = 4; i < 100; i++) {
      const result = strategy.selectNext(candidates, state);
      history.push(result.selectedEmployeeId);
      state = result.newState;
    }

    expect(history.filter((id) => id === 'agent-A').length).toBe(25);
    expect(history.filter((id) => id === 'agent-B').length).toBe(50);
    expect(history.filter((id) => id === 'agent-C').length).toBe(25);
  });

  // 4. One eligible agent
  it('4. always selects the single eligible agent deterministically', () => {
    const candidates: AgentCandidate[] = [{ employeeId: 'solo-agent', weight: 5 }];

    let state: Record<string, unknown> | undefined = undefined;
    for (let i = 0; i < 5; i++) {
      const result = strategy.selectNext(candidates, state);
      expect(result.selectedEmployeeId).toBe('solo-agent');
      state = result.newState;
    }
  });

  // 5. An agent with zero weight
  it('5. strictly excludes agents with zero weight from receiving assignments', () => {
    const candidates: AgentCandidate[] = [
      { employeeId: 'agent-active', weight: 2 },
      { employeeId: 'agent-zero', weight: 0 },
    ];

    let state: Record<string, unknown> | undefined = undefined;
    for (let i = 0; i < 10; i++) {
      const result = strategy.selectNext(candidates, state);
      expect(result.selectedEmployeeId).toBe('agent-active');
      state = result.newState;
    }
  });

  // 6. No eligible agents
  it('6. throws when there are no eligible agents or all have weight 0', () => {
    expect(() => strategy.selectNext([])).toThrow(
      /requires at least one eligible candidate with weight > 0/,
    );

    expect(() =>
      strategy.selectNext([
        { employeeId: 'z1', weight: 0 },
        { employeeId: 'z2', weight: 0 },
      ]),
    ).toThrow(/requires at least one eligible candidate with weight > 0/);
  });

  // 7. An agent becoming inactive / ineligible
  it('7. cleanly reconciles state when an agent becomes inactive', () => {
    let candidates: AgentCandidate[] = [
      { employeeId: 'agent-A', weight: 1 },
      { employeeId: 'agent-B', weight: 2 },
      { employeeId: 'agent-C', weight: 1 },
    ];

    let state: Record<string, unknown> | undefined = undefined;
    // Run 2 assignments
    let res = strategy.selectNext(candidates, state);
    state = res.newState;
    res = strategy.selectNext(candidates, state);
    state = res.newState;

    // Agent B becomes inactive, leaving A and C
    candidates = [
      { employeeId: 'agent-A', weight: 1 },
      { employeeId: 'agent-C', weight: 1 },
    ];

    const subsequentHistory: string[] = [];
    for (let i = 0; i < 20; i++) {
      const result = strategy.selectNext(candidates, state);
      subsequentHistory.push(result.selectedEmployeeId);
      state = result.newState;
    }

    // Agent B must never be selected
    expect(subsequentHistory).not.toContain('agent-B');
    // A and C distribute equally in steady state (difference <= 2 due to carry-over)
    const countA = subsequentHistory.filter((id) => id === 'agent-A').length;
    const countC = subsequentHistory.filter((id) => id === 'agent-C').length;
    expect(Math.abs(countA - countC)).toBeLessThanOrEqual(2);
    expect(countA + countC).toBe(20);
  });

  // 8. An agent being added after assignments have started
  it('8. integrates a newly added agent without corrupting state', () => {
    let candidates: AgentCandidate[] = [
      { employeeId: 'agent-A', weight: 1 },
      { employeeId: 'agent-B', weight: 1 },
    ];

    let state: Record<string, unknown> | undefined = undefined;
    for (let i = 0; i < 4; i++) {
      const res = strategy.selectNext(candidates, state);
      state = res.newState;
    }

    // Add Agent C with weight 2
    candidates = [
      { employeeId: 'agent-A', weight: 1 },
      { employeeId: 'agent-B', weight: 1 },
      { employeeId: 'agent-C', weight: 2 },
    ];

    const history: string[] = [];
    for (let i = 0; i < 40; i++) {
      const res = strategy.selectNext(candidates, state);
      history.push(res.selectedEmployeeId);
      state = res.newState;
    }

    const countA = history.filter((id) => id === 'agent-A').length;
    const countB = history.filter((id) => id === 'agent-B').length;
    const countC = history.filter((id) => id === 'agent-C').length;

    // Expected: 1:1:2 -> 10, 10, 20
    expect(countA).toBe(10);
    expect(countB).toBe(10);
    expect(countC).toBe(20);
  });

  // 9. Agent weight changes
  it('9. adapts smoothly when agent weights change mid-stream', () => {
    let candidates: AgentCandidate[] = [
      { employeeId: 'agent-A', weight: 1 },
      { employeeId: 'agent-B', weight: 1 },
    ];

    let state: Record<string, unknown> | undefined = undefined;
    for (let i = 0; i < 4; i++) {
      const res = strategy.selectNext(candidates, state);
      state = res.newState;
    }

    // Weight of Agent B increases to 3 (A:1, B:3)
    candidates = [
      { employeeId: 'agent-A', weight: 1 },
      { employeeId: 'agent-B', weight: 3 },
    ];

    const history: string[] = [];
    for (let i = 0; i < 40; i++) {
      const res = strategy.selectNext(candidates, state);
      history.push(res.selectedEmployeeId);
      state = res.newState;
    }

    expect(history.filter((id) => id === 'agent-A').length).toBe(10);
    expect(history.filter((id) => id === 'agent-B').length).toBe(30);
  });

  // 10. Deterministic assignment sequences
  it('10. produces 100% identical assignment sequences given the same inputs', () => {
    const candidates: AgentCandidate[] = [
      { employeeId: 'agent-X', weight: 3 },
      { employeeId: 'agent-Y', weight: 1 },
      { employeeId: 'agent-Z', weight: 2 },
    ];

    const runSequence = () => {
      let state: Record<string, unknown> | undefined = undefined;
      const history: string[] = [];
      for (let i = 0; i < 18; i++) {
        const res = weightedRoundRobinStrategy.selectNext(candidates, state);
        history.push(res.selectedEmployeeId);
        state = res.newState;
      }
      return history;
    };

    const run1 = runSequence();
    const run2 = runSequence();
    expect(run1).toEqual(run2);
  });

  // Standard Round-Robin Strategy tests
  describe('RoundRobinStrategy Tests', () => {
    it('rotates cyclically through eligible agents with equal distribution', () => {
      const candidates: AgentCandidate[] = [
        { employeeId: 'agent-1', weight: 10 },
        { employeeId: 'agent-2', weight: 20 },
      ];

      let state: Record<string, unknown> | undefined = undefined;
      const history: string[] = [];
      for (let i = 0; i < 6; i++) {
        const res = roundRobinStrategy.selectNext(candidates, state);
        history.push(res.selectedEmployeeId);
        state = res.newState;
      }

      expect(history).toEqual([
        'agent-1',
        'agent-2',
        'agent-1',
        'agent-2',
        'agent-1',
        'agent-2',
      ]);
    });
  });
});
