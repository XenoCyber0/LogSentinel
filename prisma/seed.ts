import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user
  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'analyst@seclab.io' },
    update: {},
    create: {
      email: 'analyst@seclab.io',
      passwordHash,
      name: 'Security Analyst',
      role: 'ANALYST',
      isVerified: true,
    },
  });

  console.log('✅ Demo user created');

  // Seed 1: Production SSH Brute Force (CRITICAL)
  const session1 = await prisma.logSession.create({
    data: {
      userId: user.id,
      title: 'Production SSH Brute Force',
      description: 'Multiple failed SSH login attempts from Tor exit node',
      rawLog: `Jan 15 03:22:14 prod-server sshd[2847]: Failed password for root from 185.220.101.47 port 52214 ssh2
Jan 15 03:22:16 prod-server sshd[2847]: Failed password for root from 185.220.101.47 port 52216 ssh2
Jan 15 03:22:19 prod-server sshd[2847]: Failed password for root from 185.220.101.47 port 52218 ssh2
Jan 15 03:22:22 prod-server sshd[2847]: Failed password for root from 185.220.101.47 port 52221 ssh2
Jan 15 03:22:25 prod-server sshd[2847]: Failed password for root from 185.220.101.47 port 52223 ssh2
Jan 15 03:22:28 prod-server sshd[2847]: Failed password for root from 185.220.101.47 port 52226 ssh2
...`,
      severity: 'CRITICAL',
      logFormat: 'AUTH',
      tags: ['ssh', 'bruteforce', 'tor'],
      analyzedAt: new Date(),
      analysis: {
        summary: "Massive SSH brute force attack detected from Tor exit node 185.220.101.47. 47 failed login attempts in under 2 minutes targeting the root account.",
        severity: "CRITICAL",
        logFormat: "AUTH",
        timeRange: { start: "2026-01-15T03:22:14Z", end: "2026-01-15T03:24:02Z" },
        totalLines: 47,
        threats: [{
          type: "BRUTE_FORCE",
          severity: "CRITICAL",
          title: "SSH Brute Force Attack",
          description: "47 failed root login attempts from single IP in 108 seconds",
          evidence: ["185.220.101.47", "Failed password for root", "47 attempts"],
          recommendation: "Immediately block 185.220.101.47/32. Enable fail2ban. Disable root SSH login."
        }],
        ipAnalysis: [{
          ip: "185.220.101.47",
          requestCount: 47,
          threatScore: 98,
          isTorExit: true,
          endpoints: ["/ssh"],
          statusCodes: { "401": 47 }
        }],
        timeline: [{ timestamp: "03:22", level: "ERROR", count: 47 }],
        recommendations: [
          "Block 185.220.101.47 immediately",
          "Enable SSH key-only authentication",
          "Deploy fail2ban with aggressive settings"
        ]
      },
    },
  });

  await prisma.alert.createMany({
    data: [
      {
        sessionId: session1.id,
        userId: user.id,
        type: 'BRUTE_FORCE',
        severity: 'CRITICAL',
        title: 'SSH Brute Force Detected',
        description: '47 failed root logins from Tor exit node',
        ipAddress: '185.220.101.47',
      },
    ],
  });

  await prisma.iPRecord.create({
    data: {
      sessionId: session1.id,
      ipAddress: '185.220.101.47',
      requestCount: 47,
      threatScore: 98,
      country: 'Unknown',
      isTorExit: true,
      isKnownBad: true,
      firstSeen: new Date('2026-01-15T03:22:14Z'),
      lastSeen: new Date('2026-01-15T03:24:02Z'),
      endpoints: ['/ssh'],
      statusCodes: { "401": 47 },
    },
  });

  // Seed 2: API Gateway DDoS
  const session2 = await prisma.logSession.create({
    data: {
      userId: user.id,
      title: 'API Gateway DDoS Pattern',
      description: 'High volume traffic flood causing service degradation',
      rawLog: `2026-01-20T14:33:01Z api-gateway [INFO] 429 Too Many Requests from 203.0.113.45
2026-01-20T14:33:02Z api-gateway [INFO] 503 Service Unavailable`,
      severity: 'HIGH',
      logFormat: 'NGINX',
      tags: ['ddos', 'api', 'rate-limit'],
      analyzedAt: new Date(),
      analysis: {
        summary: "DDoS attack detected against API gateway. 2,400 requests/min from rotating IPs causing 429/503 errors.",
        severity: "HIGH",
        logFormat: "NGINX",
        timeRange: { start: "2026-01-20T14:30:00Z", end: "2026-01-20T14:38:00Z" },
        totalLines: 1240,
        threats: [{
          type: "RATE_LIMIT",
          severity: "HIGH",
          title: "Distributed Denial of Service",
          description: "Massive request volume from 6 source IPs causing service degradation",
          evidence: ["2400 req/min", "6 rotating IPs", "429/503 flood"],
          recommendation: "Implement WAF rules and rate limiting at edge. Consider Cloudflare."
        }],
        ipAnalysis: [
          { ip: "203.0.113.45", requestCount: 820, threatScore: 87, isTorExit: false, endpoints: ["/api/v1"], statusCodes: { "429": 820 } },
          { ip: "198.51.100.23", requestCount: 640, threatScore: 81, isTorExit: false, endpoints: ["/api/v1"], statusCodes: { "429": 640 } }
        ],
        timeline: [],
        recommendations: ["Activate WAF", "Block top offending IPs"]
      },
    },
  });

  // Seed 3: After Hours Admin Access
  const session3 = await prisma.logSession.create({
    data: {
      userId: user.id,
      title: 'After-Hours Admin Access',
      description: 'Suspicious admin panel access from new geolocation',
      rawLog: `Jan 22 03:14:22 admin-server auth: Successful login for admin from 91.132.44.89`,
      severity: 'MEDIUM',
      logFormat: 'AUTH',
      tags: ['admin', 'unusual-location'],
      analyzedAt: new Date(),
      analysis: {
        summary: "Admin login from new Eastern European location at 3:14am. First time accessing from this IP.",
        severity: "MEDIUM",
        logFormat: "AUTH",
        timeRange: { start: "2026-01-22T03:14:22Z", end: "2026-01-22T03:14:22Z" },
        totalLines: 1,
        threats: [{
          type: "SUSPICIOUS_IP",
          severity: "MEDIUM",
          title: "Unusual Admin Login Time & Location",
          description: "Admin panel accessed at 3:14 AM from previously unseen geolocation",
          evidence: ["91.132.44.89", "03:14 AM", "New geolocation"],
          recommendation: "Require MFA for admin accounts. Send security notification."
        }],
        ipAnalysis: [{ ip: "91.132.44.89", requestCount: 1, threatScore: 42, isTorExit: false, endpoints: ["/admin"], statusCodes: {} }],
        timeline: [],
        recommendations: ["Enable MFA", "Review access logs"]
      },
    },
  });

  console.log('✅ 3 seeded log sessions created');

  // Additional alerts
  await prisma.alert.createMany({
    data: [
      {
        sessionId: session2.id,
        userId: user.id,
        type: 'RATE_LIMIT',
        severity: 'HIGH',
        title: 'API Rate Limit Flood',
        description: 'Excessive API calls causing 503 errors',
        ipAddress: '203.0.113.45',
      },
      {
        sessionId: session3.id,
        userId: user.id,
        type: 'SUSPICIOUS_IP',
        severity: 'MEDIUM',
        title: 'After Hours Admin Access',
        description: 'Admin access at 3:14am from new IP',
        ipAddress: '91.132.44.89',
      },
    ],
  });

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
