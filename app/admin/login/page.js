'use client'
 
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
 
export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
 
  // Already signed in? Go straight to the calendar.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/admin')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
 
  async function handleLogin(e) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
 
    const { error } = await supabase.auth.signInWithPassword({ email, password })
 
    if (error) {
      setError('That email or password is not right. Please try again.')
      setLoading(false)
    } else {
      router.push('/admin')
    }
  }
 
  return (
    <div className="login">
      <aside className="login-side">
        <Link href="/" className="brand" aria-label="Las Piñas General Hospital. Go to the home page.">
          <span className="disc h-12 w-12 lg:h-14 lg:w-14">
            <Image src="/lpgh-logo.png" alt="" width={400} height={400} priority className="h-full w-full" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-bold leading-tight">Las Piñas General Hospital</span>
            <span className="block text-sm leading-tight" style={{ color: '#dbe7dd' }}>Materials Management Section</span>
          </span>
        </Link>
 
        <div className="hidden lg:block">
          <span className="disc mb-8 block h-56 w-56">
            <Image src="/lpgh-logo.png" alt="" width={400} height={400} className="h-full w-full" />
          </span>
          <p className="footer-name">Delivery appointments, in one calendar.</p>
        </div>
      </aside>
 
      <main className="login-main">
        <div className="login-card">
          <div className="grid gap-3">
            <h1 className="title rise" style={{ '--i': 0 }}>Admin sign in</h1>
            <p className="lead text-soft rise" style={{ '--i': 1 }}>
              Sign in with your section account to see and manage delivery appointments.
            </p>
          </div>
 
          <form onSubmit={handleLogin} className="stack rise" style={{ '--i': 2 }}>
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                enterKeyHint="next"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>
 
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  style={{ paddingRight: '4.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  className="navlink absolute right-1 top-1/2 -translate-y-1/2 px-3 text-sm"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
 
            {error && <p className="error" role="alert">{error}</p>}
 
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
 
          <Link href="/" className="navlink w-fit">Back to home</Link>
        </div>
      </main>
    </div>
  )
}
 