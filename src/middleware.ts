import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      if (!process.env.NEXTAUTH_SECRET) {
        return true;
      }
      if (req.nextUrl.pathname.startsWith('/api/webhooks/incoming')) {
        return true;
      }
      return !!token;
    },
  },
});

export const config = {
  matcher: [
    '/devices/:path*',
    '/webhooks/:path*',
    '/jobs/:path*',
    '/config/:path*',
    '/logs/:path*',
    '/payload/:path*',
    '/api/devices/:path*',
    '/api/jobs/:path*',
    '/api/line-metrics/:path*',
    '/api/payload/:path*',
    '/api/webhooks',
  ],
};
