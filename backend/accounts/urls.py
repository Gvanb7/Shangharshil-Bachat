from django.urls import path
from . import views

urlpatterns = [
    # Auth (public)
    path('auth/login/',        views.MemberLoginView.as_view()),
    path('auth/me/',            views.MeView.as_view()),
    path('auth/complete-profile/', views.CompleteProfileView.as_view()),

    # Admin only
    path('admin/members/',           views.AdminListMembersView.as_view()),
    path('admin/members/register/',  views.AdminRegisterMemberView.as_view()),
    path('admin/members/<uuid:user_id>/', views.AdminEditMemberView.as_view()),
]