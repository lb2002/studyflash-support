export interface AutoCloseConfig {
  categories: string[];
  confidenceThreshold: number;
}

export interface TriageSettings {
  autoSendConfidenceThreshold: number;
  autoClose: AutoCloseConfig;
  defaultAssigneeMap: Record<string, string>;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  body: string;
}

export interface AppSettings {
  triage: TriageSettings;
  templates: Template[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  triage: {
    autoSendConfidenceThreshold: 0.7,
    autoClose: {
      categories: ["GARBAGE", "MISUNDERSTANDING"],
      confidenceThreshold: 0.85,
    },
    defaultAssigneeMap: {},
  },
  templates: [
    {
      id: "tpl-cancel-1",
      name: "Subscription Cancellation",
      category: "SUBSCRIPTION_CANCELLATION",
      body: "Thank you for reaching out. We have processed your cancellation request. Your subscription will remain active until the end of your current billing period. If you change your mind, you can resubscribe anytime.\n\nBest regards,\nThe Studyflash Team",
    },
    {
      id: "tpl-refund-1",
      name: "Refund Request",
      category: "REFUND_REQUEST",
      body: "Thank you for contacting us about your refund request. We are reviewing your case and will get back to you within 2 business days with an update.\n\nBest regards,\nThe Studyflash Team",
    },
    {
      id: "tpl-howto-1",
      name: "General How-To",
      category: "GENERAL_HOW_TO",
      body: "Thank you for your question! Here are the steps to help you:\n\n1. [Step 1]\n2. [Step 2]\n3. [Step 3]\n\nIf you need further assistance, feel free to reply.\n\nBest regards,\nThe Studyflash Team",
    },
  ],
};

const SETTINGS_KEY = "studyflash-support-settings";

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      triage: {
        ...DEFAULT_SETTINGS.triage,
        ...parsed.triage,
        autoClose: {
          ...DEFAULT_SETTINGS.triage.autoClose,
          ...parsed.triage?.autoClose,
        },
      },
      templates: parsed.templates ?? DEFAULT_SETTINGS.templates,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function isAutoCloseCategory(
  category: string | null,
  settings: AppSettings
): boolean {
  if (!category) return false;
  return settings.triage.autoClose.categories.includes(category);
}

// Categories involving money or account changes — never auto-send or auto-close
export const SENSITIVE_CATEGORIES = [
  "SUBSCRIPTION_CANCELLATION",
  "REFUND_REQUEST",
  "BILLING_INVOICE",
];

export function isSensitiveCategory(category: string | null): boolean {
  if (!category) return false;
  return SENSITIVE_CATEGORIES.includes(category);
}

export function getTemplatesForCategory(
  category: string | null,
  settings: AppSettings
): Template[] {
  if (!category) return [];
  return settings.templates.filter((t) => t.category === category);
}
