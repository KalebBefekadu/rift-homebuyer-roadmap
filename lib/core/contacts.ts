/**
 * A professional's address on a contract workstream (audit portals-2026-10,
 * decision 3): the lender for financing, the closing attorney for title.
 * Given by the agent, used only for check-ins he approves in the outbox.
 *
 * Pure: no I/O.
 */
import type { Workstream } from "./progress";

export interface Contact { name: string | null; email: string }

export const contactKey = (transactionId: string, workstream: Workstream) => `${transactionId}:${workstream}`;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The address as stored, or null when it cannot be one. */
export function cleanContact(name: string | null, email: string): Contact | null {
  const e = email.trim().toLowerCase();
  if (e.length < 3 || e.length > 200 || !EMAIL.test(e)) return null;
  const n = name?.trim().slice(0, 160) || null;
  return { name: n, email: e };
}
