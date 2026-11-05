import { useEffect } from 'react';

export default function usePageTitle(title) {
  useEffect(() => {
    if (!title) {
      document.title = 'PangAsin';
      return;
    }
    document.title = `${title} | PangAsin`;
  }, [title]);
}
