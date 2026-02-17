// ===========================================
// Service Email (Resend)
// ===========================================

import { Resend } from 'resend';

interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  siteUrl: string;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

interface SendResult {
  success: boolean;
  id?: string;
  error?: string;
}

export class EmailService {
  private resend: Resend | null;
  private config: EmailConfig;

  private getLogoUrl(): string {
    return `${this.config.siteUrl}/logo-revue-tech-nobg.png`;
  }

  constructor(config: EmailConfig) {
    this.config = config;
    this.resend = config.apiKey ? new Resend(config.apiKey) : null;
  }

  async send(options: SendEmailOptions): Promise<SendResult> {
    if (!this.resend) {
      console.log('[EMAIL] Resend not configured, skipping email:', options.subject);
      return { success: true, id: 'mock-id' };
    }

    try {
      const result = await this.resend.emails.send({
        from: this.config.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
        tags: options.tags,
      });

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      return { success: true, id: result.data?.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendSubscriptionConfirmation(
    email: string,
    firstName: string | null,
    confirmToken: string
  ): Promise<SendResult> {
    const confirmUrl = `${this.config.siteUrl}/newsletter/confirm?token=${confirmToken}`;
    const name = firstName || 'ami tech';
    const logoUrl = this.getLogoUrl();

    return this.send({
      to: email,
      subject: 'Confirmez votre inscription à la newsletter Revue Tech',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0f172a; max-width: 620px; margin: 0 auto; padding: 20px; background: #f8fafc;">
          <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 28px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <img src="${logoUrl}" alt="Revue Tech" style="height: 48px; width: auto; margin-bottom: 12px;" />
              <h1 style="color: #0ea5e9; margin: 0; font-size: 26px;">Revue Tech</h1>
              <p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px;">Le meilleur de l'actualité tech, sans bruit</p>
            </div>

            <h2 style="margin: 0 0 12px 0;">Bonjour ${name} 👋</h2>

            <p style="margin: 0 0 12px 0;">Ravi de vous compter parmi nous !</p>
            <p style="margin: 0 0 20px 0;">Un dernier clic suffit pour activer votre inscription et recevoir nos sélections hebdo :</p>

            <div style="text-align: center; margin: 26px 0;">
              <a href="${confirmUrl}" style="background: linear-gradient(90deg,#2563eb,#0ea5e9); color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 700; display: inline-block;">
                ✅ Confirmer mon inscription
              </a>
            </div>

            <p style="color: #64748b; font-size: 14px; margin: 0;">
              Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.
            </p>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
              Revue Tech · News, analyses & podcasts
            </p>
          </div>
        </body>
        </html>
      `,
      text: `Bonjour ${name},\n\nBienvenue chez Revue Tech !\n\nConfirmez votre inscription en cliquant ici : ${confirmUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.`,
      tags: [{ name: 'category', value: 'confirmation' }],
    });
  }

  async sendNewsletter(
    email: string,
    firstName: string | null,
    subject: string,
    htmlContent: string,
    unsubscribeToken: string,
    newsletterId: string
  ): Promise<SendResult> {
    const unsubscribeUrl = `${this.config.siteUrl}/newsletter/unsubscribe?token=${unsubscribeToken}`;
    const name = firstName || 'Lecteur';

    // Replace placeholder with actual name
    const personalizedHtml = htmlContent
      .replace(/\{\{firstName\}\}/g, name)
      .replace(/\{\{unsubscribeUrl\}\}/g, unsubscribeUrl);

    return this.send({
      to: email,
      subject,
      html: `
        ${personalizedHtml}
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="color: #64748b; font-size: 13px; margin: 0 0 8px 0;">Merci de lire Revue Tech 💙</p>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            Vous recevez cet email car vous êtes inscrit à la newsletter.<br>
            <a href="${unsubscribeUrl}" style="color: #94a3b8;">Se désinscrire en 1 clic</a>
          </p>
        </div>
      `,
      tags: [
        { name: 'category', value: 'newsletter' },
        { name: 'newsletter_id', value: newsletterId },
      ],
    });
  }

  async sendAdminNotification(
    subject: string,
    message: string
  ): Promise<SendResult> {
    const logoUrl = this.getLogoUrl();

    return this.send({
      to: this.config.fromEmail, // Send to self
      subject: `[Revue Tech Admin] ${subject}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; background: #f8fafc; padding: 20px;">
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
              <img src="${logoUrl}" alt="Revue Tech" style="height: 28px; width: auto;" />
              <strong style="font-size: 16px; color: #0f172a;">Notification Admin</strong>
            </div>
            <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 20px;">${subject}</h2>
            <p style="margin: 0; color: #334155; white-space: pre-line;">${message}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 18px 0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">Message automatique · Revue Tech Admin</p>
          </div>
        </div>
      `,
      text: `${subject}\n\n${message}`,
      tags: [{ name: 'category', value: 'admin' }],
    });
  }
}

export const createEmailService = (
  apiKey: string | undefined,
  fromEmail: string | undefined,
  siteUrl: string
): EmailService => {
  return new EmailService({
    apiKey: apiKey || '',
    fromEmail: fromEmail || 'noreply@technews.local',
    siteUrl,
  });
};
