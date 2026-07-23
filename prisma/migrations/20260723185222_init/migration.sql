-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ANALYST', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LogFormat" AS ENUM ('NGINX', 'AUTH', 'SYSLOG', 'DOCKER', 'APP', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('BRUTE_FORCE', 'SUSPICIOUS_IP', 'SQL_INJECTION', 'PATH_TRAVERSAL', 'PRIVILEGE_ESCALATION', 'ANOMALY', 'RATE_LIMIT', 'UNKNOWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'ANALYST',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "rawLog" TEXT NOT NULL,
    "logFormat" "LogFormat" NOT NULL DEFAULT 'UNKNOWN',
    "fileSize" INTEGER,
    "analysis" JSONB,
    "severity" "Severity" NOT NULL DEFAULT 'UNKNOWN',
    "tags" TEXT[],
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rawLine" TEXT,
    "ipAddress" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IPRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "threatScore" INTEGER NOT NULL DEFAULT 0,
    "country" TEXT,
    "isTorExit" BOOLEAN NOT NULL DEFAULT false,
    "isKnownBad" BOOLEAN NOT NULL DEFAULT false,
    "firstSeen" TIMESTAMP(3) NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "endpoints" TEXT[],
    "statusCodes" JSONB,

    CONSTRAINT "IPRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogSession" ADD CONSTRAINT "LogSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LogSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IPRecord" ADD CONSTRAINT "IPRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LogSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
