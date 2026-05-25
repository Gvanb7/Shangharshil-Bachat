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
    Expenditure, ExpenditureCategory, Income, IncomeCategory,
)
from .serializers import (
    SavingsAccountSerializer, SavingsTransactionSerializer, 
    DepositWithdrawSerializer, LoanSerializer, LoanRepaymentSerializer,
    RepaymentInputSerializer, ExpenditureSerializer,
    ExpenditureCategorySerializer, IncomeSerializer, IncomeCategorySerializer,
)

from .services import (
    deposit_to_savings, withdraw_from_savings, apply_interest_to_account, disburse_loan, record_loan_repayment,
    generate_loan_schedule, 
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
    """Admin deposits money into a member's saving account."""
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request, account_id):
        account    = get_object_or_404(SavingsAccount, id=account_id, is_active=True)
        serializer = DepositWithdrawSerializer(data=request.data)
        if serializer.is_valid():
            txn = deposit_to_savings(
                account=account,
                amount=serializer.validated_data['amount'],
                recorded_by=request.user,
                note=serializer.validated_data['note'],
            )
            return Response(SavingsTransactionSerializer(txn).data, status=201)
        return Response(serializer.errors, status=400)
    
class AdminWithdrawView(APIView):
    """Admin withdraws money from a member's savings account."""
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request, account_id):
        account    = get_object_or_404(SavingsAccount, id=account_id, is_active=True)
        serializer = DepositWithdrawSerializer(data=request.data)
        if serializer.is_valid():
            try:
                txn = withdraw_from_savings(
                    account=account,
                    amount=serializer.validated_data['amount'],
                    recorded_by=request.user,
                    note=serializer.validated_data['note'],
                )
                return Response(SavingsTransactionSerializer(txn).data, status=201)
            except ValueError as e:
                return Response({'error': str(e)}, status=400)
        return Response(serializer.errors, status=400)
    
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
    """Admin disburses an approved loan — activates it."""
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request, loan_id):
        loan = get_object_or_404(Loan, id=loan_id, status='approved')
        loan = disburse_loan(loan)
        return Response({
            'message': 'Loan disbursed and is now active.',
            'loan':    LoanSerializer(loan).data,
        })
        
class AdminRecordRepaymentView(APIView):
    """Admin records a loan repayment from a member."""
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request, loan_id):
        loan       = get_object_or_404(Loan, id=loan_id, status='active')
        serializer = RepaymentInputSerializer(data=request.data)
        if serializer.is_valid():
            try:
                repayment = record_loan_repayment(
                    loan=loan,
                    amount_paid=serializer.validated_data['amount'],
                    recorded_by=request.user,
                    note=serializer.validated_data['note'],
                )
                return Response(LoanRepaymentSerializer(repayment).data, status=201)
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
                'amount_paid':       str(repayment.amount_paid) if repayment else None,
            })

        return Response(result)

#--------Expenditure-----

class AdminExpenditureView(APIView):
    """Admin creates and lists expenditures."""
    permission_classes = [IsAdmin]

    def get(self, request):
        expenditures = Expenditure.objects.select_related('recorded_by').all()
        return Response(ExpenditureSerializer(expenditures, many=True).data)

    @transaction.atomic
    def post(self, request):
        serializer = ExpenditureSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(recorded_by=request.user)
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
        serializer = IncomeSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(recorded_by=request.user)
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