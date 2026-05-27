from rest_framework import serializers
from decimal import Decimal
from .models import SavingsAccount, SavingsTransaction, Loan, LoanRepayment, Expenditure, ExpenditureCategory, Income, IncomeCategory
from .services import calculate_loan_summary

class SavingsAccountSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    member_email = serializers.EmailField(source='member.email', read_only=True)
    
    class Meta:
        model = SavingsAccount
        fields = [
            'id', 'member', 'member_name', 'member_email', 
            'balance', 'interest_rate', 'opened_on', 'is_active',
        ]
        read_only_fields = ['id', 'member_name', 'member_email', 'opened_on']
        
class SavingsTransactionSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)
    
    class Meta:
        model = SavingsTransaction
        fields = [
            'id', 'account', 'type', 'amount', 'balance_after', 
            'note', 'recorded_by', 'recorded_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'balance_after', 'recorded_by_name', 'created_at']
        
class DepositWithdrawSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    note = serializers.CharField(allow_blank=True, required=False, default='')
    
    def validate_amount(self, value):
        if value <= Decimal('0.00'):
            raise serializers.ValidationError('Amount must be greater than zero.')
        return value
    
class LoanSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True)
    loan_summary = serializers.SerializerMethodField()
    
    class Meta:
        model = Loan
        fields = [
            'id', 'member', 'member_name', 'principal', 'interest_rate', 
            'term_months', 'status', 'monthly_installment', 'total_payable',
            'amount_paid', 'amount_remaining', 'purpose', 'disbursed_on', 
            'due_date', 'approved_by', 'approved_by_name', 'loan_summary',
            'created_at',
        ]
        read_only_fields = [
            'id', 'status', 'monthly_installment', 
            'toal_payable', 'amount_paid', 'amount_remaining', 
            'disbursed_on', 'due_date', 'approved_by', 'created_at',
        ]
        
    def get_loan_summary(self, obj):
        if obj.status == 'pending':
            return calculate_loan_summary(obj.principal, obj.interest_rate, obj.term_months)
        return None
    
class LoanRepaymentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)

    class Meta:
        model  = LoanRepayment
        fields = [
            'id', 'loan', 'amount_paid', 'principal_portion',
            'interest_portion', 'balance_after', 'note',
            'recorded_by', 'recorded_by_name', 'paid_at',
        ]
        read_only_fields = [
            'id', 'principal_portion', 'interest_portion',
            'balance_after', 'recorded_by', 'paid_at',
        ]
        
class RepaymentInputSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    note   = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_amount(self, value):
        if value <= Decimal('0.00'):
            raise serializers.ValidationError('Amount must be greater than zero.')
        return value


class ExpenditureSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)
    category_name = serializers.CharField(
        source = 'category.name', read_only = True
    )
    class Meta:
        model  = Expenditure
        fields = [
            'id', 'category', 'amount', 'description', 'category_name',
            'expense_date', 'recorded_by', 'recorded_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'recorded_by', 'created_at']
        

class ExpenditureCategorySerializer(serializers.ModelSerializer):
    expenditure_count = serializers.IntegerField(
        source='expenditures.count',
        read_only=True
    )

    class Meta:
        model  = ExpenditureCategory
        fields = ['id', 'name', 'is_active', 'expenditure_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Category name cannot be empty.')
        if len(value) < 2:
            raise serializers.ValidationError(
                'Category name must be at least 2 characters.'
            )
        return value
    
class IncomeCategorySerializer(serializers.ModelSerializer):
    income_count = serializers.IntegerField(
        source='incomes.count',
        read_only=True
    )

    class Meta:
        model  = IncomeCategory
        fields = ['id', 'name', 'is_active', 'income_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Category name cannot be empty.')
        if len(value) < 2:
            raise serializers.ValidationError(
                'Category name must be at least 2 characters.'
            )
        return value


class IncomeSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(
        source='recorded_by.full_name', read_only=True
    )
    category_name = serializers.CharField(
        source='category.name', read_only=True
    )

    class Meta:
        model  = Income
        fields = [
            'id', 'category', 'category_name', 'amount', 'description',
            'income_date', 'recorded_by', 'recorded_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'recorded_by', 'created_at']