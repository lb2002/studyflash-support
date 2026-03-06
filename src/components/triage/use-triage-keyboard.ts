import { useEffect } from "react";

interface TriageKeyboardOptions {
  onLater: () => void;
  onEdit: () => void;
  onSend: () => void;
  enabled: boolean;
  isEditing: boolean;
  sendDisabled: boolean;
}

export function useTriageKeyboard(options: TriageKeyboardOptions) {
  useEffect(() => {
    if (!options.enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === "TEXTAREA" || target.tagName === "INPUT";

      if (inInput) {
        // Only Ctrl+Enter works inside textareas
        if (
          e.key === "Enter" &&
          (e.ctrlKey || e.metaKey) &&
          !options.sendDisabled
        ) {
          e.preventDefault();
          options.onSend();
        }
        return;
      }

      if (e.key === "1") {
        e.preventDefault();
        options.onLater();
      } else if (e.key === "2") {
        e.preventDefault();
        options.onEdit();
      } else if (e.key === "Enter" && !options.sendDisabled) {
        e.preventDefault();
        options.onSend();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    options.enabled,
    options.isEditing,
    options.sendDisabled,
    options.onLater,
    options.onEdit,
    options.onSend,
  ]);
}
