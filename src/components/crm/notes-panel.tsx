"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { addNoteAction } from "@/app/actions/leads";
import { StickyNote, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Note } from "@prisma/client";

export function NotesPanel({ businessId, notes }: { businessId: string; notes: Note[] }) {
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    if (!content.trim()) return;
    startTransition(async () => {
      await addNoteAction(businessId, content);
      setContent("");
      toast.success("Note added");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a note about this lead…"
          rows={2}
          className="flex-1"
        />
        <Button onClick={handleAdd} disabled={pending || !content.trim()} className="self-end">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </Button>
      </div>

      {notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes yet" />
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-border/60 p-3 text-sm">
              <p className="whitespace-pre-wrap">{n.content}</p>
              <p className="text-xs text-muted-foreground mt-1.5">{formatDistanceToNow(n.createdAt, { addSuffix: true })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
