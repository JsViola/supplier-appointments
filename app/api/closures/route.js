import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { todayInManila } from '@/lib/scheduling'

// Public, read-only list of upcoming date closures for the booking
// calendar. Runs on the server with the service role key so the
// date_closures table itself can stay closed to anonymous visitors.
// Only the three fields the calendar needs are returned, and closures
// that already ended are left out.

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('api/closures: a required environment variable is missing')
    return NextResponse.json({ error: 'Server is not set up correctly.' }, { status: 500 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data, error } = await supabaseAdmin
    .from('date_closures')
    .select('start_date, end_date, reason')
    .gte('end_date', todayInManila())
    .order('start_date', { ascending: true })
    .limit(500)

  if (error) {
    console.error('api/closures query failed', error)
    return NextResponse.json({ error: 'Could not load closed dates.' }, { status: 500 })
  }

  return NextResponse.json(
    { closures: data },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
