from django.utils import timezone
import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from decimal import Decimal


class SavingsAccount(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member         = models.OneToOneField(
                         settings.AUTH_USER_MODEL,
                         on_delete=models.PROTECT,
                         related_name='savings_account'
                     )
    balance        = models.DecimalField(
                         max_digits=12, decimal_places=2,
                         default=Decimal('0.00'),
                         validators=[MinValueValidator(Decimal('0.00'))]
                     )
    interest_rate  = models.DecimalField(
                         max_digits=5, decimal_places=2,
                         default=Decimal('5.00'),         # 5% annual, configurable per account
                         validators=[MinValueValidator(Decimal('0.00'))]
                     )
    opened_on      = models.DateField(auto_now_add=True)
    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)
    last_interest_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['opened_on']

    def __str__(self):
        return f'Savings — {self.member.full_name or self.member.email}'


class SavingsTransaction(models.Model):
    TYPE_CHOICES = (
        ('deposit',          'Deposit'),
        ('withdrawal',       'Withdrawal'),
        ('interest_credit',  'Interest Credit'),
    )

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account     = models.ForeignKey(
                      SavingsAccount,
                      on_delete=models.PROTECT,
                      related_name='transactions'
                  )
    type        = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount      = models.DecimalField(
                      max_digits=12, decimal_places=2,
                      validators=[MinValueValidator(Decimal('0.01'))]
                  )
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)   # snapshot
    note          = models.TextField(blank=True)
    recorded_by   = models.ForeignKey(
                        settings.AUTH_USER_MODEL,
                        on_delete=models.PROTECT,
                        related_name='recorded_transactions'
                    )
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.type} Rs.{self.amount} — {self.account.member.full_name}'


class Loan(models.Model):
    STATUS_CHOICES = (
        ('pending',    'Pending Approval'),
        ('approved',   'Approved'),
        ('active',     'Active'),
        ('closed',     'Closed'),
        ('rejected',   'Rejected'),
    )

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member          = models.ForeignKey(
                          settings.AUTH_USER_MODEL,
                          on_delete=models.PROTECT,
                          related_name='loans',
                          null = True, blank = True
                      )
    borrower        = models.ForeignKey(
                          'Borrower',
                          on_delete=models.PROTECT,
                          related_name='loans',
                          null = True, blank = True
                      )
    principal       = models.DecimalField(
                          max_digits=12, decimal_places=2,
                          validators=[MinValueValidator(Decimal('1.00'))]
                      )
    interest_rate   = models.DecimalField(
                          max_digits=5, decimal_places=2,
                          default=Decimal('12.00'),        # 12% annual reducing balance
                          validators=[MinValueValidator(Decimal('0.00'))]
                      )
    term_months     = models.PositiveIntegerField()         # loan duration in months
    status          = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')

    monthly_installment = models.DecimalField(
                              max_digits=12, decimal_places=2,
                              default=Decimal('0.00')
                          )
    total_payable    = models.DecimalField(
                           max_digits=12, decimal_places=2,
                           default=Decimal('0.00')
                       )
    amount_paid      = models.DecimalField(
                           max_digits=12, decimal_places=2,
                           default=Decimal('0.00')
                       )
    amount_remaining = models.DecimalField(
                           max_digits=12, decimal_places=2,
                           default=Decimal('0.00')
                       )

    purpose          = models.TextField(blank=True)
    disbursed_on     = models.DateField(null=True, blank=True)
    due_date         = models.DateField(null=True, blank=True)

    approved_by      = models.ForeignKey(
                           settings.AUTH_USER_MODEL,
                           on_delete=models.SET_NULL,
                           null=True, blank=True,
                           related_name='approved_loans'
                       )
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)
    first_due_date   = models.DateField(null=True, blank=True)
    class Meta:
        ordering = ['-created_at']
        
    def clean(self):
        from django.core.exceptions import ValidationError
        if not self.member and not self.borrower:
            raise ValidationError('Loan must have either a member or a borrower.')
        if self.member and self.borrower:
            raise ValidationError('Loan cannot have both a member and a borrower.')

    @property
    def borrower_name(self):
        if self.member:
            return self.member.full_name or self.member.email
        if self.borrower:
            return self.borrower.full_name
        return 'Unknown'

    @property
    def borrower_phone(self):
        if self.member:
            return self.member.phone
        if self.borrower:
            return self.borrower.phone
        return ''

    @property
    def is_member_loan(self):
        return self.member is not None
        
    def __str__(self):
        return f'Loan Rs.{self.principal} - {self.borrower_name}'
    
class LoanRepayment(models.Model):
    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan               = models.ForeignKey(
                             Loan,
                             on_delete=models.PROTECT,
                             related_name='repayments'
                         )
    amount_paid        = models.DecimalField(
                             max_digits=12, decimal_places=2,
                             validators=[MinValueValidator(Decimal('0.01'))]
                         )
    penalty_portion    = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    principal_portion  = models.DecimalField(max_digits=12, decimal_places=2)
    interest_portion   = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after      = models.DecimalField(max_digits=12, decimal_places=2)   # snapshot
    note               = models.TextField(blank=True)
    recorded_by        = models.ForeignKey(
                             settings.AUTH_USER_MODEL,
                             on_delete=models.PROTECT,
                             related_name='recorded_repayments'
                         )
    paid_at            = models.DateField()
    nepali_date        = models.CharField(max_length=20, blank=True)
    created_at         = models.DateTimeField(default = timezone.now)


    class Meta:
        ordering = ['-paid_at']

    def __str__(self):
        return f'Repayment Rs.{self.amount_paid} — Loan {self.loan.id}'

    
class ExpenditureCategory(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name       = models.CharField(max_length=100, unique=True)
    created_by = models.ForeignKey(
                     settings.AUTH_USER_MODEL,
                     on_delete=models.SET_NULL,
                     null=True,
                     related_name='created_categories'
                 )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active  = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
    
class Expenditure(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category     = models.ForeignKey(
                       ExpenditureCategory,
                       on_delete= models.PROTECT,
                       related_name= 'expenditures'
                )
    amount       = models.DecimalField(
                       max_digits=12, decimal_places=2,
                       validators=[MinValueValidator(Decimal('0.01'))]
                   )
    description  = models.TextField()
    expense_date = models.DateField()
    recorded_by  = models.ForeignKey(
                       settings.AUTH_USER_MODEL,
                       on_delete=models.PROTECT,
                       related_name='expenditures'
                   )
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-expense_date']

    def __str__(self):
        return f'{self.category} Rs.{self.amount} — {self.expense_date}'
    
class IncomeCategory(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name       = models.CharField(max_length=100, unique=True)
    created_by = models.ForeignKey(
                     settings.AUTH_USER_MODEL,
                     on_delete=models.SET_NULL,
                     null=True,
                     related_name='created_income_categories'
                 )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active  = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Income(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category     = models.ForeignKey(
                       IncomeCategory,
                       on_delete=models.PROTECT,
                       related_name='incomes'
                   )
    amount       = models.DecimalField(
                       max_digits=12, decimal_places=2,
                       validators=[MinValueValidator(Decimal('0.01'))]
                   )
    description  = models.TextField()
    income_date  = models.DateField()
    recorded_by  = models.ForeignKey(
                       settings.AUTH_USER_MODEL,
                       on_delete=models.PROTECT,
                       related_name='recorded_incomes'
                   )
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-income_date']

    def __str__(self):
        return f'{self.category.name} Rs.{self.amount} — {self.income_date}'
    
class MemberDocument(models.Model):
    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member             = models.OneToOneField(
                             settings.AUTH_USER_MODEL,
                             on_delete=models.CASCADE,
                             related_name='document'
                         )
    citizenship_front  = models.ImageField(upload_to='documents/citizenship/')
    citizenship_back   = models.ImageField(upload_to='documents/citizenship/')
    signature          = models.ImageField(upload_to='documents/signatures/')
    uploaded_at        = models.DateTimeField(auto_now_add=True)
    updated_at         = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Documents — {self.member.full_name or self.member.email}'
    
class Account(models.Model):
    ACCOUNT_TYPES = [
        ('cash',    'Cash'),
        ('bank',    'Bank'),
        ('digital', 'Digital Wallet'),
        ('other',   'Other'),
    ]

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name            = models.CharField(max_length=100)
    account_type    = models.CharField(max_length=20, choices=ACCOUNT_TYPES, default='cash')
    bank_name       = models.CharField(max_length=100, blank=True)
    account_number  = models.CharField(max_length=50,  blank=True)
    branch          = models.CharField(max_length=100, blank=True)
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance         = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active       = models.BooleanField(default=True)
    created_by      = models.ForeignKey(
                          settings.AUTH_USER_MODEL,
                          on_delete=models.SET_NULL,
                          null=True,
                          related_name='created_accounts'
                      )
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['account_type', 'name']

    def __str__(self):
        return f'{self.name} ({self.get_account_type_display()})'


class AccountTransaction(models.Model):
    REFERENCE_TYPES = [
        ('savings_deposit',    'Savings Deposit'),
        ('savings_withdrawal', 'Savings Withdrawal'),
        ('loan_disbursement',  'Loan Disbursement'),
        ('loan_repayment',     'Loan Repayment'),
        ('income',             'Income'),
        ('expenditure',        'Expenditure'),
        ('transfer_in',        'Transfer In'),
        ('transfer_out',       'Transfer Out'),
        ('adjustment_add',     'Manual Adjustment (Add)'),
        ('adjustment_reduce',  'Manual Adjustment (Reduce)'),
    ]

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account          = models.ForeignKey(
                           Account,
                           on_delete=models.PROTECT,
                           related_name='transactions'
                       )
    transaction_type = models.CharField(
                           max_length=10,
                           choices=[('credit', 'Credit'), ('debit', 'Debit')]
                       )
    amount           = models.DecimalField(
                           max_digits=12, decimal_places=2,
                           validators=[MinValueValidator(Decimal('0.01'))]
                       )
    balance_after    = models.DecimalField(max_digits=12, decimal_places=2)
    reference_type   = models.CharField(max_length=30, choices=REFERENCE_TYPES)
    reference_id     = models.UUIDField(null=True, blank=True)
    note             = models.TextField(blank=True)
    nepali_date      = models.CharField(max_length=20, blank=True)
    created_by       = models.ForeignKey(
                           settings.AUTH_USER_MODEL,
                           on_delete=models.PROTECT,
                           related_name='account_transactions'
                       )
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.transaction_type} Rs.{self.amount} — {self.account.name}'
    
class TrialBalance(models.Model):
    PERIOD_TYPES = [
        ('monthly', 'Monthly'),
        ('annual',  'Annual'),
    ]

    id                = models.UUIDField(
                            primary_key=True,
                            default=uuid.uuid4,
                            editable=False
                        )
    period_type       = models.CharField(max_length=10, choices=PERIOD_TYPES)
    bs_year           = models.IntegerField()
    bs_month          = models.IntegerField(null=True, blank=True)
    bs_month_name     = models.CharField(max_length=20, blank=True)
    fiscal_year       = models.CharField(max_length=10)
    start_date_ad     = models.DateField()
    end_date_ad       = models.DateField()
    generated_at      = models.DateTimeField(auto_now_add=True)
    generated_by      = models.ForeignKey(
                            settings.AUTH_USER_MODEL,
                            on_delete=models.SET_NULL,
                            null=True, blank=True,
                            related_name='generated_statements'
                        )
    is_auto_generated = models.BooleanField(default=False)

    class Meta:
        ordering        = ['-bs_year', '-bs_month']
        unique_together = [['period_type', 'bs_year', 'bs_month']]

    def __str__(self):
        if self.period_type == 'monthly':
            return f'Trial Balance {self.bs_month_name} {self.bs_year}'
        return f'Annual Trial Balance FY {self.fiscal_year}'

class CooperativeSettings(models.Model):
    """Stores cooperative-wide settings like opening equity."""
    opening_equity     = models.DecimalField(
                             max_digits=14, decimal_places=2, default=0
                         )
    opening_equity_set = models.BooleanField(default=False)
    updated_at         = models.DateTimeField(auto_now=True)
    updated_by         = models.ForeignKey(
                             settings.AUTH_USER_MODEL,
                             on_delete=models.SET_NULL,
                             null=True, blank=True,
                             related_name='settings_updates'
                         )

    class Meta:
        verbose_name = 'Cooperative Settings'

    def __str__(self):
        return f'Settings (Opening Equity: Rs. {self.opening_equity})'
    
class Penalty(models.Model):
    PENALTY_TYPES = [
        ('savings', 'Savings Penalty'),
        ('loan',    'Loan Penalty'),
    ]

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    penalty_type    = models.CharField(max_length=10, choices=PENALTY_TYPES)
    member          = models.ForeignKey(
                          settings.AUTH_USER_MODEL,
                          on_delete=models.CASCADE,
                          related_name='penalties',
                          null = True, blank = True,
                      )
    borrower       = models.ForeignKey(
                            'Borrower',
                            on_delete=models.CASCADE,
                            null=True, blank=True,
                            related_name='penalties'
                        )
    savings_account = models.ForeignKey(
                          SavingsAccount,
                          on_delete=models.CASCADE,
                          null=True, blank=True,
                          related_name='penalties'
                      )
    loan            = models.ForeignKey(
                          Loan,
                          on_delete=models.CASCADE,
                          null=True, blank=True,
                          related_name='penalties'
                      )
    amount          = models.DecimalField(
                          max_digits=12, decimal_places=2,
                          validators=[MinValueValidator(Decimal('0.01'))]
                      )
    amount_remaining = models.DecimalField(
                          max_digits=12, decimal_places=2,
                          default=Decimal('0.00')
                      )  # tracks unpaid portion for loan penalties
    reason          = models.TextField(blank=True)
    account         = models.ForeignKey(
                          Account,
                          on_delete=models.SET_NULL,
                          null=True, blank=True,
                          related_name='penalty_collections'
                      )  # only used for savings penalty (immediate cash)
    nepali_date     = models.CharField(max_length=20, blank=True)
    is_paid         = models.BooleanField(default=False)  # for loan penalty
    recorded_by     = models.ForeignKey(
                          settings.AUTH_USER_MODEL,
                          on_delete=models.PROTECT,
                          related_name='recorded_penalties'
                      )
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        
    @property
    def borrower_name(self):
        if self.member:
            return self.member.full_name or self.member.email
        if self.borrower:
            return self.borrower.full_name
        return 'Unknown'

    def __str__(self):
        return f'{self.get_penalty_type_display()} Rs.{self.amount} — {self.borrower_name}'
    
class Borrower(models.Model):
    """External (non-member) loan borrower."""
    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name          = models.CharField(max_length=200)
    phone              = models.CharField(max_length=20)
    address            = models.TextField()
    citizenship_front  = models.ImageField(upload_to='borrowers/citizenship/')
    citizenship_back   = models.ImageField(upload_to='borrowers/citizenship/')
    signature          = models.ImageField(upload_to='borrowers/signatures/')
    photo              = models.ImageField(upload_to='borrowers/photos/')
    created_by         = models.ForeignKey(
                             settings.AUTH_USER_MODEL,
                             on_delete=models.SET_NULL,
                             null=True,
                             related_name='created_borrowers'
                         )
    created_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['full_name']

    def __str__(self):
        return f'{self.full_name} ({self.phone})'

class TransactionEditLog(models.Model):
    TRANSACTION_TYPES = [
        ('savings_deposit',    'Savings Deposit'),
        ('savings_withdrawal', 'Savings Withdrawal'),
        ('savings_penalty',    'Savings Penalty'),
        ('income',             'Income'),
        ('expenditure',        'Expenditure'),
    ]

    id               = models.UUIDField(
                           primary_key=True,
                           default=uuid.uuid4,
                           editable=False
                       )
    transaction_type = models.CharField(max_length=30, choices=TRANSACTION_TYPES)
    reference_id     = models.UUIDField()   # id of the original transaction
    original_data    = models.JSONField()   # snapshot of original values
    corrected_data   = models.JSONField()   # snapshot of corrected values
    edited_by        = models.ForeignKey(
                           settings.AUTH_USER_MODEL,
                           on_delete=models.PROTECT,
                           related_name='transaction_edits'
                       )
    edited_at        = models.DateTimeField(auto_now_add=True)
    reason           = models.TextField(blank=True)

    class Meta:
        ordering = ['-edited_at']

    def __str__(self):
        return f'Edit {self.transaction_type} {self.reference_id} by {self.edited_by.email}'
    
class Notice(models.Model):
    id          = models.UUIDField(
                      primary_key=True,
                      default=uuid.uuid4,
                      editable=False
                  )
    title       = models.CharField(max_length=200)
    body        = models.TextField(blank=True)
    attachment  = models.FileField(
                      upload_to='notices/',
                      null=True,
                      blank=True
                  )
    attachment_type = models.CharField(
                          max_length=10,
                          blank=True
                      )  # 'pdf' or 'image'
    is_active   = models.BooleanField(default=True)
    is_pinned   = models.BooleanField(default=False)
    nepali_date = models.CharField(max_length=20, blank=True)
    published_at = models.DateField()
    created_by  = models.ForeignKey(
                      settings.AUTH_USER_MODEL,
                      on_delete=models.PROTECT,
                      related_name='notices'
                  )
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-published_at']

    def __str__(self):
        return self.title


class NoticeRead(models.Model):
    """Tracks which members have read which notices."""
    id      = models.UUIDField(
                  primary_key=True,
                  default=uuid.uuid4,
                  editable=False
              )
    notice  = models.ForeignKey(
                  Notice,
                  on_delete=models.CASCADE,
                  related_name='reads'
              )
    member  = models.ForeignKey(
                  settings.AUTH_USER_MODEL,
                  on_delete=models.CASCADE,
                  related_name='notice_reads'
              )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['notice', 'member']]

    def __str__(self):
        return f'{self.member.email} read {self.notice.title}'