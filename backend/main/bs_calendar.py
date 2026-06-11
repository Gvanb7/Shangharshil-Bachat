"""
Bikram Sambat calendar utilities.
Converts between AD and BS dates and provides BS month boundaries.
"""

from datetime import date, timedelta

# BS month days for years 2000-2090 BS
# Each tuple: (year, [days_in_month_1..12])
BS_MONTH_DAYS = {
    2078: [31,31,32,32,31,30,30,29,30,29,30,30],
    2079: [31,32,31,32,31,30,30,30,29,29,30,31],
    2080: [31,31,31,32,31,31,30,29,30,29,30,30],
    2081: [31,31,32,31,31,31,30,29,30,29,30,30],
    2082: [31,31,32,32,31,30,30,29,30,29,30,30],
    2083: [31,32,31,32,31,30,30,30,29,29,30,30],
    2084: [31,31,32,31,31,30,30,30,29,30,29,31],
    2085: [31,31,31,32,31,31,29,30,30,29,29,31],
    2086: [31,31,32,31,31,31,30,29,30,29,30,30],
    2087: [31,32,31,32,31,30,30,29,30,29,30,30],
    2088: [31,32,31,32,31,30,30,30,29,29,30,31],
    2089: [31,31,31,32,31,31,30,29,30,29,30,30],
    2090: [31,31,32,31,31,31,30,29,30,29,30,30],
}

BS_MONTHS = [
    'Baisakh', 'Jestha', 'Ashadh', 'Shrawan',
    'Bhadra',  'Ashwin', 'Kartik', 'Mangsir',
    'Poush',   'Magh',   'Falgun', 'Chaitra',
]

# BS epoch: BS 2000-01-01 = AD 1943-04-14
BS_EPOCH    = date(2000, 1, 1)
AD_EPOCH    = date(1943, 4, 14)
BS_EPOCH_BS = (2000, 1, 1)


def ad_to_bs(ad_date):
    """Convert AD date to BS (year, month, day)."""
    delta = (ad_date - AD_EPOCH).days

    bs_year  = 2000
    bs_month = 1
    bs_day   = 1

    while True:
        year_data = BS_MONTH_DAYS.get(bs_year)
        if not year_data:
            break
        year_days = sum(year_data)
        if delta < year_days:
            break
        delta   -= year_days
        bs_year += 1

    year_data = BS_MONTH_DAYS.get(bs_year, [30]*12)
    for m_idx, m_days in enumerate(year_data):
        if delta < m_days:
            bs_month = m_idx + 1
            bs_day   = delta + 1
            break
        delta -= m_days

    return bs_year, bs_month, bs_day


def bs_to_ad(bs_year, bs_month, bs_day):
    """Convert BS date to AD date."""
    delta = 0

    for y in range(2000, bs_year):
        year_data = BS_MONTH_DAYS.get(y, [30]*12)
        delta    += sum(year_data)

    year_data = BS_MONTH_DAYS.get(bs_year, [30]*12)
    for m in range(1, bs_month):
        delta += year_data[m - 1]

    delta += bs_day - 1
    return AD_EPOCH + timedelta(days=delta)


def get_bs_month_days(bs_year, bs_month):
    """Get number of days in a BS month."""
    year_data = BS_MONTH_DAYS.get(bs_year, [30]*12)
    return year_data[bs_month - 1]


def get_bs_month_ad_range(bs_year, bs_month):
    """Get AD start and end dates for a BS month."""
    start_ad = bs_to_ad(bs_year, bs_month, 1)
    last_day  = get_bs_month_days(bs_year, bs_month)
    end_ad    = bs_to_ad(bs_year, bs_month, last_day)
    return start_ad, end_ad


def get_fiscal_year(bs_year, bs_month):
    """
    Get Nepal fiscal year string for a BS date.
    Fiscal year: Shrawan (month 4) to Ashadh (month 3).
    Shrawan 2082 belongs to FY 2082/83.
    Baisakh 2082 belongs to FY 2081/82.
    """
    if bs_month >= 4:   # Shrawan to Chaitra
        fy_start = bs_year
        fy_end   = bs_year + 1
    else:               # Baisakh to Ashadh
        fy_start = bs_year - 1
        fy_end   = bs_year
    return f'{fy_start}/{str(fy_end)[-2:]}'


def get_fiscal_year_ad_range(fy_string):
    """
    Get AD start and end dates for a fiscal year string like '2081/82'.
    FY starts Shrawan 1, ends Ashadh last day.
    """
    fy_start = int(fy_string.split('/')[0])
    start_ad, _ = get_bs_month_ad_range(fy_start, 4)      # Shrawan 1
    fy_end       = fy_start + 1
    _, end_ad    = get_bs_month_ad_range(fy_end, 3)        # Ashadh last
    return start_ad, end_ad


def today_bs():
    """Get today's date in BS."""
    return ad_to_bs(date.today())


def is_last_day_of_bs_month():
    """Check if today is the last day of the current BS month."""
    today     = date.today()
    y, m, d   = ad_to_bs(today)
    last_day  = get_bs_month_days(y, m)
    return d == last_day


def get_bs_month_name(month_num):
    """Get BS month name from number (1-12)."""
    return BS_MONTHS[month_num - 1]