import Link from 'next/link'
import HospitalHeader from '@/components/HospitalHeader'

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center bg-gray-50 px-3 sm:px-4 pt-4 pb-6 sm:py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-6 sm:p-8 text-center">
        <HospitalHeader />
        <hr className="my-6 border-gray-200" />
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">Delivery Appointments Management System</h1>
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