import { removeContentTags } from '../../src/utils/removeContentTags';

describe('removeContentTags', () => {
  it('should remove content wrapped in specified tags', () => {
    const content = 'This is <think>something to hide</think> visible content';
    const result = removeContentTags(content, 'think');
    expect(result).toBe('This is visible content');
  });

  it('should handle multiple tag occurrences', () => {
    const content = '<think>hidden</think> visible <think>also hidden</think> text';
    const result = removeContentTags(content, 'think');
    expect(result).toBe('visible text');
  });

  it('should handle multiline content within tags', () => {
    const content = 'Start <think>hidden\nover multiple\nlines</think> End';
    const result = removeContentTags(content, 'think');
    expect(result).toBe('Start End');
  });

  it('should return content as is when tag is not found', () => {
    const content = 'Content without any tags';
    const result = removeContentTags(content, 'think');
    expect(result).toBe('Content without any tags');
  });

  it('should work with different tag names', () => {
    const content = 'This is <custom>something to hide</custom> visible content';
    const result = removeContentTags(content, 'custom');
    expect(result).toBe('This is visible content');
  });

  it('should handle null content', () => {
    const content = null;
    const result = removeContentTags(content, 'think');
    expect(result).toBe(null);
  });

  it('should handle undefined content', () => {
    const content = undefined;
    const result = removeContentTags(content, 'think');
    expect(result).toBe(undefined);
  });

  it('should trim the result', () => {
    const content = '  <think>hidden</think> visible  ';
    const result = removeContentTags(content, 'think');
    expect(result).toBe('visible');
  });

  it('should handle nested tags correctly', () => {
    const content = 'Outside <think>Inside <think>Nested</think></think> End';
    const result = removeContentTags(content, 'think');
    expect(result).toBe('Outside End');
  });
});
