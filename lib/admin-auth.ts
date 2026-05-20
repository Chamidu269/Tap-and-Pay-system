import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export async function verifyAdmin() {
  const adminToken = cookies().get('admin_token')?.value;
  if (!adminToken) return null;
  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'fallback-admin-jwt-secret-key-at-least-32-chars');
    const { payload } = await jwtVerify(adminToken, secret);
    return payload;
  } catch (err) {
    return null;
  }
}
