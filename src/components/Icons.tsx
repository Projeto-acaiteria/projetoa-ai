// SVG inline · zero emoji (feedback_sempre_svg_nunca_emoji)
import type { SVGProps } from "react";

type I = SVGProps<SVGSVGElement>;
const base = (p: I) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const IconBowl = (p: I) => (
  <svg {...base(p)}>
    <path d="M3 11h18a9 9 0 0 1-18 0Z" />
    <path d="M12 11V7a3 3 0 0 1 3-3" />
    <path d="M6 20h12" />
  </svg>
);
export const IconFlame = (p: I) => (
  <svg {...base(p)}>
    <path d="M12 2c1.5 3 4.5 4.5 4.5 8.5a4.5 4.5 0 0 1-9 0c0-1.2.4-2.2 1-3 .3 1 1 1.7 2 2 0-2.3-1-4.3 1.5-7.5Z" />
  </svg>
);
export const IconMusic = (p: I) => (
  <svg {...base(p)}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);
export const IconHome = (p: I) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);
export const IconReceipt = (p: I) => (
  <svg {...base(p)}>
    <path d="M5 3v18l2-1.2L9 21l2-1.2L13 21l2-1.2L17 21l2-1.2V3l-2 1.2L15 3l-2 1.2L11 3 9 4.2 7 3 5 4.2Z" />
    <path d="M9 8h6M9 12h6" />
  </svg>
);
export const IconWallet = (p: I) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="13" rx="3" />
    <path d="M3 10h18" />
    <circle cx="16.5" cy="13.5" r="1.2" />
  </svg>
);
export const IconStar = (p: I) => (
  <svg {...base(p)}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />
  </svg>
);
export const IconTable = (p: I) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="5.5" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
  </svg>
);
export const IconGift = (p: I) => (
  <svg {...base(p)}>
    <rect x="3.5" y="8" width="17" height="4" rx="1" />
    <path d="M5 12v9h14v-9" />
    <path d="M12 8v13" />
    <path d="M12 8C12 8 10.6 3.8 8.2 4.8 6.2 5.6 7.4 8 12 8Z" />
    <path d="M12 8c0 0 1.4-4.2 3.8-3.2C17.8 5.6 16.6 8 12 8Z" />
  </svg>
);
export const IconUsers = (p: I) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 20a5.5 5.5 0 0 0-3-4.9" />
  </svg>
);
export const IconMenu = (p: I) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
export const IconPlus = (p: I) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconMinus = (p: I) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);
export const IconCheck = (p: I) => (
  <svg {...base(p)}>
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);
export const IconWhatsapp = (p: I) => (
  <svg {...base(p)}>
    <path d="M4 20l1.4-4.2A7.5 7.5 0 1 1 8.2 18.6L4 20Z" />
    <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5M9 9.5c0-.6.4-1 1-1 .4 0 .7.3 1 .9M14.5 15c.6 0 1-.4 1-1 0-.4-.3-.7-.9-1" />
  </svg>
);
export const IconMoto = (p: I) => (
  <svg {...base(p)}>
    <circle cx="6" cy="17" r="2.5" />
    <circle cx="18" cy="17" r="2.5" />
    <path d="M8.5 17h6l2-5h-3l-1-3h-3" />
    <path d="M14.5 9H18" />
  </svg>
);
export const IconBag = (p: I) => (
  <svg {...base(p)}>
    <path d="M6 8h12l-1 12H7L6 8Z" />
    <path d="M9 8a3 3 0 0 1 6 0" />
  </svg>
);
export const IconArrowRight = (p: I) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconChart = (p: I) => (
  <svg {...base(p)}>
    <path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" />
  </svg>
);
export const IconClock = (p: I) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const IconBox = (p: I) => (
  <svg {...base(p)}>
    <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5Z" />
    <path d="M3 7.5 12 12l9-4.5M12 12v9" />
  </svg>
);
export const IconAlert = (p: I) => (
  <svg {...base(p)}>
    <path d="M12 3.5 21 19H3Z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
);
export const IconTrash = (p: I) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
);
export const IconCart = (p: I) => (
  <svg {...base(p)}>
    <path d="M3 4h2l2.2 11.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 7H6" />
    <circle cx="9" cy="20" r="1.2" />
    <circle cx="17" cy="20" r="1.2" />
  </svg>
);
export const IconGear = (p: I) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 13H4a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 19.4 11H20a2 2 0 1 1 0 4Z" />
  </svg>
);
export const IconCard = (p: I) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 10h18M7 15h3" />
  </svg>
);
export const IconPrinter = (p: I) => (
  <svg {...base(p)}>
    <path d="M6 9V3h12v6" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
    <path d="M7 14h10v7H7z" />
  </svg>
);
