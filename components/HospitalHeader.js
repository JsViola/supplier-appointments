import Image from 'next/image'
import Link from 'next/link'
 
// Top bar used on every page: the hospital logo and name on the left,
// whatever links or buttons the page passes in on the right.
export default function HospitalHeader({ children }) {
  return (
    <header className="topbar">
      <div className="shell topbar-inner">
        <Link
          href="/"
          className="brand"
          aria-label="Las Piñas General Hospital, Materials Management Section. Go to the home page."
        >
          <span className="disc h-10 w-10">
            <Image src="/lpgh-logo.png" alt="" width={400} height={400} priority className="h-full w-full" />
          </span>
          <span className="min-w-0">
            <span className="brand-name block truncate">Las Piñas General Hospital</span>
            <span className="brand-sub block truncate">Materials Management Section</span>
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-3 sm:gap-5">{children}</nav>
      </div>
    </header>
  )
}
 