export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',

  port: parseInt(process.env.PORT || '3000', 10),

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
  },

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  trustProxy: process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1',
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
  },
  app: {
    publicUrl: process.env.APP_PUBLIC_URL || 'http://localhost:3001',
  },
  email: {
    mode: process.env.EMAIL_MODE || 'log',
    from: process.env.EMAIL_FROM || 'QA Lab <noreply@localhost>',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure:
        process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1',
      user: process.env.SMTP_USER || undefined,
      pass: process.env.SMTP_PASS || undefined,
    },
  },
});
