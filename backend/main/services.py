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


def record_loan_repayment(loan, amount_paid, recorded_by, paid_at, nepali_date, note=''):
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
        paid_at = paid_at,
        nepali_date = nepali_date,
        recorded_by=recorded_by,
    )


def _unpaid_interest(loan):
    """Helper — returns unpaid interest portion of remaining balance."""
    monthly_rate = loan.interest_rate / Decimal('100') / Decimal('12')
    return round2(loan.amount_remaining * monthly_rate / (1 + monthly_rate))

def generate_loan_schedule(loan):
    """
    Generates full month-by-month repayment schedule
    using reducing balance method.
    """
    from dateutil.relativedelta import relativedelta
    from datetime import date

    if not loan.disbursed_on:
        return []

    schedule    = []
    balance     = Decimal(str(loan.principal))
    monthly_rate = Decimal(str(loan.interest_rate)) / Decimal('100') / Decimal('12')
    emi          = Decimal(str(loan.monthly_installment))

    for month in range(1, loan.term_months + 1):
        interest_portion  = round2(balance * monthly_rate)
        principal_portion = round2(emi - interest_portion)

        # last month — clear remaining balance
        if month == loan.term_months:
            principal_portion = balance
            emi_this_month    = round2(balance + interest_portion)
        else:
            emi_this_month = emi

        balance -= principal_portion
        if balance < Decimal('0.00'):
            balance = Decimal('0.00')

        due_date = loan.disbursed_on + relativedelta(months=month)

        schedule.append({
            'month':              month,
            'due_date':           due_date,
            'emi':                emi_this_month,
            'principal_portion':  principal_portion,
            'interest_portion':   interest_portion,
            'balance_after':      balance,
        })

    return schedule

def credit_account(account, amount, reference_type, reference_id,
                   recorded_by, note='', nepali_date=''):
    """Add money to an account."""
    from .models import AccountTransaction
    from decimal import Decimal

    amount = round2(Decimal(str(amount)))
    account.balance = round2(account.balance + amount)
    account.save()

    return AccountTransaction.objects.create(
        account=account,
        transaction_type='credit',
        amount=amount,
        balance_after=account.balance,
        reference_type=reference_type,
        reference_id=reference_id,
        note=note,
        nepali_date=nepali_date,
        created_by=recorded_by,
    )


def debit_account(account, amount, reference_type, reference_id,
                  recorded_by, note='', nepali_date=''):
    """Deduct money from an account."""
    from .models import AccountTransaction
    from decimal import Decimal

    amount = round2(Decimal(str(amount)))

    if account.balance < amount:
        raise ValueError(
            f'Insufficient balance in {account.name}. '
            f'Available: Rs. {account.balance}, Required: Rs. {amount}'
        )

    account.balance = round2(account.balance - amount)
    account.save()

    return AccountTransaction.objects.create(
        account=account,
        transaction_type='debit',
        amount=amount,
        balance_after=account.balance,
        reference_type=reference_type,
        reference_id=reference_id,
        note=note,
        nepali_date=nepali_date,
        created_by=recorded_by,
    )


def transfer_between_accounts(from_account, to_account, amount,
                               recorded_by, note='', nepali_date=''):
    """Transfer money between two accounts."""
    from decimal import Decimal
    import uuid

    amount     = round2(Decimal(str(amount)))
    ref_id     = uuid.uuid4()

    debit_account(
        account=from_account,
        amount=amount,
        reference_type='transfer_out',
        reference_id=ref_id,
        recorded_by=recorded_by,
        note=f'Transfer to {to_account.name}' + (f' — {note}' if note else ''),
        nepali_date=nepali_date,
    )
    credit_account(
        account=to_account,
        amount=amount,
        reference_type='transfer_in',
        reference_id=ref_id,
        recorded_by=recorded_by,
        note=f'Transfer from {from_account.name}' + (f' — {note}' if note else ''),
        nepali_date=nepali_date,
    )
    
def get_statement_data(tb):
    """
    Calculate all trial balance figures live from source data.
    Never uses stored totals — always recalculates from transactions.
    Returns a dict with full statement data.
    """
    from .models import (
        Account, AccountTransaction,
        Income, Expenditure,
        SavingsAccount, Loan, LoanRepayment,
        SavingsTransaction, CooperativeSettings,
    )
    from django.db.models import Sum, Q
    from decimal import Decimal

    start_ad = tb.start_date_ad
    end_ad   = tb.end_date_ad

    def d(val):
        """Safe decimal conversion."""
        if val is None:
            return Decimal('0.00')
        return round2(Decimal(str(val)))

    # ── ASSETS ────────────────────────────────────────────────────────────────
    # Account balances — live from Account model
    account_items = []
    for acct in Account.objects.filter(is_active=True).order_by('name'):
        if acct.balance > Decimal('0'):
            account_items.append({
                'name':   acct.name,
                'type':   acct.account_type,
                'debit':  str(d(acct.balance)),
                'credit': '0.00',
            })

    # Loans outstanding — total remaining on active loans
    loans_outstanding = d(
        Loan.objects.filter(
            status='active'
        ).aggregate(
            total=Sum('amount_remaining')
        )['total']
    )

    total_assets = d(
        sum(Decimal(a['debit']) for a in account_items) +
        loans_outstanding
    )

    # ── LIABILITIES ───────────────────────────────────────────────────────────
    # Member savings — total balance owed back to members
    total_member_savings = d(
        SavingsAccount.objects.filter(
            is_active=True
        ).aggregate(
            total=Sum('balance')
        )['total']
    )

    liability_items = [{
        'name':   'Member Savings',
        'debit':  '0.00',
        'credit': str(total_member_savings),
    }]

    total_liabilities = total_member_savings

    # ── INCOME (period) ───────────────────────────────────────────────────────
    income_by_cat = {}

    # recorded income by category
    incomes = Income.objects.filter(
        income_date__gte=start_ad,
        income_date__lte=end_ad,
    ).select_related('category')

    for inc in incomes:
        cat = inc.category.name
        income_by_cat[cat] = income_by_cat.get(
            cat, Decimal('0')
        ) + inc.amount

    # loan interest collected this period
    interest_collected = d(
        LoanRepayment.objects.filter(
            paid_at__gte=start_ad,
            paid_at__lte=end_ad,
        ).aggregate(
            total=Sum('interest_portion')
        )['total']
    )

    if interest_collected > Decimal('0'):
        income_by_cat['Loan Interest Collected'] = (
            income_by_cat.get('Loan Interest Collected', Decimal('0')) +
            interest_collected
        )

    income_items = [
        {
            'name':   name,
            'debit':  '0.00',
            'credit': str(d(amount)),
        }
        for name, amount in sorted(income_by_cat.items())
    ]

    total_income = d(sum(income_by_cat.values(), Decimal('0')))

    # ── EXPENSES (period) ─────────────────────────────────────────────────────
    expense_by_cat = {}

    # savings interest paid to members — treated as expense
    savings_interest = d(
        SavingsTransaction.objects.filter(
            type='interest_credit',
            created_at__date__gte=start_ad,
            created_at__date__lte=end_ad,
        ).aggregate(
            total=Sum('amount')
        )['total']
    )

    if savings_interest > Decimal('0'):
        expense_by_cat['Savings Interest Paid'] = savings_interest

    # expenditures by category
    expenditures = Expenditure.objects.filter(
        expense_date__gte=start_ad,
        expense_date__lte=end_ad,
    ).select_related('category')

    for exp in expenditures:
        cat = exp.category.name
        expense_by_cat[cat] = expense_by_cat.get(
            cat, Decimal('0')
        ) + exp.amount

    expense_items = [
        {
            'name':   name,
            'debit':  str(d(amount)),
            'credit': '0.00',
        }
        for name, amount in sorted(expense_by_cat.items())
    ]

    total_expenses = d(sum(expense_by_cat.values(), Decimal('0')))

    # ── EQUITY ────────────────────────────────────────────────────────────────
    # opening equity — from settings or previous closing equity
    settings_obj   = CooperativeSettings.objects.first()
    base_equity    = d(settings_obj.opening_equity if settings_obj else 0)

    # find previous month's closing equity
    from .models import TrialBalance
    from .bs_calendar import get_fiscal_year

    opening_equity = base_equity

    if tb.period_type == 'monthly':
        # get all prior monthly statements in order
        prior = TrialBalance.objects.filter(
            period_type  = 'monthly',
            start_date_ad__lt = start_ad,
        ).order_by('start_date_ad')

        # recalculate closing equity chain from base
        running_equity = base_equity
        for prior_tb in prior:
            prior_data      = get_statement_data(prior_tb)
            running_equity  = prior_data['closing_equity']

        opening_equity = running_equity

    elif tb.period_type == 'annual':
        # for annual — opening equity is base setting
        opening_equity = base_equity

    net_surplus    = d(total_income - total_expenses)
    closing_equity = d(opening_equity + net_surplus)

    # ── TRIAL BALANCE CHECK ───────────────────────────────────────────────────
    # Dr side: Assets + Expenses
    # Cr side: Liabilities + Income + Equity
    total_dr = d(total_assets + total_expenses)
    total_cr = d(total_liabilities + total_income + closing_equity)

    difference  = abs(total_dr - total_cr)
    is_balanced = difference < Decimal('0.01')

    return {
        'id':               str(tb.id),
        'period_type':      tb.period_type,
        'bs_year':          tb.bs_year,
        'bs_month':         tb.bs_month,
        'bs_month_name':    tb.bs_month_name,
        'fiscal_year':      tb.fiscal_year,
        'start_date_ad':    str(tb.start_date_ad),
        'end_date_ad':      str(tb.end_date_ad),
        'generated_at':     tb.generated_at.isoformat(),
        'generated_by_name': (
            tb.generated_by.full_name or tb.generated_by.email
            if tb.generated_by else 'System'
        ),
        'is_auto_generated': tb.is_auto_generated,
        'opening_equity':   str(opening_equity),
        'total_assets':     str(total_assets),
        'total_liabilities':str(total_liabilities),
        'total_income':     str(total_income),
        'total_expenses':   str(total_expenses),
        'net_surplus':      str(net_surplus),
        'closing_equity':   str(closing_equity),
        'is_balanced':      is_balanced,
        'difference':       str(difference),
        'line_items': {
            'assets':      account_items + [{
                'name':   'Loans Outstanding',
                'debit':  str(loans_outstanding),
                'credit': '0.00',
            }],
            'liabilities': liability_items,
            'income':      income_items,
            'expenses':    expense_items,
            'equity': {
                'opening':     str(opening_equity),
                'net_surplus': str(net_surplus),
                'closing':     str(closing_equity),
            },
            'totals': {
                'debit':      str(total_dr),
                'credit':     str(total_cr),
                'difference': str(difference),
            },
        },
    }


def create_trial_balance_record(bs_year, bs_month, generated_by=None,
                                 is_auto=False, force=False):
    """
    Create or replace a TrialBalance period record.
    Does NOT store any calculated data — just the period metadata.
    """
    from .models import TrialBalance
    from .bs_calendar import (
        get_bs_month_ad_range, get_bs_month_name,
        get_fiscal_year, get_fiscal_year_ad_range,
    )

    existing = TrialBalance.objects.filter(
        period_type='monthly',
        bs_year=bs_year,
        bs_month=bs_month,
    ).first()

    if existing and not force:
        return existing, False

    if existing and force:
        existing.delete()

    start_ad, end_ad = get_bs_month_ad_range(bs_year, bs_month)
    month_name       = get_bs_month_name(bs_month)
    fiscal_year      = get_fiscal_year(bs_year, bs_month)

    tb = TrialBalance.objects.create(
        period_type       = 'monthly',
        bs_year           = bs_year,
        bs_month          = bs_month,
        bs_month_name     = month_name,
        fiscal_year       = fiscal_year,
        start_date_ad     = start_ad,
        end_date_ad       = end_ad,
        generated_by      = generated_by,
        is_auto_generated = is_auto,
    )

    return tb, True


def create_annual_trial_balance_record(fiscal_year_str, generated_by=None,
                                        force=False):
    """
    Create annual trial balance period record.
    """
    from .models import TrialBalance
    from .bs_calendar import get_fiscal_year_ad_range

    existing = TrialBalance.objects.filter(
        period_type = 'annual',
        fiscal_year = fiscal_year_str,
    ).first()

    if existing and not force:
        return existing, False

    if existing and force:
        existing.delete()

    fy_start        = int(fiscal_year_str.split('/')[0])
    start_ad, end_ad = get_fiscal_year_ad_range(fiscal_year_str)

    tb = TrialBalance.objects.create(
        period_type       = 'annual',
        bs_year           = fy_start + 1,
        bs_month          = None,
        bs_month_name     = '',
        fiscal_year       = fiscal_year_str,
        start_date_ad     = start_ad,
        end_date_ad       = end_ad,
        generated_by      = generated_by,
        is_auto_generated = False,
    )

    return tb, True