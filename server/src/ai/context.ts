import type { ChatMessage } from './prompt';

export const DEFAULT_INPUT_TOKEN_BUDGET = 24_000;
export const DEFAULT_RECENT_TURNS = 8;

export interface ContextOptions {
  inputTokenBudget?: number;
  recentTurns?: number;
}

// Model-independent, conservative estimate (not a provider tokenizer).
export function estimateTokens(message: ChatMessage): number {
  return Math.ceil(Buffer.byteLength(message.content, 'utf8') / 3) + 8;
}

/** Keep a contiguous suffix of user-led turns; mandatory context is never truncated. */
export function selectHistory(
  history: ChatMessage[],
  mandatory: ChatMessage[],
  options: ContextOptions = {},
): ChatMessage[] {
  const budget = options.inputTokenBudget ?? DEFAULT_INPUT_TOKEN_BUDGET;
  const maxTurns = Math.max(1, options.recentTurns ?? DEFAULT_RECENT_TURNS);
  const turns: ChatMessage[][] = [];
  for (const message of history) {
    if (message.role === 'user') turns.push([message]);
    else turns.at(-1)?.push(message);
  }
  const selected: ChatMessage[][] = [];
  let used = mandatory.reduce((sum, message) => sum + estimateTokens(message), 0);
  for (let i = turns.length - 1; i >= 0 && selected.length < maxTurns; i--) {
    const cost = turns[i].reduce((sum, message) => sum + estimateTokens(message), 0);
    // Always preserve the latest user turn, even when mandatory content exceeds budget.
    if (selected.length > 0 && used + cost > budget) break;
    selected.unshift(turns[i]);
    used += cost;
  }
  return selected.flat().map(({ role, content }) => ({ role, content }));
}
