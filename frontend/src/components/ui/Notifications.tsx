import { useEffect, useState } from 'react';

export type NotifType = 'success' | 'error' | 'info';

export interface NotifItem {
  id: string;
  type: NotifType;
  message: string;
}

const DURATION = 4200;

const ICONS: Record<NotifType, JSX.Element> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7.5v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

function NotifItem({ item, onDismiss }: { item: NotifItem; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);

  function dismiss() {
    setExiting(true);
    setTimeout(() => onDismiss(item.id), 300);
  }

  useEffect(() => {
    const t = setTimeout(dismiss, DURATION);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`rf-notif is-${item.type}${exiting ? ' is-exiting' : ''}`} role="alert">
      <span className="rf-notif-icon">{ICONS[item.type]}</span>
      <span className="rf-notif-message">{item.message}</span>
      <button className="rf-notif-close" onClick={dismiss} aria-label="Kapat">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div className="rf-notif-bar" />
    </div>
  );
}

export function Notifications({ items, onDismiss }: { items: NotifItem[]; onDismiss: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="rf-notif-container" aria-live="polite">
      {items.map((item) => (
        <NotifItem key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function createNotif(type: NotifType, message: string): NotifItem {
  return { id: Math.random().toString(36).slice(2), type, message };
}
