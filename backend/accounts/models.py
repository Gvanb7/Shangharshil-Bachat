from django.db import models
import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin, Group, Permission
import secrets
from django.conf import settings

# Create your models here.
class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra):
        extra.setdefault('role', 'admin')
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('is_active', True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = (
        ('admin', 'Administrator'),
        ('member', 'Member'),
    )

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email        = models.EmailField(unique=True)
    role         = models.CharField(max_length=10, choices=ROLE_CHOICES, default='member')

    full_name    = models.CharField(max_length=150, blank=True)
    phone        = models.CharField(max_length=20, blank=True)
    address      = models.TextField(blank=True)
    date_joined  = models.DateField(auto_now_add=True)
    profile_photo = models.ImageField(upload_to='profiles/', null=True, blank=True)

    is_active    = models.BooleanField(default=False)   # False until OTP verified
    is_staff     = models.BooleanField(default=False)
    must_change_password = models.BooleanField(default=False)
    
    groups = models.ManyToManyField(
        Group,
        related_name='custom_user_set',  # unique name
        blank=True
    )
    user_permissions = models.ManyToManyField(
        Permission,
        related_name='custom_user_permissions_set',  # unique name
        blank=True
    )

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ['full_name']

    def __str__(self):
        return f'{self.full_name or self.email} ({self.role})'

    @property
    def is_admin(self):
        return self.role == 'admin'


class OTPRequest(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email      = models.EmailField()
    otp_code   = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used    = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'OTP for {self.email}'

class PasswordResetToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
                settings.AUTH_USER_MODEL, 
                on_delete = models.CASCADE,
                related_name = 'reset_tokens'
            )
    token = models.CharField(max_length = 64, unique=True)
    created_at = models.DateField(auto_now_add = True)
    expires_at = models.DateField()
    is_used    = models.BooleanField(default = False)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f'Reset token for {self.user.email}'
    
    @property
    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at