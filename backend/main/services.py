from decimal import Decimal, ROUND_HALF_UP
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from .bs_calendar import (
    get_bs_month_ad_range,
    get_fiscal_year_ad_range,
    get_bs_month_name,
    today_bs,
    get_fiscal_year,
    get_nepali_date_from_ad,    # ← add this
)


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
    from .models import LoanRepayment, Penalty
    from django.db.models import Sum

    amount_paid = round2(amount_paid)

    if loan.status != 'active':
        raise ValueError('Repayments can only be made on active loans.')

    if amount_paid <= Decimal('0.00'):
        raise ValueError('Repayment amount must be greater than zero.')
    
    remaining_to_allocate = amount_paid

    # ── STEP 1: pay off unpaid penalties first ──────────────────────────────────
    unpaid_penalties = Penalty.objects.filter(
        loan=loan,
        penalty_type='loan',
        is_paid=False,
    ).order_by('created_at')

    penalty_paid_total = Decimal('0.00')

    for penalty in unpaid_penalties:
        if remaining_to_allocate <= Decimal('0.00'):
            break

        pay_amount = min(penalty.amount_remaining, remaining_to_allocate)
        penalty.amount_remaining = round2(penalty.amount_remaining - pay_amount)

        if penalty.amount_remaining <= Decimal('0.00'):
            penalty.amount_remaining = Decimal('0.00')
            penalty.is_paid = True

        penalty.save()

        penalty_paid_total        += pay_amount
        remaining_to_allocate      = round2(remaining_to_allocate - pay_amount)

    # ── STEP 2: pay interest ─────────────────────────────────────────────────
    # interest is calculated on remaining principal (excluding unpaid penalty)
    total_unpaid_penalty = get_unpaid_loan_penalties(loan)
    remaining_principal  = round2(
        loan.amount_remaining - total_unpaid_penalty - _unpaid_interest_estimate(loan)
    )

    monthly_rate      = loan.interest_rate / Decimal('100') / Decimal('12')
    interest_due       = round2(remaining_principal * monthly_rate)
    interest_paid_total = min(interest_due, remaining_to_allocate)
    remaining_to_allocate = round2(remaining_to_allocate - interest_paid_total)

    # ── STEP 3: remainder goes to principal ──────────────────────────────────
    principal_paid_total = remaining_to_allocate

    # cap at loan's actual remaining balance
    total_allocated = penalty_paid_total + interest_paid_total + principal_paid_total
    if total_allocated > loan.amount_remaining:
        # adjust principal down if over-allocated (edge case safety)
        overage = total_allocated - loan.amount_remaining
        principal_paid_total = round2(principal_paid_total - overage)
        if principal_paid_total < Decimal('0.00'):
            principal_paid_total = Decimal('0.00')

    # ── UPDATE LOAN ───────────────────────────────────────────────────────────
    loan.amount_paid      += amount_paid
    loan.amount_remaining  = round2(
        loan.amount_remaining - penalty_paid_total -
        interest_paid_total - principal_paid_total
    )
    if loan.amount_remaining <= Decimal('0.00'):
        loan.amount_remaining = Decimal('0.00')
        loan.status = 'closed'
    loan.save()

    return LoanRepayment.objects.create(
        loan=loan,
        amount_paid=amount_paid,
        penalty_portion=penalty_paid_total,
        principal_portion=principal_paid_total,
        interest_portion=interest_paid_total,
        balance_after=loan.amount_remaining,
        note=note,
        paid_at=paid_at,
        nepali_date=nepali_date,
        recorded_by=recorded_by,
    )


def _unpaid_interest_estimate(loan):
    """Helper — estimates unpaid interest portion for principal calculation."""
    return Decimal('0.00')  # simplified; interest is recalculated each payment

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
    
    anchor_date   = loan.first_due_date or loan.disbursed_on

    for month in range(1, loan.term_months + 1):
        due_date = anchor_date + relativedelta(months=month) 
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
    from .models import (
        Account, AccountTransaction, Income, Expenditure,
        SavingsAccount, Loan, LoanRepayment, SavingsTransaction,
        Penalty,
    )
    from django.db.models import Sum
    from decimal import Decimal
    from .bs_calendar import (
        get_bs_month_ad_range, ad_to_bs, get_fiscal_year,
        get_nepali_date_from_ad,
    )

    start_ad = tb.start_date_ad
    end_ad   = tb.end_date_ad

    def d(val):
        if val is None:
            return Decimal('0.00')
        return round2(Decimal(str(val)))

    # ── NEW / UPDATED HELPER FUNCTIONS ────────────────────────────────────────
    def get_ad_date_for_txn(txn):
        """Get the relevant AD date for a transaction.
        Uses nepali_date if available, otherwise falls back to created_at."""
        if txn.nepali_date:
            try:
                from .bs_calendar import bs_to_ad
                parts = txn.nepali_date.strip().split('-')
                return bs_to_ad(int(parts[0]), int(parts[1]), int(parts[2]))
            except Exception:
                pass
        # fallback to created_at date
        if hasattr(txn, 'created_at') and txn.created_at:
            return txn.created_at.date()
        return None

    def in_period(txn):
        ad = get_ad_date_for_txn(txn)
        if ad is None:
            return False
        return start_ad <= ad <= end_ad

    def before_period(txn):
        ad = get_ad_date_for_txn(txn)
        if ad is None:
            return False
        return ad < start_ad

    def through_period(txn):
        ad = get_ad_date_for_txn(txn)
        if ad is None:
            return False
        return ad <= end_ad
    # ── END NEW HELPERS ───────────────────────────────────────────────────────

    # ── OPENING BALANCE ─────────────────────────────────────────────────────
    opening_total      = Decimal('0.00')
    opening_by_account = []

    for acct in Account.objects.filter(is_active=True).order_by('name'):
        all_txns_before_credit = Decimal('0.00')
        all_txns_before_debit  = Decimal('0.00')

        for txn in AccountTransaction.objects.filter(
            account=acct
        ).exclude(note='Opening balance'):
            if before_period(txn):                    # ← pass txn, not string
                if txn.transaction_type == 'credit':
                    all_txns_before_credit += txn.amount
                else:
                    all_txns_before_debit  += txn.amount

        opening_balance = d(
            acct.opening_balance + all_txns_before_credit - all_txns_before_debit
        )

        if opening_balance != Decimal('0.00'):
            opening_by_account.append({
                'name':   f'Opening {acct.name} Balance',
                'amount': str(opening_balance),
            })
        opening_total += opening_balance

    # ── CLOSING BALANCE ─────────────────────────────────────────────────────
    closing_total      = Decimal('0.00')
    closing_by_account = []

    for acct in Account.objects.filter(is_active=True).order_by('name'):
        all_txns_through_credit = Decimal('0.00')
        all_txns_through_debit  = Decimal('0.00')

        for txn in AccountTransaction.objects.filter(
            account=acct
        ).exclude(note='Opening balance'):
            if through_period(txn):                   # ← pass txn, not string
                if txn.transaction_type == 'credit':
                    all_txns_through_credit += txn.amount
                else:
                    all_txns_through_debit  += txn.amount

        closing_balance = d(
            acct.opening_balance + all_txns_through_credit - all_txns_through_debit
        )

        if closing_balance != Decimal('0.00'):
            closing_by_account.append({
                'name':   f'Closing {acct.name} Balance',
                'amount': str(closing_balance),
            })
        closing_total += closing_balance

    # ── INCOME (Receipts) ─────────────────────────────────────────────────────
    income_items = []
    income_items.extend(opening_by_account)

    # savings deposits
    savings_deposits = d(
        SavingsTransaction.objects.filter(
            type='deposit',
            created_at__date__gte=start_ad,
            created_at__date__lte=end_ad,
        ).aggregate(total=Sum('amount'))['total']
    )
    if savings_deposits > Decimal('0'):
        income_items.append({
            'name':   'Member Savings Deposits',
            'amount': str(savings_deposits),
        })

    # loan repayments
    repayments_principal = d(
        LoanRepayment.objects.filter(
            paid_at__gte=start_ad,
            paid_at__lte=end_ad,
        ).aggregate(total=Sum('principal_portion'))['total']
    )
    repayments_interest = d(
        LoanRepayment.objects.filter(
            paid_at__gte=start_ad,
            paid_at__lte=end_ad,
        ).aggregate(total=Sum('interest_portion'))['total']
    )
    if repayments_principal > Decimal('0'):
        income_items.append({
            'name':   'Loan Repayments (Principal)',
            'amount': str(repayments_principal),
        })
    if repayments_interest > Decimal('0'):
        income_items.append({
            'name':   'Loan Interest Collected',
            'amount': str(repayments_interest),
        })

    # penalties
    savings_penalty = d(
        Penalty.objects.filter(
            penalty_type='savings',
            created_at__date__gte=start_ad,
            created_at__date__lte=end_ad,
        ).aggregate(total=Sum('amount'))['total']
    )
    loan_penalty_paid = d(
        LoanRepayment.objects.filter(
            paid_at__gte=start_ad,
            paid_at__lte=end_ad,
        ).aggregate(total=Sum('penalty_portion'))['total']
    )
    total_penalty = d(savings_penalty + loan_penalty_paid)
    if total_penalty > Decimal('0'):
        income_items.append({
            'name':   'Penalty Collected',
            'amount': str(total_penalty),
        })

    # income by category — use income_date for filtering
    incomes = Income.objects.filter(
        income_date__gte=start_ad,
        income_date__lte=end_ad,
    ).select_related('category')

    income_by_cat = {}
    for inc in incomes:
        cat = inc.category.name
        income_by_cat[cat] = income_by_cat.get(cat, Decimal('0')) + inc.amount

    for cat, amt in sorted(income_by_cat.items()):
        income_items.append({'name': cat, 'amount': str(d(amt))})

    total_income = d(sum(Decimal(i['amount']) for i in income_items))

    # ── EXPENDITURE (Payments) ────────────────────────────────────────────────
    expenditure_items = []

    # loan disbursements — use nepali_date from AccountTransaction
    loan_disb_total = Decimal('0.00')
    for txn in AccountTransaction.objects.filter(
        reference_type='loan_disbursement'
    ):
        if in_period(txn):                            # ← pass txn, not string
            loan_disb_total += txn.amount

    if loan_disb_total > Decimal('0'):
        expenditure_items.append({
            'name':   'Loan Disbursements',
            'amount': str(d(loan_disb_total)),
        })

    # savings withdrawals
    savings_withdrawals = d(
        SavingsTransaction.objects.filter(
            type='withdrawal',
            created_at__date__gte=start_ad,
            created_at__date__lte=end_ad,
        ).aggregate(total=Sum('amount'))['total']
    )
    if savings_withdrawals > Decimal('0'):
        expenditure_items.append({
            'name':   'Savings Withdrawals',
            'amount': str(savings_withdrawals),
        })

    # savings interest paid
    savings_interest = d(
        SavingsTransaction.objects.filter(
            type='interest_credit',
            created_at__date__gte=start_ad,
            created_at__date__lte=end_ad,
        ).aggregate(total=Sum('amount'))['total']
    )
    if savings_interest > Decimal('0'):
        expenditure_items.append({
            'name':   'Savings Interest Paid',
            'amount': str(savings_interest),
        })

    # expenditure by category — use expense_date
    expenditures = Expenditure.objects.filter(
        expense_date__gte=start_ad,
        expense_date__lte=end_ad,
    ).select_related('category')

    expense_by_cat = {}
    for exp in expenditures:
        cat = exp.category.name
        expense_by_cat[cat] = expense_by_cat.get(cat, Decimal('0')) + exp.amount

    for cat, amt in sorted(expense_by_cat.items()):
        expenditure_items.append({'name': cat, 'amount': str(d(amt))})

    # closing balances at end
    expenditure_items.extend(closing_by_account)

    total_expenditure = d(
        sum(Decimal(e['amount']) for e in expenditure_items)
    )

    # ── BALANCE CHECK ─────────────────────────────────────────────────────────
    income_excl_opening = d(
        total_income - sum(
            Decimal(i['amount']) for i in opening_by_account
        )
    )
    expenditure_excl_closing = d(
        total_expenditure - sum(
            Decimal(c['amount']) for c in closing_by_account
        )
    )
    expected_closing = d(
        opening_total + income_excl_opening - expenditure_excl_closing
    )
    is_balanced = abs(expected_closing - closing_total) < Decimal('0.01')

    return {
        'id':                str(tb.id),
        'period_type':       tb.period_type,
        'bs_year':           tb.bs_year,
        'bs_month':          tb.bs_month,
        'bs_month_name':     tb.bs_month_name,
        'fiscal_year':       tb.fiscal_year,
        'start_date_ad':     str(tb.start_date_ad),
        'end_date_ad':       str(tb.end_date_ad),
        'generated_at':      tb.generated_at.isoformat(),
        'generated_by_name': (
            (tb.generated_by.full_name or tb.generated_by.email)
            if tb.generated_by else 'System'
        ),
        'is_auto_generated': tb.is_auto_generated,
        'total_income':      str(total_income),
        'total_expenditure': str(total_expenditure),
        'opening_balance':   str(opening_total),
        'closing_balance':   str(closing_total),
        'is_balanced':       is_balanced,
        'income_items':      income_items,
        'expenditure_items': expenditure_items,
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

def apply_savings_penalty(member, savings_account, amount, account,
                           recorded_by, reason='', nepali_date=''):
    """
    Apply a penalty for missed savings deposit.
    This is immediate income — credits the cash/bank account right away.
    Does NOT touch the member's savings balance.
    """
    from .models import Penalty

    amount = round2(Decimal(str(amount)))

    penalty = Penalty.objects.create(
        penalty_type     = 'savings',
        member            = member,
        savings_account   = savings_account,
        amount            = amount,
        amount_remaining  = Decimal('0.00'),  # not applicable for savings
        reason            = reason,
        account           = account,
        nepali_date       = nepali_date,
        is_paid           = True,  # immediate
        recorded_by       = recorded_by,
    )

    # credit the account immediately
    credit_account(
        account=account,
        amount=amount,
        reference_type='penalty_income',
        reference_id=penalty.id,
        recorded_by=recorded_by,
        note=f'Savings penalty — {member.full_name or member.email}' + (f' — {reason}' if reason else ''),
        nepali_date=nepali_date,
    )

    return penalty


def apply_loan_penalty(loan, amount, recorded_by, reason='', nepali_date=''):
    """
    Apply a penalty for missed EMI payment.
    Adds to loan's amount_remaining. No immediate cash movement —
    income is only recognized when member actually pays it back.
    """
    from .models import Penalty

    if loan.status != 'active':
        raise ValueError('Penalty can only be applied to active loans.')

    amount = round2(Decimal(str(amount)))

    penalty = Penalty.objects.create(
        penalty_type     = 'loan',
        member            = loan.member,
        loan              = loan,
        amount            = amount,
        amount_remaining  = amount,  # full amount unpaid initially
        reason            = reason,
        account           = None,  # no immediate cash
        nepali_date       = nepali_date,
        is_paid           = False,
        recorded_by       = recorded_by,
    )

    # increase loan outstanding
    loan.amount_remaining = round2(loan.amount_remaining + amount)
    loan.save()

    return penalty


def get_unpaid_loan_penalties(loan):
    """Get total unpaid penalty amount for a loan."""
    from .models import Penalty
    from django.db.models import Sum

    total = Penalty.objects.filter(
        loan=loan,
        penalty_type='loan',
        is_paid=False,
    ).aggregate(total=Sum('amount_remaining'))['total']

    return round2(total) if total else Decimal('0.00')

def _check_edit_allowed(nepali_date_str):
    """Raise ValueError if transaction is outside current fiscal year."""
    from .bs_calendar import is_nepali_date_in_current_fiscal_year
    if not nepali_date_str:
        raise ValueError(
            'Transaction has no Nepali date recorded — cannot verify fiscal year. '
            'Contact system administrator.'
        )
    if not is_nepali_date_in_current_fiscal_year(nepali_date_str):
        raise ValueError(
            'This transaction cannot be edited because it falls outside '
            'the current fiscal year.'
        )


def edit_savings_transaction(txn_id, new_amount, new_note,
                              new_nepali_date, new_account_id,
                              edited_by, edit_reason=''):
    """
    Edit a savings deposit or withdrawal.
    Full reversal approach:
      1. Reverse original account transaction
      2. Reverse original savings balance change
      3. Create corrected savings transaction
      4. Create corrected account transaction
      5. Log the edit
    """
    from .models import (
        SavingsTransaction, Account, TransactionEditLog
    )
    from decimal import Decimal

    txn = SavingsTransaction.objects.select_related(
        'account__member'
    ).get(id=txn_id)

    _check_edit_allowed(
        txn.nepali_date if hasattr(txn, 'nepali_date') and txn.nepali_date
        else get_nepali_date_from_ad(txn.created_at.date())
    )

    if txn.type not in ('deposit', 'withdrawal'):
        raise ValueError('Only deposits and withdrawals can be edited.')

    new_amount = round2(Decimal(str(new_amount)))
    if new_amount <= Decimal('0'):
        raise ValueError('Amount must be greater than zero.')

    savings_account = txn.account

    # check sufficient balance for withdrawal edit
    if txn.type == 'withdrawal':
        current_balance = savings_account.balance
        balance_without_old = round2(current_balance + txn.amount)
        if new_amount > balance_without_old:
            raise ValueError(
                f'Insufficient balance. Available after reversal: '
                f'Rs. {balance_without_old}'
            )

    # get original account transaction
    from .models import AccountTransaction
    orig_acct_txn = AccountTransaction.objects.filter(
        reference_id=txn.id
    ).first()

    # snapshot original values for audit log
    original_data = {
        'amount':       str(txn.amount),
        'note':         txn.note,
        'nepali_date':  str(txn.nepali_date) if hasattr(txn, 'nepali_date') else '',
        'account_id':   str(orig_acct_txn.account.id) if orig_acct_txn else '',
        'account_name': orig_acct_txn.account.name if orig_acct_txn else '',
    }

    # ── STEP 1: reverse savings account balance ───────────────────────────
    if txn.type == 'deposit':
        savings_account.balance = round2(savings_account.balance - txn.amount)
    else:
        savings_account.balance = round2(savings_account.balance + txn.amount)
    savings_account.save()

    # ── STEP 2: reverse original cash/bank account transaction ────────────
    if orig_acct_txn:
        orig_cash_account = orig_acct_txn.account
        if orig_acct_txn.transaction_type == 'credit':
            orig_cash_account.balance = round2(
                orig_cash_account.balance - orig_acct_txn.amount
            )
        else:
            orig_cash_account.balance = round2(
                orig_cash_account.balance + orig_acct_txn.amount
            )
        orig_cash_account.save()
        orig_acct_txn.delete()

    # ── STEP 3: update savings transaction with new values ────────────────
    txn.amount = new_amount
    txn.note   = new_note
    if hasattr(txn, 'nepali_date'):
        txn.nepali_date = new_nepali_date
    txn.save()

    # ── STEP 4: apply corrected balance to savings account ────────────────
    if txn.type == 'deposit':
        savings_account.balance = round2(savings_account.balance + new_amount)
    else:
        savings_account.balance = round2(savings_account.balance - new_amount)
    savings_account.save()

    # ── STEP 5: create corrected account transaction ──────────────────────
    new_account = Account.objects.get(id=new_account_id, is_active=True)

    reference_type = (
        'savings_deposit' if txn.type == 'deposit' else 'savings_withdrawal'
    )
    member_name = (
        savings_account.member.full_name or savings_account.member.email
    )

    if txn.type == 'deposit':
        credit_account(
            account        = new_account,
            amount         = new_amount,
            reference_type = reference_type,
            reference_id   = txn.id,
            recorded_by    = edited_by,
            note           = f'[EDITED] Savings deposit — {member_name}',
            nepali_date    = new_nepali_date,
        )
    else:
        debit_account(
            account        = new_account,
            amount         = new_amount,
            reference_type = reference_type,
            reference_id   = txn.id,
            recorded_by    = edited_by,
            note           = f'[EDITED] Savings withdrawal — {member_name}',
            nepali_date    = new_nepali_date,
        )

    # ── STEP 6: log the edit ──────────────────────────────────────────────
    corrected_data = {
        'amount':       str(new_amount),
        'note':         new_note,
        'nepali_date':  new_nepali_date,
        'account_id':   str(new_account.id),
        'account_name': new_account.name,
    }
    TransactionEditLog.objects.create(
        transaction_type = (
            'savings_deposit' if txn.type == 'deposit'
            else 'savings_withdrawal'
        ),
        reference_id   = txn.id,
        original_data  = original_data,
        corrected_data = corrected_data,
        edited_by      = edited_by,
        reason         = edit_reason,
    )

    return txn


def edit_savings_penalty(penalty_id, new_amount, new_reason,
                          new_nepali_date, new_account_id,
                          edited_by, edit_reason=''):
    """Edit a savings penalty — reverse old, apply new."""
    from .models import Penalty, Account, AccountTransaction, TransactionEditLog
    from decimal import Decimal

    penalty = Penalty.objects.select_related(
        'member', 'account'
    ).get(id=penalty_id, penalty_type='savings')

    _check_edit_allowed(penalty.nepali_date)

    new_amount = round2(Decimal(str(new_amount)))
    if new_amount <= Decimal('0'):
        raise ValueError('Amount must be greater than zero.')

    original_data = {
        'amount':       str(penalty.amount),
        'reason':       penalty.reason,
        'nepali_date':  penalty.nepali_date,
        'account_id':   str(penalty.account.id) if penalty.account else '',
        'account_name': penalty.account.name if penalty.account else '',
    }

    # ── reverse original account credit ──────────────────────────────────
    orig_acct_txn = AccountTransaction.objects.filter(
        reference_id=penalty.id
    ).first()
    if orig_acct_txn:
        orig_cash_account = orig_acct_txn.account
        orig_cash_account.balance = round2(
            orig_cash_account.balance - orig_acct_txn.amount
        )
        orig_cash_account.save()
        orig_acct_txn.delete()

    # ── update penalty ────────────────────────────────────────────────────
    penalty.amount      = new_amount
    penalty.reason      = new_reason
    penalty.nepali_date = new_nepali_date
    penalty.save()

    # ── apply corrected credit to new account ─────────────────────────────
    new_account = Account.objects.get(id=new_account_id, is_active=True)
    member_name = penalty.member.full_name or penalty.member.email

    credit_account(
        account        = new_account,
        amount         = new_amount,
        reference_type = 'penalty_income',
        reference_id   = penalty.id,
        recorded_by    = edited_by,
        note           = f'[EDITED] Savings penalty — {member_name}',
        nepali_date    = new_nepali_date,
    )
    penalty.account = new_account
    penalty.save()

    # ── log ───────────────────────────────────────────────────────────────
    TransactionEditLog.objects.create(
        transaction_type = 'savings_penalty',
        reference_id     = penalty.id,
        original_data    = original_data,
        corrected_data   = {
            'amount':       str(new_amount),
            'reason':       new_reason,
            'nepali_date':  new_nepali_date,
            'account_id':   str(new_account.id),
            'account_name': new_account.name,
        },
        edited_by = edited_by,
        reason    = edit_reason,
    )

    return penalty


def edit_income(income_id, new_amount, new_category_id,
                new_description, new_nepali_date, new_account_id,
                edited_by, edit_reason=''):
    """Edit an income record — reverse old, apply new."""
    from .models import Income, IncomeCategory, Account, AccountTransaction
    from .models import TransactionEditLog
    from decimal import Decimal

    income = Income.objects.select_related('category').get(id=income_id)

    _check_edit_allowed(
        income.nepali_date if hasattr(income, 'nepali_date') and income.nepali_date
        else get_nepali_date_from_ad(income.income_date)
    )

    new_amount = round2(Decimal(str(new_amount)))
    if new_amount <= Decimal('0'):
        raise ValueError('Amount must be greater than zero.')

    original_data = {
        'amount':      str(income.amount),
        'category':    income.category.name,
        'description': income.description,
        'income_date': str(income.income_date),
    }

    # ── reverse original account credit ──────────────────────────────────
    orig_acct_txn = AccountTransaction.objects.filter(
        reference_id=income.id
    ).first()
    if orig_acct_txn:
        orig_cash_account = orig_acct_txn.account
        orig_cash_account.balance = round2(
            orig_cash_account.balance - orig_acct_txn.amount
        )
        orig_cash_account.save()
        orig_acct_txn.delete()

    # ── update income record ──────────────────────────────────────────────
    new_category  = IncomeCategory.objects.get(id=new_category_id)
    new_account   = Account.objects.get(id=new_account_id, is_active=True)
    from .bs_calendar import bs_to_ad
    parts         = new_nepali_date.split('-')
    new_income_date = bs_to_ad(int(parts[0]), int(parts[1]), int(parts[2]))

    income.amount      = new_amount
    income.category    = new_category
    income.description = new_description
    income.income_date = new_income_date
    if hasattr(income, 'nepali_date'):
        income.nepali_date = new_nepali_date
    income.save()

    # ── apply corrected credit ────────────────────────────────────────────
    credit_account(
        account        = new_account,
        amount         = new_amount,
        reference_type = 'income',
        reference_id   = income.id,
        recorded_by    = edited_by,
        note           = f'[EDITED] {new_description}',
        nepali_date    = new_nepali_date,
    )

    # ── log ───────────────────────────────────────────────────────────────
    TransactionEditLog.objects.create(
        transaction_type = 'income',
        reference_id     = income.id,
        original_data    = original_data,
        corrected_data   = {
            'amount':      str(new_amount),
            'category':    new_category.name,
            'description': new_description,
            'nepali_date': new_nepali_date,
            'account_id':  str(new_account.id),
        },
        edited_by = edited_by,
        reason    = edit_reason,
    )

    return income


def edit_expenditure(exp_id, new_amount, new_category_id,
                     new_description, new_nepali_date, new_account_id,
                     edited_by, edit_reason=''):
    """Edit an expenditure record — reverse old, apply new."""
    from .models import Expenditure, ExpenditureCategory, Account
    from .models import AccountTransaction, TransactionEditLog
    from decimal import Decimal

    exp = Expenditure.objects.select_related('category').get(id=exp_id)

    _check_edit_allowed(
        exp.nepali_date if hasattr(exp, 'nepali_date') and exp.nepali_date
        else get_nepali_date_from_ad(exp.expense_date)
    )

    new_amount = round2(Decimal(str(new_amount)))
    if new_amount <= Decimal('0'):
        raise ValueError('Amount must be greater than zero.')

    original_data = {
        'amount':      str(exp.amount),
        'category':    exp.category.name,
        'description': exp.description,
        'expense_date': str(exp.expense_date),
    }

    # ── reverse original account debit ────────────────────────────────────
    orig_acct_txn = AccountTransaction.objects.filter(
        reference_id=exp.id
    ).first()
    if orig_acct_txn:
        orig_cash_account = orig_acct_txn.account
        orig_cash_account.balance = round2(
            orig_cash_account.balance + orig_acct_txn.amount
        )
        orig_cash_account.save()
        orig_acct_txn.delete()

    # ── update expenditure record ─────────────────────────────────────────
    new_category = ExpenditureCategory.objects.get(id=new_category_id)
    new_account  = Account.objects.get(id=new_account_id, is_active=True)
    from .bs_calendar import bs_to_ad
    parts         = new_nepali_date.split('-')
    new_exp_date  = bs_to_ad(int(parts[0]), int(parts[1]), int(parts[2]))

    exp.amount      = new_amount
    exp.category    = new_category
    exp.description = new_description
    exp.expense_date = new_exp_date
    if hasattr(exp, 'nepali_date'):
        exp.nepali_date = new_nepali_date
    exp.save()

    # ── check sufficient balance for new debit ────────────────────────────
    if new_account.balance < new_amount:
        raise ValueError(
            f'Insufficient balance in {new_account.name}. '
            f'Available: Rs. {new_account.balance}'
        )

    # ── apply corrected debit ─────────────────────────────────────────────
    debit_account(
        account        = new_account,
        amount         = new_amount,
        reference_type = 'expenditure',
        reference_id   = exp.id,
        recorded_by    = edited_by,
        note           = f'[EDITED] {new_description}',
        nepali_date    = new_nepali_date,
    )

    # ── log ───────────────────────────────────────────────────────────────
    TransactionEditLog.objects.create(
        transaction_type = 'expenditure',
        reference_id     = exp.id,
        original_data    = original_data,
        corrected_data   = {
            'amount':      str(new_amount),
            'category':    new_category.name,
            'description': new_description,
            'nepali_date': new_nepali_date,
            'account_id':  str(new_account.id),
        },
        edited_by = edited_by,
        reason    = edit_reason,
    )

    return exp


def reverse_interest_application(bs_year, bs_month, reversed_by):
    """
    Reverse an entire month's interest application for all members.
    Removes all interest_credit transactions for that BS month
    and restores savings account balances.
    """
    from .models import SavingsTransaction, SavingsAccount
    from .bs_calendar import get_bs_month_ad_range
    from django.db.models import Q

    start_ad, end_ad = get_bs_month_ad_range(bs_year, bs_month)

    interest_txns = SavingsTransaction.objects.filter(
        type='interest_credit',
        created_at__date__gte=start_ad,
        created_at__date__lte=end_ad,
    ).select_related('account')

    if not interest_txns.exists():
        raise ValueError(
            f'No interest transactions found for '
            f'{get_bs_month_name(bs_month)} {bs_year}.'
        )

    reversed_count = 0
    for txn in interest_txns:
        # reverse savings balance
        txn.account.balance = round2(txn.account.balance - txn.amount)
        txn.account.save()
        txn.delete()
        reversed_count += 1

    # also reset last_interest_date on accounts so interest can be re-applied
    SavingsAccount.objects.filter(
        is_active=True
    ).update(last_interest_date=None)

    return reversed_count