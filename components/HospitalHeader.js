import Image from 'next/image'

// Shared hospital identity block: both logos, hospital name, section,
// and address. Used at the top of the home page and the booking form.
export default function HospitalHeader() {
  return (
    <header className="text-center">
      <div className="flex items-center justify-center gap-3 sm:gap-4 mb-3 sm:mb-4">
        <Image
          src="/lpgh-logo.png"
          alt="Las Piñas General Hospital and Satellite Trauma Center logo"
          width={400}
          height={400}
          priority
          className="h-16 w-16 sm:h-20 sm:w-20 object-contain"
        />
        <Image
          src="/mms-seal.png"
          alt="Materials Management Section seal"
          width={124}
          height={124}
          priority
          className="h-14 w-14 sm:h-16 sm:w-16 object-contain"
        />
      </div>
      <p className="text-base sm:text-xl font-semibold text-gray-900 leading-snug">
        Las Piñas General Hospital &amp; Satellite Trauma Center
      </p>
      <p className="text-sm sm:text-base font-medium text-green-700 mt-1">
        Materials Management Section
      </p>
      <p className="text-xs sm:text-sm text-gray-500 mt-1">
        Bernabe Compound, Pulanglupa I, Las Piñas City
      </p>
    </header>
  )
}