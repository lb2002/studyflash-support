import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import {
  TokenCredentialAuthenticationProvider,
} from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";

/**
 * Creates an authenticated Microsoft Graph client using client credentials flow.
 * This is the daemon/service auth pattern for server-side apps.
 *
 * Prerequisites:
 * 1. Azure AD app registration with Mail.Read, Mail.Send application permissions
 * 2. Admin consent granted for the app
 * 3. Application Access Policy scoped to the shared mailbox (Exchange PowerShell)
 */
export function createGraphClient() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Azure AD credentials not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET."
    );
  }

  const credential = new ClientSecretCredential(
    tenantId,
    clientId,
    clientSecret
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  return Client.initWithMiddleware({ authProvider });
}

/**
 * Get the shared mailbox email from environment
 */
export function getSharedMailbox(): string {
  const mailbox = process.env.OUTLOOK_SHARED_MAILBOX;
  if (!mailbox) {
    throw new Error("OUTLOOK_SHARED_MAILBOX not configured");
  }
  return mailbox;
}
