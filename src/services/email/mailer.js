/**
 * SMTP mailer (nodemailer). Provider-agnostic: configure SMTP_* env vars.
 */

import nodemailer from 'nodemailer';
import config from '../../config/index.js';
import { AppError } from '../../utils/errors.js';

let transporter = null;

export const isEmailConfigured = () => Boolean(config.email.smtp.host && config.email.smtp.user);

const getTransporter = () => {
  if (!isEmailConfigured()) {
    throw new AppError('Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.', 503, 'EMAIL_NOT_CONFIGURED');
  }
  if (!transporter) {
    const { host, port, secure, user, pass } = config.email.smtp;
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      pool: true,
      maxConnections: 3,
    });
  }
  return transporter;
};

/**
 * @param {{ to: string, subject: string, html: string, text: string, headers?: Record<string, string> }} message
 */
export const sendMail = async ({ to, subject, html, text, headers }) => {
  return getTransporter().sendMail({
    from: config.email.from,
    replyTo: config.email.replyTo,
    to,
    subject,
    html,
    text,
    headers,
  });
};

/** Test hook: inject a fake transporter (e.g. nodemailer jsonTransport). */
export const setTransporterForTests = (fake) => {
  transporter = fake;
};
