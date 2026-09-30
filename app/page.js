import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-semibold text-gray-900 mb-3">Delivery Appointments</h1>
        <p className="text-gray-500 mb-8">Book a delivery appointment or manage existing ones.</p>
        <div className="flex flex-col gap-3">
          <Link
            href="/book"
            className="w-full bg-gray-900 text-white rounded-lg py-3 font-medium hover:bg-gray-800 transition"
          >
            Book a Delivery Appointment
          </Link>
          <Link
            href="/admin/login"
            className="w-full border border-gray-300 text-gray-700 rounded-lg py-3 font-medium hover:bg-gray-100 transition"
          >
            Admin Login
          </Link>
        </div>
      </div>
    </div>
  )
}