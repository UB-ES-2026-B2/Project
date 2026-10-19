// Iconos SVG inline (trazo de 1.75, 24×24). Son decorativos: aria-hidden.

function Icon({ children, size = 24 }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const SPACE_TYPE_PATHS = {
  piso: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M11 21v-3h2v3" />
    </>
  ),
  casa: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  local: (
    <>
      <path d="M4 9h16l-1.5-5h-13z" />
      <path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
      <path d="M5.5 11.5V20h13v-8.5M10 20v-4.5h4V20" />
    </>
  ),
  oficina: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18M11 13v2h2v-2" />
    </>
  ),
  garaje: (
    <>
      <path d="M5 16V12l1.8-4.2A2 2 0 0 1 8.6 6.5h6.8a2 2 0 0 1 1.8 1.3L19 12v4" />
      <path d="M4 16h16v2.5H4zM5 12h14" />
      <circle cx="8" cy="14" r=".6" />
      <circle cx="16" cy="14" r=".6" />
    </>
  ),
  trastero: (
    <>
      <path d="M3.5 8 12 4l8.5 4v10L12 22l-8.5-4z" />
      <path d="M3.5 8 12 12l8.5-4M12 12v10M7.8 6l8.5 4" />
    </>
  ),
};

export function SpaceTypeIcon({ type, size }) {
  return <Icon size={size}>{SPACE_TYPE_PATHS[type]}</Icon>;
}

export function SearchIcon({ size }) {
  return (
    <Icon size={size}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </Icon>
  );
}

export function ChatIcon({ size }) {
  return (
    <Icon size={size}>
      <path d="M20 12a7.5 7.5 0 0 1-10.8 6.7L4 20l1.4-4.6A7.5 7.5 0 1 1 20 12z" />
      <path d="M8.5 11h7M8.5 14h4.5" />
    </Icon>
  );
}

export function KeyIcon({ size }) {
  return (
    <Icon size={size}>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.7-8.7M16 7l2.5 2.5M13.5 9.5l2 2" />
    </Icon>
  );
}

export function MenuIcon({ open }) {
  return (
    <Icon size={22}>
      {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </Icon>
  );
}

export function CloseIcon() {
  return (
    <Icon size={14}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function ArrowIcon() {
  return (
    <Icon size={18}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}
