// WHAT: Shared SuperAdmin UI helpers so every tab renders dates, times, and
//       action labels identically (no raw ISO timestamps, no raw action keys).
// WHY: One place for formatting and labels; Overview, Audit Log, and Records
//       all reuse them. Keeps the SuperAdmin look identical to Admin/Encoder.
import { Activity, FileX2, KeyRound, LogIn, PencilLine, PlusCircle, ShieldAlert, ShieldX, TextCursorInput, Trash2, Upload, UserCog } from 'lucide-react';

// WHAT: Format a timestamp in Asia/Manila time. Returns 'Never' when null.
// WHY: No raw ISO timestamps anywhere; single source of truth for datetime display.
export function formatDateTimeManila(value) {
  if (value === null || value === undefined || value === '') return 'Never';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// WHAT: Human-readable label for a SuperAdmin audit/action key, with fallback.
// WHY: No raw action keys anywhere in Overview / Audit Log / Records.
export const SUPERADMIN_ACTION_LABELS = {
  'superadmin.user.create': { label: 'Created user', tone: 'create', icon: PlusCircle },
  'superadmin.user.deactivate': { label: 'Deactivated user', tone: 'delete', icon: ShieldX },
  'superadmin.user.reactivate': { label: 'Reactivated user', tone: 'update', icon: PencilLine },
  'superadmin.user.reset_password': { label: 'Reset password', tone: 'account', icon: KeyRound },
  'superadmin.user.change_municipality': { label: 'Changed municipality', tone: 'account', icon: UserCog },
  'superadmin.user.force_logout': { label: 'Force logged out', tone: 'security', icon: LogIn },
  'superadmin.user.unlock': { label: 'Unlocked user', tone: 'update', icon: PencilLine },
  'superadmin.record.soft_delete': { label: 'Soft-deleted record', tone: 'delete', icon: Trash2 },
  'superadmin.record.restore': { label: 'Restored record', tone: 'update', icon: PencilLine },
  'superadmin.record.edit': { label: 'Edited record', tone: 'update', icon: PencilLine },
  'superadmin.record.permanent_delete': { label: 'Permanently deleted record', tone: 'delete', icon: FileX2 },
  'superadmin.forecast.run': { label: 'Ran forecast', tone: 'create', icon: Activity },
  'superadmin.smtp.test': { label: 'SMTP test', tone: 'account', icon: Upload },
  'superadmin.content.update': { label: 'Updated content', tone: 'update', icon: PencilLine },
  'superadmin.content.reset': { label: 'Reset content', tone: 'delete', icon: FileX2 },
  'superadmin.setting.update': { label: 'Updated setting', tone: 'update', icon: PencilLine },
  'superadmin.announcement.update': { label: 'Updated announcement', tone: 'update', icon: TextCursorInput },
  'superadmin.help_faq.create': { label: 'Created FAQ', tone: 'create', icon: PlusCircle },
  'superadmin.help_faq.update': { label: 'Updated FAQ', tone: 'update', icon: PencilLine },
  'superadmin.help_faq.delete': { label: 'Deleted FAQ', tone: 'delete', icon: Trash2 },
  'superadmin.health.view': { label: 'Viewed health', tone: 'neutral', icon: Activity },
};

export function humanizeAction(action) {
  const meta = SUPERADMIN_ACTION_LABELS[action];
  if (meta) return meta.label;
  return String(action)
    .replace(/^superadmin\./, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Unknown event';
}

export function actionIcon(action) {
  const meta = SUPERADMIN_ACTION_LABELS[action];
  return meta ? meta.icon : Activity;
}
