import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, busy = false, children }) {
  const dialog = useRef(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="row between modal-heading">
        <h2 id={id}>{title}</h2>
        <button className="btn-icon" onClick={onClose} disabled={busy} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function ConfirmDialog({ title, description, onConfirm, onClose, busy, error }) {
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <p className="muted">{description}</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose} disabled={busy} autoFocus>
          Cancel
        </button>
        <button className="btn-danger" disabled={busy} onClick={onConfirm}>
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}
