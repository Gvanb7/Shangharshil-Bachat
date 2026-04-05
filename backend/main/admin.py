from django.contrib import admin
from .models import SavingsAccount, SavingsTransaction, Loan, LoanRepayment, Expenditure


@admin.register(SavingsAccount)
class SavingsAccountAdmin(admin.ModelAdmin):
    list_display  = ['member', 'balance', 'interest_rate', 'opened_on', 'is_active']
    list_filter   = ['is_active']
    search_fields = ['member__full_name', 'member__email']


@admin.register(SavingsTransaction)
class SavingsTransactionAdmin(admin.ModelAdmin):
    list_display  = ['account', 'type', 'amount', 'balance_after', 'created_at']
    list_filter   = ['type']
    search_fields = ['account__member__full_name']


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display  = ['member', 'principal', 'interest_rate', 'term_months', 'status', 'created_at']
    list_filter   = ['status']
    search_fields = ['member__full_name', 'member__email']


@admin.register(LoanRepayment)
class LoanRepaymentAdmin(admin.ModelAdmin):
    list_display  = ['loan', 'amount_paid', 'principal_portion', 'interest_portion', 'paid_at']
    search_fields = ['loan__member__full_name']


@admin.register(Expenditure)
class ExpenditureAdmin(admin.ModelAdmin):
    list_display  = ['category', 'amount', 'expense_date', 'recorded_by']
    list_filter   = ['category']
    search_fields = ['description']