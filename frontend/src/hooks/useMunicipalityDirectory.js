// WHAT: Shared hook for the database-managed active municipality directory.
// WHY: Filters, counts, labels and map highlights must all read one list, so
//      this hook wraps the cached public endpoint and exposes the same shapes
//      to every page.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getPublicMunicipalities,
  invalidateMunicipalityDirectory,
} from '../services/dataService';

export default function useMunicipalityDirectory() {
  const [municipalities, setMunicipalities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ force = false } = {}) => {
    setLoading(true);
    try {
      const data = await getPublicMunicipalities({ force });
      setMunicipalities(Array.isArray(data.municipalities) ? data.municipalities : []);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    invalidateMunicipalityDirectory();
    return load({ force: true });
  }, [load]);

  const activeNames = useMemo(
    () => municipalities.map((m) => m.name).filter(Boolean),
    [municipalities],
  );

  return {
    municipalities,
    activeNames,
    count: activeNames.length,
    loading,
    error,
    refresh,
  };
}
