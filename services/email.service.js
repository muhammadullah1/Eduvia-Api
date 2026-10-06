"use strict";

const { Resend } = require("resend");
const config = require("../config");

function getResendClient() {
  const apiKey =
    process.env.RESEND_API_KEY ||
    (config.has("resend.apiKey") ? config.get("resend.apiKey") : null) ||
    (config.has("resendApiKey") ? config.get("resendApiKey") : null);
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

function getDefaultFrom() {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  try {
    if (config.has("resend.fromEmail")) {
      const email = config.get("resend.fromEmail");
      const name = config.has("resend.fromName") ? config.get("resend.fromName") : "";
      if (email) {
        return name ? `${name} <${email}>` : email;
      }
    }
  } catch {
    // fallback
  }
  return "Eduvia <onboarding@resend.dev>";
}

/**
 * Base email layout wrapper for professional school communications.
 */
function emailLayout({ title, subtitle, contentHtml }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 580px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      padding: 32px 28px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 13px;
      opacity: 0.85;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .body {
      padding: 36px 32px;
      line-height: 1.6;
      font-size: 15px;
    }
    .btn-container {
      margin: 32px 0;
      text-align: center;
    }
    .btn {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 13px 32px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
    }
    .btn:hover {
      background-color: #1d4ed8;
    }
    .callout {
      background-color: #f1f5f9;
      border-left: 4px solid #2563eb;
      padding: 14px 18px;
      border-radius: 0 8px 8px 0;
      margin: 24px 0;
      font-size: 14px;
      color: #334155;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 32px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
    .break-url {
      word-break: break-all;
      color: #2563eb;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Creative Leaders School</h1>
      <p>Eduvia Management Portal</p>
    </div>
    <div class="body">
      <h2 style="margin-top: 0; font-size: 19px; color: #0f172a;">${title}</h2>
      ${subtitle ? `<p style="color: #64748b; font-size: 14px; margin-top: -8px;">${subtitle}</p>` : ""}
      ${contentHtml}
    </div>
    <div class="footer">
      <p>Creative Leaders School · All rights reserved.<br>This is an automated system email. Please do not reply directly to this address.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Sends a generic email using Resend (or logs to console if no API key is set).
 */
async function sendEmail({ to, subject, html, text, from: fromAddress }) {
  const client = getResendClient();
  const recipients = Array.isArray(to) ? to : [to];
  const from = fromAddress || getDefaultFrom();

  if (!client) {
    console.log(`\n======================================================`);
    console.log(`[Email Service - Simulated Mode (No RESEND_API_KEY)]`);
    console.log(`From: ${from}`);
    console.log(`To: ${recipients.join(", ")}`);
    console.log(`Subject: ${subject}`);
    console.log(`Preview: ${text || "(HTML body)"}`);
    console.log(`======================================================\n`);
    return { success: true, simulated: true, id: `sim-${Date.now()}` };
  }

  try {
    const data = await client.emails.send({
      from,
      to: recipients,
      subject,
      html,
      text,
    });
    return { success: true, simulated: false, data };
  } catch (error) {
    console.error(`[Email Service Error] Failed to send email to ${recipients.join(", ")}:`, error);
    throw error;
  }
}

/**
 * Sends a password reset email with secure action link.
 */
async function sendPasswordResetEmail({ to, name, resetUrl, expiresIn = "1 hour" }) {
  const subject = "Reset your Eduvia account password";
  const contentHtml = `
    <p>Hello ${name || "there"},</p>
    <p>We received a request to reset the password for your Eduvia account associated with <strong>${to}</strong>.</p>
    <p>To choose a new password and regain access to your portal, click the button below:</p>

    <div class="btn-container">
      <a href="${resetUrl}" class="btn" target="_blank" rel="noopener noreferrer">Reset Password</a>
    </div>

    <div class="callout">
      <strong>Note:</strong> This link is strictly valid for <strong>${expiresIn}</strong>. If you did not make this request, you can safely ignore this email; your existing password remains unchanged.
    </div>

    <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
      If the button above does not work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" class="break-url">${resetUrl}</a>
    </p>
  `;

  const text = `Hello ${name || "there"},\n\nWe received a request to reset your password. Use the following link within ${expiresIn} to set a new password:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`;

  return sendEmail({
    to,
    subject,
    html: emailLayout({
      title: "Password Reset Request",
      subtitle: "Secure account recovery",
      contentHtml,
    }),
    text,
  });
}

/**
 * Sends an invitation email to a newly created staff or parent user.
 */
async function sendInvitationEmail({ to, name, role, inviteUrl, schoolName = "Creative Leaders School", expiresIn = "7 days" }) {
  const formattedRole = role ? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "User";
  const subject = `Welcome to Eduvia - Set up your ${formattedRole} account`;

  const contentHtml = `
    <p>Hello <strong>${name || "there"}</strong>,</p>
    <p>An account has been created for you at <strong>${schoolName}</strong> with access to the <strong>${formattedRole} Portal</strong>.</p>
    <p>To activate your account and set your secure password, please click the button below:</p>

    <div class="btn-container">
      <a href="${inviteUrl}" class="btn" target="_blank" rel="noopener noreferrer">Set Password & Activate Account</a>
    </div>

    <div class="callout">
      <strong>Getting started:</strong> This invitation is valid for <strong>${expiresIn}</strong>. Once your password is set, you will be able to log in directly using your email (<strong>${to}</strong>).
    </div>

    <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
      If the button above does not work, copy and paste this link into your browser:<br>
      <a href="${inviteUrl}" class="break-url">${inviteUrl}</a>
    </p>
  `;

  const text = `Hello ${name || "there"},\n\nAn account has been created for you at ${schoolName} for the ${formattedRole} Portal.\n\nPlease visit the following link to set your password and activate your account (valid for ${expiresIn}):\n\n${inviteUrl}\n\nYour username is: ${to}`;

  return sendEmail({
    to,
    subject,
    html: emailLayout({
      title: "Account Invitation",
      subtitle: `Welcome to ${schoolName}`,
      contentHtml,
    }),
    text,
  });
}

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendInvitationEmail,
};
