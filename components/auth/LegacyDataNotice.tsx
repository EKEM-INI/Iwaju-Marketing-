"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { keyForScope, SCOPED_DATA_KEYS } from "@/lib/account-scope";
import { CAMPAIGNS_UPDATED_EVENT, TOUCHES_UPDATED_EVENT } from "@/lib/campaigns";
import { LEADS_UPDATED_EVENT } from "@/lib/storage";
import { useToast } from "@/components/ui/Toast";

/**
 * Data stored before per-account namespacing exists sits under the un-prefixed keys,
 * which a signed-in account no longer reads. This offers to move it into the current
 * account. Nothing is removed unless the copy into the account succeeded, and an
 * account that already holds its own record for a key is never overwritten.
 */

const REFRESH_EVENTS = [
  LEADS_UPDATED_EVENT,
  "iwaju-activities-updated",
  CAMPAIGNS_UPDATED_EVENT,
  TOUCHES_UPDATED_EVENT,
];

function hasRecords(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (parsed && typeof parsed === "object") return Object.keys(parsed).length > 0;
    return parsed !== null && parsed !== "";
  } catch {
    // Unreadable JSON is still data the user may want back.
    return raw.trim().length > 0;
  }
}

export function LegacyDataNotice() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [legacyKeys, setLegacyKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setLegacyKeys([]);
      return;
    }
    setLegacyKeys(SCOPED_DATA_KEYS.filter((key) => hasRecords(window.localStorage.getItem(key))));
  }, [user]);

  if (!user || dismissed || legacyKeys.length === 0) return null;

  const moveIntoAccount = () => {
    const moved: string[] = [];
    const kept: string[] = [];
    for (const key of legacyKeys) {
      const raw = window.localStorage.getItem(key);
      if (raw === null) continue;
      const accountKey = keyForScope(key, user.id);
      if (window.localStorage.getItem(accountKey) !== null) {
        kept.push(key);
        continue;
      }
      window.localStorage.setItem(accountKey, raw);
      window.localStorage.removeItem(key);
      moved.push(key);
    }
    for (const event of REFRESH_EVENTS) {
      window.dispatchEvent(new CustomEvent(event));
    }
    setLegacyKeys(kept);
    if (moved.length > 0) {
      showToast("Record sets moved", `${moved.length} now belong to ${user.email || user.name}.`, "success");
    }
    if (kept.length > 0) {
      showToast("Left unattached", `${kept.length} set(s) were not moved: this account already has its own data there.`, "info");
    }
  };

  return (
    <div className="border-b border-amber-900/50 bg-amber-950/30 px-4 py-3 text-xs text-amber-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="font-semibold">
            This browser holds {legacyKeys.length} stored record set(s) from before accounts were separated.
          </p>
          <p className="text-amber-200/80">
            They belong to no account, so {user.email || user.name} cannot see them. Move them into this account, or leave them untouched.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={moveIntoAccount}
            className="rounded-md bg-amber-500 px-3 py-1.5 font-semibold text-black transition-colors hover:bg-amber-400 cursor-pointer"
          >
            Move it into this account
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md border border-amber-900/60 px-3 py-1.5 text-amber-200 transition-colors hover:bg-amber-950/50 cursor-pointer"
          >
            Leave it alone
          </button>
        </div>
      </div>
    </div>
  );
}
