// Constants and constraint rules for violin fingering

export const PENALTY = {
  LOW: 1,
  MEDIUM: 50,
  HIGH: 1000,
  NEVER: 100000,
  MAX: Infinity
};

export const OPEN_STRING_PITCHES = [76, 69, 62, 55]; // E5, A4, D4, G3

export const POSITION_COUNT = 32;
export const STRING_COUNT = 4;
export const FINGER_COUNT = 5;
export const UPPER_BOUT_CUTOFF = 8;

// Hand stretch distances
export const MIN_DISTANCE_TO_UPPER_FINGER = [6, 5, 3, 1, 0];
export const MAX_DISTANCE_TO_UPPER_FINGER = [32, 5, 4, 2, 0];
export const MIN_DISTANCE_TO_LOWER_FINGER = [1, 0, -2, -4, -5];
export const MAX_DISTANCE_TO_LOWER_FINGER = [32, 0, -1, -3, -5];

// Training configuration
export const DEFAULT_CONFIG = {
  nEpisodes: 10000,
  learningRate: 0.99,
  discountFactor: 0.98,  // Higher for violin (stronger sequence dependency)
  explorationRate: 0.8,
  planningSteps: 10,
  priorityThreshold: 3.0,
  evaluationInterval: 300,
  convergenceThreshold: 0.01,
  convergenceWindow: 3
};

// Comfortable finger change ranges
export function getMaxComfortableFingerChange(startFinger: number, endFinger: number): number {
  // Special case: starting from open string
  if (startFinger === 0) return POSITION_COUNT;
  
  // Special case: ending on open string
  if (endFinger === 0) return 0;
  
  const diff = endFinger - startFinger;
  const changes: { [key: number]: number } = {
    '-3': -5, '-2': -3, '-1': -1,
    '0': 0, '1': 2, '2': 4, '3': 5
  };
  
  return changes[diff] ?? -POSITION_COUNT;
}

export function getMinComfortableFingerChange(startFinger: number, endFinger: number): number {
  return -getMaxComfortableFingerChange(endFinger, startFinger);
}

// Raw position score calculation
export function calculateRawPositionScore(position: number, string: number, finger: number): number {
  // Open string
  if (position === 0) {
    if (finger !== 0) return PENALTY.NEVER;
    return PENALTY.MEDIUM;
  }
  
  // Non-open position with finger 0
  if (finger === 0) return PENALTY.NEVER;
  
  // Calculate finger positions
  const maxHighFingerPosition = position + MAX_DISTANCE_TO_UPPER_FINGER[finger];
  const minHighFingerPosition = position + MIN_DISTANCE_TO_UPPER_FINGER[finger];
  const maxLowFingerPosition = position + MAX_DISTANCE_TO_LOWER_FINGER[finger];
  const minLowFingerPosition = position + MIN_DISTANCE_TO_LOWER_FINGER[finger];
  
  // Position too low
  if (maxHighFingerPosition < 6 || maxLowFingerPosition <= 0) {
    return PENALTY.MEDIUM;
  }
  
  // Position too high
  if (minHighFingerPosition > UPPER_BOUT_CUTOFF) {
    if (minLowFingerPosition >= UPPER_BOUT_CUTOFF) {
      // Whole hand over upper bout
      return 2 * PENALTY.MEDIUM + (minLowFingerPosition - UPPER_BOUT_CUTOFF);
    } else {
      // Hand partially over upper bout
      return (3 * PENALTY.MEDIUM) / 2 + (minHighFingerPosition - UPPER_BOUT_CUTOFF);
    }
  }
  
  return 0;
}

// String cross penalty
export function calculateStringCrossPenalty(stringDiff: number): number {
  const absDiff = Math.abs(stringDiff);
  return absDiff > 0 ? 2 * PENALTY.LOW * absDiff : 0;
}

// Finger change penalty
export function calculateFingerChangePenalty(
  startPos: number,
  endPos: number,
  startFinger: number,
  endFinger: number
): number {
  const maxComfortableChange = getMaxComfortableFingerChange(startFinger, endFinger);
  const minComfortableChange = getMinComfortableFingerChange(startFinger, endFinger);
  const actualChange = endPos - startPos;
  
  if (actualChange < minComfortableChange) {
    return calculateShiftPenalty(actualChange - minComfortableChange);
  }
  if (actualChange > maxComfortableChange) {
    return calculateShiftPenalty(actualChange - maxComfortableChange);
  }
  return 0;
}

// Shift penalty
export function calculateShiftPenalty(shiftAmount: number): number {
  const absShift = Math.abs(shiftAmount);
  return PENALTY.MEDIUM + PENALTY.LOW * absShift;
}

// Calculate total penalty for a transition
export function calculateTotalPenalty(
  prevState: { position: number; finger: number; string: number },
  action: { position: number; finger: number; string: number }
): number {
  let penalty = 0;
  
  // Raw position penalty
  penalty += calculateRawPositionScore(action.position, action.string, action.finger);
  
  // String cross penalty
  penalty += calculateStringCrossPenalty(action.string - prevState.string);
  
  // Finger change penalty
  penalty += calculateFingerChangePenalty(
    prevState.position,
    action.position,
    prevState.finger,
    action.finger
  );
  
  return penalty;
}
