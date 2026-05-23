from django.urls import path
from . import views

urlpatterns = [

    # ── Savings accounts ─────────────────────────────────────────────────────
    path('savings/', views.AdminListSavingsAccountsView.as_view()),
    path('savings/create/', views.AdminCreateSavingsAccountView.as_view()),
    path('savings/apply-interest/', views.AdminApplyInterestView.as_view()),
    path('savings/<uuid:account_id>/', views.AdminSavingsAccountDetailView.as_view()),
    path('savings/<uuid:account_id>/deposit/',  views.AdminDepositView.as_view()),
    path('savings/<uuid:account_id>/withdraw/', views.AdminWithdrawView.as_view()),
    path('savings/<uuid:account_id>/transactions/', views.AdminTransactionListView.as_view()),

    # ── Member savings (own) ─────────────────────────────────────────────────
    path('member/savings/', views.MemberSavingsView.as_view()),

    # ── Loans ─────────────────────────────────────────────────────────────────
    path('loans/', views.AdminListLoansView.as_view()),
    path('loans/create/', views.AdminCreateLoanView.as_view()),
    path('loans/<uuid:loan_id>/', views.AdminLoanDetailView.as_view()),
    path('loans/<uuid:loan_id>/approve/', views.AdminApproveLoanView.as_view()),
    path('loans/<uuid:loan_id>/reject/', views.AdminRejectLoanView.as_view()),
    path('loans/<uuid:loan_id>/disburse/', views.AdminDisburseLoanView.as_view()),
    path('loans/<uuid:loan_id>/repay/', views.AdminRecordRepaymentView.as_view()),
    path('loans/<uuid:loan_id>/repayments/', views.AdminLoanRepaymentListView.as_view()),
    path('loans/<uuid:loan_id>/schedule/', views.AdminLoanScheduleView.as_view()),

    # ── Member loans (own) ────────────────────────────────────────────────────
    path('member/loans/', views.MemberLoanView.as_view()),

    # ── Expenditure ───────────────────────────────────────────────────────────
    path('expenditures/', views.AdminExpenditureView.as_view()),
    path('expenditures/<uuid:expenditure_id>/',
         views.AdminExpenditureView.as_view()),
    path('expenditures/categories/',
         views.AdminCategoryListCreateView.as_view()),
    path('expenditures/categories/<uuid:category_id>/',
         views.AdminCategoryDetailView.as_view()),
]