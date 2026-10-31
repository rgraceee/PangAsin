# WHAT: Pwersang month-math helpers na ginagamit ng admin API, analytics API,
#       aggregates, at forecasting service.
# WHY: Isa lamang ang logic para sa pag-shift, pagdaragdag, at pagkuha ng bounds
#      ng bawat buwan para hindi magkaka-inconsistency ang petsa sa buong sistema.
from datetime import date, timedelta


def shift_month(ym: str, delta: int) -> str:
    """Shift a 'YYYY-MM' label by `delta` calendar months."""
    y = int(ym[:4])
    m = int(ym[5:7]) + delta
    while m > 12:
        m -= 12
        y += 1
    while m < 1:
        m += 12
        y -= 1
    return f"{y:04d}-{m:02d}"


def add_months(source_date, months):
    """Add `months` to a date and return the last day of the resulting month."""
    month = source_date.month - 1 + months
    year = source_date.year + month // 12
    month = month % 12 + 1
    if month == 12:
        return date(year + 1, 1, 1) - timedelta(days=1)
    return date(year, month + 1, 1) - timedelta(days=1)


def month_start_offset(base: date, months: int) -> date:
    """First day of the month `months` away from the first day of `base`'s month."""
    m = base.month - 1 + months
    y = base.year + m // 12
    m = m % 12 + 1
    return date(y, m, 1)


def grid_start_end(range_months: int, today: date):
    """Return (start, end) covering the last `range_months` months ending at
    the current month. `range_months` is one of 12, 24, or 36."""
    end = today
    y, m = today.year, today.month
    total = y * 12 + (m - 1) - (range_months - 1)
    sy, sm = divmod(total, 12)
    sm += 1
    start = date(sy, sm, 1)
    return start, end


def month_bounds(ym: str):
    """(first day, last day) of the calendar month 'YYYY-MM'."""
    y = int(ym[:4])
    m = int(ym[5:7])
    start = date(y, m, 1)
    end = date(y + 1, 1, 1) - timedelta(days=1) if m == 12 else date(y, m + 1, 1) - timedelta(days=1)
    return start, end
