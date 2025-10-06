# Railway Deployment Guide for Kaneo PMS

## Overview

This guide will help you deploy the updated Kaneo PMS API with email notifications and Google Chat webhooks to Railway.

## Features Added

1. **Email Invitations**: When users are invited to workspaces, they receive email notifications
2. **Task Notifications**: When tasks are created or assigned, users get email notifications
3. **Google Chat Webhooks**: Optional notifications sent to Google Chat channels
4. **Production-Ready Dockerfile**: Optimized for Railway deployment

## Prerequisites

1. Railway account
2. SMTP email service (Gmail, SendGrid, etc.)
3. Google Chat webhook URL (optional)

## Environment Variables

Set the following environment variables in your Railway project:

### Required Variables

```env
DATABASE_URL=your-postgresql-database-url
JWT_ACCESS_SECRET=your-jwt-secret
BETTER_AUTH_SECRET=your-auth-secret
FRONTEND_URL=https://tasks.radon-media.com
```

### Email Configuration (Required for email notifications) - Mailjet Setup

```env
SMTP_HOST=in-v3.mailjet.com
SMTP_PORT=587
SMTP_USER=ff101fec070cbb0bdf0473ca3c084d8c
SMTP_PASS=b8633cc26a8a59f56f4cc12186172a31
FROM_EMAIL=no-reply@mail.tasks.radon-media.com
```

### Optional Variables

```env
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/YOUR_SPACE/messages?key=KEY&token=TOKEN
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
NODE_ENV=production
PORT=1337
```

## Mailjet SMTP Setup

The Mailjet configuration is already provided above. To set up the domain verification:

1. **Domain Verification in Mailjet:**
   - Log into your Mailjet account
   - Go to Account Settings > Sender domains & addresses
   - Add and verify the domain: `mail.tasks.radon-media.com`

2. **DNS Configuration:**
   Add these DNS records to your domain (mail.tasks.radon-media.com):
   ```
   # SPF Record (TXT)
   v=spf1 include:spf.mailjet.com ~all
   
   # DKIM Records (provided by Mailjet after domain verification)
   # Add the CNAME records as shown in Mailjet dashboard
   ```

3. **Test Configuration:**
   - Use the provided API key and Secret key
   - Mailjet SMTP server: `in-v3.mailjet.com:587`
   - Authentication: Use API key as username, Secret key as password

## Google Chat Webhook Setup

1. Create a Google Chat space
2. Add webhooks:
   - In the space, click the space name > Apps & integrations
   - Add webhooks > Create webhook
   - Copy the webhook URL and use as `GOOGLE_CHAT_WEBHOOK_URL`

## Deployment Steps

### Option 1: Deploy from GitHub (Recommended)

1. Push your updated code to GitHub
2. Connect Railway to your GitHub repository
3. Railway will auto-detect the Dockerfile in `apps/api/`
4. Set all environment variables listed above
5. Deploy!

### Option 2: Railway CLI

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Deploy: `railway up`

## Testing the Deployment

1. **Test invitation emails**: Invite a user to a workspace
2. **Test task notifications**: Create/assign a task
3. **Check logs**: Use Railway dashboard to monitor logs
4. **Verify webhooks**: Check Google Chat for notifications (if configured)

## Troubleshooting

### Email not sending

- Check SMTP credentials
- Verify SMTP_HOST and SMTP_PORT
- Check Railway logs for email errors
- Test SMTP settings with a test script

### Google Chat webhook not working

- Verify webhook URL is correct
- Check webhook permissions in Google Chat
- Monitor Railway logs for webhook errors

### Build failures

- Ensure all dependencies are in package.json
- Check Dockerfile builds locally: `docker build -f apps/api/Dockerfile .`
- Verify pnpm workspace configuration

### Database connection issues

- Verify DATABASE_URL format: `postgresql://user:password@host:port/database`
- Check database is accessible from Railway
- Run migrations: `pnpm db:migrate`

## Production Checklist

- [ ] All environment variables set
- [ ] SMTP credentials tested
- [ ] Database connected and migrated
- [ ] Frontend URL configured correctly
- [ ] Google Chat webhook tested (if using)
- [ ] Error monitoring configured
- [ ] Backup strategy in place

## Monitoring

Railway provides built-in monitoring. Additionally, you can:

1. Set up log alerts for email/webhook failures
2. Monitor database performance
3. Track API response times
4. Set up health check endpoints

## Updates and Maintenance

To update the deployment:

1. Push changes to your connected GitHub repo
2. Railway will automatically rebuild and deploy
3. Monitor logs during deployment
4. Test critical functionality after deployment

## Support

For issues:
1. Check Railway logs first
2. Verify environment variables
3. Test email/webhook configurations locally
4. Check database connectivity