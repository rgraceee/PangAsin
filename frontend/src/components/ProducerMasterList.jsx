import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Pencil, Plus, Trash2, Users, ContactRound, CalendarDays } from 'lucide-react';
import { createProducer, deleteProducer, getProducers, updateProducer } from '../services/dataService';
import { confirmDelete } from '../services/feedback';
import { useToast } from './Toast';
import KpiCard from './ui/KpiCard';
import KpiGrid from './ui/KpiGrid';
import PageHeader from './admin/PageHeader';
import MunicipalityMapArt from './encoder/MunicipalityMapArt';
import IconButton from './IconButton';

const EMPTY_FORM = { name: '', age: '', sex: '', address: '', barangay_id: '' };

export default function ProducerMasterList({ user, isAdmin = false }) {
  const outlet = useOutletContext();
  const activeUser = user || outlet?.user;
  const adminView = isAdmin || activeUser?.role === 'admin';
  const { toastSuccess, toastError } = useToast();
  const [filters, setFilters] = useState({ municipality_id: '', barangay_id: '', q: '' });
  const [rows, setRows] = useState([]);
  const [statistics, setStatistics] = useState({ total: 0, male: 0, female: 0, other: 0, average_age: null, by_barangay: [] });
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (adminView && filters.municipality_id) params.municipality_id = filters.municipality_id;
    if (filters.barangay_id) params.barangay_id = filters.barangay_id;
    if (filters.q.trim()) params.q = filters.q.trim();
    getProducers(params)
      .then((result) => {
        setRows(result.producers || []);
        setStatistics(result.statistics || { total: 0, male: 0, female: 0, other: 0, average_age: null, by_barangay: [] });
        setMunicipalities(result.municipalities || []);
        setBarangays(result.barangays || []);
      })
      .catch((err) => setError(err.message || 'Could not load the worker master list.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters.municipality_id, filters.barangay_id, filters.q, adminView]);

  const handleAdd = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        age: form.age === '' ? null : Number(form.age),
        barangay_id: Number(form.barangay_id),
      };
      if (editing) await updateProducer(editing.id, payload);
      else await createProducer(payload);
      setShowAdd(false);
      setForm(EMPTY_FORM);
      setEditing(null);
      toastSuccess(editing ? 'Worker details updated.' : 'Worker added to the master list.', editing ? 'Worker updated' : 'Worker added');
      load();
    } catch (err) {
      const message = err.data?.errors?.join(' ') || err.message || 'Could not add this worker.';
      setError(message);
      toastError(message, 'Could not add worker');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (worker) => {
    setEditing(worker);
    setForm({
      name: worker.name,
      age: worker.age == null ? '' : String(worker.age),
      sex: worker.sex,
      address: worker.address,
      barangay_id: String(worker.barangay_id),
    });
    setError('');
    setShowAdd(true);
  };

  const removeWorker = async (worker) => {
    const confirmed = await confirmDelete({
      title: 'Delete this worker?',
      text: `Remove <strong>${worker.name}</strong> from the master list? Producer report history will remain unchanged.`,
      confirmText: 'Delete worker',
    });
    if (!confirmed) return;
    try {
      await deleteProducer(worker.id);
      toastSuccess(`${worker.name} was removed from the master list.`, 'Worker deleted');
      load();
    } catch (err) {
      const message = err.message || 'Could not delete this worker.';
      setError(message);
      toastError(message, 'Could not delete worker');
    }
  };

  const updateFilter = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value, ...(name === 'municipality_id' ? { barangay_id: '' } : {}) }));
  };

  return (
    <>
      {/* WHAT: Parehos na clean header sa encoder, sub hero pa rin sa admin.
         WHY: bawal magbago ang admin markup; encoder gets the token-based look. */}
      <PageHeader
        id="producer-master-list"
        variant={adminView ? 'sub' : 'clean'}
        title="Master List"
        subtitle={adminView ? 'Registered workers across Pangasinan, organized by municipality and barangay.' : `Registered workers in ${activeUser?.municipality_name || 'your municipality'}.`}
        art={adminView ? undefined : <MunicipalityMapArt highlightName={activeUser?.municipality_name} />}
        compact={!adminView}
        action={<Button type="button" onClick={() => { setEditing(null); setForm(EMPTY_FORM); setError(''); setShowAdd(true); }}><Plus size={16} className="me-1" />Add Worker</Button>}
      >
        {adminView && (
          <div className="admin-page-hero-control">
            <label className="admin-page-hero-field" htmlFor="master-municipality">Municipality</label>
            <select id="master-municipality" className="form-select admin-page-hero-select" name="municipality_id" value={filters.municipality_id} onChange={updateFilter}>
              <option value="">All municipalities</option>
              {municipalities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        )}
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="master-barangay">Barangay</label>
          <select id="master-barangay" className="form-select admin-page-hero-select" name="barangay_id" value={filters.barangay_id} onChange={updateFilter}>
            <option value="">All barangays</option>
            {barangays.map((item) => <option key={item.id} value={item.id}>{item.name}{adminView ? ` · ${item.municipality}` : ''}</option>)}
          </select>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="master-search">Search workers</label>
          <input id="master-search" className="form-control admin-page-hero-input" name="q" value={filters.q} onChange={updateFilter} placeholder="Name or address" />
        </div>
      </PageHeader>

      {error && !showAdd && <Alert variant="danger">{error}</Alert>}
      <KpiGrid columns={4}>
        <KpiCard icon={Users} title="Registered workers" value={statistics.total} accent="ocean" />
        <KpiCard icon={ContactRound} title="Women" value={statistics.female} accent="green" />
        <KpiCard icon={ContactRound} title="Men" value={statistics.male} accent="gold" />
        <KpiCard
          icon={CalendarDays}
          title="Average age"
          value={statistics.average_age == null ? '—' : statistics.average_age}
          supporting={`Other sex: ${statistics.other.toLocaleString()} worker${statistics.other === 1 ? '' : 's'}`}
          accent="brown"
        />
      </KpiGrid>

      <Card className="encoder-card admin-card">
        <Card.Header className="d-flex align-items-center justify-content-between">
          <h2 className="h6 mb-0"><Users size={16} className="me-2" />Workers</h2>
          <Badge bg="light" text="dark">{rows.length.toLocaleString()} shown</Badge>
        </Card.Header>
        <Card.Body className="p-0">
          {loading ? <div className="text-center py-5"><Spinner animation="border" size="sm" /></div> : rows.length === 0 ? (
            <div className="chart-empty py-5">No workers match the current filters.</div>
          ) : (
            <Table responsive hover className="mb-0 encoder-table admin-table">
              <thead><tr><th>Name</th><th>Age</th><th>Sex</th><th>Municipality</th><th>Barangay</th><th>Address</th><th aria-label="Actions" /></tr></thead>
              <tbody>{rows.map((worker) => (
                <tr key={worker.id}>
                  <td className="fw-semibold">{worker.name}</td>
                  <td>{worker.age == null ? worker.age_bracket || '—' : worker.age}</td>
                  <td>{worker.sex}</td>
                  <td>{worker.municipality}</td>
                  <td>{worker.barangay}</td>
                  <td>{worker.address}</td>
                  <td className="text-nowrap">
                    <IconButton icon={Pencil} label={`Edit ${worker.name}`} variant="outline-primary" onClick={() => openEdit(worker)} />
                    <IconButton icon={Trash2} label={`Delete ${worker.name}`} variant="outline-danger" onClick={() => removeWorker(worker)} />
                  </td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Card className="encoder-card admin-card mt-4">
        <Card.Header><h2 className="h6 mb-0">Workers by barangay</h2></Card.Header>
        <Card.Body className="p-0">
          {statistics.by_barangay.length === 0 ? (
            <div className="chart-empty py-4">No worker counts to show.</div>
          ) : (
            <Table responsive hover size="sm" className="mb-0 encoder-table admin-table">
              <thead><tr>{adminView && <th>Municipality</th>}<th>Barangay</th><th className="text-end">Workers</th></tr></thead>
              <tbody>{statistics.by_barangay.map((item) => (
                <tr key={`${item.municipality}-${item.barangay}`}>
                  {adminView && <td>{item.municipality}</td>}
                  <td>{item.barangay}</td>
                  <td className="text-end">{item.total.toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Modal show={showAdd} onHide={() => { setShowAdd(false); setEditing(null); }} centered>
        <Form onSubmit={handleAdd}>
          <Modal.Header closeButton><Modal.Title>{editing ? 'Edit Worker' : 'Add Worker'}</Modal.Title></Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Barangay</Form.Label>
              <Form.Select required value={form.barangay_id} onChange={(event) => setForm((current) => ({ ...current, barangay_id: event.target.value }))}>
                <option value="">Select barangay</option>
                {barangays.map((item) => <option key={item.id} value={item.id}>{item.name}{adminView ? ` · ${item.municipality}` : ''}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Full name</Form.Label>
              <Form.Control required maxLength={150} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </Form.Group>
            <Row className="g-3">
              <Col sm={6}><Form.Group className="mb-3"><Form.Label>Age</Form.Label><Form.Control type="number" min="0" max="120" step="1" required={editing ? editing.age != null : true} value={form.age} onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))} /></Form.Group></Col>
              <Col sm={6}><Form.Group className="mb-3"><Form.Label>Sex</Form.Label><Form.Select required value={form.sex} onChange={(event) => setForm((current) => ({ ...current, sex: event.target.value }))}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></Form.Select></Form.Group></Col>
            </Row>
            <Form.Group><Form.Label>Address</Form.Label><Form.Control required maxLength={255} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /></Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="outline-secondary" onClick={() => { setShowAdd(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add worker'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}