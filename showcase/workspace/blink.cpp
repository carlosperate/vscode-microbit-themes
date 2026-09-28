#include "MicroBit.h"

// Blinks the centre LED, faster on every press of button A.
MicroBit uBit;

constexpr int MIN_DELAY = 50;

int main() {
    uBit.init();
    int delay = 500;
    while (true) {
        if (uBit.buttonA.isPressed() && delay > MIN_DELAY) {
            delay /= 2;
        }
        uBit.display.image.setPixelValue(2, 2, 255);
        uBit.sleep(delay);
        uBit.display.clear();
        uBit.sleep(delay);
    }
    return 0;
}
