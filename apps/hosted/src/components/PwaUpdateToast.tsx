import { useEffect, useRef, useState } from 'react';
import { applyUpdate, subscribeToPendingUpdate } from '../pwaUpdate';
import classes from './PwaUpdateToast.module.css';

const RELOAD_DELAY_MS = 3000;

export function PwaUpdateToast() {
  const [visible, setVisible] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    return subscribeToPendingUpdate(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      setVisible(true);
      window.setTimeout(() => {
        applyUpdate(true);
      }, RELOAD_DELAY_MS);
    });
  }, []);

  if (!visible) return null;

  return (
    <div className={classes.toast} role="status" aria-live="polite">
      Updating…
    </div>
  );
}
