export function ConfirmDialog(props: { message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div class="dialog-backdrop" role="dialog" aria-modal="true">
      <div class="dialog">
        <p>{props.message}</p>
        <div class="row">
          <button class="secondary" onClick={props.onCancel}>Cancel</button>
          <button class="danger" onClick={props.onConfirm}>{props.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
