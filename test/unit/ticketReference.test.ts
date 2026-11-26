import { addTicketReference } from '../../src/utils/ticketReference';

describe('addTicketReference', () => {
  const message = 'feat(button): add the button component';

  it.each([
    { branch: 'feat/foo-1234-button', ticket: 'FOO-1234' },
    { branch: 'feature/PROJECT-123-a-nice-new-feature', ticket: 'PROJECT-123' },
    { branch: 'foo-1243-feature-button-component', ticket: 'FOO-1243' },
    { branch: 'bug/ab2-7', ticket: 'AB2-7' },
    { branch: 'user/jane/OPS-9_fix_login', ticket: 'OPS-9' },
    { branch: 'ABC-1-and-ABC-2', ticket: 'ABC-1' }
  ])('adds a Refs footer with $ticket on $branch', ({ branch, ticket }) => {
    expect(addTicketReference(message, branch)).toBe(
      `${message}\n\nRefs: ${ticket}`
    );
  });

  it('puts the footer after the body', () => {
    expect(
      addTicketReference(`${message}\n\nExplain the change.\n`, 'feat/foo-1234')
    ).toBe(`${message}\n\nExplain the change.\n\nRefs: FOO-1234`);
  });

  it('adds the ticket to the subject of a one-line message', () => {
    expect(
      addTicketReference(message, 'feat/foo-1234-button', { oneLine: true })
    ).toBe(`${message} (FOO-1234)`);
  });

  it.each(['main', 'feat/add-button', 'release/2026-11', 'fix/123-login', ''])(
    'leaves the message unchanged on "%s"',
    (branch) => {
      expect(addTicketReference(message, branch)).toBe(message);
    }
  );

  it.each(['FOO-1234: add the button', 'add the button (foo-1234)'])(
    'does not repeat a ticket that "%s" already names',
    (messageWithTicket) => {
      expect(
        addTicketReference(messageWithTicket, 'feat/foo-1234-button')
      ).toBe(messageWithTicket);
    }
  );

  it('still adds the ticket when the message names a different one', () => {
    expect(addTicketReference('fix FOO-12345 leftovers', 'feat/foo-1234')).toBe(
      'fix FOO-12345 leftovers\n\nRefs: FOO-1234'
    );
  });
});
