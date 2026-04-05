import nodemailer from "nodemailer";
import { config } from "../config/config";
import logger from "../utils/logger";

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  // Initialization

  /**
   * Initializes the email service with the configured SMTP credentials.
   * If the credentials are not available, logs a warning and does not initialize the service.
   * @remarks This method should be called once before sending any emails.
   */
  static initialize() {
    if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS,
        },
      });
      logger.info("Email service initialized");
    } else {
      logger.warn("Email service not configured - missing SMTP credentials");
    }
  }

  // Private helpers

  /**
   * Checks if the email service is ready to send emails.
   * If the email service is not initialized, logs a warning and returns false.
   * @param {string} methodName - The name of the method which is being skipped.
   * @returns {boolean} Whether the email service is ready or not.
   */
  private static isReady(methodName: string): boolean {
    if (!this.transporter) {
      logger.warn(`Email service not available - skipping ${methodName}`);
      return false;
    }
    return true;
  }

  /**
   * Wraps the given HTML content with a basic email template.
   * The template includes a title, a horizontal line, and a footer with the FinTrack-Platform team signature.
   * @param {string} title - The title of the email.
   * @param {string} bodyContent - The content of the email.
   * @returns {string} The wrapped HTML content.
   */
  private static wrapHtml(title: string, bodyContent: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <h1 style="color: #2563eb;">${title}</h1>
        ${bodyContent}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 20px;">
        <p style="color: #6b7280; font-size: 14px;">
          Best regards,<br>
          The FinTrack-Platform Team
        </p>
      </div>
    `;
  }

  /**
   * Generates a call-to-action button with the given href and label.
   * The button style is a blue button with white text and a rounded border.
   * @param {string} href - The href of the button.
   * @param {string} label - The text label of the button.
   * @returns {string} The HTML content of the button.
   */
  private static ctaButton(href: string, label: string): string {
    return `
      <div style="margin: 30px 0;">
        <a href="${href}"
           style="background-color: #2563eb; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; display: inline-block;
                  font-weight: 600; letter-spacing: 0.3px;">
          ${label}
        </a>
      </div>
    `;
  }

  // Welcome

  /**
   * Sends a welcome email to the given email address with the given name.
   * The email contains a brief message and a call-to-action button to get started.
   * If the email service is not initialized, logs a warning and returns immediately.
   * @param {string} email - The email address to send the welcome email to.
   * @param {string} name - The name of the user to include in the welcome email.
   * @returns {Promise<void>} A Promise resolving when the welcome email is sent.
   */
  static async sendWelcomeEmail(email: string, name: string): Promise<void> {
    if (!this.isReady("welcome email")) return;

    try {
      await this.transporter!.sendMail({
        from: `"FinTrack-Platform" <${config.SMTP_USER}>`,
        to: email,
        subject: "Welcome to FinTrack-Platform!",
        html: this.wrapHtml(
          `Welcome to FinTrack-Platform, ${name}! 🎉`,
          `
          <p>We're excited to have you on board. Your account has been successfully created.</p>
          <p>You can now start managing your finances and tracking your activity.</p>
          ${this.ctaButton(config.FRONTEND_URL, "Get Started")}
          <p>If you have any questions, feel free to reach out to our support team.</p>
          `
        ),
      });
      logger.info("Welcome email sent", { email });
    } catch (error) {
      logger.error("Failed to send welcome email", { email, error });
    }
  }

  // Email Verification

  /**
   * Sends a verification email to the given email address with the given raw token.
   * The email contains a brief message and a call-to-action button to verify the email address.
   * If the email service is not initialized, logs a warning and returns immediately.
   * @param {string} email - The email address to send the verification email to.
   * @param {string} rawToken - The raw token to include in the verification email.
   * @returns {Promise<void>} A Promise resolving when the verification email is sent.
   */
  static async sendVerificationEmail(
    email: string,
    rawToken: string
  ): Promise<void> {
    if (!this.isReady("verification email")) return;

    try {
      const verifyUrl = `${config.FRONTEND_URL}/verify-email?token=${rawToken}`;

      await this.transporter!.sendMail({
        from: `"FinTrack-Platform" <${config.SMTP_USER}>`,
        to: email,
        subject: "Verify your FinTrack-Platform email address",
        html: this.wrapHtml(
          "Verify your email address",
          `
          <p>Thanks for signing up! Before you can access your account, please verify
             your email address by clicking the button below.</p>
          ${this.ctaButton(verifyUrl, "Verify Email")}
          <p>
            Or copy and paste this link into your browser:<br>
            <span style="color: #2563eb; word-break: break-all;">${verifyUrl}</span>
          </p>
          <p style="color: #6b7280; font-size: 14px;">
            This link expires in <strong>24 hours</strong>. If you did not create an
            account, you can safely ignore this email.
          </p>
          `
        ),
      });
      logger.info("Verification email sent", { email });
    } catch (error) {
      logger.error("Failed to send verification email", { email, error });
      throw error;
    }
  }

  // Password Reset

  /**
   * Sends a password reset email to the given email address with the given raw token.
   * The email contains a brief message and a call-to-action button to reset the password.
   * If the email service is not initialized, logs a warning and returns immediately.
   * @param {string} email - The email address to send the password reset email to.
   * @param {string} rawToken - The raw token to include in the password reset email.
   * @returns {Promise<void>} A Promise resolving when the password reset email is sent.
   */
  static async sendPasswordResetEmail(
    email: string,
    rawToken: string
  ): Promise<void> {
    if (!this.isReady("password reset email")) return;

    try {
      const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${rawToken}`;

      await this.transporter!.sendMail({
        from: `"FinTrack-Platform" <${config.SMTP_USER}>`,
        to: email,
        subject: "Reset your FinTrack-Platform password",
        html: this.wrapHtml(
          "Password Reset Request",
          `
          <p>We received a request to reset the password for your FinTrack-Platform account.</p>
          <p>Click the button below to set a new password:</p>
          ${this.ctaButton(resetUrl, "Reset Password")}
          <p>
            Or copy and paste this link into your browser:<br>
            <span style="color: #2563eb; word-break: break-all;">${resetUrl}</span>
          </p>
          <p style="color: #6b7280; font-size: 14px;">
            This link expires in <strong>10 minutes</strong>. If you did not request a
            password reset, please ignore this email — your password will remain unchanged.
          </p>
          `
        ),
      });
      logger.info("Password reset email sent", { email });
    } catch (error) {
      logger.error("Failed to send password reset email", { email, error });
      throw error;
    }
  }
}

EmailService.initialize();
