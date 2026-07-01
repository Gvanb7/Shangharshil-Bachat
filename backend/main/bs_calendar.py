"""
Bikram Sambat calendar utilities.
Converts between AD and BS dates and provides BS month boundaries.
"""

from datetime import date, timedelta

# BS month days for years 2000-2090 BS
# Each tuple: (year, [days_in_month_1..12])
BS_MONTH_DAYS = {
    2072: [31,32,31,32,31,30,30,29,30,29,30,30],
    2073: [31,32,31,32,31,30,30,30,29,29,30,31],
    2074: [31,31,31,32,31,31,30,29,30,29,30,30],
    2075: [31,31,32,31,31,31,30,29,30,29,30,30],
    2076: [31,32,31,32,31,30,30,30,29,29,30,30],
    2077: [31,32,31,32,31,30,30,30,29,30,29,31],
    2078: [31,31,31,32,31,31,30,29,30,29,30,30],
    2079: [31,31,32,31,31,31,30,29,30,29,30,30],
    2080: [31,32,31,32,31,30,30,30,29,29,30,30],
    2081: [31,32,31,32,31,30,30,30,29,30,29,31],
    2082: [31,31,32,31,31,31,30,29,30,29,30,30],
    2083: [31,31,32,31,31,31,30,29,30,29,30,30],
    2084: [31,32,31,32,31,30,30,30,29,29,30,31],
    2085: [30,32,31,32,31,30,30,30,29,30,29,31],
    2086: [31,31,32,31,31,31,30,29,30,29,30,30],
    2087: [31,31,32,31,31,31,30,30,29,30,30,30],
    2088: [30,31,32,32,30,31,30,30,29,30,30,30],
    2089: [30,32,31,32,31,30,30,30,29,30,30,30],
    2090: [30,32,31,32,31,30,30,30,29,30,30,30],
}

BS_MONTHS = [
    'Baisakh', 'Jestha', 'Ashadh', 'Shrawan',
    'Bhadra',  'Ashwin', 'Kartik', 'Mangsir',
    'Poush',   'Magh',   'Falgun', 'Chaitra',
]

# BS epoch: BS 2078-01-01 = AD 2021-04-14 (anchored within our accurate table range)
AD_EPOCH         = date(2021, 4, 14)
BS_EPOCH_YEAR    = 2078


def ad_to_bs(ad_date):
    """Convert AD date to BS (year, month, day)."""
    delta = (ad_date - AD_EPOCH).days

    if delta < 0:
        # date before epoch — walk backwards
        year = BS_EPOCH_YEAR
        while delta < 0:
            year -= 1
            year_data = BS_MONTH_DAYS.get(year, [30] * 12)
            delta += sum(year_data)
    else:
        year = BS_EPOCH_YEAR
        while True:
            year_data = BS_MONTH_DAYS.get(year, [30] * 12)
            year_days = sum(year_data)
            if delta < year_days:
                break
            delta -= year_days
            year += 1

    year_data = BS_MONTH_DAYS.get(year, [30] * 12)
    bs_month = 1
    bs_day   = 1
    for m_idx, m_days in enumerate(year_data):
        if delta < m_days:
            bs_month = m_idx + 1
            bs_day   = delta + 1
            break
        delta -= m_days

    return year, bs_month, bs_day

def bs_to_ad(bs_year, bs_month, bs_day):
    """Convert BS date to AD date."""
    delta = 0

    if bs_year >= BS_EPOCH_YEAR:
        for y in range(BS_EPOCH_YEAR, bs_year):
            year_data = BS_MONTH_DAYS.get(y, [30] * 12)
            delta    += sum(year_data)
    else:
        for y in range(bs_year, BS_EPOCH_YEAR):
            year_data = BS_MONTH_DAYS.get(y, [30] * 12)
            delta    -= sum(year_data)

    year_data = BS_MONTH_DAYS.get(bs_year, [30] * 12)
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

FOUNDING_BS_YEAR = 2073  # cooperative founding year

def get_available_fiscal_years():
    """
    Get list of fiscal years from founding year to current+1.
    Returns list of strings like ['2073/74', '2074/75', ...]
    """
    current_year, current_month, _ = today_bs()
    current_fy_start = current_year if current_month >= 4 else current_year - 1

    years = []
    for fy_start in range(FOUNDING_BS_YEAR, current_fy_start + 2):
        fy_end = fy_start + 1
        years.append(f'{fy_start}/{str(fy_end)[-2:]}')

    return years


def get_fiscal_year_months(fy_string):
    """
    Get list of (bs_year, bs_month, month_name) tuples for a fiscal year.
    Shrawan (month 4) to Ashadh (month 3) of next year.
    """
    fy_start = int(fy_string.split('/')[0])
    months = []

    for m in range(4, 13):  # Shrawan to Chaitra
        months.append((fy_start, m, get_bs_month_name(m)))

    for m in range(1, 4):  # Baisakh to Ashadh
        months.append((fy_start + 1, m, get_bs_month_name(m)))

    return months

def is_date_in_fiscal_year(nepali_date_str, fy_string):
    """Check if a BS date string (YYYY-MM-DD) falls within a fiscal year."""
    try:
        parts = nepali_date_str.split('-')
        year  = int(parts[0])
        month = int(parts[1])
    except (ValueError, IndexError):
        return False

    fy_start = int(fy_string.split('/')[0])

    if month >= 4:  # Shrawan to Chaitra
        return year == fy_start
    else:  # Baisakh to Ashadh
        return year == fy_start + 1
    
def is_nepali_date_in_current_fiscal_year(nepali_date_str):
    """
    Check if a BS date string (YYYY-MM-DD) falls within the
    current fiscal year. Used for edit permission checks.
    """
    try:
        parts  = nepali_date_str.strip().split('-')
        year   = int(parts[0])
        month  = int(parts[1])
        current_y, current_m, _ = today_bs()
        current_fy = get_fiscal_year(current_y, current_m)
        txn_fy     = get_fiscal_year(year, month)
        return txn_fy == current_fy
    except (ValueError, IndexError):
        return False


def get_nepali_date_from_ad(ad_date):
    """Convert an AD date object to BS string YYYY-MM-DD."""
    y, m, d = ad_to_bs(ad_date)
    return f'{y}-{str(m).zfill(2)}-{str(d).zfill(2)}'