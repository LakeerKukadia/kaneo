import { sendEmail } from "./src/utils/mailer.js";

// Test email configuration
async function testEmail() {
  console.log("Testing Mailjet email configuration...");

  try {
    await sendEmail({
      to: "test@example.com", // Replace with your email for testing
      subject: "Kaneo PMS - Email Test",
      text: "This is a test email from Kaneo PMS to verify Mailjet configuration.",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #667eea;">🧪 Kaneo PMS Email Test</h2>
          <p>This is a test email to verify that Mailjet SMTP is working correctly with Kaneo PMS.</p>
          <div style="background: #f7fafc; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Status:</strong> ✅ Email delivery successful</p>
            <p><strong>From:</strong> no-reply@mail.tasks.radon-media.com</p>
            <p><strong>SMTP Server:</strong> in-v3.mailjet.com:587</p>
          </div>
          <p>Best regards,<br>Kaneo Team</p>
        </div>
      `,
    });

    console.log("✅ Test email sent successfully!");
  } catch (error) {
    console.error("❌ Failed to send test email:", error);
  }
}

// Uncomment to run the test
// testEmail();
