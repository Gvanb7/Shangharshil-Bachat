from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    message = 'Access denied. Admin only.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'admin'
        )


class IsMember(BasePermission):
    message = 'Access denied. Members only.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'member'
        )