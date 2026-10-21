import pytest
from backend.routes.maintenance import parse_km_interval, parse_time_interval, COMPONENT_ALIASES


def test_parse_km_interval():
    km, is_insp = parse_km_interval("5,000 km")
    assert km == 5000
    assert is_insp is False

    km, is_insp = parse_km_interval("5,000 km inspection")
    assert km == 5000
    assert is_insp is True

    km, is_insp = parse_km_interval("10,000 km inspection")
    assert km == 10000
    assert is_insp is True

    km, is_insp = parse_km_interval("0 km")
    assert km == 0
    assert is_insp is False

    km, is_insp = parse_km_interval(None, default_num=5000)
    assert km == 5000
    assert is_insp is False


def test_parse_time_interval():
    assert parse_time_interval("6 months") == 6
    assert parse_time_interval("24 months") == 24
    assert parse_time_interval("1 month") == 1
    assert parse_time_interval("3 months") == 3
    assert parse_time_interval(None, default_num=12) == 12


def test_component_aliases():
    assert "front brake pads" in COMPONENT_ALIASES
    assert "brake pads & discs" in COMPONENT_ALIASES["front brake pads"]
    assert "battery visual & terminal check" in COMPONENT_ALIASES
    assert "tyre pressure check" in COMPONENT_ALIASES
