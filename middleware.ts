import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // 1. Identify absolutely protected Dashboard routes
  const isDashboardRoute = 
    path.startsWith('/intelligence') || 
    path.startsWith('/results') || 
    path.startsWith('/calibration') || 
    path === '/dashboard';

  // 2. Activation Guard (Disabled for UI development phase)
  if (isDashboardRoute) {
     const activationState = request.cookies.get('zeno_state')?.value;
     
     if (activationState !== 'ACTIVE') {
        // Force them into the Activation Onboarding Flow
        // return NextResponse.redirect(new URL('/activate', request.url));
     }
  }

  // 3. For all other routes (Home, Onboarding, Login, Signup, Pricing, etc.), let them pass naturally.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
