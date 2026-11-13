import { describe, expect, it } from 'vitest';
import { canConfirm, nextRequirementStatus, type RequirementEvent } from './state-machine';
import { REQUIREMENT_STATUSES, type RequirementStatus } from './types';

const EVENTS: RequirementEvent[] = ['user_message', 'ai_sufficient', 'ai_insufficient', 'user_confirm', 'doc_edit'];

// 设计文档 6.1 完整转换表的期望矩阵（手工推导，作为测试基准）。
const TABLE: Record<RequirementStatus, Record<RequirementEvent, RequirementStatus>> = {
  pending: {
    user_message: 'polishing',
    ai_sufficient: 'pending',
    ai_insufficient: 'pending',
    user_confirm: 'pending',
    doc_edit: 'pending',
  },
  polishing: {
    user_message: 'polishing',
    ai_sufficient: 'ai_ready',
    ai_insufficient: 'polishing',
    user_confirm: 'polishing',
    doc_edit: 'polishing',
  },
  ai_ready: {
    user_message: 'polishing',
    ai_sufficient: 'ai_ready',
    ai_insufficient: 'ai_ready',
    user_confirm: 'confirmed',
    doc_edit: 'ai_ready',
  },
  confirmed: {
    user_message: 'polishing',
    ai_sufficient: 'confirmed',
    ai_insufficient: 'confirmed',
    user_confirm: 'confirmed',
    doc_edit: 'reconfirm',
  },
  reconfirm: {
    user_message: 'polishing',
    ai_sufficient: 'reconfirm',
    ai_insufficient: 'reconfirm',
    user_confirm: 'confirmed',
    doc_edit: 'reconfirm',
  },
};

describe('nextRequirementStatus 完整转换表', () => {
  for (const status of REQUIREMENT_STATUSES) {
    for (const event of EVENTS) {
      it(`${status} + ${event} → ${TABLE[status][event]}`, () => {
        expect(nextRequirementStatus(status, event)).toBe(TABLE[status][event]);
      });
    }
  }
});

describe('不变量 1：confirmed 只能由 user_confirm 到达', () => {
  it('任何非 user_confirm 事件都不能从非 confirmed 状态进入 confirmed', () => {
    for (const status of REQUIREMENT_STATUSES) {
      if (status === 'confirmed') continue;
      for (const event of EVENTS) {
        if (event === 'user_confirm') continue;
        expect(nextRequirementStatus(status, event)).not.toBe('confirmed');
      }
    }
  });

  it('user_confirm 仅能从 ai_ready / reconfirm 到达 confirmed', () => {
    expect(nextRequirementStatus('ai_ready', 'user_confirm')).toBe('confirmed');
    expect(nextRequirementStatus('reconfirm', 'user_confirm')).toBe('confirmed');
    expect(nextRequirementStatus('pending', 'user_confirm')).toBe('pending');
    expect(nextRequirementStatus('polishing', 'user_confirm')).toBe('polishing');
  });
});

describe('不变量 2：AI 输出绝不直接到 confirmed，且只允许 polishing→ai_ready 或保持', () => {
  it('ai_sufficient / ai_insufficient 不能把非 confirmed 状态变为 confirmed', () => {
    for (const status of REQUIREMENT_STATUSES) {
      if (status === 'confirmed') continue;
      expect(nextRequirementStatus(status, 'ai_sufficient')).not.toBe('confirmed');
      expect(nextRequirementStatus(status, 'ai_insufficient')).not.toBe('confirmed');
    }
  });

  it('ai_sufficient 仅在 polishing 时转为 ai_ready，其余保持不变', () => {
    for (const status of REQUIREMENT_STATUSES) {
      const expected = status === 'polishing' ? 'ai_ready' : status;
      expect(nextRequirementStatus(status, 'ai_sufficient')).toBe(expected);
    }
  });

  it('ai_insufficient 总是保持不变', () => {
    for (const status of REQUIREMENT_STATUSES) {
      expect(nextRequirementStatus(status, 'ai_insufficient')).toBe(status);
    }
  });
});

describe('canConfirm 门控', () => {
  it('仅 ai_ready / reconfirm 可确认', () => {
    for (const status of REQUIREMENT_STATUSES) {
      expect(canConfirm(status)).toBe(status === 'ai_ready' || status === 'reconfirm');
    }
  });
});