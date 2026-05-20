import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Admin route protection (except /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const adminToken = request.cookies.get('admin_token')?.value

    if (!adminToken) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    try {
      const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'fallback-admin-jwt-secret-key-at-least-32-chars')
      await jwtVerify(adminToken, secret)
      return NextResponse.next()
    } catch (err) {
      console.error('Admin token verification failed:', err)
      const res = NextResponse.redirect(new URL('/admin/login', request.url))
      res.cookies.delete('admin_token')
      return res
    }
  }

  // 2. Supabase route protection for /owner/* and passenger pages
  if (
    pathname.startsWith('/owner') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/tickets') ||
    pathname.startsWith('/recharge') ||
    pathname.startsWith('/account')
  ) {
    const { supabase, response } = await updateSession(request)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Fetch user profile role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Role-based routing checks
    if (pathname.startsWith('/owner')) {
      if (profile.role !== 'bus_owner') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      // Check if owner profile is complete (exists in bus_owners table)
      const { data: ownerRecord } = await supabase
        .from('bus_owners')
        .select('status')
        .eq('id', user.id)
        .single()

      const isProfileComplete = !!ownerRecord

      if (!isProfileComplete && pathname !== '/owner/complete-profile') {
        return NextResponse.redirect(new URL('/owner/complete-profile', request.url))
      }

      if (isProfileComplete && pathname === '/owner/complete-profile') {
        return NextResponse.redirect(new URL('/owner/dashboard', request.url))
      }
    } else {
      // Passenger pages (/dashboard, /tickets, /recharge, /account)
      if (profile.role !== 'passenger') {
        return NextResponse.redirect(new URL('/owner/dashboard', request.url))
      }
    }

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/owner/:path*',
    '/dashboard/:path*',
    '/tickets/:path*',
    '/recharge/:path*',
    '/account/:path*',
  ],
}
