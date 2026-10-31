import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Building2, Copy, KeyRound, Loader2, MapPin, Pencil, Plus, Power,
  Tag, Trash2, X,
} from 'lucide-react';
import {
  createAdminMunicipality,
  deleteAdminBarangay,
  deleteAdminMunicipality,
  deleteAdminMunicipalityGeojson,
  getAdminMunicipalities,
  renameAdminBarangay,
  updateAdminMunicipality,
  uploadAdminMunicipalityGeojson,
} from '../../services/dataService';
import { confirmAction, promptText } from '../../services/feedback';
import { useToast } from '../Toast';
import { SkeletonList } from '../Skeleton';
import PageHeader from './PageHeader';
import LocationPicker from './LocationPicker';
import MunicipalityMapArt from '../encoder/MunicipalityMapArt';
import useMunicipalityDirectory from '../../hooks/useMunicipalityDirectory';
import usePagination from '../../hooks/usePagination';
import TablePagination from '../ui/TablePagination';
import {
  hasBundledBoundary,
  isWithinPangasinan,
  normalizeMunicipalityName,
} from '../../utils/municipalityGeo';
import { previewEncoderEmail } from '../../utils/encoderEmail';

const EMPTY_CREATE = {
  name: '',
  latitude: '',
  longitude: '',
  status: 'active',
  barangays: [],
};

function parseBarangayInput(text) {
  return String(text || '')
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function barangayKey(name) {
  return String(name || '').trim().toLowerCase();
}

function countDecimals(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text.includes('.')) return 0;
  const fraction = text.split('.')[1] || '';
  const exponent = fraction.includes('e-') ? Number(fraction.split('e-')[1]) || 0 : 0;
  return (fraction.split('e-')[0] || '').length + exponent;
}

// WHAT: Client-side validation na tugma sa backend rules.
// WHY: Mas mabilis ang feedback; ang server pa rin ang final authority.
const NAME_PATTERN = /^[\p{L}\p{N} .,'’\-]+$/u;

function nameKey(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function validateMunicipalityForm(form, { municipalities = [], excludeId = null } = {}) {
  const errors = {};
  const name = String(form.name ?? '').trim();
  if (!name) errors.name = 'Municipality name is required.';
  else if (name.length > 100) errors.name = 'Name must be at most 100 characters.';
  else if (!/[a-z0-9]/i.test(name)) errors.name = 'Name must contain at least one letter or digit.';
  else if (!NAME_PATTERN.test(name)) {
    errors.name = 'Use letters, digits, spaces, periods, hyphens, or apostrophes only.';
  } else if (municipalities.some(
    (municipality) => municipality.id !== excludeId
      && nameKey(municipality.name) === nameKey(name),
  )) {
    errors.name = 'A municipality with this name already exists.';
  }

  const latitude = String(form.latitude ?? '').trim();
  const longitude = String(form.longitude ?? '').trim();

  if (!latitude) {
    errors.latitude = 'Latitude is required.';
  } else {
    const lat = Number(latitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      errors.latitude = 'Latitude must be between -90 and 90.';
    } else if (countDecimals(latitude) > 6) {
      errors.latitude = 'Latitude must have at most 6 decimal places.';
    }
  }

  if (!longitude) {
    errors.longitude = 'Longitude is required.';
  } else {
    const lng = Number(longitude);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      errors.longitude = 'Longitude must be between -180 and 180.';
    } else if (countDecimals(longitude) > 6) {
      errors.longitude = 'Longitude must have at most 6 decimal places.';
    }
  }

  return errors;
}

function coordinateWarning(form) {
  const lat = String(form.latitude ?? '').trim();
  const lng = String(form.longitude ?? '').trim();
  if (!lat || !lng) return '';
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return '';
  return isWithinPangasinan(lat, lng)
    ? ''
    : 'These coordinates are outside the Pangasinan bounds. Double-check before saving.';
}

function formatCoord(value) {
  return value === null || value === undefined || value === '' ? '—' : Number(value).toFixed(4);
}

function boundaryStatus(municipality) {
  if (municipality?.has_boundary) {
    return {
      tone: 'uploaded',
      label: 'Uploaded boundary',
      detail: municipality.geojson_ref || '',
    };
  }
  if (hasBundledBoundary(municipality?.name)) {
    return { tone: 'bundled', label: 'Bundled boundary only', detail: 'No uploaded file' };
  }
  return { tone: 'none', label: 'No boundary', detail: 'Maps use the pin' };
}

function FormSection({ title, hint, children }) {
  return (
    <section className="muni-form-section">
      <div className="muni-form-section__head">
        <h6 className="muni-form-section__title">{title}</h6>
        {hint ? <p className="muni-form-section__hint">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <div className="muni-field-error" id={id} role="alert">
      {children}
    </div>
  );
}

function MuniModalHeader({ titleId, title, subtitle }) {
  return (
    <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header">
      <div className="muni-modal__heading">
        <Modal.Title id={titleId} className="muni-modal__title">{title}</Modal.Title>
        {subtitle ? <p className="muni-modal__subtitle">{subtitle}</p> : null}
      </div>
    </Modal.Header>
  );
}

/* WHAT: Segmented Active/Inactive control.
   WHY: Mas malinaw kaysa select kung dalawa lang ang estado; may dot at
        pressed state para hindi mapagkamalang plain text. */
function StatusToggle({ value, onChange, describedBy, disabled = false }) {
  const options = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];
  return (
    <div
      className="muni-segmented"
      role="group"
      aria-label="Municipality status"
      aria-describedby={describedBy}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`muni-segmented__option muni-segmented__option--${option.value}${value === option.value ? ' is-selected' : ''}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          <span className="muni-segmented__dot" aria-hidden="true" />
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* WHAT: 36px row action button na may intent color at loading spinner.
   WHY: Mas malaki ang touch target at hindi na mapagkamalan ang delete
        sa edit/power dahil hiwalay ito at pula ang tone. */
function MuniActionButton({
  icon: Icon, label, tone = 'edit', onClick, disabled = false, loading = false,
}) {
  return (
    <button
      type="button"
      className={`muni-action-btn muni-action-btn--${tone}`}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
      title={label}
      aria-busy={loading || undefined}
    >
      {loading
        ? <Loader2 size={16} className="muni-spin" aria-hidden="true" />
        : <Icon size={16} aria-hidden="true" />}
    </button>
  );
}

/* WHAT: Add-only tag input para sa barangays.
   WHY: Mas malinaw kaysa textarea; Enter/comma ang add, Backspace ang remove.
        Sa Edit, existing names ay hiwalay na chips at hindi na maaaring i-edit dito. */
function BarangayTagInput({
  value, onChange, existingNames = [], max = 100, placeholder = 'Type a barangay name…', invalid = false,
}) {
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');

  const addFromText = (text) => {
    const names = parseBarangayInput(text);
    if (!names.length) return;
    const seen = new Set(
      [...existingNames, ...value].map(barangayKey).filter(Boolean),
    );
    const next = [...value];
    let skipped = 0;
    names.forEach((name) => {
      const key = barangayKey(name);
      if (!key || seen.has(key)) {
        skipped += 1;
        return;
      }
      if (existingNames.length + next.length >= max) {
        skipped += 1;
        return;
      }
      seen.add(key);
      next.push(name);
    });
    if (next.length !== value.length) onChange(next);
    if (skipped) {
      setNotice(
        existingNames.length + next.length >= max
          ? `Limit reached (${max}).`
          : 'Duplicate or empty names were skipped.',
      );
    } else {
      setNotice('');
    }
  };

  const commitDraft = () => {
    addFromText(draft);
    setDraft('');
  };

  const removeTag = (name) => {
    onChange(value.filter((item) => item !== name));
    setNotice('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
    } else if (event.key === 'Backspace' && !draft && value.length) {
      event.preventDefault();
      removeTag(value[value.length - 1]);
    }
  };

  const handlePaste = (event) => {
    const text = event.clipboardData?.getData('text') || '';
    if (/[\n,]/.test(text)) {
      event.preventDefault();
      addFromText(text);
      setDraft('');
    }
  };

  const remaining = Math.max(0, max - existingNames.length - value.length);

  return (
    <div>
      <div className={`muni-tag-input${invalid ? ' is-invalid' : ''}`}>
        <div className="muni-tag-input__chips">
          {value.map((name) => (
            <span key={name} className="muni-tag">
              <Tag size={11} aria-hidden="true" />
              <span>{name}</span>
              <button
                type="button"
                className="muni-tag__remove"
                onClick={() => removeTag(name)}
                aria-label={`Remove ${name}`}
                title={`Remove ${name}`}
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitDraft}
            onPaste={handlePaste}
            placeholder={value.length ? '' : placeholder}
            aria-label="Add barangay names"
            aria-invalid={invalid || undefined}
            disabled={remaining === 0 && !draft}
          />
        </div>
        <div className="muni-tag-input__hint">
          Press Enter or comma to add. {remaining} of {max} slots left.
        </div>
      </div>
      {notice ? <div className="muni-tag-input__notice" role="status">{notice}</div> : null}
    </div>
  );
}

function BoundaryPreview({ name, hasUploaded = false }) {
  const bundled = useMemo(() => hasBundledBoundary(name), [name]);
  if (!name) return null;
  return (
    <div className="muni-boundary-preview">
      <MunicipalityMapArt highlightName={name} mode="single" showLabel={false} />
      <p className="text-muted small mb-0 mt-2">
        {hasUploaded
          ? 'An uploaded boundary file is active. This preview still shows the bundled Pangasinan shape.'
          : bundled
            ? 'Boundary matched from the bundled 48-municipality Pangasinan GeoJSON.'
            : 'No bundled boundary matches this name yet; maps will use the latitude/longitude marker as a fallback.'}
      </p>
    </div>
  );
}

function BoundaryChip({ municipality }) {
  const status = boundaryStatus(municipality);
  return (
    <span
      className={`muni-boundary-chip muni-boundary-chip--${status.tone}`}
      title={status.detail || status.label}
    >
      <MapPin size={11} aria-hidden="true" />
      {status.label}
    </span>
  );
}

/* WHAT: Nai-encode ang mga email ng encoder sa edit modal.
   WHY: Ihiwalay ang mahabang ternary para ma-intindihin ang render logic. */
function encoderEmailList(editing) {
  const encoders = (editing && editing.encoders) || [];
  if (encoders.length === 0) return <span className="text-muted small">No encoder account is linked yet.</span>;
  return <code>{encoders.map((encoder) => encoder.email).join(', ')}</code>;
}

/* WHAT: Class name ng help text sa status field ng edit form.
   WHY: Pula kung pag-aalis ang active status, kung hindi muted. */
function editStatusClassName(editForm, editing) {
  return editForm.status === 'inactive' && editForm.status !== editing?.status
    ? 'text-danger d-block mt-1'
    : 'text-muted d-block mt-1';
}

/* WHAT: Mensahe ng help text sa status field ng edit form.
   WHY: Ihiwalay ang mahabang ternary sa JSX. */
function editStatusMessage(editForm, editing) {
  if (editForm.status === 'inactive' && editForm.status !== editing?.status) {
    return "Saving this change deactivates the municipality's active encoder account(s).";
  }
  return 'Inactive municipalities are hidden from public views; linked encoders are deactivated.';
}

/* WHAT: Reference ng uploaded boundary file sa edit form.
   WHY: Maikli ang JSX sa boundary section. */
function boundaryFileRef(editing) {
  if (editing?.has_boundary) return editing.geojson_ref;
  return 'No uploaded boundary file';
}

/* WHAT: Laman ng Save button habang nag-save o hindi.
   WHY: Ihiwalay ang ternary sa Modal Footer. */
function saveButtonContent(saving) {
  if (saving) return (
    <>
      <Loader2 size={15} className="muni-spin" aria-hidden="true" />
      Saving…
    </>
  );
  return 'Save Changes';
}


export default function Municipalities() {
  const { toastSuccess, toastError } = useToast();
  const { activeNames, refresh: refreshDirectory } = useMunicipalityDirectory();
  const [municipalities, setMunicipalities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedMapName, setSelectedMapName] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const lastHighlightId = useRef(0);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createError, setCreateError] = useState(null);
  const [createTouched, setCreateTouched] = useState({});
  const [createGeojson, setCreateGeojson] = useState(null);
  const [saving, setSaving] = useState(false);
  const createNameRef = useRef(null);

  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_CREATE);
  const [editError, setEditError] = useState(null);
  const [editTouched, setEditTouched] = useState({});
  const [editGeojson, setEditGeojson] = useState(null);
  const editNameRef = useRef(null);

  // WHAT: Isang row lang ang may in-flight request sa isang pagkakataon.
  // WHY: Para may spinner/disabled state sa tamang row at hindi ma-double click.
  const [rowBusy, setRowBusy] = useState(null);

  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminMunicipalities();
      setMunicipalities(response.municipalities || []);
    } catch (err) {
      setError(err.message || 'Could not load municipalities.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => municipalities.filter((m) => !statusFilter || m.status === statusFilter),
    [municipalities, statusFilter],
  );

  /* WHAT: The municipality list pages in the browser.
     WHY: the page already loads every municipality for the map and the
          summary; slicing only changes how many rows are drawn. */
  const pager = usePagination({
    total: visible.length,
    resetKey: `${statusFilter}|${municipalities.length}`,
  });
  const pagedMunicipalities = visible.slice(pager.pageStart, pager.pageStart + pager.perPage);
  const { goToPage, perPage } = pager;

  // WHAT: Sinusuportahan ang /admin/municipalities?highlight=<id> mula sa Audit Log.
  // WHY: Direktang mapupunta ang admin sa tamang row at map highlight; hindi
  //      nag-iiwan ng dead link kapag wala na ang municipality.
  useEffect(() => {
    if (loading) return;
    const highlightId = Number(searchParams.get('highlight'));
    if (!highlightId) {
      lastHighlightId.current = 0;
      return;
    }
    if (lastHighlightId.current === highlightId) return;
    lastHighlightId.current = highlightId;
    const match = municipalities.find((municipality) => municipality.id === highlightId);
    if (match) {
      setSelectedMapName(match.name);
      if (statusFilter && match.status !== statusFilter) setStatusFilter('');
      /* WHAT: Jump to the page that holds the linked municipality.
         WHY: the audit-log link must still land on the row after pagination. */
      const index = visible.findIndex((municipality) => municipality.id === match.id);
      if (index >= 0) goToPage(Math.floor(index / perPage) + 1);
      window.setTimeout(() => {
        document.getElementById(`muni-row-${match.id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 120);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('highlight');
    setSearchParams(next, { replace: true });
  }, [loading, municipalities, searchParams, setSearchParams, statusFilter, visible, goToPage, perPage]);

  const selectedMapMatch = useMemo(() => {
    const key = normalizeMunicipalityName(selectedMapName);
    if (!key) return null;
    return municipalities.find(
      (municipality) => normalizeMunicipalityName(municipality.name) === key,
    ) || null;
  }, [municipalities, selectedMapName]);

  const summary = useMemo(() => ({
    total: municipalities.length,
    active: municipalities.filter((m) => m.status === 'active').length,
    uploaded: municipalities.filter((m) => m.has_boundary).length,
  }), [municipalities]);

  const createEmailPreview = useMemo(
    () => previewEncoderEmail(createForm.name),
    [createForm.name],
  );
  const createWarning = useMemo(() => coordinateWarning(createForm), [createForm]);
  const editWarning = useMemo(() => coordinateWarning(editForm), [editForm]);

  // WHAT: Live validation — laging kinokompute, pero ang error lang ng
  //       na-touch/blurred na field ang ipinapakita.
  // WHY: Hindi nakakagulat ang pulang field habang nagta-type pa lang.
  const createValidation = useMemo(
    () => validateMunicipalityForm(createForm, { municipalities }),
    [createForm, municipalities],
  );
  const editValidation = useMemo(
    () => validateMunicipalityForm(editForm, {
      municipalities,
      excludeId: editing?.id ?? null,
    }),
    [editForm, municipalities, editing?.id],
  );
  const createErrors = useMemo(
    () => Object.fromEntries(
      Object.entries(createValidation).filter(([field]) => createTouched[field]),
    ),
    [createValidation, createTouched],
  );
  const editErrors = useMemo(
    () => Object.fromEntries(
      Object.entries(editValidation).filter(([field]) => editTouched[field]),
    ),
    [editValidation, editTouched],
  );
  const createValid = Object.keys(createValidation).length === 0;
  const editValid = Object.keys(editValidation).length === 0;

  const markCreateTouched = (field) => {
    setCreateTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  const markEditTouched = (field) => {
    setEditTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  const markAllTouched = (validation, setter) => {
    setter(Object.fromEntries(Object.keys(validation).map((field) => [field, true])));
  };

  const handleMapSelect = useCallback((name) => {
    setSelectedMapName(name);
    const key = normalizeMunicipalityName(name);
    const match = municipalities.find(
      (municipality) => normalizeMunicipalityName(municipality.name) === key,
    );
    if (!match) return;
    // WHAT: Alisin ang filter kung natatakpan nito ang napiling munisipyo.
    // WHY: Kapag hindi visible ang row, parang walang nangyari sa click.
    if (statusFilter && match.status !== statusFilter) setStatusFilter('');
    window.setTimeout(() => {
      document.getElementById(`muni-row-${match.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 0);
  }, [municipalities, statusFilter]);

  const clearMapSelection = () => setSelectedMapName('');

  const updateCreateField = (field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateEditField = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE);
    setCreateError(null);
    setCreateTouched({});
    setCreateGeojson(null);
    setShowCreate(true);
  };

  const closeCreate = () => {
    if (saving) return;
    setShowCreate(false);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreateError(null);
    if (!createValid) {
      markAllTouched(createValidation, setCreateTouched);
      setCreateError('Please fix the highlighted fields.');
      const firstInvalid = ['name', 'latitude', 'longitude']
        .find((field) => createValidation[field]);
      document.getElementById(`muni-create-${firstInvalid}`)?.focus();
      return;
    }
    const barangays = createForm.barangays;

    setSaving(true);
    try {
      const response = await createAdminMunicipality({
        name: createForm.name,
        latitude: createForm.latitude,
        longitude: createForm.longitude,
        status: createForm.status,
        barangays,
      });

      let uploadWarning = null;
      if (createGeojson && response.municipality?.id) {
        try {
          await uploadAdminMunicipalityGeojson(response.municipality.id, createGeojson);
        } catch (err) {
          uploadWarning = err.data?.errors?.join(' ') || err.message;
        }
      }

      setShowCreate(false);
      await load();
      await refreshDirectory();
      setCredentials({
        municipalityName: response.municipality?.name || createForm.name,
        encoder: response.encoder,
      });
      setCopied(false);
      setShowCredentials(true);
      if (uploadWarning) {
        toastError(`Municipality added, but the boundary was not saved: ${uploadWarning}`);
      } else {
        toastSuccess(
          `${response.municipality?.name || createForm.name} has been added.`,
          'Municipality added',
        );
      }
    } catch (err) {
      const message = err.data?.errors
        ? err.data.errors.join(' ')
        : (err.message || 'Could not add the municipality.');
      setCreateError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (municipality) => {
    setEditing(municipality);
    setEditForm({
      name: municipality.name,
      latitude: municipality.latitude ?? '',
      longitude: municipality.longitude ?? '',
      status: municipality.status,
      barangays: [],
    });
    setEditError(null);
    setEditTouched({});
    setEditGeojson(null);
    setShowEdit(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setShowEdit(false);
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    if (!editing) return;
    setEditError(null);
    if (!editValid) {
      markAllTouched(editValidation, setEditTouched);
      setEditError('Please fix the highlighted fields.');
      const firstInvalid = ['name', 'latitude', 'longitude']
        .find((field) => editValidation[field]);
      document.getElementById(`muni-edit-${firstInvalid}`)?.focus();
      return;
    }

    const payload = {
      name: editForm.name,
      latitude: editForm.latitude,
      longitude: editForm.longitude,
      status: editForm.status,
    };
    if (editForm.barangays.length) payload.barangays = editForm.barangays;

    setSaving(true);
    try {
      const response = await updateAdminMunicipality(editing.id, payload);

      let uploadWarning = null;
      if (editGeojson) {
        try {
          await uploadAdminMunicipalityGeojson(editing.id, editGeojson);
        } catch (err) {
          uploadWarning = err.data?.errors?.join(' ') || err.message;
        }
      }

      setShowEdit(false);
      setEditing(null);
      await load();
      await refreshDirectory();
      const deactivated = response.deactivated_encoder_count || 0;
      const parts = [`${response.municipality?.name || editing.name} has been updated.`];
      if (deactivated) {
        parts.push(
          `${deactivated} linked encoder account${deactivated === 1 ? '' : 's'} ${deactivated === 1 ? 'was' : 'were'} deactivated.`,
        );
      }
      if (payload.status === 'active' && editing.status !== 'active') {
        parts.push('Linked encoder accounts stay inactive until re-enabled in User Management.');
      }
      if (uploadWarning) {
        toastError(`Saved, but the boundary was not uploaded: ${uploadWarning}`);
      } else {
        toastSuccess(parts.join(' '), 'Municipality saved');
      }
    } catch (err) {
      const message = err.data?.errors
        ? err.data.errors.join(' ')
        : (err.message || 'Could not save the municipality.');
      setEditError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (municipality) => {
    const nextStatus = municipality.status === 'active' ? 'inactive' : 'active';
    const deactivating = nextStatus === 'inactive';
    const encoderCount = municipality.encoder_count ?? (municipality.encoders || []).length;
    const encoderCopy = encoderCount
      ? ` Its ${encoderCount} linked encoder account${encoderCount === 1 ? '' : 's'} will also be deactivated.`
      : '';
    await confirmAction({
      title: deactivating
        ? `Deactivate ${municipality.name}?`
        : `Activate ${municipality.name}?`,
      text: deactivating
        ? `<strong>${municipality.name}</strong> will be hidden from public, analytics, forecast, and data-quality views.${encoderCopy}`
        : `<strong>${municipality.name}</strong> will be visible again. Linked encoder accounts are <strong>not</strong> reactivated automatically; re-enable them in User Management.`,
      confirmText: deactivating ? 'Deactivate' : 'Activate',
      danger: deactivating,
      onConfirm: async () => {
        setRowBusy({ id: municipality.id, action: nextStatus });
        try {
          const response = await updateAdminMunicipality(municipality.id, { status: nextStatus });
          await load();
          await refreshDirectory();
          const deactivated = response.deactivated_encoder_count || 0;
          toastSuccess(
            deactivating
              ? `${municipality.name} is now inactive.${deactivated ? ` ${deactivated} encoder account${deactivated === 1 ? '' : 's'} deactivated.` : ''}`
              : `${municipality.name} is now active. Linked encoder accounts were not reactivated.`,
            deactivating ? 'Municipality deactivated' : 'Municipality activated',
          );
        } finally {
          setRowBusy(null);
        }
      },
    });
  };

  const renameBarangay = async (barangay) => {
    if (!editing) return;
    const name = await promptText({
      title: `Rename ${barangay.name}`,
      inputValue: barangay.name,
      confirmText: 'Rename',
    });
    if (!name || name === barangay.name) return;

    try {
      const response = await renameAdminBarangay(barangay.id, name);
      const updated = response.barangay;
      setEditing((prev) => (prev ? {
        ...prev,
        barangays: prev.barangays.map((item) => (item.id === updated.id ? updated : item)),
      } : prev));
      await load();
      toastSuccess(`${barangay.name} was renamed to ${updated.name}.`, 'Barangay renamed');
    } catch (err) {
      const message = err.data?.errors?.join(' ') || err.message || 'Could not rename the barangay.';
      toastError(message);
    }
  };

  const removeBarangay = async (barangay) => {
    if (!editing) return;
    await confirmAction({
      title: `Delete ${barangay.name}?`,
      text: 'This removes the barangay permanently. Barangays that already have production records, reports, or producers cannot be deleted.',
      confirmText: 'Delete barangay',
      danger: true,
      icon: 'trash',
      onConfirm: async () => {
        await deleteAdminBarangay(barangay.id);
        setEditing((prev) => (prev ? {
          ...prev,
          barangays: prev.barangays.filter((item) => item.id !== barangay.id),
        } : prev));
        await load();
        toastSuccess(`${barangay.name} was deleted.`, 'Barangay deleted');
      },
    });
  };

  const removeBoundary = async () => {
    if (!editing) return;
    await confirmAction({
      title: 'Remove the uploaded boundary?',
      text: 'The stored GeoJSON file will be deleted. You can upload a new one at any time.',
      confirmText: 'Remove boundary',
      danger: true,
      icon: 'trash',
      onConfirm: async () => {
        const response = await deleteAdminMunicipalityGeojson(editing.id);
        const updated = response?.municipality;
        setEditing((prev) => (prev
          ? (updated || { ...prev, geojson_ref: null, has_boundary: false })
          : prev));
        await load();
        toastSuccess('The uploaded boundary was removed.', 'Boundary removed');
      },
    });
  };

  const deleteMunicipality = async (municipality) => {
    const encoderCount = municipality.encoder_count ?? (municipality.encoders || []).length;
    const encoderCopy = encoderCount
      ? `This also removes its ${encoderCount} encoder account${encoderCount === 1 ? '' : 's'}.`
      : 'No encoder account is linked.';
    const typed = await promptText({
      title: `Delete ${municipality.name}?`,
      text: `${encoderCopy} This action cannot be undone.`,
      inputPlaceholder: municipality.name,
      confirmText: 'Delete municipality',
      danger: true,
    });
    if (!typed) return;
    if (typed.toLowerCase() !== municipality.name.toLowerCase()) {
      toastError('The name did not match. Deletion cancelled.');
      return;
    }

    const finishDelete = async () => {
      await load();
      await refreshDirectory();
      toastSuccess(`${municipality.name} and all of its data were deleted.`, 'Municipality deleted');
    };

    setRowBusy({ id: municipality.id, action: 'delete' });
    try {
      try {
        await deleteAdminMunicipality(municipality.id, { confirm_name: typed });
        await finishDelete();
        return;
      } catch (err) {
        if (err.data?.code !== 'municipality_has_data') throw err;

        const force = await confirmAction({
          title: 'Delete all dependent data too?',
          text: `${err.message}<br /><br />This permanently deletes the municipality, its barangays, encoder accounts, production records, reports, forecasts, and producers.`,
          confirmText: 'Delete everything',
          danger: true,
          icon: 'trash',
        });
        if (!force) return;

        await deleteAdminMunicipality(municipality.id, { confirm_name: typed, force: true });
        await finishDelete();
      }
    } catch (err) {
      toastError(err.message || 'Could not delete the municipality.');
    } finally {
      setRowBusy(null);
    }
  };

  const credentialsEncoder = credentials?.encoder;
  const createdAccount = credentialsEncoder?.created
    ? credentialsEncoder.encoder
    : credentialsEncoder?.existing_encoder;

  const copyCredentials = async () => {
    const password = credentials?.encoder?.temporary_password;
    if (!password) return;
    const email = credentialsEncoder?.created
      ? credentialsEncoder.encoder?.email
      : credentialsEncoder?.existing_encoder?.email;
    try {
      await navigator.clipboard.writeText([email, password].filter(Boolean).join('\n'));
      setCopied(true);
      toastSuccess('Email and temporary password copied.', 'Copied');
    } catch (err) {
      toastError('Could not copy automatically. Select and copy the password manually.');
    }
  };

  return (
    <>
      <PageHeader
        id="admin-municipalities"
        variant="clean"
        className="ui-pageheader--admin"
        title="Municipality Management"
        subtitle="Add a municipality and its encoder account, maintain barangays, and control which municipalities appear in the dashboard."
        art={(
          <MunicipalityMapArt
            mode="province"
            activeNames={activeNames}
            selectedName={selectedMapName}
            onSelect={handleMapSelect}
            selectableNames={municipalities.map((municipality) => municipality.name)}
          />
        )}
      >
        <div className="muni-header-actions">
          <div className="admin-page-hero-control muni-header-status">
            <label className="admin-page-hero-field" htmlFor="muni-status-filter">Status</label>
            <select
              id="muni-status-filter"
              className="form-select admin-page-hero-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button type="button" className="ui-btn-primary" onClick={openCreate}>
            <Plus size={16} aria-hidden="true" />
            Add Municipality
          </button>
        </div>
      </PageHeader>

      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="muni-summary">
            <span className="muni-summary__item">
              <strong>{summary.total}</strong> total
            </span>
            <span className="muni-summary__item muni-summary__item--active">
              <strong>{summary.active}</strong> active
            </span>
            <span className="muni-summary__item">
              <strong>{summary.uploaded}</strong> with uploaded boundary
            </span>
            <span className="muni-summary__spacer" />
            <span className="text-muted small">
              Adding a municipality creates its encoder account automatically.
            </span>
          </div>

          {selectedMapName && (
            <div className="muni-map-selection" role="status">
              <span className="muni-map-selection__label">
                <MapPin size={15} aria-hidden="true" />
                Selected on map: <strong>{selectedMapName}</strong>
              </span>
              {selectedMapMatch ? (
                <button
                  type="button"
                  className="ui-btn-outline ui-btn--sm"
                  onClick={() => openEdit(selectedMapMatch)}
                >
                  <Pencil size={13} aria-hidden="true" />
                  Edit
                </button>
              ) : (
                <span className="text-muted small">
                  Not in the database yet. Use Add Municipality to create it.
                </span>
              )}
              <button
                type="button"
                className="muni-map-selection__clear"
                onClick={clearMapSelection}
                aria-label="Clear map selection"
                title="Clear map selection"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}

          {error && <Alert variant="danger">{error}</Alert>}
          {loading && <div className="text-center py-2"><SkeletonList rows={5} cols={6} /></div>}
          {!loading && visible.length === 0 && (
            <div className="muni-empty-state">
              <Building2 size={30} aria-hidden="true" />
              <p className="mb-2">
                {statusFilter
                  ? `No ${statusFilter} municipalities match the current filter.`
                  : 'No municipalities yet.'}
              </p>
              <div className="d-flex gap-2 justify-content-center">
                {statusFilter && (
                  <button type="button" className="ui-btn-outline ui-btn--sm" onClick={() => setStatusFilter('')}>
                    Clear filter
                  </button>
                )}
                <button type="button" className="ui-btn-primary ui-btn--sm" onClick={openCreate}>
                  <Plus size={14} aria-hidden="true" />
                  Add Municipality
                </button>
              </div>
            </div>
          )}
          {!loading && visible.length > 0 && (
            <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table muni-admin-table">
              <thead>
                <tr>
                  <th>Municipality</th>
                  <th>Status</th>
                  <th className="muni-col-secondary">Barangays</th>
                  <th className="muni-col-secondary">Encoder accounts</th>
                  <th className="muni-col-secondary">Records</th>
                  <th className="muni-col-secondary">Coordinates</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {pagedMunicipalities.map((municipality) => {
                  const activeEncoders = (municipality.encoders || []).filter((user) => user.status === 'active');
                  const pendingPassword = (municipality.encoders || []).some((user) => user.must_change_password);
                  const isMapSelected = Boolean(selectedMapName)
                    && normalizeMunicipalityName(selectedMapName) === normalizeMunicipalityName(municipality.name);
                  return (
                    <tr
                      key={municipality.id}
                      id={`muni-row-${municipality.id}`}
                      className={isMapSelected ? 'muni-row--selected' : undefined}
                    >
                      <td>
                        <div className="fw-semibold">{municipality.name}</div>
                        <BoundaryChip municipality={municipality} />
                        {municipality.has_boundary && municipality.geojson_ref && (
                          <div className="text-muted small muni-boundary-ref">{municipality.geojson_ref}</div>
                        )}
                      </td>
                      <td>
                        <span className={`muni-status-badge muni-status-badge--${municipality.status}`}>
                          {municipality.status}
                        </span>
                      </td>
                      <td className="muni-col-secondary">
                        <span title={(municipality.barangays || []).map((barangay) => barangay.name).join(', ')}>
                          {municipality.barangays?.length || 0}
                        </span>
                      </td>
                      <td className="muni-col-secondary">
                        <div>
                          {activeEncoders.length} active / {municipality.encoder_count || 0}
                        </div>
                        {(municipality.encoders || []).length > 0 && (
                          <div className="text-muted small" title={(municipality.encoders || []).map((user) => user.email).join(', ')}>
                            {(municipality.encoders || []).map((user) => user.email).join(', ')}
                          </div>
                        )}
                        {pendingPassword && (
                          <div className="text-warning small">
                            <KeyRound size={12} aria-hidden="true" /> Temporary password pending
                          </div>
                        )}
                      </td>
                      <td className="muni-col-secondary">{municipality.record_count || 0}</td>
                      <td className="muni-col-secondary text-nowrap small">
                        <span className="muni-coord">
                          <MapPin size={11} aria-hidden="true" />
                          {formatCoord(municipality.latitude)}, {formatCoord(municipality.longitude)}
                        </span>
                      </td>
                      <td className="muni-actions-cell">
                        <div
                          className="muni-row-actions"
                          role="group"
                          aria-label={`Actions for ${municipality.name}`}
                        >
                          <MuniActionButton
                            icon={Pencil}
                            label={`Edit municipality ${municipality.name}`}
                            tone="edit"
                            onClick={() => openEdit(municipality)}
                            disabled={rowBusy?.id === municipality.id}
                          />
                          <MuniActionButton
                            icon={Power}
                            label={municipality.status === 'active'
                              ? `Deactivate ${municipality.name}`
                              : `Activate ${municipality.name}`}
                            tone={municipality.status === 'active' ? 'deactivate' : 'activate'}
                            onClick={() => toggleStatus(municipality)}
                            disabled={rowBusy?.id === municipality.id}
                            loading={rowBusy?.id === municipality.id
                              && rowBusy.action === (municipality.status === 'active' ? 'inactive' : 'active')}
                          />
                          <span className="muni-row-actions__sep" aria-hidden="true" />
                          <MuniActionButton
                            icon={Trash2}
                            label={`Delete municipality ${municipality.name}`}
                            tone="delete"
                            onClick={() => deleteMunicipality(municipality)}
                            disabled={rowBusy?.id === municipality.id}
                            loading={rowBusy?.id === municipality.id && rowBusy.action === 'delete'}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          {!loading && visible.length > 0 && (
            <div className="px-3 pb-3">
              <TablePagination
                page={pager.page}
                pages={pager.pages}
                total={visible.length}
                perPage={pager.perPage}
                onPageChange={pager.goToPage}
                onPerPageChange={pager.changePerPage}
                itemLabel="municipalities"
              />
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal
        show={showCreate}
        onHide={closeCreate}
        centered
        size="lg"
        scrollable
        dialogClassName="muni-modal"
        aria-labelledby="muni-create-title"
        onEntered={() => createNameRef.current?.focus()}
      >
        <MuniModalHeader
          titleId="muni-create-title"
          title="Add Municipality"
          subtitle="Create the municipality record and its encoder account. Required fields are marked with an asterisk."
        />
        <Form onSubmit={handleCreate} noValidate className="muni-modal-form">
          <Modal.Body>
            {createError && <Alert variant="danger">{createError}</Alert>}

            <FormSection
              title="Identity"
              hint="The encoder email and GeoJSON reference are derived from this name."
            >
              <Form.Group>
                <Form.Label htmlFor="muni-create-name">
                  Municipality name <span className="muni-required" aria-hidden="true">*</span>
                </Form.Label>
                <Form.Control
                  id="muni-create-name"
                  ref={createNameRef}
                  autoFocus
                  value={createForm.name}
                  onChange={(event) => updateCreateField('name', event.target.value)}
                  onBlur={() => markCreateTouched('name')}
                  maxLength={100}
                  placeholder="e.g. San Fabian or Alaminos City"
                  isInvalid={Boolean(createErrors.name)}
                  aria-required="true"
                  aria-invalid={Boolean(createErrors.name)}
                  aria-describedby={`muni-create-name-help${createErrors.name ? ' muni-create-name-error' : ''}`}
                />
                <FieldError id="muni-create-name-error">{createErrors.name}</FieldError>
                <Form.Text id="muni-create-name-help" className="text-muted">
                  Letters, digits, spaces, periods, hyphens, and apostrophes. Leading “City of ”
                  and trailing “ City” are ignored in the slug.
                </Form.Text>
              </Form.Group>

              <div className={`muni-email-preview${createEmailPreview ? '' : ' muni-email-preview--empty'}`}>
                <span className="muni-email-preview__label">
                  <KeyRound size={13} aria-hidden="true" />
                  Encoder email preview
                </span>
                <code>{createEmailPreview || 'Add a name with letters or digits'}</code>
                <span className="muni-email-preview__hint">
                  Created automatically when you save. The temporary password is shown once.
                </span>
              </div>

              <Form.Group className="mt-3">
                <div className="form-label">Status</div>
                <StatusToggle
                  value={createForm.status}
                  onChange={(value) => updateCreateField('status', value)}
                  describedBy="muni-create-status-help"
                />
                <Form.Text id="muni-create-status-help" className="text-muted d-block mt-1">
                  Inactive municipalities are hidden from public views; linked encoders are
                  deactivated.
                </Form.Text>
              </Form.Group>
            </FormSection>

            <FormSection
              title="Location"
              hint="Required. Type coordinates or click the map; the pin returns 6-decimal values."
            >
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label htmlFor="muni-create-latitude">
                      Latitude <span className="muni-required" aria-hidden="true">*</span>
                    </Form.Label>
                    <Form.Control
                      id="muni-create-latitude"
                      type="number"
                      inputMode="decimal"
                      step="0.000001"
                      min={-90}
                      max={90}
                      value={createForm.latitude}
                      onChange={(event) => updateCreateField('latitude', event.target.value)}
                      onBlur={() => markCreateTouched('latitude')}
                      isInvalid={Boolean(createErrors.latitude)}
                      aria-required="true"
                      aria-invalid={Boolean(createErrors.latitude)}
                      aria-describedby={`muni-create-latitude-help${createErrors.latitude ? ' muni-create-latitude-error' : ''}`}
                    />
                    <FieldError id="muni-create-latitude-error">{createErrors.latitude}</FieldError>
                    <Form.Text id="muni-create-latitude-help" className="text-muted">
                      −90 to 90, up to 6 decimal places.
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label htmlFor="muni-create-longitude">
                      Longitude <span className="muni-required" aria-hidden="true">*</span>
                    </Form.Label>
                    <Form.Control
                      id="muni-create-longitude"
                      type="number"
                      inputMode="decimal"
                      step="0.000001"
                      min={-180}
                      max={180}
                      value={createForm.longitude}
                      onChange={(event) => updateCreateField('longitude', event.target.value)}
                      onBlur={() => markCreateTouched('longitude')}
                      isInvalid={Boolean(createErrors.longitude)}
                      aria-required="true"
                      aria-invalid={Boolean(createErrors.longitude)}
                      aria-describedby={`muni-create-longitude-help${createErrors.longitude ? ' muni-create-longitude-error' : ''}`}
                    />
                    <FieldError id="muni-create-longitude-error">{createErrors.longitude}</FieldError>
                    <Form.Text id="muni-create-longitude-help" className="text-muted">
                      −180 to 180, up to 6 decimal places.
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <div className="mt-3">
                <LocationPicker
                  height={260}
                  latitude={createForm.latitude}
                  longitude={createForm.longitude}
                  onChange={(latitude, longitude) => setCreateForm((prev) => ({
                    ...prev,
                    latitude: String(latitude),
                    longitude: String(longitude),
                  }))}
                />
              </div>

              {createWarning && (
                <div className="muni-form-warning" role="status">
                  <AlertTriangle size={14} aria-hidden="true" />
                  {createWarning}
                </div>
              )}
            </FormSection>

            <FormSection
              title="Barangays"
              hint="Optional, up to 100. Names are de-duplicated case-insensitively."
            >
              <BarangayTagInput
                value={createForm.barangays}
                onChange={(names) => setCreateForm((prev) => ({ ...prev, barangays: names }))}
                max={100}
                placeholder="Type a barangay name and press Enter"
              />
              <div className="text-muted small mt-2">
                A municipality can be created with zero barangays and no production data.
              </div>
            </FormSection>

            <FormSection
              title="Boundary"
              hint="Optional GeoJSON Polygon or MultiPolygon, up to 5 MB."
            >
              <Form.Control
                type="file"
                accept=".json,.geojson,application/json,application/geo+json"
                onChange={(event) => setCreateGeojson(event.target.files?.[0] || null)}
              />
              <Form.Text className="text-muted">
                Stored as <code>geojson/&lt;slug&gt;.json</code>.
                {' '}
                {createGeojson ? `Selected: ${createGeojson.name}` : 'No file selected.'}
              </Form.Text>
            </FormSection>
          </Modal.Body>
          <Modal.Footer className="muni-modal__footer">
            <span className={`muni-modal__footer-note${createValid ? ' is-ready' : ''}`}>
              {createValid
                ? 'Ready to save.'
                : 'Complete the required fields to enable saving.'}
            </span>
            <div className="muni-modal__footer-actions">
              <button type="button" className="ui-btn-outline" onClick={closeCreate} disabled={saving}>Cancel</button>
              <button
                type="submit"
                className="ui-btn-primary"
                disabled={saving || !createValid}
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="muni-spin" aria-hidden="true" />
                    Adding…
                  </>
                ) : (
                  <>
                    <Plus size={15} aria-hidden="true" />
                    Add Municipality
                  </>
                )}
              </button>
            </div>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={showEdit}
        onHide={closeEdit}
        centered
        size="lg"
        scrollable
        dialogClassName="muni-modal"
        aria-labelledby="muni-edit-title"
        onEntered={() => editNameRef.current?.focus()}
      >
        <MuniModalHeader
          titleId="muni-edit-title"
          title={`Edit ${editing?.name || 'municipality'}`}
          subtitle="Update identity, location, and barangays. Every change is recorded in the audit log."
        />
        <Form onSubmit={handleEdit} noValidate className="muni-modal-form">
          <Modal.Body>
            {editError && <Alert variant="danger">{editError}</Alert>}

            <FormSection
              title="Identity"
              hint="Renaming does not change the existing encoder email or display name."
            >
              <Form.Group>
                <Form.Label htmlFor="muni-edit-name">
                  Municipality name <span className="muni-required" aria-hidden="true">*</span>
                </Form.Label>
                <Form.Control
                  id="muni-edit-name"
                  ref={editNameRef}
                  autoFocus
                  value={editForm.name}
                  onChange={(event) => updateEditField('name', event.target.value)}
                  onBlur={() => markEditTouched('name')}
                  maxLength={100}
                  isInvalid={Boolean(editErrors.name)}
                  aria-required="true"
                  aria-invalid={Boolean(editErrors.name)}
                  aria-describedby={`muni-edit-name-help${editErrors.name ? ' muni-edit-name-error' : ''}`}
                />
                <FieldError id="muni-edit-name-error">{editErrors.name}</FieldError>
                <Form.Text id="muni-edit-name-help" className="text-muted">
                  Letters, digits, spaces, periods, hyphens, and apostrophes. Names are unique.
                </Form.Text>
              </Form.Group>

              <div className="muni-email-preview">
                <span className="muni-email-preview__label">
                  <KeyRound size={13} aria-hidden="true" />
                  Linked encoder email{((editing?.encoders || []).length > 1) ? 's' : ''}
                </span>
                {encoderEmailList(editing)}
                <span className="muni-email-preview__hint">
                  This address is intentionally unchanged when the municipality is renamed.
                </span>
              </div>

              <Form.Group className="mt-3">
                <div className="form-label">Status</div>
                <StatusToggle
                  value={editForm.status}
                  onChange={(value) => updateEditField('status', value)}
                  describedBy="muni-edit-status-help"
                />
                <Form.Text
                  id="muni-edit-status-help"
                  className={editStatusClassName(editForm, editing)}
                >
                  {editStatusMessage(editForm, editing)}
                </Form.Text>
              </Form.Group>
            </FormSection>

            <FormSection
              title="Location"
              hint="Required. Type coordinates or click the map; the pin returns 6-decimal values."
            >
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label htmlFor="muni-edit-latitude">
                      Latitude <span className="muni-required" aria-hidden="true">*</span>
                    </Form.Label>
                    <Form.Control
                      id="muni-edit-latitude"
                      type="number"
                      inputMode="decimal"
                      step="0.000001"
                      min={-90}
                      max={90}
                      value={editForm.latitude}
                      onChange={(event) => updateEditField('latitude', event.target.value)}
                      onBlur={() => markEditTouched('latitude')}
                      isInvalid={Boolean(editErrors.latitude)}
                      aria-required="true"
                      aria-invalid={Boolean(editErrors.latitude)}
                      aria-describedby={`muni-edit-latitude-help${editErrors.latitude ? ' muni-edit-latitude-error' : ''}`}
                    />
                    <FieldError id="muni-edit-latitude-error">{editErrors.latitude}</FieldError>
                    <Form.Text id="muni-edit-latitude-help" className="text-muted">
                      −90 to 90, up to 6 decimal places.
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label htmlFor="muni-edit-longitude">
                      Longitude <span className="muni-required" aria-hidden="true">*</span>
                    </Form.Label>
                    <Form.Control
                      id="muni-edit-longitude"
                      type="number"
                      inputMode="decimal"
                      step="0.000001"
                      min={-180}
                      max={180}
                      value={editForm.longitude}
                      onChange={(event) => updateEditField('longitude', event.target.value)}
                      onBlur={() => markEditTouched('longitude')}
                      isInvalid={Boolean(editErrors.longitude)}
                      aria-required="true"
                      aria-invalid={Boolean(editErrors.longitude)}
                      aria-describedby={`muni-edit-longitude-help${editErrors.longitude ? ' muni-edit-longitude-error' : ''}`}
                    />
                    <FieldError id="muni-edit-longitude-error">{editErrors.longitude}</FieldError>
                    <Form.Text id="muni-edit-longitude-help" className="text-muted">
                      −180 to 180, up to 6 decimal places.
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <div className="mt-3">
                <LocationPicker
                  height={260}
                  latitude={editForm.latitude}
                  longitude={editForm.longitude}
                  onChange={(latitude, longitude) => setEditForm((prev) => ({
                    ...prev,
                    latitude: String(latitude),
                    longitude: String(longitude),
                  }))}
                />
              </div>

              {editWarning && (
                <div className="muni-form-warning" role="status">
                  <AlertTriangle size={14} aria-hidden="true" />
                  {editWarning}
                </div>
              )}
            </FormSection>

            <FormSection
              title="Barangays"
              hint="Existing names can be renamed or deleted individually. New names are add-only."
            >
              <Form.Label className="mb-1">
                Current barangays ({(editing?.barangays || []).length})
              </Form.Label>
              <div className="muni-barangay-chips">
                {(editing?.barangays || []).length === 0 && <span className="text-muted small">None</span>}
                {(editing?.barangays || []).map((barangay) => (
                  <span key={barangay.id} className="muni-barangay-chip muni-barangay-chip--editable">
                    <span>{barangay.name}</span>
                    <button
                      type="button"
                      className="muni-barangay-chip__action"
                      onClick={() => renameBarangay(barangay)}
                      title={`Rename ${barangay.name}`}
                      aria-label={`Rename ${barangay.name}`}
                    >
                      <Pencil size={12} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="muni-barangay-chip__action muni-barangay-chip__action--danger"
                      onClick={() => removeBarangay(barangay)}
                      title={`Delete ${barangay.name}`}
                      aria-label={`Delete ${barangay.name}`}
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>

              <Form.Label className="mt-3 mb-1">Add barangays</Form.Label>
              <BarangayTagInput
                value={editForm.barangays}
                onChange={(names) => setEditForm((prev) => ({ ...prev, barangays: names }))}
                existingNames={(editing?.barangays || []).map((barangay) => barangay.name)}
                max={100}
                placeholder="Type a new barangay name and press Enter"
              />
              {editForm.barangays.length > 0 && (
                <div className="text-muted small mt-2">
                  {editForm.barangays.length} new barangay
                  {editForm.barangays.length === 1 ? '' : 's'} will be added when you save.
                </div>
              )}
            </FormSection>

            <FormSection
              title="Boundary"
              hint="The uploaded file overrides the bundled boundary. Remove it to fall back to the bundled shape."
            >
              <div className="muni-boundary-file">
                <div className="muni-boundary-file__status">
                  <BoundaryChip municipality={editing || { name: editForm.name }} />
                  <code>
                    {boundaryFileRef(editing)}
                  </code>
                </div>
                {editing?.has_boundary && (
                  <button type="button" className="ui-btn-outline ui-btn--sm" onClick={removeBoundary}>
                    <Trash2 size={13} aria-hidden="true" />
                    Remove
                  </button>
                )}
              </div>

              <BoundaryPreview name={editForm.name} hasUploaded={Boolean(editing?.has_boundary)} />

              <Form.Control
                className="mt-2"
                type="file"
                accept=".json,.geojson,application/json,application/geo+json"
                onChange={(event) => setEditGeojson(event.target.files?.[0] || null)}
              />
              <Form.Text className="text-muted">
                Upload a Polygon or MultiPolygon GeoJSON (up to 5 MB) to replace the stored boundary.
                {' '}
                {editGeojson ? `Selected: ${editGeojson.name}` : 'No new file selected.'}
              </Form.Text>
            </FormSection>

            {(editing?.encoders || []).length > 0 && (
              <FormSection title="Encoder accounts" hint="Status is managed in User Management.">
                <ul className="muni-encoder-list">
                  {(editing.encoders || []).map((encoder) => (
                    <li key={encoder.id}>
                      <span>{encoder.email}</span>
                      <span className={`muni-status-badge muni-status-badge--${encoder.status}`}>
                        {encoder.status}
                      </span>
                      {encoder.must_change_password && (
                        <span className="text-warning small">temporary password pending</span>
                      )}
                    </li>
                  ))}
                </ul>
              </FormSection>
            )}
          </Modal.Body>
          <Modal.Footer className="muni-modal__footer">
            <span className={`muni-modal__footer-note${editValid ? ' is-ready' : ''}`}>
              {editValid
                ? 'Ready to save.'
                : 'Fix the highlighted fields to enable saving.'}
            </span>
            <div className="muni-modal__footer-actions">
              <button type="button" className="ui-btn-outline" onClick={closeEdit} disabled={saving}>Cancel</button>
              <button
                type="submit"
                className="ui-btn-primary"
                disabled={saving || !editValid}
              >
                {saveButtonContent(saving)}
              </button>
            </div>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={showCredentials}
        onHide={() => setShowCredentials(false)}
        centered
        dialogClassName="muni-modal muni-credentials-modal"
        aria-labelledby="muni-credentials-title"
      >
        <MuniModalHeader
          titleId="muni-credentials-title"
          title={credentialsEncoder?.created ? 'Encoder account created' : 'Existing encoder account'}
          subtitle={`${credentials?.municipalityName || 'The municipality'} was added successfully.`}
        />
        <Modal.Body>
          {credentialsEncoder?.created ? (
            <>
              <Alert variant="warning" className="mb-3" role="alert">
                This temporary password is shown <strong>once</strong>. Copy it now and hand it to the
                encoder. They must replace it on first sign-in.
              </Alert>
              <div className="muni-credentials-box">
                <div className="muni-credentials-label">Email</div>
                <div className="muni-credentials-value">{createdAccount?.email}</div>
              </div>
              <div className="muni-credentials-box">
                <div className="muni-credentials-label">Temporary password</div>
                <div className="muni-credentials-value muni-credentials-code">
                  {credentialsEncoder.temporary_password}
                </div>
                <button type="button" className="ui-btn-outline ui-btn--sm mt-2" onClick={copyCredentials}>
                  <Copy size={14} aria-hidden="true" />
                  {copied ? 'Copied' : 'Copy credentials'}
                </button>
              </div>
            </>
          ) : (
            <>
              <Alert variant="info">
                An active encoder account already exists for this municipality, so no new account
                was created. Its existing password is unchanged and cannot be displayed here.
              </Alert>
              <div className="muni-credentials-box">
                <div className="muni-credentials-label">Email</div>
                <div className="muni-credentials-value">{createdAccount?.email}</div>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="muni-modal__footer">
          <span className="muni-modal__footer-note">
            Store the password in a secure place before closing.
          </span>
          <div className="muni-modal__footer-actions">
            <button type="button" className="ui-btn-primary" onClick={() => setShowCredentials(false)}>Done</button>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
}
