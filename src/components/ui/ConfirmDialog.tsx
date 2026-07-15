import { useDialogFocus } from '../../utils/useDialogFocus';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = '취소',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useDialogFocus<HTMLDivElement>(open, onCancel);
  if (!open) return null;

  return (
    <div className="confirm-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <div
        className="confirm-dialog"
        data-tone={tone}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <span lang="en">Confirm the change</span>
        <h2 id="confirm-dialog-title" lang="ko">{title}</h2>
        <p id="confirm-dialog-description" lang="ko">{description}</p>
        <div>
          <button type="button" onClick={onCancel}><span lang="ko">{cancelLabel}</span></button>
          <button type="button" onClick={onConfirm}><span lang="ko">{confirmLabel}</span></button>
        </div>
      </div>
    </div>
  );
}
