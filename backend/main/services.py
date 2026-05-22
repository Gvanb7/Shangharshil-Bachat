from decimal import Decimal, ROUND_HALF_UP
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta


def round2(value):
    """Always round to 2 decimal places using standard rounding."""
    return Decimal(value).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


# ── Savings ───────────────────────────────────────────────────────────────────

def calculate_monthly_interest(balance, annual_rate):
    """
    Simple monthly interest on savings.
    Formula: Interest = Balance × (Annual Rate / 12 / 100)
    """
    monthly_rate = Decimal(annual_rate) / Decimal('12') / Decimal('100')
    return round2(Decimal(balance) * monthly_rate)


def apply_interest_to_account(account, recorded_by):
    """
    Credits monthly interest to a savings account.
    Creates a transaction record. Called by admin each month.
    """
    from .models import SavingsTransaction
    from django.utils import timezone
    
    today = timezone.now().date()
    
   # prevent double application in same month
    if account.last_interest_date:
       if (account.last_interest_date.year == today.year and
           account.last_interest_date.month == today.month):
           return None, 'already_applied'

    interest = calculate_monthly_interest(account.balance, account.interest_rate)

    if interest <= Decimal('0.00'):
        return None, 'zero_balance'

    account.balance += interest
    account.last_interest_date = today
    account.save()

    transaction = SavingsTransaction.objects.create(
        account=account,
        type='interest_credit',
        amount=interest,
        balance_after=account.balance,
        note=f'Monthly interest at {account.interest_rate}% p.a.',
        recorded_by=recorded_by,
    )
    return transaction, 'success'


def deposit_to_savings(account, amount, recorded_by, note=''):
    """Deposit money into a savings account."""
    from .models import SavingsTransaction

    amount = round2(amount)
    if amount <= Decimal('0.00'):
        raise ValueError('Deposit amount must be greater than zero.')

    account.balance += amount
    account.save()

    return SavingsTransaction.objects.create(
        account=account,
        type='deposit',
        amount=amount,
        balance_after=account.balance,
        note=note,
        recorded_by=recorded_by,
    )


def withdraw_from_savings(account, amount, recorded_by, note=''):
    """Withdraw money from a savings account."""
    from .models import SavingsTransaction

    amount = round2(amount)
    if amount <= Decimal('0.00'):
        raise ValueError('Withdrawal amount must be greater than zero.')
    if amount > account.balance:
        raise ValueError(f'Insufficient balance. Available: Rs.{account.balance}')

    account.balance -= amount
    account.save()

    return SavingsTransaction.objects.create(
        account=account,
        type='withdrawal',
        amount=amount,
        balance_after=account.balance,
        note=note,
        recorded_by=recorded_by,
    )


# ── Loans ─────────────────────────────────────────────────────────────────────

def calculate_emi(principal, annual_rate, term_months):
    """
    Reducing balance EMI formula:
    EMI = P × r × (1+r)^n / ((1+r)^n - 1)
    where r = monthly interest rate, n = number of months
    """
    principal    = Decimal(str(principal))
    annual_rate  = Decimal(str(annual_rate))
    term_months  = int(term_months)

    if annual_rate == Decimal('0'):
        return round2(principal / term_months)

    r = annual_rate / Decimal('100') / Decimal('12')
    n = term_months

    factor = (1 + r) ** n
    emi    = principal * r * factor / (factor - 1)
    return round2(emi)


def calculate_loan_summary(principal, annual_rate, term_months):
    """Returns EMI, total payable, and total interest for a loan."""
    emi           = calculate_emi(principal, annual_rate, term_months)
    total_payable = round2(emi * term_months)
    total_interest = round2(total_payable - Decimal(str(principal)))
    return {
        'monthly_installment': emi,
        'total_payable':       total_payable,
        'total_interest':      total_interest,
    }


def disburse_loan(loan, disbursed_on=None):
    """
    Activates a loan — sets status to active,
    calculates EMI, total payable, due date.
    """
    from datetime import date
    summary = calculate_loan_summary(loan.principal, loan.interest_rate, loan.term_months)

    loan.status               = 'active'
    loan.monthly_installment  = summary['monthly_installment']
    loan.total_payable        = summary['total_payable']
    loan.amount_remaining     = summary['total_payable']
    loan.disbursed_on         = disbursed_on or date.today()
    loan.due_date             = loan.disbursed_on + relativedelta(months=loan.term_months)
    loan.save()
    return loan


def record_loan_repayment(loan, amount_paid, recorded_by, note=''):
    """
    Records a loan repayment using reducing balance method.
    Splits payment into interest and principal portions.
    Closes loan automatically when fully paid.
    """
    from .models import LoanRepayment

    amount_paid = round2(amount_paid)

    if loan.status != 'active':
        raise ValueError('Repayments can only be made on active loans.')

    if amount_paid <= Decimal('0.00'):
        raise ValueError('Repayment amount must be greater than zero.')

    # Calculate interest on remaining principal for this period
    remaining_principal = loan.amount_remaining - _unpaid_interest(loan)
    monthly_rate        = loan.interest_rate / Decimal('100') / Decimal('12')
    interest_portion    = round2(remaining_principal * monthly_rate)
    principal_portion   = round2(amount_paid - interest_portion)

    # Guard: if overpaying, cap at remaining
    if amount_paid > loan.amount_remaining:
        amount_paid       = loan.amount_remaining
        principal_portion = amount_paid - interest_portion

    loan.amount_paid      += amount_paid
    loan.amount_remaining  = round2(loan.amount_remaining - amount_paid)
    if loan.amount_remaining <= Decimal('0.00'):
        loan.amount_remaining = Decimal('0.00')
        loan.status           = 'closed'
    loan.save()

    return LoanRepayment.objects.create(
        loan=loan,
        amount_paid=amount_paid,
        principal_portion=principal_portion,
        interest_portion=interest_portion,
        balance_after=loan.amount_remaining,
        note=note,
        recorded_by=recorded_by,
    )


def _unpaid_interest(loan):
    """Helper — returns unpaid interest portion of remaining balance."""
    monthly_rate = loan.interest_rate / Decimal('100') / Decimal('12')
    return round2(loan.amount_remaining * monthly_rate / (1 + monthly_rate))