/**
 * Removes content wrapped in specified tags from a string
 * @param content The content string to process
 * @param tag The tag name without angle brackets (e.g., 'think' for '<think></think>')
 * @returns The content with the specified tags and their contents removed, and trimmed
 */
export function removeContentTags<T extends string | null | undefined>(content: T, tag: string): T {
  if (!content || typeof content !== 'string') {
    return content;
  }
  
  // Dynamic implementation for other cases
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  
  // Parse the content and remove tags
  let result = '';
  let skipUntil: number | null = null;
  let depth = 0;
  
  for (let i = 0; i < content.length; i++) {
    // Check for opening tag
    if (content.substring(i, i + openTag.length) === openTag) {
      depth++;
      if (depth === 1) {
        skipUntil = content.indexOf(closeTag, i + openTag.length);
        i = i + openTag.length - 1; // Skip the opening tag
        continue;
      }
    }
    // Check for closing tag
    else if (content.substring(i, i + closeTag.length) === closeTag && depth > 0) {
      depth--;
      if (depth === 0) {
        i = i + closeTag.length - 1; // Skip the closing tag
        skipUntil = null;
        continue;
      }
    }
    
    // Only add character if not inside a tag
    if (skipUntil === null) {
      result += content[i];
    }
  }

  // Normalize multiple spaces/tabs into a single space (preserves newlines), then trim.
  result = result.replace(/[ \t]+/g, ' ').trim();

  return result as unknown as T;
}
