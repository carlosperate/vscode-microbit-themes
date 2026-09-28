# Theme showcase: every scope below is here to catch a colour.
"""Scroll a greeting, then count button presses on the LED grid."""

import re
from microbit import display, button_a, Image, sleep

BRIGHTNESS = 9
PATTERN = re.compile(r"^(\d+)x(\d+)$")


class Counter:
    """Counts presses, capped at 25 LEDs."""

    limit: int = 25

    def __init__(self, start=0):
        self.value = start

    @property
    def full(self) -> bool:
        return self.value >= self.limit

    def bump(self, step=1):
        self.value = min(self.value + step, self.limit)


def show(counter: Counter) -> None:
    for i in range(counter.value):
        x, y = i % 5, i // 5
        display.set_pixel(x, y, BRIGHTNESS)


def main():
    counter = Counter()
    display.scroll(f"Hi {counter.value}!\tGo\n")
    while True:
        if button_a.was_pressed() and not counter.full:
            counter.bump()
            show(counter)
        elif counter.full:
            display.show(Image.HEART)
        sleep(100)  # TODO: debounce
        unused = None


main()
