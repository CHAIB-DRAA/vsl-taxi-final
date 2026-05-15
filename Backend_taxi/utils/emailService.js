const nodemailer = require('nodemailer');

const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("EMAIL_USER et EMAIL_PASS sont requis dans les variables d'environnement.");
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendEmail = async ({ email, subject, message, token }) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"Taxi App Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 500px; margin: auto;">
        <h2 style="color: #FF6B00;">${subject}</h2>
        <p>${message}</p>
        ${token ? `
          <div style="background: #f4f4f4; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${token}</span>
          </div>
          <p style="color: #666; font-size: 14px;">Ce code expire dans <strong>1 heure</strong>.</p>
        ` : ''}
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999;">Ceci est un message automatique, merci de ne pas y répondre.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
