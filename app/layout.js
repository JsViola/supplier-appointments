import { Public_Sans } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
 
// Public Sans was designed for government services: plain, sturdy, and it
// has the letters a Philippine address needs (ñ).
const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})
 
export const metadata = {
  title: 'Delivery Appointments | LPGH Materials Management Section',
  description:
    'Delivery appointment booking for the Materials Management Section of Las Piñas General Hospital and Satellite Trauma Center.',
}
 
// Phone baseline: edge to edge under the notch, light only, status bar
// colour matches the top bar of every page, keyboard resizes the layout.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  colorScheme: 'light',
  themeColor: '#f4f6f3',
}
 
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={publicSans.variable}>
      <body>
        {children}
        {/* One Toaster for the whole app, mounted once, here */}
        <Toaster
          position="bottom-center"
          richColors
          closeButton
          mobileOffset={{ bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
        />
      </body>
    </html>
  )
}
 