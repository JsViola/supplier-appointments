import Image from 'next/image'
import Link from 'next/link'
 
// Top bar used on every page: the hospital logo and the section seal, the
// name beside them when there is room, and whatever links or buttons the
// page passes in on the right.
export default function HospitalHeader({ children }) {
  return (
    <header className="topbar">
      <div className="shell topbar-inner">
        <Link
          href="/"
          className="brand"
          aria-label="Las Piñas General Hospital, Materials Management Section. Go to the home page."
        >
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="disc h-9 w-9 sm:h-10 sm:w-10">
              <Image src="/lpgh-logo.png" alt="" width={400} height={400} priority className="h-full w-full" />
            </span>
            <span className="disc h-9 w-9 sm:h-10 sm:w-10">
              <Image src="/mms-seal.png" alt="" width={124} height={124} priority className="h-full w-full" />
            </span>
          </span>
          <span className="brand-text">
            <span className="brand-name block truncate">Las Piñas General Hospital</span>
            <span className="brand-sub block truncate">Materials Management Section</span>
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-3 sm:gap-5">{children}</nav>
      </div>
    </header>
  )
}
 