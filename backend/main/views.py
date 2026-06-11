from decimal import Decimal

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.db import transaction

from accounts.permissions import IsAdmin, IsMember
from .models import (
    SavingsAccount, SavingsTransaction, Loan, LoanRepayment, 
    Expenditure, ExpenditureCategory, Income, IncomeCategory, Account, AccountTransaction,
    TrialBalance, CooperativeSettings,
)
from .serializers import (
    SavingsAccountSerializer, SavingsTransactionSerializer, 
    DepositWithdrawSerializer, LoanSerializer, LoanRepaymentSerializer,
    RepaymentInputSerializer, ExpenditureSerializer,
    ExpenditureCategorySerializer, IncomeSerializer, IncomeCategorySerializer, 
    AccountSerializer, AccountTransactionSerializer, 
    TrialBalanceSerializer, CooperativeSettingsSerializer,
)

from .services import (
    deposit_to_savings, withdraw_from_savings, apply_interest_to_account, disburse_loan, record_loan_repayment,
    generate_loan_schedule, credit_account, debit_account, transfer_between_accounts, 
    get_statement_data, create_trial_balance_record, create_annual_trial_balance_record,
)

from .bs_calendar import (
    get_bs_month_name, today_bs, get_fiscal_year, BS_MONTHS,
)

User = get_user_model()

# ----Saving----

class AdminCreateSavingsAccountView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        try:
            member_id     = request.data.get('member_id')
            interest_rate = request.data.get('interest_rate', '6.00')

            if not member_id:
                return Response({'error': 'member_id is required.'}, status=400)

            member = get_object_or_404(User, id=member_id, role='member')

            if hasattr(member, 'savings_account'):
                return Response(
                    {'error': 'This member already has a savings account.'},
                    status=400
                )

            account = SavingsAccount.objects.create(
                member=member,
                interest_rate=interest_rate,
            )

            return Response(SavingsAccountSerializer(account).data, status=201)

        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
class AdminListSavingsAccountsView(APIView):
    """Admin views all savings accounts."""
    permission_classes = [IsAdmin]

    def get(self, request):
        accounts = SavingsAccount.objects.select_related('member').all()
        return Response(SavingsAccountSerializer(accounts, many=True).data)

class AdminSavingsAccountDetailView(APIView):
    """Admin views, edits a specific savings account."""
    permission_classes = [IsAdmin]

    def get(self, request, account_id):
        account = get_object_or_404(SavingsAccount, id=account_id)
        return Response(SavingsAccountSerializer(account).data)

    def patch(self, request, account_id):
        account = get_object_or_404(SavingsAccount, id=account_id)
        serializer = SavingsAccountSerializer(account, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

class AdminDepositView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request, account_id):
        savings_account = get_object_or_404(
            SavingsAccount, id=account_id, is_active=True
        )
        amount     = request.data.get('amount')
        note       = request.data.get('note', '')
        acct_id    = request.data.get('account_id')
        nep_date   = request.data.get('nepali_date', '')

        if not amount:
            return Response({'error': 'Amount is required.'}, status=400)
        if not acct_id:
            return Response(
                {'error': 'Please select an account (Cash/Bank/etc.).'},
                status=400
            )

        try:
            cash_account = Account.objects.get(id=acct_id, is_active=True)
        except Account.DoesNotExist:
            return Response({'error': 'Selected account not found.'}, status=400)

        try:
            txn = deposit_to_savings(
                savings_account, amount, request.user, note
            )
            # credit the cash/bank account
            credit_account(
                account=cash_account,
                amount=amount,
                reference_type='savings_deposit',
                reference_id=txn.id,
                recorded_by=request.user,
                note=f'Savings deposit — {savings_account.member.full_name or savings_account.member.email}',
                nepali_date=nep_date,
            )
            return Response(SavingsTransactionSerializer(txn).data, status=201)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
    
class AdminWithdrawView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request, account_id):
        savings_account = get_object_or_404(
            SavingsAccount, id=account_id
        )
        amount   = request.data.get('amount')
        note     = request.data.get('note', '')
        acct_id  = request.data.get('account_id')
        nep_date = request.data.get('nepali_date', '')

        if not amount:
            return Response({'error': 'Amount is required.'}, status=400)
        if not acct_id:
            return Response(
                {'error': 'Please select an account (Cash/Bank/etc.).'},
                status=400
            )

        try:
            cash_account = Account.objects.get(id=acct_id, is_active=True)
        except Account.DoesNotExist:
            return Response({'error': 'Selected account not found.'}, status=400)

        try:
            txn = withdraw_from_savings(
                savings_account, amount, request.user, note
            )
            debit_account(
                account=cash_account,
                amount=amount,
                reference_type='savings_withdrawal',
                reference_id=txn.id,
                recorded_by=request.user,
                note=f'Savings withdrawal — {savings_account.member.full_name or savings_account.member.email}',
                nepali_date=nep_date,
            )
            return Response(SavingsTransactionSerializer(txn).data, status=201)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
    
class AdminApplyInterestView(APIView):
    """Admin applies monthly interest to ALL active savings accounts at once."""
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request):
        accounts = SavingsAccount.objects.filter(is_active=True)
        results  = []
        applied  = []
        already_done = []
        zero_balance = []
        
        for account in accounts:
            txn, status = apply_interest_to_account(account, request.user)
            if status == 'success':
                applied.append({
                    'member':   account.member.full_name,
                    'interest': str(txn.amount),
                    'balance':  str(account.balance),
                })
            elif status == 'already_applied':
                already_done.append(
                    account.member.full_name or account.member.email
                )
            elif status == 'zero_balance':
                zero_balance.append(
                    account.member.full_name or account.member.email
                )
                
        if already_done and not applied:
            return Response({
                'status': 'already_applied',
                'message': 'Interest has already been applied this month for all accounts.',
                'details': already_done,
            }, status=400)
            
        return Response({
            'status': 'success',
            'message': f'Interest applied to {len(applied)} account(s).',
            'applied': applied,
            'applied_done': already_done,
            'zero_balance': zero_balance
        })


class AdminTransactionListView(APIView):
    """Admin views all transactions for a savings account."""
    permission_classes = [IsAdmin]

    def get(self, request, account_id):
        account  = get_object_or_404(SavingsAccount, id=account_id)
        txns     = SavingsTransaction.objects.filter(account=account)
        return Response(SavingsTransactionSerializer(txns, many=True).data)

class MemberSavingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            account = SavingsAccount.objects.get(member=request.user)
        except SavingsAccount.DoesNotExist:
            return Response(None, status=200)

        txns = SavingsTransaction.objects.filter(account=account)[:20]
        return Response({
            'account':      SavingsAccountSerializer(account).data,
            'transactions': SavingsTransactionSerializer(txns, many=True).data,
        })
        


# ----Loans-----
class AdminCreateLoanView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        try:
            serializer = LoanSerializer(data=request.data)
            if serializer.is_valid():
                # admin-created loans skip pending — go straight to approved
                loan = serializer.save(
                    status='approved',
                    approved_by=request.user,
                )
                return Response(LoanSerializer(loan).data, status=201)
            return Response(serializer.errors, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class AdminListLoansView(APIView):
    """Admin views all loans."""
    permission_classes = [IsAdmin]

    def get(self, request):
        status_filter = request.query_params.get('status')
        loans = Loan.objects.select_related('member', 'approved_by').all()
        if status_filter:
            loans = loans.filter(status=status_filter)
        return Response(LoanSerializer(loans, many=True).data)
    
class AdminLoanDetailView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, loan_id):
        loan = get_object_or_404(Loan, id=loan_id)
        return Response(LoanSerializer(loan).data)

    def patch(self, request, loan_id):
        loan = get_object_or_404(Loan, id=loan_id)
        # only allow editing pending loans
        if loan.status not in ['pending', 'approved']:
            return Response(
                {'error': 'Cannot edit an active or closed loan.'},
                status=400
            )
        serializer = LoanSerializer(loan, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(LoanSerializer(loan).data)
        return Response(serializer.errors, status=400)
    
class AdminApproveLoanView(APIView):
    """Admin approves a pending loan."""
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request, loan_id):
        loan = get_object_or_404(Loan, id=loan_id, status='pending')
        loan.status      = 'approved'
        loan.approved_by = request.user
        loan.save()
        return Response({
            'message': 'Loan approved.',
            'loan':    LoanSerializer(loan).data,
        })
        
class AdminRejectLoanView(APIView):
    """Admin rejects a pending loan."""
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request, loan_id):
        loan = get_object_or_404(Loan, id=loan_id, status='pending')
        loan.status      = 'rejected'
        loan.approved_by = request.user
        loan.save()
        return Response({'message': 'Loan rejected.'})

class AdminDisburseLoanView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request, loan_id):
        loan     = get_object_or_404(Loan, id=loan_id, status='approved')
        acct_id  = request.data.get('account_id')
        nep_date = request.data.get('nepali_date', '')

        if not acct_id:
            return Response(
                {'error': 'Please select an account to disburse from.'},
                status=400
            )

        try:
            cash_account = Account.objects.get(id=acct_id, is_active=True)
        except Account.DoesNotExist:
            return Response({'error': 'Selected account not found.'}, status=400)

        try:
            from django.utils import timezone
            disbursed_on = timezone.now().date()
            disburse_loan(loan, disbursed_on)

            debit_account(
                account=cash_account,
                amount=loan.principal,
                reference_type='loan_disbursement',
                reference_id=loan.id,
                recorded_by=request.user,
                note=f'Loan disbursement — {loan.member.full_name or loan.member.email}',
                nepali_date=nep_date,
            )
            return Response(LoanSerializer(loan).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        
class AdminRecordRepaymentView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request, loan_id):
        loan     = get_object_or_404(Loan, id=loan_id, status='active')
        acct_id  = request.data.get('account_id')
        nep_date = request.data.get('nepali_date', '')

        if not acct_id:
            return Response(
                {'error': 'Please select an account for this repayment.'},
                status=400
            )

        try:
            cash_account = Account.objects.get(id=acct_id, is_active=True)
        except Account.DoesNotExist:
            return Response({'error': 'Selected account not found.'}, status=400)

        serializer = RepaymentInputSerializer(data=request.data)
        if serializer.is_valid():
            try:
                repayment = record_loan_repayment(
                    loan=loan,
                    amount_paid=serializer.validated_data['amount'],
                    recorded_by=request.user,
                    paid_at=serializer.validated_data['paid_at'],
                    nepali_date=nep_date,
                    note=serializer.validated_data['note'],
                )
                credit_account(
                    account=cash_account,
                    amount=serializer.validated_data['amount'],
                    reference_type='loan_repayment',
                    reference_id=repayment.id,
                    recorded_by=request.user,
                    note=f'Loan repayment — {loan.member.full_name or loan.member.email}',
                    nepali_date=nep_date,
                )
                return Response(
                    LoanRepaymentSerializer(repayment).data, status=201
                )
            except ValueError as e:
                return Response({'error': str(e)}, status=400)
        return Response(serializer.errors, status=400)

class AdminLoanRepaymentListView(APIView):
    """Admin views all repayments for a loan."""
    permission_classes = [IsAdmin]

    def get(self, request, loan_id):
        loan       = get_object_or_404(Loan, id=loan_id)
        repayments = LoanRepayment.objects.filter(loan=loan)
        return Response(LoanRepaymentSerializer(repayments, many=True).data)
    
class MemberLoanView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        loans = Loan.objects.filter(
            member=request.user
        ).select_related('member', 'approved_by')
        return Response(LoanSerializer(loans, many=True).data)

class AdminLoanScheduleView(APIView):
    """Returns full repayment schedule with paid/unpaid status per month."""
    permission_classes = [IsAdmin]

    def get(self, request, loan_id):
        loan     = get_object_or_404(Loan, id=loan_id)
        schedule = generate_loan_schedule(loan)

        if not schedule:
            return Response([])

        # get all repayments for this loan
        repayments = LoanRepayment.objects.filter(loan=loan).order_by('paid_at')

        # match repayments to months
        result         = []
        repayment_list = list(repayments)
        paid_count     = 0

        for item in schedule:
            if paid_count < len(repayment_list):
                repayment  = repayment_list[paid_count]
                is_paid    = True
                paid_count += 1
            else:
                repayment = None
                is_paid   = False

            result.append({
                'month':             item['month'],
                'due_date':          item['due_date'].strftime('%Y-%m-%d'),
                'emi':               str(item['emi']),
                'principal_portion': str(item['principal_portion']),
                'interest_portion':  str(item['interest_portion']),
                'balance_after':     str(item['balance_after']),
                'is_paid':           is_paid,
                'paid_at':           repayment.paid_at.strftime('%Y-%m-%d') if repayment else None,
                'nepali_date' :      repayment.nepali_date if repayment else None,
                'amount_paid':       str(repayment.amount_paid) if repayment else None,
            })

        return Response(result)

#--------Expenditure-----

class AdminExpenditureView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        expenditures = Expenditure.objects.select_related(
            'category', 'recorded_by'
        ).all()
        return Response(ExpenditureSerializer(expenditures, many=True).data)

    @transaction.atomic
    def post(self, request):
        acct_id  = request.data.get('account_id')
        nep_date = request.data.get('nepali_date', '')

        if not acct_id:
            return Response(
                {'error': 'Please select an account for this expenditure.'},
                status=400
            )

        try:
            cash_account = Account.objects.get(id=acct_id, is_active=True)
        except Account.DoesNotExist:
            return Response({'error': 'Selected account not found.'}, status=400)

        serializer = ExpenditureSerializer(data=request.data)
        if serializer.is_valid():
            expenditure = serializer.save(recorded_by=request.user)
            try:
                debit_account(
                    account=cash_account,
                    amount=expenditure.amount,
                    reference_type='expenditure',
                    reference_id=expenditure.id,
                    recorded_by=request.user,
                    note=expenditure.description,
                    nepali_date=nep_date,
                )
            except ValueError as e:
                raise transaction.TransactionManagementError(str(e))
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

class AdminCategoryListCreateView(APIView):
    """Admin lists all categories and creates new ones."""
    permission_classes = [IsAdmin]

    def get(self, request):
        categories = ExpenditureCategory.objects.filter(is_active=True)
        return Response(
            ExpenditureCategorySerializer(categories, many=True).data
        )

    def post(self, request):
        serializer = ExpenditureCategorySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

class AdminCategoryDetailView(APIView):
    """Admin edits or deactivates a category."""
    permission_classes = [IsAdmin]

    def patch(self, request, category_id):
        category   = get_object_or_404(ExpenditureCategory, id=category_id)
        serializer = ExpenditureCategorySerializer(
            category, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, category_id):
        category = get_object_or_404(ExpenditureCategory, id=category_id)
        if category.expenditures.count() > 0:
            # soft delete — don't delete if has expenditures
            category.is_active = False
            category.save()
            return Response(
                {'message': 'Category deactivated (has existing expenditures).'}
            )
        category.delete()
        return Response({'message': 'Category deleted.'}, status=204)
    
class AdminIncomeCategoryListCreateView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        categories = IncomeCategory.objects.filter(is_active=True)
        return Response(
            IncomeCategorySerializer(categories, many=True).data
        )

    def post(self, request):
        serializer = IncomeCategorySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class AdminIncomeCategoryDetailView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, category_id):
        category   = get_object_or_404(IncomeCategory, id=category_id)
        serializer = IncomeCategorySerializer(
            category, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, category_id):
        category = get_object_or_404(IncomeCategory, id=category_id)
        if category.incomes.count() > 0:
            category.is_active = False
            category.save()
            return Response(
                {'message': 'Category deactivated (has existing income records).'}
            )
        category.delete()
        return Response({'message': 'Category deleted.'}, status=204)


class AdminIncomeView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        incomes = Income.objects.select_related(
            'category', 'recorded_by'
        ).all()
        return Response(IncomeSerializer(incomes, many=True).data)

    @transaction.atomic
    def post(self, request):
        acct_id  = request.data.get('account_id')
        nep_date = request.data.get('nepali_date', '')

        if not acct_id:
            return Response(
                {'error': 'Please select an account for this income.'},
                status=400
            )

        try:
            cash_account = Account.objects.get(id=acct_id, is_active=True)
        except Account.DoesNotExist:
            return Response({'error': 'Selected account not found.'}, status=400)

        serializer = IncomeSerializer(data=request.data)
        if serializer.is_valid():
            income = serializer.save(recorded_by=request.user)
            credit_account(
                account=cash_account,
                amount=income.amount,
                reference_type='income',
                reference_id=income.id,
                recorded_by=request.user,
                note=income.description,
                nepali_date=nep_date,
            )
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class AdminIncomeDetailView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, income_id):
        income = get_object_or_404(Income, id=income_id)
        return Response(IncomeSerializer(income).data)

    @transaction.atomic
    def patch(self, request, income_id):
        income     = get_object_or_404(Income, id=income_id)
        serializer = IncomeSerializer(income, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, income_id):
        income = get_object_or_404(Income, id=income_id)
        income.delete()
        return Response({'message': 'Income record deleted.'}, status=204)
    
class MemberApplyLoanView(APIView):
    """Member applies for a loan — only principal and purpose."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        principal = request.data.get('principal', '').strip()
        purpose   = request.data.get('purpose', '').strip()

        if not principal:
            return Response({'error': 'Principal amount is required.'}, status=400)

        try:
            principal = Decimal(str(principal))
            if principal <= Decimal('0.00'):
                raise ValueError
        except (ValueError, Exception):
            return Response({'error': 'Enter a valid principal amount.'}, status=400)

        if not purpose:
            return Response({'error': 'Purpose is required.'}, status=400)

        # check if member already has a pending loan application
        existing_pending = Loan.objects.filter(
            member=request.user,
            status='pending'
        ).exists()

        if existing_pending:
            return Response(
                {'error': 'You already have a pending loan application.'},
                status=400
            )

        loan = Loan.objects.create(
            member=request.user,
            principal=principal,
            purpose=purpose,
            status='pending',
            interest_rate=Decimal('12.00'),  # default — admin can change on approval
            term_months=12,                  # default — admin sets on disburse
        )

        return Response({
            'message': 'Loan application submitted successfully.',
            'loan': LoanSerializer(loan).data,
        }, status=201)

    def delete(self, request, loan_id):
        """Member cancels their own pending loan application."""
        try:
            loan = Loan.objects.get(
                id=loan_id,
                member=request.user,
                status='pending'
            )
        except Loan.DoesNotExist:
            return Response(
                {'error': 'No pending loan application found.'},
                status=404
            )

        loan.delete()
        return Response({'message': 'Loan application cancelled.'})
    
class AdminAccountListCreateView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        accounts = Account.objects.filter(is_active=True)
        return Response(AccountSerializer(accounts, many=True).data)

    def post(self, request):
        serializer = AccountSerializer(data=request.data)
        if serializer.is_valid():
            account = serializer.save(created_by=request.user)
            # set opening balance as initial balance
            account.balance = account.opening_balance
            account.save()
            # record opening balance as a transaction if > 0
            if account.opening_balance > 0:
                AccountTransaction.objects.create(
                    account=account,
                    transaction_type='credit',
                    amount=account.opening_balance,
                    balance_after=account.balance,
                    reference_type='adjustment_add',
                    note='Opening balance',
                    created_by=request.user,
                )
            return Response(AccountSerializer(account).data, status=201)
        return Response(serializer.errors, status=400)


class AdminAccountDetailView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, account_id):
        account = get_object_or_404(Account, id=account_id)
        return Response(AccountSerializer(account).data)

    def patch(self, request, account_id):
        account    = get_object_or_404(Account, id=account_id)
        serializer = AccountSerializer(
            account, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, account_id):
        account = get_object_or_404(Account, id=account_id)
        if account.transactions.count() > 0:
            account.is_active = False
            account.save()
            return Response(
                {'message': 'Account deactivated (has transactions).'}
            )
        account.delete()
        return Response({'message': 'Account deleted.'}, status=204)


class AdminAccountTransactionListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, account_id):
        account = get_object_or_404(Account, id=account_id)
        txns    = AccountTransaction.objects.filter(
            account=account
        ).select_related('created_by')
        return Response(
            AccountTransactionSerializer(txns, many=True).data
        )


class AdminAccountAdjustView(APIView):
    """Manual balance adjustment."""
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request, account_id):
        account    = get_object_or_404(Account, id=account_id, is_active=True)
        adj_type   = request.data.get('type')     # 'add' or 'reduce'
        amount     = request.data.get('amount')
        note       = request.data.get('note', '')
        nep_date   = request.data.get('nepali_date', '')

        if adj_type not in ['add', 'reduce']:
            return Response(
                {'error': 'Type must be "add" or "reduce".'},
                status=400
            )
        if not amount:
            return Response({'error': 'Amount is required.'}, status=400)

        try:
            if adj_type == 'add':
                credit_account(
                    account=account,
                    amount=amount,
                    reference_type='adjustment_add',
                    reference_id=None,
                    recorded_by=request.user,
                    note=note or 'Manual adjustment (add)',
                    nepali_date=nep_date,
                )
            else:
                debit_account(
                    account=account,
                    amount=amount,
                    reference_type='adjustment_reduce',
                    reference_id=None,
                    recorded_by=request.user,
                    note=note or 'Manual adjustment (reduce)',
                    nepali_date=nep_date,
                )
            return Response(AccountSerializer(account).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)


class AdminAccountTransferView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request):
        from_id  = request.data.get('from_account')
        to_id    = request.data.get('to_account')
        amount   = request.data.get('amount')
        note     = request.data.get('note', '')
        nep_date = request.data.get('nepali_date', '')

        if not from_id or not to_id:
            return Response(
                {'error': 'Both from and to accounts are required.'},
                status=400
            )
        if from_id == to_id:
            return Response(
                {'error': 'Cannot transfer to the same account.'},
                status=400
            )
        if not amount:
            return Response({'error': 'Amount is required.'}, status=400)

        try:
            from_account = Account.objects.get(id=from_id, is_active=True)
            to_account   = Account.objects.get(id=to_id,   is_active=True)
        except Account.DoesNotExist:
            return Response(
                {'error': 'One or both accounts not found.'},
                status=400
            )

        try:
            transfer_between_accounts(
                from_account=from_account,
                to_account=to_account,
                amount=amount,
                recorded_by=request.user,
                note=note,
                nepali_date=nep_date,
            )
            return Response({
                'message':      f'Transfer successful.',
                'from_account': AccountSerializer(from_account).data,
                'to_account':   AccountSerializer(to_account).data,
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        
class AdminTrialBalanceListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        period_type = request.query_params.get('type', 'monthly')
        statements  = TrialBalance.objects.filter(period_type=period_type)

        # return lightweight list — no live calculation here
        data = []
        for tb in statements:
            data.append({
                'id':               str(tb.id),
                'period_type':      tb.period_type,
                'bs_year':          tb.bs_year,
                'bs_month':         tb.bs_month,
                'bs_month_name':    tb.bs_month_name,
                'fiscal_year':      tb.fiscal_year,
                'start_date_ad':    str(tb.start_date_ad),
                'end_date_ad':      str(tb.end_date_ad),
                'generated_at':     tb.generated_at.isoformat(),
                'is_auto_generated': tb.is_auto_generated,
            })

        return Response(data)


class AdminTrialBalanceGenerateView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        period_type = request.data.get('period_type', 'monthly')
        force       = bool(request.data.get('force', False))

        if period_type == 'monthly':
            bs_year  = request.data.get('bs_year')
            bs_month = request.data.get('bs_month')

            if not bs_year or not bs_month:
                return Response(
                    {'error': 'bs_year and bs_month are required.'},
                    status=400
                )

            try:
                tb, created = create_trial_balance_record(
                    bs_year      = int(bs_year),
                    bs_month     = int(bs_month),
                    generated_by = request.user,
                    force        = force,
                )
                # return live calculated data
                return Response({
                    'created':   created,
                    'statement': get_statement_data(tb),
                }, status=201 if created else 200)
            except Exception as e:
                return Response({'error': str(e)}, status=400)

        elif period_type == 'annual':
            fiscal_year = request.data.get('fiscal_year')
            if not fiscal_year:
                return Response(
                    {'error': 'fiscal_year is required (e.g. 2081/82).'},
                    status=400
                )
            try:
                tb, created = create_annual_trial_balance_record(
                    fiscal_year_str = fiscal_year,
                    generated_by    = request.user,
                    force           = force,
                )
                return Response({
                    'created':   created,
                    'statement': get_statement_data(tb),
                }, status=201 if created else 200)
            except Exception as e:
                return Response({'error': str(e)}, status=400)

        return Response({'error': 'Invalid period_type.'}, status=400)


class AdminTrialBalanceDetailView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, tb_id):
        tb = get_object_or_404(TrialBalance, id=tb_id)
        # always return live calculated data
        return Response(get_statement_data(tb))

    def delete(self, request, tb_id):
        tb = get_object_or_404(TrialBalance, id=tb_id)
        tb.delete()
        return Response({'message': 'Statement deleted.'}, status=204)
class AdminCooperativeSettingsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        obj, _ = CooperativeSettings.objects.get_or_create(pk=1)
        return Response(CooperativeSettingsSerializer(obj).data)

    def patch(self, request):
        obj, _ = CooperativeSettings.objects.get_or_create(pk=1)
        opening_equity = request.data.get('opening_equity')
        if opening_equity is None:
            return Response(
                {'error': 'opening_equity is required.'},
                status=400
            )
        try:
            obj.opening_equity     = Decimal(str(opening_equity))
            obj.opening_equity_set = True
            obj.updated_by         = request.user
            obj.save()
            return Response(CooperativeSettingsSerializer(obj).data)
        except Exception as e:
            return Response({'error': str(e)}, status=400)