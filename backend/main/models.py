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
                          related_name='loans'
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

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Loan Rs.{self.principal} — {self.member.full_name} ({self.status})'


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
    principal_portion  = models.DecimalField(max_digits=12, decimal_places=2)
    interest_portion   = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after      = models.DecimalField(max_digits=12, decimal_places=2)   # snapshot
    note               = models.TextField(blank=True)
    recorded_by        = models.ForeignKey(
                             settings.AUTH_USER_MODEL,
                             on_delete=models.PROTECT,
                             related_name='recorded_repayments'
                         )
    paid_at            = models.DateTimeField(auto_now_add=True)

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