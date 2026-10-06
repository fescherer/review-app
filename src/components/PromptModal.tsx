import { useState, type FormEvent } from "react";
import { errorMessage } from "../lib/util";
import { Modal } from "./Modal";

interface Props {
  title: string;
  label: string;
  initial?: string;
  submitLabel?: string;
  /** Throw to show an error and keep the dialog open. */
  onSubmit: (value: string) => Promise<void>;
  onClose: () => void;
}

/** Single text-field dialog (rename, create). */
export function PromptModal({ title, label, initial = "", submitLabel = "Save", onSubmit, onClose }: Props) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      size="md"
      locked={busy}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => submit()} disabled={busy || !value.trim()}>
            {submitLabel}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        <label className="label" htmlFor="prompt-input">{label}</label>
        <input id="prompt-input" className="input" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </form>
    </Modal>
  );
}
