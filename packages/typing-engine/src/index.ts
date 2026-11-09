/** 入力位置を返す。大文字小文字は区別しない。 */
export function matchedLength(target: string, input: string): number {
  const normalizedTarget = target.toLowerCase();
  const normalizedInput = input.toLowerCase();
  let index = 0;
  while (index < normalizedInput.length && normalizedInput[index] === normalizedTarget[index]) index += 1;
  return index;
}

/** 入力途中で成立している候補だけを残す。 */
export function matchingVariants(variants: readonly string[], input: string): string[] {
  const normalized = input.toLowerCase();
  return variants.filter((variant) => variant.toLowerCase().startsWith(normalized));
}

export function isAnyVariantComplete(variants: readonly string[], input: string): boolean {
  const normalized = input.toLowerCase();
  return variants.some((variant) => variant.toLowerCase() === normalized);
}

export function isPromptComplete(target: string, input: string): boolean {
  return target.length === input.length && matchedLength(target, input) === target.length;
}
