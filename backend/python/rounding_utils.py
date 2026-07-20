from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


def round_to_multiple(number, multiple):
    """Round to the nearest multiple, with exact midpoints rounded upward."""
    if not number or not multiple:
        return 0

    try:
        decimal_number = Decimal(str(number))
        decimal_multiple = Decimal(str(multiple))
        rounded_units = (decimal_number / decimal_multiple).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
        result = rounded_units * decimal_multiple
    except (InvalidOperation, ValueError, TypeError, ZeroDivisionError):
        return 0

    if result == result.to_integral_value():
        return int(result)
    return float(result)
