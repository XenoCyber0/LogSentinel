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

export interface Session {
  user: User;
  accessToken: string;
  expiresAt: string;
}

export interface AuthResponse {
  data: {
    user: User;
    accessToken?: string;
    refreshToken?: string;
  } | null;
  error: string | null;
  status: number;
}
