import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import 'react-big-calendar/lib/css/react-big-calendar.css'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Delivery Appointments System | LPGH Materials Management Section',
  description: 'Delivery appointment booking for Las Piñas General Hospital and Satellite Trauma Center.',
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
