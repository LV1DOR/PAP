// Email service using Resend
// Add RESEND_API_KEY to your .env.local

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@civiclens.app';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Send invitation email to new user
 */
export async function sendInvitationEmail({ 
  email, 
  role, 
  municipalityName, 
  inviterName,
  token 
}) {
  const inviteUrl = `${APP_URL}/accept-invite?token=${token}`;
  
  const roleLabel = {
    municipality_admin: 'Municipality Administrator',
    staff: 'Staff Member',
  }[role] || role;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Invitation to Join CivicLens - ${municipalityName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>CivicLens Invitation</h1>
              </div>
              <div class="content">
                <p>Hello,</p>
                <p><strong>${inviterName}</strong> has invited you to join CivicLens as a <strong>${roleLabel}</strong> for <strong>${municipalityName}</strong>.</p>
                <p>CivicLens is a civic issue reporting and management platform that helps municipalities efficiently track and resolve community reports.</p>
                <p>Click the button below to accept your invitation and set up your account:</p>
                <center>
                  <a href="${inviteUrl}" class="button">Accept Invitation</a>
                </center>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background: white; padding: 10px; border-radius: 4px; font-family: monospace;">${inviteUrl}</p>
                <p><strong>This invitation will expire in 7 days.</strong></p>
                <p>If you didn't expect this invitation, you can safely ignore this email.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} CivicLens. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message, inviteUrl };
    }

    return { success: true, messageId: data.id, inviteUrl };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message, inviteUrl };
  }
}

/**
 * Send welcome email after successful registration
 */
export async function sendWelcomeEmail({ email, name, role, municipalityName }) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Welcome to CivicLens!',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to CivicLens!</h1>
              </div>
              <div class="content">
                <p>Hi ${name || 'there'},</p>
                <p>Your account has been successfully created for <strong>${municipalityName}</strong>.</p>
                <p>You can now log in and start managing community reports.</p>
                <center>
                  <a href="${APP_URL}/login" class="button">Log In Now</a>
                </center>
                <p>If you have any questions, please contact your administrator.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Welcome email error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Welcome email send error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send report status update notification (future use)
 */
export async function sendReportStatusEmail({ 
  email, 
  reportTitle, 
  oldStatus, 
  newStatus,
  reportId 
}) {
  const reportUrl = `${APP_URL}/reports/${reportId}`;
  
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Report Status Updated: ${reportTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .status { display: inline-block; padding: 6px 12px; border-radius: 4px; font-weight: bold; }
              .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Report Status Updated</h1>
              </div>
              <div class="content">
                <p>The status of your report has been updated:</p>
                <p><strong>${reportTitle}</strong></p>
                <p>
                  <span class="status" style="background: #fbbf24;">${oldStatus}</span>
                  →
                  <span class="status" style="background: #10b981;">${newStatus}</span>
                </p>
                <center>
                  <a href="${reportUrl}" class="button">View Report</a>
                </center>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Status email error:', error);
    return { success: false, error: error.message };
  }
}
