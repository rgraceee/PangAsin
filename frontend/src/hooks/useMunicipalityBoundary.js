// WHAT: Custom hook para sa automatic boundary retrieval sa Add Municipality modal.
// WHY: Ang boundary ay na-retrieve mula sa bundled GeoJSON kapag napili ang
//      munisipyo, may AbortController para sa stale request handling, at may
//      loading/error/unavailable states.
import { useCallback, useRef, useState } from 'react';
import {
  findMunicipalityBoundary,
  boundaryToCoordinates,
  boundaryToBounds,
} from '../utils/boundaryUtils';

export const BOUNDARY_STATUS_IDLE = 'idle';
export const BOUNDARY_STATUS_RETRIEVING = 'retrieving';
export const BOUNDARY_STATUS_SUCCESS = 'success';
export const BOUNDARY_STATUS_UNAVAILABLE = 'unavailable';
export const BOUNDARY_STATUS_ERROR = 'error';

export function useMunicipalityBoundary() {
  const [status, setStatus] = useState(BOUNDARY_STATUS_IDLE);
  const [boundary, setBoundary] = useState(null);
  const [coordinates, setCoordinates] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const abortRef = useRef(null);

  const retrieve = useCallback((name) => {
    // Cancel any in-flight request from a previous selection.
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    if (!name || !name.trim()) {
      setStatus(BOUNDARY_STATUS_IDLE);
      setBoundary(null);
      setCoordinates(null);
      setBounds(null);
      setErrorMessage('');
      return;
    }

    setStatus(BOUNDARY_STATUS_RETRIEVING);
    setErrorMessage('');

    // Synchronous lookup from bundled data (no network needed).
    setTimeout(() => {
      if (controller.signal.aborted) return;

      const found = findMunicipalityBoundary(name);
      if (!found) {
        setStatus(BOUNDARY_STATUS_UNAVAILABLE);
        setBoundary(null);
        setCoordinates(null);
        setBounds(null);
        setErrorMessage(
          'Boundary data unavailable. This municipality has no bundled boundary data.',
        );
        return;
      }

      const coords = boundaryToCoordinates(found);
      const bnds = boundaryToBounds(found);

      if (!coords) {
        setStatus(BOUNDARY_STATUS_ERROR);
        setBoundary(found);
        setBounds(null);
        setErrorMessage(
          'Unable to retrieve boundary. The boundary geometry is invalid.',
        );
        return;
      }

      setStatus(BOUNDARY_STATUS_SUCCESS);
      setBoundary(found);
      setCoordinates(coords);
      setBounds(bnds);
      setErrorMessage('');
    }, 0);
  }, []);

  const clear = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setStatus(BOUNDARY_STATUS_IDLE);
    setBoundary(null);
    setCoordinates(null);
    setBounds(null);
    setErrorMessage('');
  }, []);

  return {
    status,
    boundary,
    coordinates,
    bounds,
    errorMessage,
    retrieve,
    clear,
    isLoading: status === BOUNDARY_STATUS_RETRIEVING,
    hasBoundary: status === BOUNDARY_STATUS_SUCCESS,
    hasError: status === BOUNDARY_STATUS_UNAVAILABLE || status === BOUNDARY_STATUS_ERROR,
  };
}
