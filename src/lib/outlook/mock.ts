/**
 * Mock Outlook email data for demo mode.
 * Simulates what would come from Microsoft Graph API.
 */

const MOCK_EMAILS = [
  {
    id: "mock-msg-001",
    conversationId: "mock-conv-001",
    subject: "Probleem met mijn abonnement",
    from: {
      emailAddress: {
        name: "Jan de Vries",
        address: "jan.devries@example.com",
      },
    },
    body: {
      contentType: "text",
      content:
        "Beste Studyflash team, Ik heb problemen met het verlengen van mijn abonnement. De betaling wordt steeds geweigerd. Kunnen jullie me helpen? Met vriendelijke groet, Jan",
    },
    receivedDateTime: new Date().toISOString(),
    isRead: false,
  },
  {
    id: "mock-msg-002",
    conversationId: "mock-conv-002",
    subject: "Rückerstattung anfrage",
    from: {
      emailAddress: {
        name: "Maria Bauer",
        address: "maria.bauer@example.com",
      },
    },
    body: {
      contentType: "text",
      content:
        "Guten Tag, ich möchte gerne eine Rückerstattung für mein Jahresabonnement beantragen. Ich habe es vor 3 Tagen gekauft, aber die App entspricht nicht meinen Erwartungen. Bitte um schnelle Bearbeitung. Danke, Maria Bauer",
    },
    receivedDateTime: new Date(Date.now() - 3600000).toISOString(),
    isRead: false,
  },
  {
    id: "mock-msg-003",
    conversationId: "mock-conv-003",
    subject: "Bug: Flashcards werden nicht gespeichert",
    from: {
      emailAddress: {
        name: "Thomas Schmitt",
        address: "thomas.schmitt@example.com",
      },
    },
    body: {
      contentType: "text",
      content:
        "Hallo, seit gestern werden meine erstellten Karteikarten nicht mehr gespeichert. Ich nutze die Web-Version auf Chrome. Wenn ich ein neues Deck erstelle und Karten hinzufüge, sind sie nach einem Neuladen der Seite verschwunden. Das ist sehr frustrierend, da ich morgen eine Prüfung habe. Bitte dringend beheben! Thomas",
    },
    receivedDateTime: new Date(Date.now() - 7200000).toISOString(),
    isRead: false,
  },
];

/**
 * Returns mock email data simulating a Graph API response.
 */
export function getMockEmails() {
  return MOCK_EMAILS;
}

/**
 * Simulates sending a reply. In mock mode, just logs the action.
 */
export function mockSendReply(messageId: string, replyBody: string) {
  // In production: call Microsoft Graph API to send reply
  void messageId;
  void replyBody;
  return { success: true, mock: true };
}
