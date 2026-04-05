import random
import string
from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from .models import OTPRequest


def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))


def create_and_send_otp(email):
    # Invalidate any previous unused OTPs for this email
    OTPRequest.objects.filter(email=email, is_used=False).update(is_used=True)

    otp = generate_otp()
    expires_at = timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

    OTPRequest.objects.create(
        email=email,
        otp_code=otp,
        expires_at=expires_at,
    )

    subject = 'Your Shangharshil Bachat Login OTP'
    message = (
        f'Your one-time password is: {otp}\n\n'
        f'This OTP is valid for {settings.OTP_EXPIRY_MINUTES} minutes.\n'
        f'Do not share this code with anyone.'
    )

    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )

    return True


def verify_otp(email, otp_code):
    try:
        otp_obj = OTPRequest.objects.filter(
            email=email,
            otp_code=otp_code,
            is_used=False,
            expires_at__gt=timezone.now(),
        ).latest('created_at')
    except OTPRequest.DoesNotExist:
        return False, 'Invalid or expired OTP.'

    otp_obj.is_used = True
    otp_obj.save()
    return True, 'OTP verified.'