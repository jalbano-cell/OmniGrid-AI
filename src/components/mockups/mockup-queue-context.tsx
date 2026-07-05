"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { MockupStatus } from "@prisma/client";
import {
  addToMockupQueueAction,
  addManualLeadToMockupQueueAction,
  markMockupSentAction,
  removeMockupAction,
  updateMockupNotesAction,
  updateMockupStatusAction,
  updateMockupUrlAction,
  type MockupQueueItemWithBusiness,
} from "@/app/actions/mockups";

interface ManualLeadInput {
  name: string;
  industry: string;
  city: string;
  province?: string;
  country?: string;
  phone?: string;
  googleProfile?: string;
  notes?: string;
}

interface MockupQueueContextValue {
  items: MockupQueueItemWithBusiness[];
  addBusiness: (businessId: string) => Promise<void>;
  addManualLead: (input: ManualLeadInput) => Promise<void>;
  setStatus: (id: string, status: MockupStatus) => Promise<void>;
  setUrl: (id: string, url: string) => Promise<void>;
  setNotes: (id: string, notes: string) => Promise<void>;
  markSent: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const MockupQueueContext = createContext<MockupQueueContextValue | null>(null);

export function MockupQueueProvider({
  initialItems,
  children,
}: {
  initialItems: MockupQueueItemWithBusiness[];
  children: ReactNode;
}) {
  const [items, setItems] = useState(initialItems);

  const upsert = useCallback((item: MockupQueueItemWithBusiness) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx === -1) return [item, ...prev];
      const next = [...prev];
      next[idx] = item;
      return next;
    });
  }, []);

  const addBusiness = useCallback(
    async (businessId: string) => {
      const before = items.some((i) => i.businessId === businessId);
      const item = await addToMockupQueueAction(businessId);
      upsert(item);
      toast.success(before ? `${item.business.name} is already in the mockup queue` : `Added ${item.business.name} to mockup queue`);
    },
    [items, upsert]
  );

  const addManualLead = useCallback(
    async (input: ManualLeadInput) => {
      const item = await addManualLeadToMockupQueueAction(input);
      upsert(item);
      toast.success(`Added ${item.business.name} to mockup queue`);
    },
    [upsert]
  );

  const setStatus = useCallback(
    async (id: string, status: MockupStatus) => {
      const item = await updateMockupStatusAction(id, status);
      upsert(item);
    },
    [upsert]
  );

  const setUrl = useCallback(
    async (id: string, url: string) => {
      const item = await updateMockupUrlAction(id, url);
      upsert(item);
    },
    [upsert]
  );

  const setNotes = useCallback(
    async (id: string, notes: string) => {
      const item = await updateMockupNotesAction(id, notes);
      upsert(item);
    },
    [upsert]
  );

  const markSent = useCallback(
    async (id: string) => {
      const item = await markMockupSentAction(id);
      upsert(item);
      toast.success(`Marked ${item.business.name} as sent`);
    },
    [upsert]
  );

  const remove = useCallback(async (id: string) => {
    const removed = items.find((i) => i.id === id);
    await removeMockupAction(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (removed) toast.success(`Removed ${removed.business.name} from mockup queue`);
  }, [items]);

  const value = useMemo(
    () => ({ items, addBusiness, addManualLead, setStatus, setUrl, setNotes, markSent, remove }),
    [items, addBusiness, addManualLead, setStatus, setUrl, setNotes, markSent, remove]
  );

  return <MockupQueueContext.Provider value={value}>{children}</MockupQueueContext.Provider>;
}

export function useMockupQueue() {
  const ctx = useContext(MockupQueueContext);
  if (!ctx) throw new Error("useMockupQueue must be used within MockupQueueProvider");
  return ctx;
}
