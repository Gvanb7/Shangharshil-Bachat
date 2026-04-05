from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'role', 'full_name', 'phone', 'address',
                  'date_joined', 'profile_photo', 'is_active']
        read_only_fields = ['id', 'email', 'role', 'date_joined', 'is_active']


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'role', 'full_name', 'phone', 'address',
                  'date_joined', 'is_active']
        read_only_fields = ['id', 'email', 'date_joined']