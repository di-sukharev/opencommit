export function parseCustomHeaders(headers: any): Record<string, string> {
  let parsedHeaders = {};

  if (!headers) {
    return parsedHeaders;
  }

  try {
    if (typeof headers === 'object' && !Array.isArray(headers)) {
      parsedHeaders = headers;
    } else {
      parsedHeaders = JSON.parse(headers);
    }
  } catch {
    console.warn(
      'Invalid OCO_API_CUSTOM_HEADERS format, ignoring custom headers'
    );
  }

  return parsedHeaders;
}
