from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'role', 'full_name', 'phone', 'address',
                  'date_joined', 'profile_photo', 'is_active']
        read_only_fields = ['id', 'email', 'role', 'date_joined', 'is_active']

class MemberUpdateProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        max_length = 150, 
        required = True, 
        error_messages = {'blank': 'Full name cannot be empty.'}
    )
    phone = serializers.CharField(
        max_length = 15, 
        required = True, 
        allow_blank = True,
    )
    address = serializers.CharField(
        required = False, 
        allow_blank = True,
    )
    
    class Meta:
        model = User
        fields = ['full_name', 'phone', 'address']
        
    def validate_full_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Full name cannot be empty.')
        if len(value) < 3:
            raise serializers.ValidationError(
                'Full name must have at least 3 characters.'
            )
        return value
    
    def validate_phone(self, value):
        value = value.strip()
        if value and not value.replace('+', '').replace('-', '').replace(' ', '').isdigit():
            raise serializers.ValidationError('Enter a valid phone number.')
        return value

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'role', 'full_name', 'phone', 'address',
                  'date_joined', 'is_active']
        read_only_fields = ['id', 'email', 'date_joined']