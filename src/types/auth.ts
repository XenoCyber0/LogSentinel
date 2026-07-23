export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'ANALYST' | 'ADMIN' | 'VIEWER';
  isVerified: boolean;
  isBanned: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
  updatedAt: string;
}
