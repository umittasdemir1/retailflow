export type ToastState = { tone: 'info' | 'success' | 'error'; text: string } | null;

export function ToastBanner(props: { toast: Exclude<ToastState, null>; onClose: () => void }) {
  return (
    <div className={'rf-toast is-' + props.toast.tone}>
      <span>{props.toast.text}</span>
      <button type="button" onClick={props.onClose}>Kapat</button>
    </div>
  );
}
