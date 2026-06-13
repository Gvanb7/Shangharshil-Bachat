from django.urls import path
from . import views

urlpatterns = [
    # Auth (public)
    path('auth/login/',        views.MemberLoginView.as_view()),
    path('auth/me/',            views.MeView.as_view()),
    path('auth/complete-profile/', views.CompleteProfileView.as_view()),
    path('auth/change-password/', views.MemberChangePasswordView.as_view()),
    path('auth/profile-picture/', views.UpdateProfilePictureView.as_view()),
    path('auth/profile-picture/delete/', views.DeleteProfilePictureView.as_view()),
    path('auth/forgot-password/',       views.ForgotPasswordView.as_view()),
    path('auth/reset-password/',        views.ResetPasswordView.as_view()),
    path('auth/validate-reset-token/',  views.ValidateResetTokenView.as_view()),

    # Admin only
    path('admin/members/',           views.AdminListMembersView.as_view()),
    path('admin/members/register/',  views.AdminRegisterMemberView.as_view()),
    path('admin/members/<uuid:user_id>/', views.AdminEditMemberView.as_view()),
    path('admin/members/<uuid:user_id>/reset-password/', views.AdminChangePasswordView.as_view()),
    path('admin/members/<uuid:user_id>/documents/', views.AdminMemberDocumentView.as_view()),
]