"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Mail,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Settings2,
  FileText,
} from "lucide-react";
import {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  type AppSettings,
  type TriageSettings,
  type Template,
  SENSITIVE_CATEGORIES,
} from "@/lib/settings";
import { formatCategory } from "@/lib/constants";

const ALL_CATEGORIES = [
  "SUBSCRIPTION_CANCELLATION",
  "REFUND_REQUEST",
  "FLASHCARD_ISSUES",
  "ACCOUNT_ISSUES",
  "BILLING_INVOICE",
  "CONTENT_UPLOAD",
  "TECHNICAL_ERRORS",
  "LANGUAGE_ISSUES",
  "DATA_LOSS",
  "QUIZ_ISSUES",
  "PODCAST_ISSUES",
  "MINDMAP_ISSUES",
  "MOCK_EXAM_ISSUES",
  "SUMMARY_ISSUES",
  "GENERAL_HOW_TO",
  "MISUNDERSTANDING",
  "GARBAGE",
  "OTHER",
];

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function SettingsPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    created: number;
    mock?: boolean;
  } | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "",
    body: "",
  });

  useEffect(() => {
    fetch("/api/team-members")
      .then((r) => r.json())
      .then(setTeamMembers);
    setSettings(loadSettings());
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/outlook/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult(data);
      if (data.created > 0) {
        toast.success(`Synced ${data.created} new emails`);
      } else {
        toast.info("No new emails to sync");
      }
    } catch {
      toast.error("Sync failed");
    }
    setSyncing(false);
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  const updateTriage = (partial: Partial<TriageSettings>) => {
    const updated = {
      ...settings,
      triage: { ...settings.triage, ...partial },
    };
    setSettings(updated);
    saveSettings(updated);
    toast.success("Settings saved");
  };

  const updateAutoClose = (
    partial: Partial<AppSettings["triage"]["autoClose"]>
  ) => {
    updateTriage({
      autoClose: { ...settings.triage.autoClose, ...partial },
    });
  };

  const toggleAutoCloseCategory = (category: string) => {
    if (SENSITIVE_CATEGORIES.includes(category)) return;
    const current = settings.triage.autoClose.categories;
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    updateAutoClose({ categories: updated });
  };

  const handleAddTemplate = () => {
    if (!newTemplate.name || !newTemplate.category || !newTemplate.body) {
      toast.error("Please fill in all fields");
      return;
    }
    const template: Template = {
      ...newTemplate,
      id: `tpl-${Date.now()}`,
    };
    const updated = {
      ...settings,
      templates: [...settings.templates, template],
    };
    setSettings(updated);
    saveSettings(updated);
    setNewTemplate({ name: "", category: "", body: "" });
    setAddTemplateOpen(false);
    toast.success("Template added");
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = {
      ...settings,
      templates: settings.templates.filter((t) => t.id !== id),
    };
    setSettings(updated);
    saveSettings(updated);
    toast.success("Template deleted");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{member.role}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Outlook Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Outlook Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">Status:</span>
            <Badge variant="secondary" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Mock Mode
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Outlook integration is running in mock mode. Set{" "}
            <code className="bg-muted px-1 rounded">OUTLOOK_ENABLED=true</code>{" "}
            with Azure AD credentials to enable real email sync.
          </p>
          <Separator />
          <div>
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync from Outlook
            </Button>
            {syncResult && (
              <p className="text-sm text-muted-foreground mt-2">
                Last sync: {syncResult.created} new tickets imported
                {syncResult.mock && " (mock data)"}
              </p>
            )}
          </div>

          <Separator />
          <div>
            <h3 className="text-sm font-medium mb-2">
              Production Setup Guide
            </h3>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>
                Register an app in Azure AD with Mail.Read, Mail.Send
                permissions
              </li>
              <li>Grant admin consent for the application</li>
              <li>
                Create Application Access Policy for the shared mailbox
              </li>
              <li>
                Set environment variables: AZURE_TENANT_ID, AZURE_CLIENT_ID,
                AZURE_CLIENT_SECRET, OUTLOOK_SHARED_MAILBOX
              </li>
              <li>Set OUTLOOK_ENABLED=true</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* AI Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">Provider:</span>
            <Badge variant="outline">Anthropic Claude</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Categorization model:</span>
            <Badge variant="secondary">Claude Haiku 4.5</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Drafting model:</span>
            <Badge variant="secondary">Claude Sonnet 4.5</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">API Key:</span>
            {process.env.NEXT_PUBLIC_AI_CONFIGURED === "true" ? (
              <Badge
                variant="secondary"
                className="flex items-center gap-1"
              >
                <CheckCircle className="h-3 w-3 text-green-500" />
                Configured
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                Set ANTHROPIC_API_KEY in .env
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Triage Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Triage Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-send threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Auto-Send Confidence Threshold
              </Label>
              <Badge variant="outline">
                {Math.round(
                  settings.triage.autoSendConfidenceThreshold * 100
                )}
                %
              </Badge>
            </div>
            <Slider
              value={[settings.triage.autoSendConfidenceThreshold]}
              onValueChange={([v]) =>
                updateTriage({ autoSendConfidenceThreshold: v })
              }
              min={0.5}
              max={1.0}
              step={0.05}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              In Full Auto mode, tickets with AI confidence above this
              threshold are sent automatically.
            </p>
          </div>

          <Separator />

          {/* Auto-close threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Auto-Close Confidence Threshold
              </Label>
              <Badge variant="outline">
                {Math.round(
                  settings.triage.autoClose.confidenceThreshold * 100
                )}
                %
              </Badge>
            </div>
            <Slider
              value={[settings.triage.autoClose.confidenceThreshold]}
              onValueChange={([v]) =>
                updateAutoClose({ confidenceThreshold: v })
              }
              min={0.5}
              max={1.0}
              step={0.05}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Tickets in auto-close categories with confidence above this
              threshold are closed without a reply.
            </p>
          </div>

          <Separator />

          {/* Auto-close categories */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Auto-Close Categories
            </Label>
            <p className="text-xs text-muted-foreground">
              Tickets in these categories will be auto-closed during triage
              instead of receiving a draft reply.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_CATEGORIES.map((cat) => {
                const sensitive = SENSITIVE_CATEGORIES.includes(cat);
                return (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div>
                      <span className="text-xs">{formatCategory(cat)}</span>
                      {sensitive && (
                        <p className="text-[10px] text-orange-500">Requires human review</p>
                      )}
                    </div>
                    <Switch
                      checked={settings.triage.autoClose.categories.includes(cat)}
                      disabled={sensitive}
                      onCheckedChange={() => toggleAutoCloseCategory(cat)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default Assignee Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Default Assignee Mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Assign a default team member for each ticket category.
          </p>
          <div className="space-y-2">
            {ALL_CATEGORIES.map((cat) => (
              <div
                key={cat}
                className="flex items-center justify-between gap-4 p-2 rounded border"
              >
                <span className="text-xs min-w-32">
                  {formatCategory(cat)}
                </span>
                <Select
                  value={
                    settings.triage.defaultAssigneeMap[cat] || "none"
                  }
                  onValueChange={(v) => {
                    const map = { ...settings.triage.defaultAssigneeMap };
                    if (v === "none") {
                      delete map[cat];
                    } else {
                      map[cat] = v;
                    }
                    updateTriage({ defaultAssigneeMap: map });
                  }}
                >
                  <SelectTrigger className="w-48 h-8 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Response Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Response Templates
            </CardTitle>
            <Dialog open={addTemplateOpen} onOpenChange={setAddTemplateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Response Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label className="text-sm">Name</Label>
                    <Input
                      value={newTemplate.name}
                      onChange={(e) =>
                        setNewTemplate({
                          ...newTemplate,
                          name: e.target.value,
                        })
                      }
                      placeholder="e.g. Refund Approved"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Category</Label>
                    <Select
                      value={newTemplate.category}
                      onValueChange={(v) =>
                        setNewTemplate({ ...newTemplate, category: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {formatCategory(cat)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Body</Label>
                    <Textarea
                      value={newTemplate.body}
                      onChange={(e) =>
                        setNewTemplate({
                          ...newTemplate,
                          body: e.target.value,
                        })
                      }
                      placeholder="Write the template response..."
                      rows={6}
                    />
                  </div>
                  <Button onClick={handleAddTemplate} className="w-full">
                    Add Template
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {settings.templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No templates configured. Add templates for common response
              categories.
            </p>
          ) : (
            <div className="space-y-3">
              {settings.templates.map((tpl) => (
                <div key={tpl.id} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{tpl.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {formatCategory(tpl.category)}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTemplate(tpl.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {tpl.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
