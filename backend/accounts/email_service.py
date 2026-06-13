import resend
import os
from django.conf import settings

resend.api_key = settings.RESEND_API_KEY

#during development w/o verified domain, all mails go to admin email
DEV_MODE = settings.DEBUG

def send_welcome_email(member_email, member_name, password):
  to_email = member_email if not DEV_MODE else settings.ADMIN_EMAIL
  try:
        resend.Emails.send({
            'from':    settings.DEFAULT_FROM_EMAIL,
            'to':      [to_email],
            'subject': 'Welcome to Shangharshil Yuva Bachat Samuha',
            'html':    _welcome_template(member_name, member_email, password),
        })
        return True, 'Email sent successfully.'
  except Exception as e:
        return False, str(e)


def send_password_reset_email(member_email, member_name, new_password):
  to_email = member_email if not DEV_MODE else settings.ADMIN_EMAIL
  try:
        resend.Emails.send({
            'from':    settings.DEFAULT_FROM_EMAIL,
            'to':      [to_email],
            'subject': 'Your Password Has Been Reset — Shangharshil Bachat Samuha',
            'html':    _password_reset_template(member_name, member_email, new_password),
        })
        return True, 'Email sent successfully.'
  except Exception as e:
        return False, str(e)


def _welcome_template(name, email, password):
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,sans-serif;">
      <div style="max-width:480px;margin:40px auto;background:#fff;
                  border-radius:16px;overflow:hidden;
                  box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <div style="background:#0c4a6e;padding:32px 40px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">
            🏦 Shangharshil Yuva Bachat Samuha
          </h1>
          <p style="color:#7dd3fc;margin:8px 0 0;font-size:13px;">
            Member Management System
          </p>
        </div>

        <!-- Body -->
        <div style="padding:32px 40px;">
          <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">
            Welcome, {name or 'Member'}!
          </h2>
          <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Your account has been created by the administrator.
            Here are your login credentials:
          </p>

          <!-- Credentials box -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;
                      border-radius:10px;padding:20px 24px;margin-bottom:24px;">
            <div style="margin-bottom:12px;">
              <p style="color:#94a3b8;font-size:11px;
                        text-transform:uppercase;letter-spacing:0.05em;
                        margin:0 0 4px;">Email</p>
              <p style="color:#1e293b;font-size:15px;
                        font-weight:600;margin:0;">{email}</p>
            </div>
            <div>
              <p style="color:#94a3b8;font-size:11px;
                        text-transform:uppercase;letter-spacing:0.05em;
                        margin:0 0 4px;">Temporary Password</p>
              <p style="color:#0369a1;font-size:18px;font-weight:700;
                        letter-spacing:0.05em;margin:0;
                        font-family:monospace;">{password}</p>
            </div>
          </div>

          <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 24px;">
            Please log in and change your password immediately for security.
          </p>

          <!-- Warning -->
          <div style="background:#fefce8;border:1px solid #fde047;
                      border-radius:8px;padding:12px 16px;margin-bottom:24px;">
            <p style="color:#854d0e;font-size:12px;margin:0;line-height:1.5;">
              ⚠️ Do not share these credentials with anyone.
              Change your password after first login.
            </p>
          </div>

          <p style="color:#94a3b8;font-size:12px;margin:0;">
            If you did not expect this email, please contact your administrator.
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;padding:16px 40px;
                    border-top:1px solid #e2e8f0;text-align:center;">
          <p style="color:#94a3b8;font-size:11px;margin:0;">
            © 2026 Shangharshil Yuva Bachat Samuha. All rights reserved.
          </p>
        </div>

      </div>
    </body>
    </html>
    """


def _password_reset_template(name, email, new_password):
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,sans-serif;">
      <div style="max-width:480px;margin:40px auto;background:#fff;
                  border-radius:16px;overflow:hidden;
                  box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <div style="background:#0c4a6e;padding:32px 40px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">
            🏦 Shangharshil Yuva Bachat Samuha
          </h1>
        </div>

        <!-- Body -->
        <div style="padding:32px 40px;">
          <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">
            Password Reset
          </h2>
          <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Hi {name or 'Member'}, your password has been reset by the administrator.
          </p>

          <!-- Credentials box -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;
                      border-radius:10px;padding:20px 24px;margin-bottom:24px;">
            <div style="margin-bottom:12px;">
              <p style="color:#94a3b8;font-size:11px;
                        text-transform:uppercase;letter-spacing:0.05em;
                        margin:0 0 4px;">Email</p>
              <p style="color:#1e293b;font-size:15px;
                        font-weight:600;margin:0;">{email}</p>
            </div>
            <div>
              <p style="color:#94a3b8;font-size:11px;
                        text-transform:uppercase;letter-spacing:0.05em;
                        margin:0 0 4px;">New Password</p>
              <p style="color:#0369a1;font-size:18px;font-weight:700;
                        letter-spacing:0.05em;margin:0;
                        font-family:monospace;">{new_password}</p>
            </div>
          </div>

          <div style="background:#fefce8;border:1px solid #fde047;
                      border-radius:8px;padding:12px 16px;margin-bottom:24px;">
            <p style="color:#854d0e;font-size:12px;margin:0;line-height:1.5;">
              ⚠️ Please log in and change your password immediately.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;padding:16px 40px;
                    border-top:1px solid #e2e8f0;text-align:center;">
          <p style="color:#94a3b8;font-size:11px;margin:0;">
            © 2026 Shangharshil Yuva Bachat Samuha. All rights reserved.
          </p>
        </div>

      </div>
    </body>
    </html>
    """
    
def send_password_reset_link_email(member_email, member_name,
                                    reset_url, expires_mins=15):
    to_email = member_email if not DEV_MODE else settings.ADMIN_EMAIL
    try:
        resend.Emails.send({
            'from':    settings.DEFAULT_FROM_EMAIL,
            'to':      [to_email],
            'subject': 'Password Reset — Shangharshil Bachat Samuha',
            'html':    _reset_link_template(
                           member_name, member_email,
                           reset_url, expires_mins
                       ),
        })
        return True, 'Email sent successfully.'
    except Exception as e:
        return False, str(e)


def _reset_link_template(name, email, reset_url, expires_mins):
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,sans-serif;">
      <div style="max-width:480px;margin:40px auto;background:#fff;
                  border-radius:16px;overflow:hidden;
                  box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <div style="background:#0c4a6e;padding:32px 40px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">
            🏦 Shangharshil Yuva Bachat Samuha
          </h1>
        </div>

        <div style="padding:32px 40px;">
          <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">
            Password Reset Request
          </h2>
          <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Hi {name or 'Member'}, we received a request to reset your
            password for <strong>{email}</strong>.
          </p>

          <div style="text-align:center;margin:24px 0;">
            <a href="{reset_url}"
               style="background:#0369a1;color:#fff;padding:12px 32px;
                      border-radius:8px;text-decoration:none;
                      font-weight:600;font-size:15px;display:inline-block;">
              Reset Password
            </a>
          </div>

          <div style="background:#fefce8;border:1px solid #fde047;
                      border-radius:8px;padding:12px 16px;margin-bottom:24px;">
            <p style="color:#854d0e;font-size:12px;margin:0;line-height:1.5;">
              ⚠️ This link expires in {expires_mins} minutes.
              If you did not request this, ignore this email —
              your password will not change.
            </p>
          </div>

          <p style="color:#94a3b8;font-size:12px;margin:0;">
            If the button above does not work, copy and paste this link:
            <br/>
            <span style="color:#0369a1;word-break:break-all;">
              {reset_url}
            </span>
          </p>
        </div>

        <div style="background:#f8fafc;padding:16px 40px;
                    border-top:1px solid #e2e8f0;text-align:center;">
          <p style="color:#94a3b8;font-size:11px;margin:0;">
            © 2026 Shangharshil Yuva Bachat Samuha. All rights reserved.
          </p>
        </div>

      </div>
    </body>
    </html>
    """