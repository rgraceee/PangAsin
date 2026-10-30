// WHAT: Presentation metadata para sa audit actions at details.
// WHY: Isang lugar lang ang labels, tones, at formatting para hindi magkaiba
//      ang basa sa table, filters, at expanded details row.
import {
  Activity,
  FileX2,
  KeyRound,
  LogIn,
  PencilLine,
  PlusCircle,
  ShieldAlert,
  ShieldX,
  TextCursorInput,
  Trash2,
  Upload,
  UserCog,
} from 'lucide-react';

export const AUDIT_ACTION_META = {
  'municipality.create': { label: 'Municipality added', tone: 'create', icon: PlusCircle },
  'municipality.update': { label: 'Municipality updated', tone: 'update', icon: PencilLine },
  'municipality.delete': { label: 'Municipality deleted', tone: 'delete', icon: Trash2 },
  'municipality.geojson.upload': { label: 'Boundary uploaded', tone: 'boundary', icon: Upload },
  'municipality.geojson.delete': { label: 'Boundary removed', tone: 'boundary', icon: FileX2 },
  'barangay.rename': { label: 'Barangay renamed', tone: 'update', icon: TextCursorInput },
  'barangay.delete': { label: 'Barangay deleted', tone: 'delete', icon: Trash2 },
  'user.update': { label: 'User updated', tone: 'account', icon: UserCog },
  'auth.login': { label: 'Sign in', tone: 'auth', icon: LogIn },
  'auth.login.failed': { label: 'Failed sign in', tone: 'security', icon: ShieldAlert },
  'auth.login.blocked': { label: 'Blocked sign in', tone: 'security', icon: ShieldX },
  'auth.password.change': { label: 'Password changed', tone: 'account', icon: KeyRound },
  'auth.password.reset_request': { label: 'Password reset requested', tone: 'security', icon: KeyRound },
  'auth.password.reset_complete': { label: 'Password reset completed', tone: 'security', icon: KeyRound },
};

export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_META);

export function getActionMeta(action) {
  return AUDIT_ACTION_META[action] || {
    label: action || 'Unknown event',
    tone: 'neutral',
    icon: Activity,
  };
}

export const ENTITY_LABELS = {
  municipality: 'Municipality',
  barangay: 'Barangay',
  user: 'User',
};

export function getEntityLabel(type) {
  if (!type) return 'Unknown';
  return ENTITY_LABELS[type] || type;
}

const DETAIL_LABELS = {
  geojson_ref: 'Boundary file',
  feature_count: 'Features',
  encoder_created: 'Encoder account created',
  encoder_email: 'Encoder email',
  deactivated_encoder_count: 'Encoders deactivated',
  file_removed: 'File removed',
  password_changed: 'Password changed',
  municipality_id: 'Municipality',
  old_name: 'Old name',
  new_name: 'New name',
  force: 'Force delete',
  deleted: 'Deleted records',
  changes: 'Changes',
  barangays: 'Barangays',
  role: 'Role',
  email: 'Email',
  name: 'Name',
  status: 'Status',
  message: 'Message',
};

export function detailLabel(key) {
  if (DETAIL_LABELS[key]) return DETAIL_LABELS[key];
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDetailValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
