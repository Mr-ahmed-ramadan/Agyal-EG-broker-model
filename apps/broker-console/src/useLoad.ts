import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Loads a GET endpoint and exposes a reload function. */
export function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    api<T>('GET', path)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [path]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}

export const egp = (v: string | number) =>
  new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(Number(v));

export const when = (v: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(v));
