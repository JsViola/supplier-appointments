import Image from 'next/image'
import Link from 'next/link'
import HospitalHeader from '@/components/HospitalHeader'
 
const READY = [
  {
    title: 'The P.O. number',
    text: 'Written as the year, the month, and a four-digit number, for example 2026-10-0613.',
  },
  {
    title: 'The confirmation date and delivery terms',
    text: 'Both are on your purchase order. The terms are the number of days you have to deliver, counted in calendar days or working days.',
  },
  {
    title: 'What you are delivering',
    text: 'Choose full delivery, or partial delivery with the item numbers from the P.O. and the boxes for each.',
  },
  {
    title: 'A mobile number we can reach',
    text: 'Philippine numbers start with 9. Numbers from other countries are accepted with their country code.',
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
 
            <div className="order-first lg:order-none rise" style={{ '--i': 1 }}>
              <span className="disc mx-auto block h-28 w-28 sm:h-40 sm:w-40 lg:h-[26rem] lg:w-[26rem]">
                <Image
                  src="/lpgh-logo.png"
                  alt="Las Piñas General Hospital and Satellite Trauma Center seal"
                  width={400}
                  height={400}
                  priority
                  className="h-full w-full"
                />
              </span>
            </div>
          </div>
        </section>
 
        <section className="shell section">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
            <h2 className="title">Have these ready</h2>
            <ol className="grid gap-8">
              {READY.map((item) => (
                <li key={item.title}>
                  <p className="h2">{item.title}</p>
                  <p className="lead text-soft mt-2">{item.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
 
        <section className="field-tint">
          <div className="shell section grid gap-8 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
            <h2 className="title">How delivery days are counted</h2>
            <div className="grid gap-8">
              <div>
                <p className="h2">Calendar days</p>
                <p className="lead text-soft mt-2">
                  Every day counts, including weekends and holidays. You may deliver on any day inside your window.
                </p>
              </div>
              <div>
                <p className="h2">Working days</p>
                <p className="lead text-soft mt-2">
                  Monday to Friday count. Weekends and Philippine regular holidays are skipped, and you may only deliver on a working day.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
 
      <footer className="footer">
        <div className="shell section grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-end">
          <div className="grid gap-3">
            <span className="disc block h-14 w-14">
              <Image src="/mms-seal.png" alt="Materials Management Section seal" width={124} height={124} className="h-full w-full" />
            </span>
            <p className="footer-name">Las Piñas General Hospital &amp; Satellite Trauma Center</p>
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
 