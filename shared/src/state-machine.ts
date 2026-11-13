import type { RequirementStatus } from './types';

export type RequirementEvent =
  | 'user_message'
  | 'ai_sufficient'
  | 'ai_insufficient'
  | 'user_confirm'
  | 'doc_edit';

export function nextRequirementStatus(current: RequirementStatus, event: RequirementEvent): RequirementStatus {
  switch (event) {
    case 'user_message':
      return 'polishing';
    case 'ai_sufficient':
      return current === 'polishing' ? 'ai_ready' : current;
    case 'ai_insufficient':
      return current;
    case 'user_confirm':
      return current === 'ai_ready' || current === 'reconfirm' ? 'confirmed' : current;
    case 'doc_edit':
      return current === 'confirmed' ? 'reconfirm' : current;
  }
}

export function canConfirm(current: RequirementStatus): boolean {
  return current === 'ai_ready' || current === 'reconfirm';
}