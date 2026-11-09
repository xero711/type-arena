import { describe, expect, it } from 'vitest';
import { isAnyVariantComplete, isPromptComplete, matchedLength, matchingVariants } from './index';

describe('typing engine', () => {
  it('counts a matching romanized prefix without case sensitivity', () => {
    expect(matchedLength('kazewokirisake', 'Kaze')).toBe(4);
  });

  it('does not advance through an incorrect character', () => {
    expect(matchedLength('hoshinokanatahe', 'hosxi')).toBe(3);
  });

  it('only completes a prompt when all characters match', () => {
    expect(isPromptComplete('syouriwotsukame', 'syouriwotsukame')).toBe(true);
    expect(isPromptComplete('syouriwotsukame', 'syouriwotsukam')).toBe(false);
  });

  it('keeps alternate Hepburn and Kunrei spellings available while typing', () => {
    const candidates = ['shizukanamorinooku', 'sizukanamorinooku'];
    expect(matchingVariants(candidates, 'si')).toEqual(['sizukanamorinooku']);
    expect(isAnyVariantComplete(candidates, 'sizukanamorinooku')).toBe(true);
  });
});
