import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST || "";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASS || "";
const fromEmail =
  process.env.FROM_EMAIL || "no-reply@mail.tasks.radon-media.com";
const googleChatWebhook = process.env.GOOGLE_CHAT_WEBHOOK_URL || "";

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
});

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  if (!smtpHost || !smtpUser) {
    console.log("SMTP not configured, skipping email to:", to);
    return;
  }

  try {
    await transporter.sendMail({
      from: fromEmail,
      to,
      subject,
      text,
      html,
    });
    console.log(`Email sent successfully to: ${to}`);
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}

export async function postGoogleChatMessage(message: string) {
  if (!googleChatWebhook) {
    console.log(
      "Google Chat webhook not configured, skipping message:",
      message,
    );
    return;
  }

  try {
    const response = await fetch(googleChatWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log("Google Chat message sent successfully");
  } catch (err) {
    console.error("Failed to post Google Chat message:", err);
  }
}

export async function sendTaskNotification({
  userEmail,
  userName,
  taskTitle,
  taskId,
  action = "created",
}: {
  userEmail: string;
  userName?: string;
  taskTitle: string;
  taskId: string;
  action?: "created" | "assigned" | "updated";
}) {
  const frontendUrl =
    process.env.FRONTEND_URL?.replace(/\/$/, "") ||
    "https://tasks.radon-media.com";
  const taskUrl = `${frontendUrl}/tasks/${taskId}`;

  const emailSubject = `Task ${action}: ${taskTitle}`;
  const emailText = `Hello ${userName || "there"},\n\nA task has been ${action}:\n\nTitle: ${taskTitle}\nTask ID: ${taskId}\n\nView task: ${taskUrl}\n\nBest regards,\nKaneo Team`;
  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Kaneo PMS</h1>
        <p style="color: #ffffff; margin: 10px 0 0 0; opacity: 0.9;">Project Management System</p>
      </div>
      <div style="padding: 30px 20px;">
        <h2 style="color: #2d3748; margin: 0 0 20px 0; font-size: 24px;">Task ${action.charAt(0).toUpperCase() + action.slice(1)}</h2>
        <p style="color: #4a5568; font-size: 16px; line-height: 1.5;">Hello ${userName || "there"},</p>
        <p style="color: #4a5568; font-size: 16px; line-height: 1.5;">A task has been <strong>${action}</strong> in your workspace:</p>
        <div style="background: #f7fafc; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 0 4px 4px 0;">
          <p style="color: #2d3748; margin: 0 0 10px 0; font-weight: 600; font-size: 18px;">${taskTitle}</p>
          <p style="color: #718096; margin: 0; font-size: 14px;">Task ID: ${taskId}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${taskUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.2);">View Task</a>
        </div>
        <hr style="border: none; height: 1px; background: #e2e8f0; margin: 30px 0;">
        <p style="color: #718096; font-size: 14px; line-height: 1.5;">Best regards,<br><strong>Kaneo Team</strong></p>
        <p style="color: #a0aec0; font-size: 12px; margin-top: 20px;">You're receiving this email because you're a member of a Kaneo workspace. If you have any questions, please contact your workspace administrator.</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: userEmail,
    subject: emailSubject,
    text: emailText,
    html: emailHtml,
  });

  const chatMessage = `🔔 Task ${action}: "${taskTitle}" (ID: ${taskId}) - Assigned to ${userName || userEmail}`;
  await postGoogleChatMessage(chatMessage);
}

export async function sendInvitationEmail({
  userEmail,
  userName,
  workspaceName,
  inviterName,
}: {
  userEmail: string;
  userName?: string;
  workspaceName: string;
  inviterName?: string;
}) {
  const frontendUrl =
    process.env.FRONTEND_URL?.replace(/\/$/, "") ||
    "https://tasks.radon-media.com";
  const inviteUrl = `${frontendUrl}/dashboard`;

  const subject = `Invitation to join ${workspaceName} on Kaneo`;
  const text = `Hello ${userName || "there"},\n\n${inviterName ? `${inviterName} has` : "You have been"} invited you to join the workspace "${workspaceName}" on Kaneo.\n\nClick the link below to access your dashboard:\n${inviteUrl}\n\nBest regards,\nKaneo Team`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Kaneo PMS</h1>
        <p style="color: #ffffff; margin: 10px 0 0 0; opacity: 0.9;">Project Management System</p>
      </div>
      <div style="padding: 30px 20px;">
        <h2 style="color: #2d3748; margin: 0 0 20px 0; font-size: 24px;">🎉 Workspace Invitation</h2>
        <p style="color: #4a5568; font-size: 16px; line-height: 1.5;">Hello ${userName || "there"},</p>
        <p style="color: #4a5568; font-size: 16px; line-height: 1.5;">${inviterName ? `<strong>${inviterName}</strong> has` : "You have been"} invited you to join the workspace on Kaneo PMS!</p>
        <div style="background: #f7fafc; border-left: 4px solid #48bb78; padding: 20px; margin: 20px 0; border-radius: 0 4px 4px 0;">
          <p style="color: #2d3748; margin: 0 0 10px 0; font-weight: 600; font-size: 18px;">📋 ${workspaceName}</p>
          ${inviterName ? `<p style="color: #718096; margin: 0; font-size: 14px;">Invited by: ${inviterName}</p>` : ""}
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(72, 187, 120, 0.2);">Accept Invitation</a>
        </div>
        <div style="background: #edf2f7; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <p style="color: #4a5568; margin: 0; font-size: 14px; text-align: center;">
            <strong>What's next?</strong><br>
            Click the button above to access your dashboard and start collaborating on projects, tasks, and more!
          </p>
        </div>
        <hr style="border: none; height: 1px; background: #e2e8f0; margin: 30px 0;">
        <p style="color: #718096; font-size: 14px; line-height: 1.5;">Best regards,<br><strong>Kaneo Team</strong></p>
        <p style="color: #a0aec0; font-size: 12px; margin-top: 20px;">You're receiving this email because someone invited you to join their Kaneo workspace. If you believe this was sent by mistake, you can safely ignore this email.</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: userEmail,
    subject,
    text,
    html,
  });

  const chatMessage = `👋 New workspace invitation: ${userName || userEmail} invited to "${workspaceName}"${inviterName ? ` by ${inviterName}` : ""}`;
  await postGoogleChatMessage(chatMessage);
}
