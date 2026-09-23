import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 20, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  )
}

const mk = (paths: React.ReactNode) => (p: P) => base({ ...p, children: paths })

export const IconHome = mk(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-6h6v6" /></>)
export const IconCalendar = mk(<><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M8 2.5v4M16 2.5v4M3 10h18" /></>)
export const IconFile = mk(<><path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-12z" /><path d="M14 2.5v6h6M9 13h6M9 17h6" /></>)
export const IconChat = mk(<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1L3 20l1.2-4.3A8.5 8.5 0 1 1 21 11.5z" />)
export const IconUser = mk(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5" /></>)
export const IconUsers = mk(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1.2-3.4 4-4.8 6.5-4.8s5.3 1.4 6.5 4.8" /><circle cx="17" cy="9" r="2.8" /><path d="M16.5 15.3c2.3.2 4.2 1.5 5 4.7" /></>)
export const IconPhone = mk(<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z" />)
export const IconMic = mk(<><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5 10.5a7 7 0 0 0 14 0M12 17.5V21M8.5 21h7" /></>)
export const IconVideo = mk(<><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="m15.5 10.5 6-3.5v10l-6-3.5" /></>)
export const IconVideoOff = mk(<><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="m15.5 10.5 6-3.5v10l-6-3.5" /><path d="m3 3 18 18" /></>)
export const IconAlertTri = mk(<><path d="M12 3 2.5 20h19z" /><path d="M12 9.5V14M12 17.2v.3" /></>)
export const IconAlertOct = mk(<><path d="M7.9 2.5h8.2L21.5 7.9v8.2l-5.4 5.4H7.9l-5.4-5.4V7.9z" /><path d="M12 8v5M12 16.5v.3" /></>)
export const IconCheck = mk(<path d="m4.5 12.5 5 5 10-11" />)
export const IconCheckCircle = mk(<><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5.5-6.5" /></>)
export const IconClock = mk(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>)
export const IconSearch = mk(<><circle cx="11" cy="11" r="7" /><path d="m20.5 20.5-4.8-4.8" /></>)
export const IconPlus = mk(<path d="M12 5v14M5 12h14" />)
export const IconX = mk(<path d="M6 6l12 12M18 6 6 18" />)
export const IconChevronL = mk(<path d="m14.5 5.5-7 6.5 7 6.5" />)
export const IconChevronR = mk(<path d="m9.5 5.5 7 6.5-7 6.5" />)
export const IconChevronD = mk(<path d="m5.5 9.5 6.5 7 6.5-7" />)
export const IconBell = mk(<><path d="M18 9.5a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15.5 18 9.5" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></>)
export const IconLogout = mk(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>)
export const IconShield = mk(<path d="M12 2.5 4.5 5.5v6c0 5 3.2 8.3 7.5 10 4.3-1.7 7.5-5 7.5-10v-6z" />)
export const IconShieldCheck = mk(<><path d="M12 2.5 4.5 5.5v6c0 5 3.2 8.3 7.5 10 4.3-1.7 7.5-5 7.5-10v-6z" /><path d="m9 11.5 2.2 2.2 4-4.5" /></>)
export const IconChart = mk(<><path d="M3 3v18h18" /><path d="M8 16v-5M13 16V8M18 16v-8" /></>)
export const IconPill = mk(<><rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="m9.5 9.5 5 5" /></>)
export const IconSteth = mk(<><path d="M6 3v6a4 4 0 0 0 8 0V3" /><path d="M6 3H4.5M10 3h1.5M14 3h-1.5M18 3h1.5" /><path d="M10 13v3a5 5 0 0 0 10 0v-1" /><circle cx="20" cy="11" r="2" /></>)
export const IconGlobe = mk(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" /></>)
export const IconSend = mk(<><path d="m21 3-9.5 9.5" /><path d="M21 3 14.5 21l-5-8.5L3 7.5z" /></>)
export const IconDownload = mk(<><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></>)
export const IconTrash = mk(<><path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" /><path d="M6.5 7l1 13a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-13" /><path d="M10 11v6M14 11v6" /></>)
export const IconEdit = mk(<><path d="M17 3.5 20.5 7 8.5 19l-5 1 1-5z" /><path d="m14.5 6 3.5 3.5" /></>)
export const IconInfo = mk(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.8v.3" /></>)
export const IconHeart = mk(<path d="M12 20.5S3.5 15.4 3.5 9.6A4.6 4.6 0 0 1 8.2 5c1.7 0 3 .9 3.8 2.2A4.6 4.6 0 0 1 15.8 5a4.6 4.6 0 0 1 4.7 4.6c0 5.8-8.5 10.9-8.5 10.9z" />)
export const IconActivity = mk(<path d="M3 12h4l2.5-6 4 12L16 12h5" />)
export const IconPin = mk(<><path d="M12 21.5S5 15.6 5 10a7 7 0 0 1 14 0c0 5.6-7 11.5-7 11.5z" /><circle cx="12" cy="10" r="2.6" /></>)
export const IconStar = mk(<path d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3L2.8 9.5l6.4-.9z" />)
export const IconSettings = mk(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z" /></>)
export const IconRefresh = mk(<><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3.5V9h-5.5" /></>)
export const IconClipboard = mk(<><rect x="5" y="4" width="14" height="17" rx="2" /><rect x="9" y="2.5" width="6" height="4" rx="1" /><path d="M9 11h6M9 15h6" /></>)
export const IconEye = mk(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>)
export const IconLock = mk(<><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>)
export const IconWifi = mk(<><path d="M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10.5 10.5 0 0 1 13 0M8.6 16a6 6 0 0 1 6.8 0" /><circle cx="12" cy="19.2" r="1.2" fill="currentColor" /></>)
export const IconFilePlus = mk(<><path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-12z" /><path d="M14 2.5v6h6" /><path d="M12 12v6M9 15h6" /></>)
