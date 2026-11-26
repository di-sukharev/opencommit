// A tracker key in a branch name, e.g. "foo-1234" in "feat/foo-1234-button"
const TICKET_IN_BRANCH =
  /(?<![A-Za-z0-9])[A-Za-z][A-Za-z0-9]*-\d+(?![A-Za-z0-9])/;

// Conventional Commits puts issue references in a footer. A one-line message
// has no footer, so the ticket goes at the end of the subject instead.
export const addTicketReference = (
  message: string,
  branch: string,
  { oneLine = false }: { oneLine?: boolean } = {}
): string => {
  const ticket = branch.match(TICKET_IN_BRANCH)?.[0].toUpperCase();
  if (!ticket) return message;

  const ticketInMessage = new RegExp(
    `(?<![A-Za-z0-9])${ticket}(?![A-Za-z0-9])`,
    'i'
  );
  if (ticketInMessage.test(message)) return message;

  return oneLine
    ? `${message.trimEnd()} (${ticket})`
    : `${message.trimEnd()}\n\nRefs: ${ticket}`;
};
