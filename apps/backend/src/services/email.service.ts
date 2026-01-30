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
    const name = firstName || 'there';

    return this.send({
      to: email,
      subject: 'Confirmez votre inscription à la newsletter TechNews',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #0ea5e9; margin: 0;">TechNews</h1>
          </div>
          
          <h2>Bonjour ${name} ! 👋</h2>
          
          <p>Merci de vous être inscrit à notre newsletter tech !</p>
          
          <p>Pour confirmer votre inscription et commencer à recevoir nos actualités, cliquez sur le bouton ci-dessous :</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmUrl}" style="background-color: #0ea5e9; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Confirmer mon inscription
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Si vous n'avez pas demandé cette inscription, vous pouvez ignorer cet email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            TechNews - Actualités Tech & Podcasts
          </p>
        </body>
        </html>
      `,
      text: `Bonjour ${name}!\n\nMerci de vous être inscrit à la newsletter TechNews.\n\nConfirmez votre inscription: ${confirmUrl}\n\nSi vous n'avez pas demandé cette inscription, ignorez cet email.`,
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
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          Vous recevez cet email car vous êtes inscrit à la newsletter TechNews.<br>
          <a href="${unsubscribeUrl}" style="color: #999;">Se désinscrire</a>
        </p>
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
    return this.send({
      to: this.config.fromEmail, // Send to self
      subject: `[TechNews Admin] ${subject}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>${subject}</h2>
          <p>${message}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">Notification automatique TechNews</p>
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
