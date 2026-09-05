import { useEffect } from 'react';

export default function usePageTitle(title, { prefix = 'PangAsin — ' } = {}) {
  useEffect(() => {
    document.title = title ? `${prefix}${title}` : 'PangAsin';
  }, [title, prefix]);
}