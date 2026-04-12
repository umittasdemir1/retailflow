import { useState } from 'react';
import {
  LayoutDashboard,
  Upload,
  BarChart3,
  ArrowLeftRight,
  Package,
  MapPin,
  ScanSearch,
  Settings,
  Activity,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
} from 'lucide-react';

export type ActivePage = 'dashboard' | 'upload' | 'products' | 'locations' | 'analysis' | 'results' | 'vision';

interface NavItem {
  id: ActivePage;
  icon: React.ReactNode;
  label: string;
}

const NAV: NavItem[] = [
  { id: 'dashboard', icon: <LayoutDashboard size={24} strokeWidth={1.7} />, label: 'Dashboard' },
  { id: 'upload',    icon: <Upload size={24} strokeWidth={1.7} />,          label: 'Veri Yükle' },
  { id: 'products',  icon: <Package size={24} strokeWidth={1.7} />,         label: 'Ürünler' },
  { id: 'locations', icon: <MapPin size={24} strokeWidth={1.7} />,          label: 'Lokasyonlar' },
  { id: 'analysis',  icon: <BarChart3 size={24} strokeWidth={1.7} />,       label: 'Analiz' },
  { id: 'results',   icon: <ArrowLeftRight size={24} strokeWidth={1.7} />,  label: 'Sonuçlar' },
  { id: 'vision',    icon: <ScanSearch size={24} strokeWidth={1.7} />,      label: 'Görsel Arama' },
];

interface Props {
  activePage: ActivePage;
  onPageChange: (page: ActivePage) => void;
  healthState: 'healthy' | 'loading' | 'offline';
  children: React.ReactNode;
}

export function AppShell({ activePage, onPageChange, healthState, children }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const statusColor =
    healthState === 'healthy' ? '#059669' :
    healthState === 'loading' ? '#d97706' : '#dc2626';

  function handleNavClick(id: ActivePage) {
    onPageChange(id);
    setExpanded(false);
    setMobileOpen(false);
  }

  const navOpen = mobileOpen || expanded;

  return (
    <div className="rf-shell-root">

      {/* ── Mobile top bar ── */}
      <header className="rf-mobile-bar">
        <button
          type="button"
          className="rf-mobile-hamburger"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menü"
        >
          {mobileOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
        </button>
        <span className="rf-mobile-brand">RetailFlow</span>
        <div
          className="rf-nav-status"
          style={{ '--sc': statusColor } as React.CSSProperties}
          title={`API: ${healthState}`}
        />
      </header>

      {/* Overlay — click outside to close (both desktop expand & mobile) */}
      {navOpen && (
        <div
          className="rf-nav-overlay"
          onClick={() => { setExpanded(false); setMobileOpen(false); }}
        />
      )}

      {/* ── Nav ── */}
      <aside className={`rf-nav${expanded ? ' is-expanded' : ''}${mobileOpen ? ' is-mobile-open' : ''}`}>

        {/* Logo */}
        <div className="rf-nav-logo">
          <Activity size={24} strokeWidth={1.7} className="rf-nav-logo-icon" />
          {(expanded || mobileOpen) && <span className="rf-nav-logo-text">RetailFlow</span>}
        </div>

        {/* Nav items */}
        <nav className="rf-nav-list">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rf-nav-item${activePage === item.id ? ' is-active' : ''}`}
              onClick={() => handleNavClick(item.id)}
              title={!expanded && !mobileOpen ? item.label : undefined}
            >
              <span className="rf-nav-item-icon">{item.icon}</span>
              {(expanded || mobileOpen) && <span className="rf-nav-item-label">{item.label}</span>}
            </button>
          ))}

          {/* Chevron — sadece desktop'ta görünür */}
          <button
            type="button"
            className="rf-nav-item rf-nav-item--chevron rf-desktop-only"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Daralt' : 'Genişlet'}
          >
            <span className="rf-nav-item-icon">
              {expanded
                ? <ChevronsLeft size={24} strokeWidth={1.7} />
                : <ChevronsRight size={24} strokeWidth={1.7} />}
            </span>
            {expanded && <span className="rf-nav-item-label">Daralt</span>}
          </button>
        </nav>

        {/* Bottom */}
        <div className="rf-nav-bottom">
          <button type="button" className="rf-nav-item" title="Ayarlar">
            <span className="rf-nav-item-icon"><Settings size={24} strokeWidth={1.7} /></span>
            {(expanded || mobileOpen) && <span className="rf-nav-item-label">Ayarlar</span>}
            <div
              className="rf-nav-status"
              style={{ '--sc': statusColor } as React.CSSProperties}
              title={`API: ${healthState}`}
            />
          </button>
        </div>

      </aside>

      {/* Main content */}
      <main className="rf-main-content">
        {children}
      </main>
    </div>
  );
}
