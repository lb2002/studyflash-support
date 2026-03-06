"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FileText } from "lucide-react";
import { type Template } from "@/lib/settings";

interface TemplateSelectorProps {
  templates: Template[];
  onSelect: (body: string) => void;
}

export function TemplateSelector({
  templates,
  onSelect,
}: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);

  if (templates.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-1" />
          Templates ({templates.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Select a template
          </p>
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              className="w-full text-left p-2 rounded hover:bg-accent text-sm"
              onClick={() => {
                onSelect(tpl.body);
                setOpen(false);
              }}
            >
              <span className="font-medium">{tpl.name}</span>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {tpl.body.substring(0, 80)}...
              </p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
