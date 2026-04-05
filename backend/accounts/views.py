from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

from .utils import create_and_send_otp, verify_otp
from .serializers import UserProfileSerializer, AdminUserSerializer
from .permissions import IsAdmin

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from django.contrib.auth import get_user_model

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
        user = request.user
        serializer = UserProfileSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


class MeView(APIView):
    """Returns current logged-in user's profile."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserProfileSerializer(request.user).data)


class AdminRegisterMemberView(APIView):
    """Admin pre-registers a member email so they can sign up."""
    permission_classes = [IsAdmin]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'Email is required.'}, status=400)

        if User.objects.filter(email=email).exists():
            return Response({'error': 'This email is already registered.'}, status=400)

        user = User.objects.create_user(email=email, role='member')
        return Response(
            {'message': f'Member {email} registered. They can now sign up via OTP.'},
            status=201,
        )


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
        email = attrs.get('email')
        password = attrs.get('password')

        try:
            user = User.objects.get(email=email)
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