import unittest

from rounding_utils import round_to_multiple


class RoundToMultipleTests(unittest.TestCase):
    def test_rounds_values_below_midpoint_down(self):
        self.assertEqual(round_to_multiple(4.9, 10), 0)
        self.assertEqual(round_to_multiple(14.9, 10), 10)

    def test_rounds_exact_midpoints_up(self):
        self.assertEqual(round_to_multiple(5, 10), 10)
        self.assertEqual(round_to_multiple(15, 10), 20)
        self.assertEqual(round_to_multiple(25, 10), 30)

    def test_rounds_values_above_midpoint_up(self):
        self.assertEqual(round_to_multiple(5.5, 10), 10)
        self.assertEqual(round_to_multiple(15.5, 10), 20)

    def test_zero_and_missing_multiple_return_zero(self):
        self.assertEqual(round_to_multiple(0, 10), 0)
        self.assertEqual(round_to_multiple(10, 0), 0)


if __name__ == "__main__":
    unittest.main()
