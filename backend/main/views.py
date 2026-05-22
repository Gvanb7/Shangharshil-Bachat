from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.db import transaction

from accounts.permissions import IsAdmin, IsMember
from .models import SavingsAccount, SavingsTransaction, Loan, LoanRepayment, Expenditure
from .serializers import (
    SavingsAccountSerializer, SavingsTransactionSerializer, 
    DepositWithdrawSerializer, LoanSerializer, LoanRepaymentSerializer,
    RepaymentInputSerializer, ExpenditureSerializer,
)

from .services import (
    deposit_to_savings, withdraw_from_savings, apply_interest_to_account, disburse_loan, record_loan_repayment, 
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
                loan = serializer.save(status='pending')
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
    """Admin views a specific loan."""
    permission_classes = [IsAdmin]

    def get(self, request, loan_id):
        loan = get_object_or_404(Loan, id=loan_id)
        return Response(LoanSerializer(loan).data)
    
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


class AdminExpenditureDetailView(APIView):
    """Admin edits or deletes a specific expenditure."""
    permission_classes = [IsAdmin]

    def get(self, request, expenditure_id):
        exp = get_object_or_404(Expenditure, id=expenditure_id)
        return Response(ExpenditureSerializer(exp).data)

    @transaction.atomic
    def patch(self, request, expenditure_id):
        exp        = get_object_or_404(Expenditure, id=expenditure_id)
        serializer = ExpenditureSerializer(exp, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, expenditure_id):
        exp = get_object_or_404(Expenditure, id=expenditure_id)
        exp.delete()
        return Response({'message': 'Expenditure deleted.'}, status=204)