import os
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

from rest_framework.parsers import MultiPartParser, FormParser
from main.models import MemberDocument
from main.serializers import MemberDocumentSerializer

from .utils import create_and_send_otp, verify_otp
from .serializers import UserProfileSerializer, AdminUserSerializer, MemberUpdateProfileSerializer
from .permissions import IsAdmin

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from django.contrib.auth import get_user_model

from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator

from rest_framework.parsers import MultiPartParser, FormParser
from .email_service import send_welcome_email, send_password_reset_email, send_password_reset_link_email

import secrets
from django.utils import timezone
from datetime import timedelta
from .models import PasswordResetToken
from django.conf import settings


User = get_user_model()


def get_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class RequestOTPView(APIView):
    """
    Member hits this first. Checks email is pre-registered by admin, then sends OTP.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'Email is required.'}, status=400)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'This email is not registered. Contact your administrator.'},
                status=404,
            )

        create_and_send_otp(email)
        return Response({'message': f'OTP sent to {email}.'})


class VerifyOTPView(APIView):
    """
    Verify OTP. If first login (profile incomplete), returns needs_profile=True.
    Otherwise returns JWT tokens directly.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email    = request.data.get('email', '').strip().lower()
        otp_code = request.data.get('otp', '').strip()

        if not email or not otp_code:
            return Response({'error': 'Email and OTP are required.'}, status=400)

        valid, message = verify_otp(email, otp_code)
        if not valid:
            return Response({'error': message}, status=400)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=404)

        user.is_active = True
        user.save()

        needs_profile = not user.full_name

        tokens = get_tokens(user)
        return Response({
            'tokens': tokens,
            'needs_profile': needs_profile,
            'role': user.role,
            'user': UserProfileSerializer(user).data,
        })


class CompleteProfileView(APIView):
    """Member fills in their profile after first OTP login."""
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        serializer = MemberUpdateProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(UserProfileSerializer(request.user).data)
        return Response(serializer.errors, status=400)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'admin':
            try:
                from main.bs_calendar import is_last_day_of_bs_month, today_bs
                from main.services import create_trial_balance_record
                if is_last_day_of_bs_month():
                    y, m, _ = today_bs()
                    create_trial_balance_record(
                        bs_year=y, bs_month=m, is_auto=True
                    )
            except Exception:
                pass  # never block login

        return Response(UserProfileSerializer(request.user).data)

class AdminRegisterMemberView(APIView):
    permission_classes = [IsAdmin]
    parser_classes     = [MultiPartParser, FormParser]

    def post(self, request):
        email     = request.data.get('email', '').strip().lower()
        password  = request.data.get('password', '').strip()
        full_name = request.data.get('full_name', '').strip()
        phone     = request.data.get('phone', '').strip()
        address   = request.data.get('address', '').strip()

        # document files
        citizenship_front = request.FILES.get('citizenship_front')
        citizenship_back  = request.FILES.get('citizenship_back')
        signature         = request.FILES.get('signature')

        # validations
        if not email:
            return Response({'error': 'Email is required.'}, status=400)
        if not password:
            return Response({'error': 'Password is required.'}, status=400)
        if len(password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters.'},
                status=400
            )
        if User.objects.filter(email=email).exists():
            return Response(
                {'error': 'This email is already registered.'},
                status=400
            )

        # document validations
        if not citizenship_front:
            return Response(
                {'error': 'Citizenship front photo is required.'},
                status=400
            )
        if not citizenship_back:
            return Response(
                {'error': 'Citizenship back photo is required.'},
                status=400
            )
        if not signature:
            return Response(
                {'error': 'Signature photo is required.'},
                status=400
            )

        # validate file types
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        for label, file in [
            ('Citizenship front', citizenship_front),
            ('Citizenship back',  citizenship_back),
            ('Signature',         signature),
        ]:
            if file.content_type not in allowed_types:
                return Response(
                    {'error': f'{label}: only JPEG, PNG or WebP allowed.'},
                    status=400
                )
            if file.size > 5 * 1024 * 1024:
                return Response(
                    {'error': f'{label}: file size must be less than 5MB.'},
                    status=400
                )

        # create user
        user = User.objects.create_user(
            email=email,
            password=password,
            role='member',
            full_name=full_name,
            phone=phone,
            address=address,
            is_active=True,
            must_change_password=True,  # force password change on first login
        )

        # save documents
        MemberDocument.objects.create(
            member=user,
            citizenship_front=citizenship_front,
            citizenship_back=citizenship_back,
            signature=signature,
        )

        # send welcome email
        email_sent, email_msg = send_welcome_email(email, full_name, password)

        return Response({
            'message':    f'Member {email} registered successfully.',
            'email_sent': email_sent,
            'email_note': email_msg if not email_sent else 'Credentials sent to member email.',
            'user':       AdminUserSerializer(user).data,
        }, status=201)

class AdminMemberDocumentView(APIView):
    """Admin views and updates member documents."""
    permission_classes = [IsAdmin]
    parser_classes     = [MultiPartParser, FormParser]

    def get(self, request, user_id):
        user = get_object_or_404(User, id=user_id, role='member')
        try:
            doc = user.document
            return Response(
                MemberDocumentSerializer(doc, context={'request': request}).data
            )
        except MemberDocument.DoesNotExist:
            return Response({'error': 'No documents uploaded yet.'}, status=404)

    def patch(self, request, user_id):
        user = get_object_or_404(User, id=user_id, role='member')

        try:
            doc = user.document
        except MemberDocument.DoesNotExist:
            doc = None

        # validate files
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        for label, key in [
            ('Citizenship front', 'citizenship_front'),
            ('Citizenship back',  'citizenship_back'),
            ('Signature',         'signature'),
        ]:
            file = request.FILES.get(key)
            if file:
                if file.content_type not in allowed_types:
                    return Response(
                        {'error': f'{label}: only JPEG, PNG or WebP allowed.'},
                        status=400
                    )
                if file.size > 5 * 1024 * 1024:
                    return Response(
                        {'error': f'{label}: file size must be less than 5MB.'},
                        status=400
                    )

        if doc:
            serializer = MemberDocumentSerializer(
                doc,
                data=request.FILES,
                partial=True,
                context={'request': request}
            )
        else:
            data          = request.FILES.copy()
            data['member'] = user.id
            serializer    = MemberDocumentSerializer(
                data=data,
                context={'request': request}
            )

        if serializer.is_valid():
            serializer.save(member=user)
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
class MemberLoginView(APIView):
    permission_classes = [AllowAny]

    @method_decorator(ratelimit(key='ip', rate='5/m', method='POST', block=True))
    def post(self, request):
        email    = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '').strip()

        if not email or not password:
            return Response({'error': 'Email and password are required.'}, status=400)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid email or password.'}, status=400)

        if not user.check_password(password):
            return Response({'error': 'Invalid email or password.'}, status=400)

        if not user.is_active:
            return Response({'error': 'Your account is inactive. Contact administrator.'}, status=400)

        tokens = get_tokens(user)
        return Response({
            'tokens': tokens,
            'role':   user.role,
            'user':   UserProfileSerializer(user).data,
            'must_change_password': user.must_change_password,
        })


class AdminListMembersView(APIView):
    """Admin: list all members."""
    permission_classes = [IsAdmin]

    def get(self, request):
        members = User.objects.filter(role='member')
        return Response(AdminUserSerializer(members, many=True).data)


class AdminEditMemberView(APIView):
    """Admin: edit any member's profile."""
    permission_classes = [IsAdmin]

    def patch(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, role='member')
        except User.DoesNotExist:
            return Response({'error': 'Member not found.'}, status=404)

        serializer = AdminUserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


User = get_user_model()

class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'email'

    def validate(self, attrs):
        email = attrs.get('email').strip().lower()
        password = attrs.get('password')

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError('No account found with this email.')

        if not user.check_password(password):
            raise serializers.ValidationError('Incorrect password.')

        if not user.is_active:
            raise serializers.ValidationError('This account is not active yet.')

        # manually set self.user so parent token generation works
        self.user = user

        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)

        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    
class MemberChangePasswordView(APIView):
    """Member changes their own password."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get('current_password', '').strip()
        new_password     = request.data.get('new_password', '').strip()
        confirm_password = request.data.get('confirm_password', '').strip()

        if not current_password or not new_password or not confirm_password:
            return Response(
                {'error': 'All fields are required.'},
                status=400
            )

        if not request.user.check_password(current_password):
            return Response(
                {'error': 'Current password is incorrect.'},
                status=400
            )

        if new_password != confirm_password:
            return Response(
                {'error': 'New passwords do not match.'},
                status=400
            )

        if len(new_password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters.'},
                status=400
            )

        if current_password == new_password:
            return Response(
                {'error': 'New password must be different from current password.'},
                status=400
            )

        request.user.set_password(new_password)
        request.user.must_change_password = False
        request.user.save()
        return Response({'message': 'Password changed successfully.'})


class AdminChangePasswordView(APIView):
    """Admin resets password for any member."""
    permission_classes = [IsAdmin]

    def post(self, request, user_id):
        new_password     = request.data.get('new_password', '').strip()
        confirm_password = request.data.get('confirm_password', '').strip()

        if not new_password or not confirm_password:
            return Response(
                {'error': 'Both password fields are required.'},
                status=400
            )

        if new_password != confirm_password:
            return Response(
                {'error': 'Passwords do not match.'},
                status=400
            )

        if len(new_password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters.'},
                status=400
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=404)

        user.set_password(new_password)
        user.save()
        
        #send password reset email
        email_sent, email_msg = send_password_reset_email(
            user.email, user.full_name, new_password
        )
        return Response({
            'message': f'Password reset successfully for {user.email}.',
            'email_sent': email_sent,
            'email_note': email_msg if not email_sent else 'New password sent to member email'
        })
        
class UpdateProfilePictureView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser]

    def patch(self, request):
        if 'profile_photo' not in request.FILES:
            return Response(
                {'error': 'No image file provided.'},
                status=400
            )

        file = request.FILES['profile_photo']

        # validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
        if file.content_type not in allowed_types:
            return Response(
                {'error': 'Only JPEG, PNG and WebP images are allowed.'},
                status=400
            )

        # validate file size — max 2MB
        if file.size > 2 * 1024 * 1024:
            return Response(
                {'error': 'Image size must be less than 2MB.'},
                status=400
            )

        # delete old photo if exists
        user = request.user
        if user.profile_photo:
            if os.path.isfile(user.profile_photo.path):
                os.remove(user.profile_photo.path)

        user.profile_photo = file
        user.save()

        return Response(UserProfileSerializer(user).data)


class DeleteProfilePictureView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user
        if not user.profile_photo:
            return Response(
                {'error': 'No profile picture to delete.'},
                status=400
            )

        if os.path.isfile(user.profile_photo.path):
            os.remove(user.profile_photo.path)

        user.profile_photo = None
        user.save()
        return Response({'message': 'Profile picture removed.'})
    
class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()

        if not email:
            return Response(
                {'error': 'Email is required.'},
                status=400
            )

        # always return success to prevent email enumeration
        try:
            user = User.objects.get(
                email__iexact=email,
                role='member',
                is_active=True
            )

            # invalidate existing tokens
            PasswordResetToken.objects.filter(
                user=user, is_used=False
            ).update(is_used=True)

            # create new token
            token      = secrets.token_urlsafe(32)
            expires_at = timezone.now() + timedelta(minutes=15)

            reset_token = PasswordResetToken.objects.create(
                user=user,
                token=token,
                expires_at=expires_at,
            )

            # send email
            reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
            send_password_reset_link_email(
                member_email = user.email,
                member_name  = user.full_name or user.email,
                reset_url    = reset_url,
                expires_mins = 15,
            )

        except User.DoesNotExist:
            pass   # don't reveal if email exists

        return Response({
            'message': 'If that email is registered, a reset link has been sent.'
        })


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token            = request.data.get('token', '').strip()
        new_password     = request.data.get('new_password', '').strip()
        confirm_password = request.data.get('confirm_password', '').strip()

        if not token:
            return Response(
                {'error': 'Reset token is required.'},
                status=400
            )

        if not new_password or not confirm_password:
            return Response(
                {'error': 'Both password fields are required.'},
                status=400
            )

        if new_password != confirm_password:
            return Response(
                {'error': 'Passwords do not match.'},
                status=400
            )

        if len(new_password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters.'},
                status=400
            )

        try:
            reset_token = PasswordResetToken.objects.select_related(
                'user'
            ).get(token=token, is_used=False)
        except PasswordResetToken.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired reset link.'},
                status=400
            )

        if reset_token.is_expired:
            return Response(
                {'error': 'This reset link has expired. Please request a new one.'},
                status=400
            )

        # reset password
        user = reset_token.user
        user.set_password(new_password)
        user.must_change_password = False
        user.save()

        # mark token as used
        reset_token.is_used = True
        reset_token.save()

        # invalidate all other tokens for this user
        PasswordResetToken.objects.filter(
            user=user, is_used=False
        ).update(is_used=True)

        return Response({
            'message': 'Password reset successfully. You can now log in.'
        })


class ValidateResetTokenView(APIView):
    """Check if a reset token is still valid before showing the form."""
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get('token', '').strip()

        if not token:
            return Response({'valid': False})

        try:
            reset_token = PasswordResetToken.objects.get(
                token=token, is_used=False
            )
            if reset_token.is_expired:
                return Response({'valid': False, 'reason': 'expired'})
            return Response({
                'valid': True,
                'email': reset_token.user.email,
            })
        except PasswordResetToken.DoesNotExist:
            return Response({'valid': False, 'reason': 'invalid'})