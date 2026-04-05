from django.urls import path
from . import views

urlpatterns = [
    # Auth (public)
    path('auth/request-otp/',   views.RequestOTPView.as_view()),
    path('auth/verify-otp/',    views.VerifyOTPView.as_view()),

    # Member (authenticated)
    path('auth/me/',            views.MeView.as_view()),
    path('auth/complete-profile/', views.CompleteProfileView.as_view()),

    # Admin only
    path('admin/members/',           views.AdminListMembersView.as_view()),
    path('admin/members/register/',  views.AdminRegisterMemberView.as_view()),
    path('admin/members/<uuid:user_id>/', views.AdminEditMemberView.as_view()),
]