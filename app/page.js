import Image from 'next/image'
import Link from 'next/link'
import HospitalHeader from '@/components/HospitalHeader'
 
const ANNOUNCEMENTS = [
  {
    src: '/mms-announcement.jpg',
    alt: 'Materials Management Section announcement',
    width: 1190,
    height: 1322,
  },
  {
    src: '/mms-announcement2.jpg',
    alt: 'Announcement: strict compliance with delivery terms and imposition of liquidated damages. Liquidated damages are 0.1 percent of the cost of the delayed goods for every calendar day of delay, and the contract may be rescinded at 10 percent. Requests for extension must be filed in writing before the delivery deadline.',
    width: 1189,
    height: 1323,
  },
]
 
const READY = [
  {
    title: 'The P.O. number',
    text: 'Written as the year, the month, and a four-digit number, for example 2026-10-0613.',
  },
  {
    title: 'Confirmation date and delivery terms',
    text: 'Both are on your purchase order. Terms state how many calendar or working days you have to deliver.',
  },
  {
    title: 'What you are delivering',
    text: 'Choose full delivery, or partial delivery with the P.O. item numbers and box quantities.',
  },
  {
    title: 'A mobile number we can reach',
    text: 'Philippine numbers start with 9. Other countries are accepted with their country code.',
  },
]
 
export default function HomePage() {
  return (
    <>
      <HospitalHeader>
        <Link href="/admin/login" className="navlink">Admin login</Link>
      </HospitalHeader>
 
      <main>
        <section className="hero">
          <div className="shell hero-inner">
            <div>
              <h1 className="display rise" style={{ '--i': 0 }}>Book a delivery appointment</h1>
              <p className="lead hero-lead rise" style={{ '--i': 1 }}>
                Suppliers reserve a delivery date for a purchase order with the Materials Management Section of Las Piñas General Hospital.
              </p>
              <div className="hero-cta rise" style={{ '--i': 2 }}>
                <Link href="/book" className="btn btn-gold">Book a delivery</Link>
              </div>
            </div>

          </div>
        </section>
 
        <section className="announcement-section shell" aria-labelledby="announcement-title">
          <div className="announcement-card">
            <div className="announcement-heading">
              <span className="announcement-kicker">Materials Management Section</span>
              <h2 id="announcement-title">Announcement</h2>
            </div>
            <div className="announcement-grid">
              {ANNOUNCEMENTS.map((a) => (
                <a
                  key={a.src}
                  href={a.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="announcement-link"
                  aria-label="Open this announcement full size in a new tab"
                >
                  <Image
                    src={a.src}
                    alt={a.alt}
                    width={a.width}
                    height={a.height}
                    sizes="(max-width: 900px) 100vw, 600px"
                    className="announcement-image"
                  />
                </a>
              ))}
            </div>
          </div>
        </section>
 
        <section className="home-guides shell" aria-label="Delivery appointment information">
          <div className="guide-card ready-card">
            <div className="guide-heading">
              <span className="guide-eyebrow">Before you book</span>
              <h2>Have these ready</h2>
            </div>
            <ol className="ready-list">
              {READY.map((item, index) => (
                <li key={item.title} className="ready-item">
                  <span className="ready-number">{index + 1}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
 
          <div className="guide-card days-card">
            <div className="guide-heading">
              <span className="guide-eyebrow">Know your delivery window</span>
              <h2>How delivery days are counted</h2>
            </div>
            <div className="day-types">
              <article className="day-type">
                <h3>Calendar days</h3>
                <p>Every day counts, including weekends and holidays. You may deliver on any day inside your window.</p>
              </article>
              <article className="day-type">
                <h3>Working days</h3>
                <p>Monday to Friday count. Weekends and Philippine regular holidays are skipped, and delivery is allowed only on a working day.</p>
              </article>
            </div>
          </div>
        </section>
      </main>
 
      <footer className="footer">
        <div className="shell section grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-end">
          <div className="grid gap-3">
 
            {/* Organization Logos */}
            <div className="flex items-center gap-3">
              {/* Materials Management Section Logo */}
              <span className="disc block h-14 w-14 overflow-hidden rounded-full">
                <Image
                  src="/mms-seal.png"
                  alt="Materials Management Section seal"
                  width={124}
                  height={124}
                  className="h-full w-full object-contain"
                />
              </span>
 
              {/* Las Piñas General Hospital Logo */}
              <span className="disc block h-14 w-14 overflow-hidden rounded-full">
                <Image
                  src="/lpgh-logo.png"
                  alt="Las Piñas General Hospital logo"
                  width={124}
                  height={124}
                  className="h-full w-full object-contain"
                />
              </span>
            </div>
 
            <p className="footer-name">
              Las Piñas General Hospital &amp; Satellite Trauma Center
            </p>
 
            <p className="lead" style={{ color: '#dbe7dd' }}>
              Materials Management Section, Bernabe Compound, Pulanglupa I, Las Piñas City
            </p>
          </div>
 
          <div className="flex flex-wrap gap-x-6 gap-y-1 lg:justify-end">
            <Link href="/book" className="navlink">Book a delivery</Link>
            <Link href="/admin/login" className="navlink">Admin login</Link>
          </div>
        </div>
      </footer>
    </>
  )
}