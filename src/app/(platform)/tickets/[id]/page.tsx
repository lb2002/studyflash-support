"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Sparkles,
  Globe,
  User,
  Headphones,
  Bot,
  Loader2,
  Bug,
  BarChart3,
  Database,
  RefreshCw,
  StickyNote,
} from "lucide-react";
import { STATUS_COLORS, LANG_LABELS, formatCategory } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { loadSettings, getTemplatesForCategory } from "@/lib/settings";
import { TemplateSelector } from "@/components/templates/template-selector";
import Link from "next/link";

interface Message {
  id: string;
  body: string;
  bodyTranslated: string | null;
  source: string;
  senderName: string | null;
  senderEmail: string | null;
  teamMember: { id: string; name: string } | null;
  createdAt: string;
}

interface Enrichment {
  id: string;
  type: string;
  data: Record<string, unknown>;
  fetchedAt: string;
}

interface TicketDetail {
  id: string;
  externalId: string | null;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  tags: string[];
  language: string | null;
  translatedSubject: string | null;
  aiSummary: string | null;
  aiConfidence: number | null;
  aiSuggestedAssignee: string | null;
  customerEmail: string | null;
  customerName: string | null;
  source: string | null;
  assignee: { id: string; name: string } | null;
  assigneeId: string | null;
  messages: Message[];
  enrichments: Enrichment[];
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

const STATUS_OPTIONS = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CUSTOMER",
  "RESOLVED",
  "CLOSED",
];

const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  INBOUND_EMAIL: <User className="h-4 w-4" />,
  OUTBOUND_EMAIL: <Headphones className="h-4 w-4" />,
  OUTBOUND_OUTLOOK: <Headphones className="h-4 w-4" />,
  INTERNAL_NOTE: <StickyNote className="h-4 w-4" />,
  AI_DRAFT: <Bot className="h-4 w-4" />,
};

function detectLanguage(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(bedankt|hartelijk|alstublieft|wij|uw|graag|vraag)\b/.test(lower)) return "nl";
  if (/\b(merci|bonjour|votre|nous|avec|pour|les)\b/.test(lower)) return "fr";
  if (/\b(vielen|bitte|herzlich|ihre|können|wir|danke)\b/.test(lower)) return "de";
  return "en";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [enrichmentData, setEnrichmentData] = useState<Record<string, unknown> | null>(null);
  const [loadingEnrichment, setLoadingEnrichment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [englishDraft, setEnglishDraft] = useState("");
  const [draftLang, setDraftLang] = useState<string | null>(null);
  const [syncingDraft, setSyncingDraft] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [appSettings] = useState(() => loadSettings());
  const [customerHistory, setCustomerHistory] = useState<
    Array<{
      id: string;
      externalId: string | null;
      subject: string;
      status: string;
      createdAt: string;
    }>
  >([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchTicket = async () => {
    try {
      const res = await fetch(`/api/tickets/${id}`);
      if (!res.ok) throw new Error("Failed to load ticket");
      const data = await res.json();
      setTicket(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ticket");
    }
  };

  useEffect(() => {
    fetchTicket();
    fetch("/api/team-members")
      .then((r) => r.json())
      .then(setTeamMembers);
  }, [id]);

  // Restore AI draft from localStorage on load
  useEffect(() => {
    if (!ticket || replyText) return;
    const saved = localStorage.getItem(`draft-${id}`);
    if (saved) {
      setReplyText(saved);
      const savedEnglish = localStorage.getItem(`draft-en-${id}`);
      const savedLang = localStorage.getItem(`draft-lang-${id}`);
      if (savedEnglish) setEnglishDraft(savedEnglish);
      if (savedLang) setDraftLang(savedLang);
    }
  }, [ticket?.id]);

  // Fetch customer history (other tickets from same email)
  useEffect(() => {
    if (!ticket?.customerEmail) return;
    setLoadingHistory(true);
    fetch(`/api/tickets?customerEmail=${encodeURIComponent(ticket.customerEmail)}&limit=20`)
      .then((r) => r.json())
      .then((data) => {
        setCustomerHistory(
          (data.tickets || []).filter((t: { id: string }) => t.id !== ticket.id)
        );
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [ticket?.id, ticket?.customerEmail]);

  // Auto-translate inbound messages for non-German/English tickets
  useEffect(() => {
    if (!ticket) return;
    const lang = ticket.language?.toLowerCase();
    if (!lang || lang === "de" || lang === "en") return;

    const untranslated = ticket.messages.filter(
      (m) => m.source === "INBOUND_EMAIL" && !m.bodyTranslated
    );
    if (untranslated.length === 0) return;

    // Translate all untranslated messages in parallel
    Promise.all(
      untranslated.map((msg) =>
        fetch("/api/ai/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: msg.body,
            targetLanguage: "en",
            messageId: msg.id,
            ticketId: id,
          }),
        })
      )
    ).then(() => {
      fetchTicket();
    });
  }, [ticket?.id, ticket?.messages.length]);

  const ticketLang = ticket?.language?.toLowerCase() || null;
  const showSplitEditor = englishDraft.length > 0 && draftLang !== null;
  const displayLang = draftLang || ticketLang || "unknown";

  const draftLangRef = useRef(draftLang);
  draftLangRef.current = draftLang;

  const syncEnglishToTarget = useCallback(
    async (englishText: string) => {
      const lang = draftLangRef.current;
      if (!englishText.trim() || !lang) return;
      setSyncingDraft(true);
      try {
        const res = await fetch("/api/ai/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: englishText,
            targetLanguage: lang,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setReplyText(data.translated);
        }
      } catch {
        // Silently fail — user can still edit the target language directly
      }
      setSyncingDraft(false);
    },
    []
  );

  const handleEnglishDraftChange = useCallback(
    (text: string) => {
      setEnglishDraft(text);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        syncEnglishToTarget(text);
      }, 1500);
    },
    [syncEnglishToTarget]
  );

  const handleStatusChange = async (newStatus: string) => {
    await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchTicket();
    toast.success("Status updated");
  };

  const handlePriorityChange = async (newPriority: string) => {
    await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: newPriority }),
    });
    fetchTicket();
    toast.success("Priority updated");
  };

  const handleAssign = async (assigneeId: string) => {
    await fetch(`/api/tickets/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assigneeId: assigneeId === "unassigned" ? null : assigneeId,
      }),
    });
    fetchTicket();
    toast.success("Ticket assigned");
  };

  const handleReply = async (source: "OUTBOUND_EMAIL" | "INTERNAL_NOTE" = "OUTBOUND_EMAIL") => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const currentUserId = localStorage.getItem("currentUserId");
      const currentUser = teamMembers.find((m) => m.id === currentUserId);

      const res = await fetch(`/api/tickets/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: replyText,
          source,
          teamMemberId: currentUserId,
          senderName: currentUser?.name,
          senderEmail: currentUser?.email,
        }),
      });

      if (!res.ok) throw new Error("Failed to send");

      setReplyText("");
      setEnglishDraft("");
      setDraftLang(null);
      localStorage.removeItem(`draft-${id}`);
      localStorage.removeItem(`draft-en-${id}`);
      localStorage.removeItem(`draft-lang-${id}`);
      fetchTicket();
      toast.success(source === "INTERNAL_NOTE" ? "Note added" : "Reply sent");
    } catch {
      toast.error("Failed to send reply");
    }
    setSending(false);
  };

  const handleCategorize = async () => {
    setCategorizing(true);
    try {
      const res = await fetch("/api/ai/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: id }),
      });
      if (res.ok) {
        // Re-fetch ticket to get updated category
        const updated = await fetch(`/api/tickets/${id}`).then((r) => r.json());
        setTicket(updated);

        // Auto-assign based on default assignee mapping
        const defaultAssignee = updated.category
          ? appSettings.triage.defaultAssigneeMap[updated.category]
          : null;
        if (defaultAssignee && !updated.assigneeId) {
          await fetch(`/api/tickets/${id}/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assigneeId: defaultAssignee }),
          });
          fetchTicket();
        }

        toast.success("Ticket categorized by AI");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to categorize");
      }
    } catch {
      toast.error("Failed to categorize");
    }
    setCategorizing(false);
  };

  const handleDraft = async () => {
    setDrafting(true);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: id }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplyText(data.draft);
        localStorage.setItem(`draft-${id}`, data.draft);

        // Always translate draft to English to detect language
        const transRes = await fetch("/api/ai/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: data.draft,
            targetLanguage: "en",
          }),
        });
        if (transRes.ok) {
          const transData = await transRes.json();
          // If translation differs from original, draft is non-English
          const isEnglishDraft =
            transData.translated.trim().substring(0, 50) ===
            data.draft.trim().substring(0, 50);
          if (!isEnglishDraft) {
            const detectedLang = ticketLang || detectLanguage(data.draft);
            setEnglishDraft(transData.translated);
            setDraftLang(detectedLang);
            localStorage.setItem(`draft-en-${id}`, transData.translated);
            localStorage.setItem(`draft-lang-${id}`, detectedLang);
          }
        }

        toast.success("AI draft generated");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to generate draft");
      }
    } catch {
      toast.error("Failed to generate draft");
    }
    setDrafting(false);
  };

  const handleTranslate = async (messageId: string, text: string) => {
    setTranslatingId(messageId);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          targetLanguage: "en",
          messageId,
          ticketId: id,
        }),
      });
      if (res.ok) {
        fetchTicket();
        toast.success("Translation complete");
      }
    } catch {
      toast.error("Translation failed");
    }
    setTranslatingId(null);
  };

  const handleLoadEnrichment = async () => {
    setLoadingEnrichment(true);
    try {
      const res = await fetch(`/api/enrichment/${id}`);
      if (res.ok) {
        const data = await res.json();
        setEnrichmentData(data);
      }
    } catch {
      toast.error("Failed to load enrichment data");
    }
    setLoadingEnrichment(false);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchTicket}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">
          Loading ticket...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/tickets")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">
              #{ticket.externalId}
            </span>
            <Badge
              className={`text-xs ${STATUS_COLORS[ticket.status] || ""}`}
              variant="secondary"
            >
              {ticket.status.replace(/_/g, " ")}
            </Badge>
            {ticket.source && (
              <Badge variant="outline" className="text-xs">
                {ticket.source}
              </Badge>
            )}
            {ticket.language && (
              <Badge variant="outline" className="text-xs">
                {LANG_LABELS[ticket.language] || ticket.language}
              </Badge>
            )}
          </div>
          <h1 className="text-lg font-semibold mt-1">
            {ticket.aiSummary || ticket.subject}
          </h1>
          {ticket.aiSummary && ticket.subject !== ticket.aiSummary && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Original: {ticket.subject}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left: Thread + Reply */}
        <div className="flex-1 overflow-auto pr-4">
          <div className="space-y-4 pb-4">
              {ticket.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg border p-4 ${
                    msg.source === "INBOUND_EMAIL"
                      ? "bg-card"
                      : msg.source === "AI_DRAFT"
                        ? "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800"
                        : msg.source === "INTERNAL_NOTE"
                          ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"
                          : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          {msg.source === "INBOUND_EMAIL"
                            ? "CU"
                            : msg.source === "AI_DRAFT"
                              ? "AI"
                              : getInitials(
                                  msg.teamMember?.name || msg.senderName || "?"
                                )}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {msg.source === "INBOUND_EMAIL"
                          ? msg.senderName || "Customer"
                          : msg.source === "AI_DRAFT"
                            ? "AI Draft"
                            : msg.teamMember?.name || msg.senderName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {msg.source === "INBOUND_EMAIL"
                          ? "Customer"
                          : msg.source === "AI_DRAFT"
                            ? "AI"
                            : msg.source === "INTERNAL_NOTE"
                              ? "Internal Note"
                              : "Support"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {msg.source === "INBOUND_EMAIL" &&
                        !msg.bodyTranslated && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTranslate(msg.id, msg.body)}
                            disabled={translatingId === msg.id}
                          >
                            {translatingId === msg.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Globe className="h-3 w-3" />
                            )}
                            <span className="ml-1 text-xs">Translate</span>
                          </Button>
                        )}
                      <span
                        className="text-xs text-muted-foreground"
                        title={new Date(msg.createdAt).toLocaleString()}
                      >
                        {timeAgo(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{msg.body}</div>
                  {msg.bodyTranslated && (
                    <div className="mt-3 pt-3 border-t border-dashed">
                      <div className="flex items-center gap-1 mb-1">
                        <Globe className="h-3 w-3 text-blue-500" />
                        <span className="text-xs text-blue-600 font-medium">
                          English Translation
                        </span>
                      </div>
                      <div className="text-sm text-blue-800 whitespace-pre-wrap">
                        {msg.bodyTranslated}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

          {/* Reply Box */}
          <div className="border-t pt-4 space-y-3 pb-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDraft}
                disabled={drafting}
              >
                {drafting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                AI Draft
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCategorize}
                disabled={categorizing}
              >
                {categorizing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                Categorize
              </Button>
              <TemplateSelector
                templates={getTemplatesForCategory(ticket.category, appSettings)}
                onSelect={(body) => {
                  setReplyText(body);
                  setEnglishDraft("");
                  setDraftLang(null);
                }}
              />
            </div>
            {showSplitEditor ? (
              <div className="space-y-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      English (edit here)
                    </span>
                  </div>
                  <Textarea
                    className="min-h-20 max-h-48 overflow-auto"
                    placeholder="Edit in English..."
                    value={englishDraft}
                    onChange={(e) => handleEnglishDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleReply("OUTBOUND_EMAIL");
                      }
                    }}
                    rows={3}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="h-3 w-3 text-blue-500" />
                    <span className="text-xs font-medium text-blue-600">
                      {LANG_LABELS[displayLang] || displayLang} (will be sent)
                    </span>
                    {syncingDraft && (
                      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    )}
                  </div>
                  <Textarea
                    className="min-h-20 max-h-48 overflow-auto border-blue-200 bg-blue-50/50"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            ) : (
              <Textarea
                className="min-h-24 max-h-64 overflow-auto"
                placeholder="Type your reply... (Ctrl+Enter to send)"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleReply("OUTBOUND_EMAIL");
                  }
                }}
                rows={4}
              />
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => handleReply("INTERNAL_NOTE")}
                disabled={sending || !replyText.trim()}
              >
                <StickyNote className="h-4 w-4 mr-1" />
                Add Note
              </Button>
              <Button onClick={() => handleReply("OUTBOUND_EMAIL")} disabled={sending || !replyText.trim()}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Send Reply
              </Button>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-72 space-y-4 overflow-auto">
          {/* Status & Priority */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <Select
                  value={ticket.status}
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Priority
                </label>
                <Select
                  value={ticket.priority}
                  onValueChange={handlePriorityChange}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Assignee
                </label>
                <Select
                  value={ticket.assigneeId || "unassigned"}
                  onValueChange={handleAssign}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div>
                <label className="text-xs text-muted-foreground">
                  Category
                </label>
                <p className="text-sm mt-1">
                  {ticket.category ? (
                    <Badge variant="outline">
                      {formatCategory(ticket.category)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">
                      Not categorized
                    </span>
                  )}
                </p>
                {ticket.aiConfidence != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    AI confidence: {Math.round(ticket.aiConfidence * 100)}%
                  </p>
                )}
              </div>
              {ticket.tags.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ticket.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Email: </span>
                <span>{ticket.customerEmail || "Unknown"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Name: </span>
                <span>{ticket.customerName || "Unknown"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Created: </span>
                <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Customer History */}
          {(loadingHistory || customerHistory.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Customer History
                  {customerHistory.length > 0 && (
                    <span className="text-muted-foreground font-normal ml-1">
                      ({customerHistory.length})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-auto">
                    {customerHistory.map((t) => (
                      <Link
                        key={t.id}
                        href={`/tickets/${t.id}`}
                        className="block p-2 rounded hover:bg-accent text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-muted-foreground">
                            #{t.externalId}
                          </span>
                          <Badge
                            className={`text-[10px] ${STATUS_COLORS[t.status] || ""}`}
                            variant="secondary"
                          >
                            {t.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="truncate mt-0.5">{t.subject}</p>
                        <p className="text-muted-foreground mt-0.5">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Enrichment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Enrichment</CardTitle>
            </CardHeader>
            <CardContent>
              {!enrichmentData ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleLoadEnrichment}
                  disabled={loadingEnrichment}
                >
                  {loadingEnrichment ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Database className="h-4 w-4 mr-1" />
                  )}
                  Load Enrichment Data
                </Button>
              ) : (
                <div className="space-y-3">
                  {/* Sentry */}
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Bug className="h-3 w-3 text-red-500" />
                      <span className="text-xs font-medium">Sentry</span>
                    </div>
                    {(enrichmentData.sentry as Array<Record<string, unknown>>)?.length > 0 ? (
                      <div className="space-y-1">
                        {(enrichmentData.sentry as Array<Record<string, unknown>>).map((e: Record<string, unknown>, i: number) => (
                          <div
                            key={i}
                            className="text-xs p-2 bg-red-50 rounded border border-red-100"
                          >
                            <p className="font-medium">{e.title as string}</p>
                            <p className="text-muted-foreground">
                              {e.count as number}x | Last: {e.lastSeen as string}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No errors found
                      </p>
                    )}
                  </div>

                  {/* PostHog */}
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <BarChart3 className="h-3 w-3 text-blue-500" />
                      <span className="text-xs font-medium">PostHog</span>
                    </div>
                    {(enrichmentData.posthog as Record<string, unknown>)?.sessions ? (
                      <div className="text-xs space-y-1">
                        <p>
                          Sessions:{" "}
                          {((enrichmentData.posthog as Record<string, unknown>).sessions as Array<unknown>).length}
                        </p>
                        <p className="text-muted-foreground">
                          Last active:{" "}
                          {(enrichmentData.posthog as Record<string, unknown>).lastActive as string}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No data available
                      </p>
                    )}
                  </div>

                  {/* User Data */}
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <User className="h-3 w-3 text-green-500" />
                      <span className="text-xs font-medium">User Data</span>
                    </div>
                    {(enrichmentData.userData as Record<string, unknown>) ? (
                      <div className="text-xs space-y-1">
                        <p>
                          Plan:{" "}
                          <Badge variant="outline" className="text-[10px]">
                            {(enrichmentData.userData as Record<string, unknown>).plan as string}
                          </Badge>
                        </p>
                        <p>
                          Signup:{" "}
                          {(enrichmentData.userData as Record<string, unknown>).signupDate as string}
                        </p>
                        <p>
                          Last login:{" "}
                          {(enrichmentData.userData as Record<string, unknown>).lastLogin as string}
                        </p>
                        <p>
                          Decks: {(enrichmentData.userData as Record<string, unknown>).deckCount as number} |
                          Cards: {(enrichmentData.userData as Record<string, unknown>).cardCount as number}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No user data
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
