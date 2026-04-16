import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Admin',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const expectedUser = process.env.ADMIN_USER || 'admin';
        if (!credentials?.username || credentials.username !== expectedUser) {
          return null;
        }
        const pw = credentials.password;
        if (!pw) return null;

        const hash = process.env.ADMIN_PASSWORD_HASH;
        if (hash) {
          if (!bcrypt.compareSync(pw, hash)) return null;
        } else if (process.env.ADMIN_PASSWORD) {
          if (pw !== process.env.ADMIN_PASSWORD) return null;
        } else {
          return null;
        }

        return { id: expectedUser, name: expectedUser };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.name = token.sub ?? session.user.name;
      return session;
    },
  },
};
