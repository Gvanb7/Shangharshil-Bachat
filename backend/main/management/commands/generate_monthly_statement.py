from django.core.management.base import BaseCommand
from main.bs_calendar import today_bs, is_last_day_of_bs_month
from main.services import create_trial_balance_record


class Command(BaseCommand):
    help = 'Auto-generate monthly trial balance if today is last BS month day'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true')
        parser.add_argument('--year',  type=int)
        parser.add_argument('--month', type=int)

    def handle(self, *args, **options):
        if options['year'] and options['month']:
            bs_year  = options['year']
            bs_month = options['month']
        else:
            if not is_last_day_of_bs_month() and not options['force']:
                self.stdout.write('Not last day of BS month. Skipping.')
                return
            bs_year, bs_month, _ = today_bs()

        tb, created = create_trial_balance_record(
            bs_year  = bs_year,
            bs_month = bs_month,
            is_auto  = True,
            force    = options['force'],
        )

        if created:
            self.stdout.write(self.style.SUCCESS(
                f'Generated period: {tb.bs_month_name} {tb.bs_year}'
            ))
        else:
            self.stdout.write(
                f'Already exists: {tb.bs_month_name} {tb.bs_year}'
            )