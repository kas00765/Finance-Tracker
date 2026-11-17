import { useEffect, useState } from 'react';

// The key includes every input used by load. Ignore responses after the key
// changes or the component unmounts, and never show data under a different key.
export function useResource(key, load) {
  const [revision, setRevision] = useState(0);
  const requestKey = `${key}:${revision}`;
  const [state, setState] = useState({ key: null, data: null, error: '' });
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(load)
      .then(
        (data) => {
          if (active) setState({ key: requestKey, data, error: '' });
        },
        (error) => {
          if (active) setState({ key: requestKey, data: null, error: error.message });
        },
      );
    return () => {
      active = false;
    };
  }, [requestKey]);
  return {
    data: state.key === requestKey ? state.data : null,
    error: state.key === requestKey ? state.error : '',
    loading: state.key !== requestKey,
    reload: () => setRevision((value) => value + 1),
  };
}
