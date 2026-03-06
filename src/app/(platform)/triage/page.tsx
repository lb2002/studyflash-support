"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Loader2,
  SkipForward,
  Pencil,
  Send,
  Globe,
  Bug,
  BarChart3,
  User,
  Database,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Zap,
  PanelRightClose,
  PanelRightOpen,
  Languages,
  Ban,
} from "lucide-react";
import {
  STATUS_COLORS,
  PRIORITY_COLORS,
  LANG_LABELS,
  formatCategory,
} from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { useTriageKeyboard } from "@/components/triage/use-triage-keyboard";
import { loadSettings, isAutoCloseCategory, isSensitiveCategory, getTemplatesForCategory, type AppSettings } from "@/lib/settings";
import { TemplateSelector } from "@/components/templates/template-selector";

// --- Types ---

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
  enrichments: unknown[];
  createdAt: string;
  updatedAt: string;
}

interface TicketSummary {
  id: string;
  externalId: string | null;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  language: string | null;
  aiSummary: string | null;
  aiConfidence: number | null;
  createdAt: string;
}

interface AutoLogEntry {
  ticketId: string;
  ticketExternalId: string | null;
  ticketSubject: string;
  action: "auto-sent" | "auto-closed" | "skipped-low-confidence" | "skipped-error";
  confidence: number | null;
  timestamp: Date;
}

type PrepStatus = "idle" | "loading" | "done" | "error";

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const AUTO_DELAY_MS = 2000;

function detectLanguage(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(bedankt|hartelijk|alstublieft|wij|uw|graag|vraag)\b/.test(lower))
    return "nl";
  if (/\b(merci|bonjour|votre|nous|avec|pour|les)\b/.test(lower)) return "fr";
  if (/\b(vielen|bitte|herzlich|ihre|können|wir|danke)\b/.test(lower))
    return "de";
  return "en";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// --- Main Component ---

export default function TriagePage() {
  // Queue state
  const [queue, setQueue] = useState<TicketSummary[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueLoading, setQueueLoading] = useState(true);

  // Current ticket state
  const [ticket, setTicket] = useState<TicketDetail | null>(null);

  // Preparation statuses
  const [categorizeStatus, setCategorizeStatus] = useState<PrepStatus>("idle");
  const [translateStatus, setTranslateStatus] = useState<PrepStatus>("idle");
  const [enrichStatus, setEnrichStatus] = useState<PrepStatus>("idle");
  const [draftStatus, setDraftStatus] = useState<PrepStatus>("idle");

  // Prepared data
  const [enrichmentData, setEnrichmentData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [draftText, setDraftText] = useState("");
  const [englishDraft, setEnglishDraft] = useState("");
  const [draftLang, setDraftLang] = useState<string | null>(null);

  // UI state
  const [mode, setMode] = useState<"semi" | "auto">("semi");
  const [isEditing, setIsEditing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [onlyEnglish, setOnlyEnglish] = useState(true);
  const [syncingDraft, setSyncingDraft] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTicketIdRef = useRef<string | null>(null);

  // Settings
  const [settings] = useState<AppSettings>(() => loadSettings());
  const [isAutoCloseCandidate, setIsAutoCloseCandidate] = useState(false);

  // Auto mode
  const [autoRunning, setAutoRunning] = useState(false);
  const autoRunningRef = useRef(false);
  const [autoLog, setAutoLog] = useState<AutoLogEntry[]>([]);

  // Prefetch cache for pipelining — stores fully prepared next ticket
  interface PrefetchResult {
    ticket: TicketDetail;
    draftText: string;
    englishDraft: string;
    draftLang: string | null;
    isAutoCloseCandidate: boolean;
    enrichment: Record<string, unknown> | null;
  }
  const prefetchCacheRef = useRef<Map<string, PrefetchResult>>(new Map());
  const prefetchingRef = useRef<Set<string>>(new Set());

  // Fetch the queue of OPEN tickets
  useEffect(() => {
    async function loadQueue() {
      setQueueLoading(true);
      try {
        const res = await fetch("/api/tickets?status=OPEN&limit=100");
        if (!res.ok) throw new Error("Failed to load tickets");
        const data = await res.json();
        const sorted = (data.tickets as TicketSummary[]).sort((a, b) => {
          const pa = PRIORITY_ORDER[a.priority] ?? 99;
          const pb = PRIORITY_ORDER[b.priority] ?? 99;
          if (pa !== pb) return pa - pb;
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
        setQueue(sorted);
        setQueueIndex(0);
      } catch {
        toast.error("Failed to load triage queue");
      }
      setQueueLoading(false);
    }
    loadQueue();
  }, []);

  // Load current ticket when queue index changes
  useEffect(() => {
    if (queue.length === 0 || queueIndex >= queue.length) return;
    const ticketId = queue[queueIndex].id;
    currentTicketIdRef.current = ticketId;

    async function loadTicket() {
      // Reset state
      setTicket(null);
      setCategorizeStatus("idle");
      setTranslateStatus("idle");
      setEnrichStatus("idle");
      setDraftStatus("idle");
      setEnrichmentData(null);
      setDraftText("");
      setEnglishDraft("");
      setDraftLang(null);
      setIsEditing(false);
      setIsAutoCloseCandidate(false);

      try {
        // Check prefetch cache for a fully prepared result
        const cached = prefetchCacheRef.current.get(ticketId);
        if (cached) {
          prefetchCacheRef.current.delete(ticketId);
          if (currentTicketIdRef.current !== ticketId) return;

          // Re-check ticket status via a fresh fetch (it may have been sent/closed since prefetch)
          try {
            const freshRes = await fetch(`/api/tickets/${ticketId}`);
            if (freshRes.ok) {
              const freshData = await freshRes.json();
              if (freshData.status !== "OPEN") {
                if (currentTicketIdRef.current === ticketId) advanceQueue();
                return;
              }
              // Use fresh ticket data but keep the prefetched draft/enrichment
              cached.ticket = freshData;
            }
          } catch {
            // If re-check fails, fall through with cached data
          }

          if (currentTicketIdRef.current !== ticketId) return;

          // Apply all cached state at once — skip prepareTicket entirely
          setTicket(cached.ticket);
          setCategorizeStatus("done");
          setDraftStatus("done");
          setEnrichStatus(cached.enrichment ? "done" : "idle");
          setTranslateStatus("done");
          setEnrichmentData(cached.enrichment);
          setDraftText(cached.draftText);
          setEnglishDraft(cached.englishDraft);
          setDraftLang(cached.draftLang);
          setIsAutoCloseCandidate(cached.isAutoCloseCandidate);

          // Still trigger prefetch for the NEXT ticket
          triggerPrefetch(ticketId);
          return;
        }

        const res = await fetch(`/api/tickets/${ticketId}`);
        if (!res.ok) throw new Error("Failed to load ticket");
        const data = await res.json();

        // Check ticket is still the current one (user may have skipped)
        if (currentTicketIdRef.current !== ticketId) return;

        // Skip if no longer OPEN
        if (data.status !== "OPEN") {
          advanceQueue();
          return;
        }

        setTicket(data);
        prepareTicket(data, ticketId);
      } catch (err) {
        if (currentTicketIdRef.current === ticketId) {
          console.error("Failed to load ticket:", err);
          // In auto mode, skip to next ticket instead of showing error and stalling
          if (autoRunningRef.current) {
            advanceQueue();
          } else {
            toast.error("Failed to load ticket");
          }
        }
      }
    }

    loadTicket();
  }, [queue, queueIndex]);

  // Pipeline: prefetch + fully prepare the next ticket in the background
  function triggerPrefetch(currentTicketId: string) {
    const currentIdx = queue.findIndex((q) => q.id === currentTicketId);
    if (currentIdx < 0 || currentIdx + 1 >= queue.length) return;
    const nextId = queue[currentIdx + 1].id;
    if (prefetchCacheRef.current.has(nextId) || prefetchingRef.current.has(nextId)) return;
    prefetchingRef.current.add(nextId);

    (async () => {
      try {
        // 1. Fetch ticket
        const res = await fetch(`/api/tickets/${nextId}`);
        if (!res.ok) return;
        let t: TicketDetail = await res.json();
        if (t.status !== "OPEN") return;

        // 2. Categorize if needed
        if (!t.category || t.aiConfidence == null) {
          const catRes = await fetch("/api/ai/categorize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticketId: nextId }),
          });
          if (catRes.ok) {
            const refRes = await fetch(`/api/tickets/${nextId}`);
            if (refRes.ok) t = await refRes.json();
          }
        }

        const autoClose = isAutoCloseCategory(t.category, settings);

        // 3. Enrich (parallel with draft)
        const enrichPromise = fetch(`/api/enrichment/${nextId}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

        // 4. Draft (skip if auto-close)
        let draftText = "";
        let englishDraft = "";
        let draftLang: string | null = null;

        if (!autoClose) {
          const draftRes = await fetch("/api/ai/draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticketId: nextId }),
          });
          if (draftRes.ok) {
            const draftData = await draftRes.json();
            draftText = draftData.draft;

            // 5. Translate draft to English
            const transRes = await fetch("/api/ai/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: draftData.draft, targetLanguage: "en" }),
            });
            if (transRes.ok) {
              const transData = await transRes.json();
              const isEnglish =
                transData.translated.trim().substring(0, 50) ===
                draftData.draft.trim().substring(0, 50);
              if (!isEnglish) {
                englishDraft = transData.translated;
                draftLang = t.language?.toLowerCase() || detectLanguage(draftData.draft);
              } else {
                englishDraft = draftData.draft;
                draftLang = null;
              }
            }
          }
        }

        const enrichment = await enrichPromise;

        prefetchCacheRef.current.set(nextId, {
          ticket: t,
          draftText,
          englishDraft,
          draftLang,
          isAutoCloseCandidate: autoClose,
          enrichment,
        });
      } catch { /* prefetch is best-effort */ }
      finally { prefetchingRef.current.delete(nextId); }
    })();
  }

  // Prepare ticket: categorize, translate, enrich, draft
  async function prepareTicket(t: TicketDetail, ticketId: string) {
    const guard = () => currentTicketIdRef.current === ticketId;

    // Start enrich in parallel (independent)
    setEnrichStatus("loading");
    fetch(`/api/enrichment/${ticketId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (guard()) {
          setEnrichmentData(data);
          setEnrichStatus("done");
        }
      })
      .catch(() => {
        if (guard()) setEnrichStatus("error");
      });

    // Translate inbound messages in parallel (independent)
    const untranslated = t.messages.filter(
      (m) => m.source === "INBOUND_EMAIL" && !m.bodyTranslated
    );
    if (untranslated.length > 0) {
      setTranslateStatus("loading");
      Promise.all(
        untranslated.map((msg) =>
          fetch("/api/ai/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: msg.body,
              targetLanguage: "en",
              messageId: msg.id,
              ticketId,
            }),
          })
        )
      )
        .then(async () => {
          if (!guard()) return;
          // Re-fetch ticket to get updated translations
          const res = await fetch(`/api/tickets/${ticketId}`);
          if (res.ok && guard()) {
            const updated = await res.json();
            setTicket(updated);
          }
          setTranslateStatus("done");
        })
        .catch(() => {
          if (guard()) setTranslateStatus("error");
        });
    } else {
      setTranslateStatus("done");
    }

    // Categorize if needed (or if category exists but no confidence score), then draft
    let updatedTicket = t;
    if (!t.category || t.aiConfidence == null) {
      setCategorizeStatus("loading");
      try {
        const catRes = await fetch("/api/ai/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId }),
        });
        if (!guard()) return;
        if (catRes.ok) {
          // Re-fetch to get updated category/priority/language
          const refRes = await fetch(`/api/tickets/${ticketId}`);
          if (refRes.ok && guard()) {
            updatedTicket = await refRes.json();
            setTicket(updatedTicket);

            // Auto-assign based on default assignee mapping
            const defaultAssignee = updatedTicket.category
              ? settings.triage.defaultAssigneeMap[updatedTicket.category]
              : null;
            if (defaultAssignee && !updatedTicket.assigneeId) {
              fetch(`/api/tickets/${ticketId}/assign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assigneeId: defaultAssignee }),
              }).catch(() => {});
            }
          }
          setCategorizeStatus("done");
        } else {
          setCategorizeStatus("error");
        }
      } catch {
        if (guard()) setCategorizeStatus("error");
      }
    } else {
      setCategorizeStatus("done");
    }

    if (!guard()) return;

    // Trigger background prefetch for the next ticket
    triggerPrefetch(ticketId);

    // Check if ticket should be auto-closed (skip drafting)
    const shouldAutoClose = isAutoCloseCategory(updatedTicket.category, settings);
    if (guard()) setIsAutoCloseCandidate(shouldAutoClose);
    if (shouldAutoClose) {
      setDraftStatus("done");
      setDraftText("");
      return;
    }

    // Generate draft (after categorize)
    setDraftStatus("loading");
    try {
      const draftRes = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      if (!guard()) return;
      if (draftRes.ok) {
        const draftData = await draftRes.json();
        setDraftText(draftData.draft);

        // Translate draft to English
        const transRes = await fetch("/api/ai/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: draftData.draft,
            targetLanguage: "en",
          }),
        });
        if (!guard()) return;
        if (transRes.ok) {
          const transData = await transRes.json();
          const isEnglishDraft =
            transData.translated.trim().substring(0, 50) ===
            draftData.draft.trim().substring(0, 50);
          if (!isEnglishDraft) {
            setEnglishDraft(transData.translated);
            setDraftLang(
              updatedTicket.language?.toLowerCase() ||
                detectLanguage(draftData.draft)
            );
          } else {
            setEnglishDraft(draftData.draft);
            setDraftLang(null);
          }
        }
        setDraftStatus("done");
      } else {
        setDraftStatus("error");
      }
    } catch {
      if (guard()) setDraftStatus("error");
    }
  }

  // Auto mode evaluation
  useEffect(() => {
    if (mode !== "auto" || !autoRunning || !ticket) return;
    // Wait until both are resolved (done or error)
    if (categorizeStatus === "loading" || categorizeStatus === "idle") return;
    if (draftStatus === "loading" || draftStatus === "idle") return;

    if (categorizeStatus === "error" || draftStatus === "error") {
      setAutoLog((prev) => [
        {
          ticketId: ticket.id,
          ticketExternalId: ticket.externalId,
          ticketSubject: ticket.aiSummary || ticket.subject,
          action: "skipped-error",
          confidence: ticket.aiConfidence,
          timestamp: new Date(),
        },
        ...prev,
      ]);
      advanceQueue();
      return;
    }

    const confidence = ticket.aiConfidence ?? 0;

    // Auto-close candidate (garbage/misunderstanding)
    if (isAutoCloseCandidate) {
      if (confidence >= settings.triage.autoClose.confidenceThreshold) {
        const timer = setTimeout(async () => {
          if (currentTicketIdRef.current !== ticket.id) return;
          setAutoLog((prev) => [
            {
              ticketId: ticket.id,
              ticketExternalId: ticket.externalId,
              ticketSubject: ticket.aiSummary || ticket.subject,
              action: "auto-closed",
              confidence,
              timestamp: new Date(),
            },
            ...prev,
          ]);
          await autoCloseTicket();
        }, AUTO_DELAY_MS);
        return () => clearTimeout(timer);
      } else {
        setAutoLog((prev) => [
          {
            ticketId: ticket.id,
            ticketExternalId: ticket.externalId,
            ticketSubject: ticket.aiSummary || ticket.subject,
            action: "skipped-low-confidence",
            confidence,
            timestamp: new Date(),
          },
          ...prev,
        ]);
        advanceQueue();
      }
      return;
    }

    // Never auto-send sensitive categories (cancellations, refunds, billing) — require human review
    if (isSensitiveCategory(ticket.category)) {
      setAutoLog((prev) => [
        {
          ticketId: ticket.id,
          ticketExternalId: ticket.externalId,
          ticketSubject: ticket.aiSummary || ticket.subject,
          action: "skipped-low-confidence",
          confidence,
          timestamp: new Date(),
        },
        ...prev,
      ]);
      advanceQueue();
      return;
    }

    if (confidence >= settings.triage.autoSendConfidenceThreshold && draftText) {
      // Auto-send after brief delay
      const timer = setTimeout(async () => {
        if (currentTicketIdRef.current !== ticket.id) return;
        setAutoLog((prev) => [
          {
            ticketId: ticket.id,
            ticketExternalId: ticket.externalId,
            ticketSubject: ticket.aiSummary || ticket.subject,
            action: "auto-sent",
            confidence,
            timestamp: new Date(),
          },
          ...prev,
        ]);
        await sendReply();
      }, AUTO_DELAY_MS);
      return () => clearTimeout(timer);
    } else {
      // Low confidence — skip, don't pause
      setAutoLog((prev) => [
        {
          ticketId: ticket.id,
          ticketExternalId: ticket.externalId,
          ticketSubject: ticket.aiSummary || ticket.subject,
          action: "skipped-low-confidence",
          confidence,
          timestamp: new Date(),
        },
        ...prev,
      ]);
      advanceQueue();
    }
  }, [mode, autoRunning, ticket?.id, draftStatus, categorizeStatus, isAutoCloseCandidate, draftText, settings]);

  // Actions
  function advanceQueue() {
    setQueueIndex((i) => i + 1);
  }

  const handleLater = useCallback(() => {
    if (!ticket) return;
    advanceQueue();
    toast("Skipped — will review later");
  }, [ticket]);

  const handleToggleEdit = useCallback(() => {
    setIsEditing((v) => !v);
  }, []);

  async function sendReply() {
    if (!ticket || !draftText.trim()) return;
    setIsSending(true);
    const currentUserId = localStorage.getItem("currentUserId");
    try {
      const teamRes = await fetch("/api/team-members");
      const teamMembers = await teamRes.json();
      const currentUser = teamMembers.find(
        (m: { id: string }) => m.id === currentUserId
      );

      await fetch(`/api/tickets/${ticket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: draftText,
          source: "OUTBOUND_EMAIL",
          teamMemberId: currentUserId,
          senderName: currentUser?.name,
          senderEmail: currentUser?.email,
        }),
      });
      toast.success("Reply sent");
    } catch {
      toast.error("Failed to send reply");
    }
    setIsSending(false);
    advanceQueue();
  }

  async function autoCloseTicket() {
    if (!ticket) return;
    setIsSending(true);
    try {
      await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "AUTO_CLOSED" }),
      });
      toast.success("Ticket auto-closed");
    } catch {
      toast.error("Failed to auto-close ticket");
    }
    setIsSending(false);
    advanceQueue();
  }

  const handleSend = useCallback(() => {
    if (isSending) return;
    if (isAutoCloseCandidate) {
      autoCloseTicket();
      return;
    }
    if (draftStatus !== "done") return;
    sendReply();
  }, [isSending, draftStatus, ticket, draftText, isAutoCloseCandidate]);

  // Sync English draft to target language
  const syncEnglishToTarget = useCallback(
    async (englishText: string) => {
      if (!englishText.trim() || !draftLang) return;
      setSyncingDraft(true);
      try {
        const res = await fetch("/api/ai/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: englishText,
            targetLanguage: draftLang,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setDraftText(data.translated);
        }
      } catch {
        // Silently fail
      }
      setSyncingDraft(false);
    },
    [draftLang]
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

  // Keyboard shortcuts
  useTriageKeyboard({
    onLater: handleLater,
    onEdit: handleToggleEdit,
    onSend: handleSend,
    enabled: !!ticket && !queueLoading,
    isEditing,
    sendDisabled: isSending || draftStatus !== "done",
  });

  // Derived state
  const allDone =
    categorizeStatus === "done" &&
    translateStatus === "done" &&
    enrichStatus === "done" &&
    draftStatus === "done";
  const queueEmpty = !queueLoading && queueIndex >= queue.length;
  const showSplitDraft = draftLang !== null && draftLang !== "en";

  // --- Render ---

  if (queueLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">
          Loading triage queue...
        </span>
      </div>
    );
  }

  if (queueEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <h2 className="text-xl font-semibold">Queue Complete</h2>
        <p className="text-muted-foreground">
          {autoLog.length > 0
            ? `${autoLog.filter((l) => l.action === "auto-sent").length} sent, ${autoLog.filter((l) => l.action === "auto-closed").length} auto-closed, ${autoLog.filter((l) => l.action !== "auto-sent" && l.action !== "auto-closed").length} skipped`
            : "All open tickets have been triaged."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h1 className="text-2xl font-bold">Triage Queue</h1>
          <p className="text-sm text-muted-foreground">
            Ticket {queueIndex + 1} of {queue.length} open tickets
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={onlyEnglish ? "secondary" : "outline"}
            size="sm"
            onClick={() => setOnlyEnglish((v) => !v)}
          >
            <Languages className="h-3 w-3 mr-1" />
            {onlyEnglish ? "All Languages" : "English Only"}
          </Button>
          {mode === "auto" && autoRunning ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setMode("semi");
                setAutoRunning(false);
                autoRunningRef.current = false;
              }}
            >
              Stop Auto
            </Button>
          ) : (
            <>
              <Button
                variant={mode === "semi" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setMode("semi");
                  setAutoRunning(false);
                  autoRunningRef.current = false;
                }}
              >
                Semi-Auto
              </Button>
              <Button
                variant={mode === "auto" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setMode("auto");
                  setAutoRunning(true);
                  autoRunningRef.current = true;
                }}
              >
                <Zap className="h-3 w-3 mr-1" />
                Full Auto
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{
            width: `${((queueIndex + 1) / queue.length) * 100}%`,
          }}
        />
      </div>

      {/* Main content */}
      <div className="flex gap-4">
        {/* Left: Ticket + Draft */}
        <div className="flex-1 min-w-0">
          {!ticket ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading ticket...
              </span>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {/* Ticket info header */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">
                    #{ticket.externalId}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">
                    {ticket.aiSummary || ticket.subject}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge
                    className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[ticket.priority] || ""}`}
                    variant="secondary"
                  >
                    {ticket.priority}
                  </Badge>
                  {ticket.language && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {LANG_LABELS[ticket.language] || ticket.language}
                    </Badge>
                  )}
                  {ticket.category && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {formatCategory(ticket.category)}
                    </Badge>
                  )}
                  {ticket.aiConfidence != null && (
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(ticket.aiConfidence * 100)}% confidence
                    </span>
                  )}
                  {categorizeStatus === "loading" && (
                    <span className="flex items-center text-[10px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Categorizing...
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {ticket.customerName || ticket.customerEmail || "Unknown"} · {timeAgo(ticket.createdAt)}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  Conversation
                  {translateStatus === "loading" && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                </h3>
                {ticket.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg border p-3 ${
                      msg.source === "INBOUND_EMAIL"
                        ? "bg-card"
                        : msg.source === "INTERNAL_NOTE"
                          ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"
                          : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px]">
                            {msg.source === "INBOUND_EMAIL"
                              ? "CU"
                              : getInitials(
                                  msg.teamMember?.name ||
                                    msg.senderName ||
                                    "?"
                                )}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">
                          {msg.source === "INBOUND_EMAIL"
                            ? msg.senderName || "Customer"
                            : msg.teamMember?.name || msg.senderName}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {msg.source === "INBOUND_EMAIL"
                            ? "Customer"
                            : msg.source === "INTERNAL_NOTE"
                              ? "Note"
                              : "Support"}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {timeAgo(msg.createdAt)}
                      </span>
                    </div>
                    {/* Show English translation first for inbound */}
                    {msg.source === "INBOUND_EMAIL" && msg.bodyTranslated ? (
                      <>
                        <div className="text-sm whitespace-pre-wrap">
                          {msg.bodyTranslated}
                        </div>
                        {!onlyEnglish && (
                          <div className="mt-2 pt-2 border-t border-dashed">
                            <span className="text-[10px] text-muted-foreground">
                              Original:
                            </span>
                            <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                              {msg.body}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm whitespace-pre-wrap">
                        {msg.body}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Draft section */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    {isAutoCloseCandidate ? (
                      <Ban className="h-3 w-3" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {isAutoCloseCandidate ? "Auto-Close" : "AI Draft"}
                    {draftStatus === "loading" && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                  </h3>
                  {!isAutoCloseCandidate && (
                    <TemplateSelector
                      templates={getTemplatesForCategory(ticket.category, settings)}
                      onSelect={(body) => {
                        setDraftText(body);
                        setEnglishDraft(body);
                        setDraftLang(null);
                      }}
                    />
                  )}
                </div>

                {isAutoCloseCandidate && categorizeStatus === "done" && (
                  <div className="flex items-center gap-2 text-sm p-4 border rounded-lg bg-orange-50 border-orange-200">
                    <Ban className="h-4 w-4 text-orange-500 shrink-0" />
                    <span>
                      Categorized as <strong>{formatCategory(ticket.category)}</strong> — no reply needed. Click Auto-Close to dismiss.
                    </span>
                  </div>
                )}

                {!isAutoCloseCandidate && draftStatus === "loading" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 border rounded-lg bg-muted/30">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating draft response...
                  </div>
                )}

                {!isAutoCloseCandidate && draftStatus === "error" && (
                  <div className="text-sm text-red-500 p-4 border border-red-200 rounded-lg">
                    Failed to generate draft. You can still write a reply
                    manually.
                  </div>
                )}

                {!isAutoCloseCandidate && draftStatus === "done" && (
                  <>
                    {isEditing ? (
                      /* Edit mode: split editor */
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
                            value={englishDraft}
                            onChange={(e) =>
                              handleEnglishDraftChange(e.target.value)
                            }
                            rows={4}
                          />
                        </div>
                        {showSplitDraft && !onlyEnglish && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Globe className="h-3 w-3 text-blue-500" />
                              <span className="text-xs font-medium text-blue-600">
                                {LANG_LABELS[draftLang!] || draftLang} (will be
                                sent)
                              </span>
                              {syncingDraft && (
                                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                              )}
                            </div>
                            <Textarea
                              className="min-h-20 max-h-48 overflow-auto border-blue-200 bg-blue-50/50"
                              value={draftText}
                              onChange={(e) => setDraftText(e.target.value)}
                              rows={4}
                            />
                          </div>
                        )}
                        {!showSplitDraft && (
                          <Textarea
                            className="min-h-20 max-h-48 overflow-auto"
                            value={draftText}
                            onChange={(e) => setDraftText(e.target.value)}
                            rows={4}
                          />
                        )}
                      </div>
                    ) : (
                      /* Read-only mode */
                      <div className="space-y-2">
                        <Card className="bg-muted/30">
                          <CardContent className="pt-3 pb-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Globe className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs font-medium text-muted-foreground">
                                English
                              </span>
                            </div>
                            <div className="text-sm whitespace-pre-wrap">
                              {englishDraft || draftText}
                            </div>
                          </CardContent>
                        </Card>
                        {showSplitDraft && !onlyEnglish && (
                          <Card className="bg-blue-50/50 border-blue-200">
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Globe className="h-3 w-3 text-blue-500" />
                                <span className="text-xs font-medium text-blue-600">
                                  {LANG_LABELS[draftLang!] || draftLang} (will
                                  be sent)
                                </span>
                              </div>
                              <div className="text-sm whitespace-pre-wrap">
                                {draftText}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Action bar */}
              {ticket && (
                <div className="border-t pt-4 pb-4">
                  {mode === "auto" && autoRunning ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Auto-processing... ({autoLog.filter((l) => l.action === "auto-sent").length} sent, {autoLog.filter((l) => l.action !== "auto-sent").length} skipped)
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={handleLater}
                        className="flex-1"
                      >
                        <SkipForward className="h-4 w-4 mr-1" />
                        Later
                        <kbd className="ml-2 px-1.5 py-0.5 text-[10px] bg-muted rounded border">
                          1
                        </kbd>
                      </Button>
                      <Button
                        variant={isEditing ? "secondary" : "outline"}
                        onClick={handleToggleEdit}
                        className="flex-1"
                        disabled={draftStatus !== "done"}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        {isEditing ? "Done Editing" : "Edit"}
                        <kbd className="ml-2 px-1.5 py-0.5 text-[10px] bg-muted rounded border">
                          2
                        </kbd>
                      </Button>
                      {isAutoCloseCandidate ? (
                        <Button
                          onClick={handleSend}
                          disabled={isSending || categorizeStatus !== "done"}
                          variant="destructive"
                          className="flex-[1.5] whitespace-nowrap"
                        >
                          {isSending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Ban className="h-4 w-4 mr-1" />
                          )}
                          Auto-Close
                          <kbd className="ml-2 px-1.5 py-0.5 text-[10px] bg-destructive-foreground text-destructive rounded border border-destructive-foreground/30">
                            Enter
                          </kbd>
                        </Button>
                      ) : (
                        <Button
                          onClick={handleSend}
                          disabled={isSending || draftStatus !== "done"}
                          className="flex-[1.5] whitespace-nowrap"
                        >
                          {isSending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Send className="h-4 w-4 mr-1" />
                          )}
                          Send
                          <kbd className="ml-2 px-1.5 py-0.5 text-[10px] bg-primary-foreground text-primary rounded border border-primary-foreground/30">
                            Enter
                          </kbd>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="shrink-0 self-start sticky top-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen((v) => !v)}
            className="mb-2"
          >
            {sidebarOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
          {sidebarOpen && (
          <div className="w-72 space-y-4">
          {/* Enrichment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-3 w-3" />
                Enrichment
                {enrichStatus === "loading" && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {enrichStatus === "loading" && (
                <p className="text-xs text-muted-foreground">Loading...</p>
              )}
              {enrichStatus === "error" && (
                <p className="text-xs text-red-500">Failed to load</p>
              )}
              {enrichmentData && (
                <div className="space-y-3">
                  {/* Sentry */}
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Bug className="h-3 w-3 text-red-500" />
                      <span className="text-xs font-medium">Sentry</span>
                    </div>
                    {(
                      enrichmentData.sentry as Array<Record<string, unknown>>
                    )?.length > 0 ? (
                      <div className="space-y-1">
                        {(
                          enrichmentData.sentry as Array<
                            Record<string, unknown>
                          >
                        ).map(
                          (e: Record<string, unknown>, i: number) => (
                            <div
                              key={i}
                              className="text-xs p-2 bg-red-50 rounded border border-red-100"
                            >
                              <p className="font-medium">
                                {e.title as string}
                              </p>
                              <p className="text-muted-foreground">
                                {e.count as number}x | Last:{" "}
                                {e.lastSeen as string}
                              </p>
                            </div>
                          )
                        )}
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
                    {(enrichmentData.posthog as Record<string, unknown>)
                      ?.sessions ? (
                      <div className="text-xs space-y-1">
                        <p>
                          Sessions:{" "}
                          {
                            (
                              (
                                enrichmentData.posthog as Record<
                                  string,
                                  unknown
                                >
                              ).sessions as unknown[]
                            ).length
                          }
                        </p>
                        <p className="text-muted-foreground">
                          Last active:{" "}
                          {
                            (
                              enrichmentData.posthog as Record<
                                string,
                                unknown
                              >
                            ).lastActive as string
                          }
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
                            {
                              (
                                enrichmentData.userData as Record<
                                  string,
                                  unknown
                                >
                              ).plan as string
                            }
                          </Badge>
                        </p>
                        <p>
                          Signup:{" "}
                          {
                            (
                              enrichmentData.userData as Record<
                                string,
                                unknown
                              >
                            ).signupDate as string
                          }
                        </p>
                        <p>
                          Last login:{" "}
                          {
                            (
                              enrichmentData.userData as Record<
                                string,
                                unknown
                              >
                            ).lastLogin as string
                          }
                        </p>
                        <p>
                          Decks:{" "}
                          {
                            (
                              enrichmentData.userData as Record<
                                string,
                                unknown
                              >
                            ).deckCount as number
                          }{" "}
                          | Cards:{" "}
                          {
                            (
                              enrichmentData.userData as Record<
                                string,
                                unknown
                              >
                            ).cardCount as number
                          }
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

          {/* Auto-triage log */}
          {mode === "auto" && autoLog.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Auto-Triage Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {autoLog.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs"
                    >
                      {entry.action === "auto-sent" ? (
                        <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                      ) : entry.action === "auto-closed" ? (
                        <Ban className="h-3 w-3 text-orange-500 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-yellow-500 shrink-0" />
                      )}
                      <span className="truncate flex-1">
                        #{entry.ticketExternalId}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {entry.confidence != null
                          ? `${Math.round(entry.confidence * 100)}%`
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preparation status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Preparation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                {[
                  { label: "Categorize", status: categorizeStatus },
                  { label: "Translate", status: translateStatus },
                  { label: "Enrichment", status: enrichStatus },
                  { label: "AI Draft", status: draftStatus },
                ].map((step) => (
                  <div
                    key={step.label}
                    className="flex items-center justify-between"
                  >
                    <span>{step.label}</span>
                    {step.status === "loading" && (
                      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    )}
                    {step.status === "done" && (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    )}
                    {step.status === "error" && (
                      <AlertCircle className="h-3 w-3 text-red-500" />
                    )}
                    {step.status === "idle" && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
