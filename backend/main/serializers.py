from rest_framework import serializers
from decimal import Decimal
from .models import(
    Penalty, SavingsAccount, SavingsTransaction, Loan, LoanRepayment, Expenditure,
    ExpenditureCategory, Income, IncomeCategory, MemberDocument, Account, AccountTransaction,
    TrialBalance, CooperativeSettings, Borrower, Notice,
)
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
    member_name   = serializers.SerializerMethodField()
    member_phone  = serializers.SerializerMethodField()
    is_member_loan = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Loan
        fields = [
            'id', 'member', 'borrower', 'member_name', 'member_phone',
            'is_member_loan', 'principal', 'purpose', 'interest_rate',
            'term_months', 'first_due_date', 'status', 'amount_paid',
            'amount_remaining', 'disbursed_on', 'created_at',
        ]
        read_only_fields = ['id', 'amount_paid', 'amount_remaining', 'created_at']

    def get_member_name(self, obj):
        return obj.borrower_name

    def get_member_phone(self, obj):
        return obj.borrower_phone
    
class LoanRepaymentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)

    class Meta:
        model  = LoanRepayment
        fields = [
            'id', 'loan', 'amount_paid', 'penalty_portion',
            'principal_portion', 'interest_portion', 'balance_after', 
            'note','recorded_by', 'recorded_by_name', 
            'paid_at', 'nepali_date',
        ]
        read_only_fields = [
            'id', 'penalty_portion', 'principal_portion', 'interest_portion',
            'balance_after', 'recorded_by', 'paid_at',
        ]
        
class RepaymentInputSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    note   = serializers.CharField(required=False, allow_blank=True, default='')
    paid_at = serializers.DateField()
    nepali_date = serializers.CharField(max_length=20)

    def validate_amount(self, value):
        if value <= Decimal('0.00'):
            raise serializers.ValidationError('Amount must be greater than zero.')
        return value
    
    def validate_nepali_date(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Date is required.')
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
        
class MemberDocumentSerializer(serializers.ModelSerializer):
    citizenship_front_url = serializers.SerializerMethodField()
    citizenship_back_url  = serializers.SerializerMethodField()
    signature_url         = serializers.SerializerMethodField()

    class Meta:
        model  = MemberDocument
        fields = [
            'id', 'member',
            'citizenship_front', 'citizenship_front_url',
            'citizenship_back',  'citizenship_back_url',
            'signature',         'signature_url',
            'uploaded_at',
        ]
        read_only_fields = ['id', 'uploaded_at']

    def _build_url(self, obj, field_name):
        request = self.context.get('request')
        field   = getattr(obj, field_name)
        if field and request:
            return request.build_absolute_uri(field.url)
        elif field:
            return field.url
        return None

    def get_citizenship_front_url(self, obj):
        return self._build_url(obj, 'citizenship_front')

    def get_citizenship_back_url(self, obj):
        return self._build_url(obj, 'citizenship_back')

    def get_signature_url(self, obj):
        return self._build_url(obj, 'signature')
    
class AccountSerializer(serializers.ModelSerializer):
    account_type_display = serializers.CharField(
        source='get_account_type_display', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )

    class Meta:
        model  = Account
        fields = [
            'id', 'name', 'account_type', 'account_type_display',
            'bank_name', 'account_number', 'branch',
            'opening_balance', 'balance', 'is_active',
            'created_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'balance', 'created_at']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Account name is required.')
        return value

    def validate_opening_balance(self, value):
        if value < 0:
            raise serializers.ValidationError(
                'Opening balance cannot be negative.'
            )
        return value


class AccountTransactionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )
    account_name = serializers.CharField(
        source='account.name', read_only=True
    )

    class Meta:
        model  = AccountTransaction
        fields = [
            'id', 'account', 'account_name', 'transaction_type',
            'amount', 'balance_after', 'reference_type',
            'reference_id', 'note', 'nepali_date',
            'created_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']
        
class TrialBalanceSerializer(serializers.ModelSerializer):
    generated_by_name = serializers.CharField(
        source='generated_by.full_name', read_only=True
    )

    class Meta:
        model  = TrialBalance
        fields = [
            'id', 'period_type', 'bs_year', 'bs_month', 'bs_month_name',
            'fiscal_year', 'start_date_ad', 'end_date_ad',
            'generated_at', 'generated_by_name', 'is_auto_generated',
            'opening_equity', 'total_assets', 'total_liabilities',
            'total_income', 'total_expenses', 'net_surplus',
            'closing_equity', 'is_balanced', 'line_items',
        ]
        read_only_fields = fields


class CooperativeSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CooperativeSettings
        fields = ['opening_equity', 'opening_equity_set', 'updated_at']
        
class PenaltySerializer(serializers.ModelSerializer):
    member_name     = serializers.CharField(source='member.full_name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)
    account_name    = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model  = Penalty
        fields = [
            'id', 'penalty_type', 'member', 'member_name',
            'savings_account', 'loan', 'amount', 'amount_remaining',
            'reason', 'account', 'account_name', 'nepali_date',
            'is_paid', 'recorded_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'amount_remaining', 'is_paid', 'created_at']
        
class BorrowerSerializer(serializers.ModelSerializer):
    citizenship_front_url = serializers.SerializerMethodField()
    citizenship_back_url  = serializers.SerializerMethodField()
    signature_url         = serializers.SerializerMethodField()
    photo_url              = serializers.SerializerMethodField()

    class Meta:
        model  = Borrower
        fields = [
            'id', 'full_name', 'phone', 'address',
            'citizenship_front', 'citizenship_front_url',
            'citizenship_back',  'citizenship_back_url',
            'signature',          'signature_url',
            'photo',               'photo_url',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def _build_url(self, obj, field_name):
        request = self.context.get('request')
        field   = getattr(obj, field_name)
        if field and request:
            return request.build_absolute_uri(field.url)
        elif field:
            return field.url
        return None

    def get_citizenship_front_url(self, obj):
        return self._build_url(obj, 'citizenship_front')

    def get_citizenship_back_url(self, obj):
        return self._build_url(obj, 'citizenship_back')

    def get_signature_url(self, obj):
        return self._build_url(obj, 'signature')

    def get_photo_url(self, obj):
        return self._build_url(obj, 'photo')
    
class NoticeSerializer(serializers.ModelSerializer):
    created_by_name  = serializers.CharField(
                           source='created_by.full_name',
                           read_only=True
                       )
    attachment_url   = serializers.SerializerMethodField()
    unread_count     = serializers.SerializerMethodField()

    class Meta:
        model  = Notice
        fields = [
            'id', 'title', 'body',
            'attachment', 'attachment_url', 'attachment_type',
            'is_active', 'is_pinned',
            'nepali_date', 'published_at',
            'created_by_name', 'created_at', 'updated_at',
            'unread_count',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.attachment.url)
        return obj.attachment.url

    def get_unread_count(self, obj):
        # returns how many members haven't read this notice
        from accounts.models import User
        total_members = User.objects.filter(
            role='member', is_active=True
        ).count()
        read_count = obj.reads.count()
        return max(0, total_members - read_count)


class MemberNoticeSerializer(serializers.ModelSerializer):
    """Serializer for member-facing notice view — includes is_read flag."""
    created_by_name = serializers.CharField(
                          source='created_by.full_name',
                          read_only=True
                      )
    attachment_url  = serializers.SerializerMethodField()
    is_read         = serializers.SerializerMethodField()

    class Meta:
        model  = Notice
        fields = [
            'id', 'title', 'body',
            'attachment_url', 'attachment_type',
            'is_pinned', 'nepali_date', 'published_at',
            'created_by_name', 'created_at',
            'is_read',
        ]

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.attachment.url)
        return obj.attachment.url

    def get_is_read(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.reads.filter(member=request.user).exists()