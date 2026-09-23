#include "led_controller.h"

namespace LedController {

static uint8_t currentBrightness = 0;
static uint8_t restoreBrightness = 0;
static uint8_t blinkBrightness = 100;
static uint16_t blinkOnMs = 500;
static uint16_t blinkOffMs = 500;
static uint8_t blinkCount = 0;
static uint8_t blinkRemaining = 0;
static bool blinking = false;
static bool blinkOutputOn = false;
static unsigned long lastBlinkChange = 0;

void writeBrightness(uint8_t percent) {
  analogWrite(LED_PIN, map(percent, 0, 100, 0, 255));
}

void begin() {
  pinMode(LED_PIN, OUTPUT);

  writeBrightness(0);

  currentBrightness = 0;
}

void setBrightness(uint8_t percent) {
  // กันค่าหลุดเกิน 100%
  if (percent > 100) {
    percent = 100;
  }

  blinking = false;
  blinkOutputOn = false;
  currentBrightness = percent;

  // 0-100% -> 0-255 PWM
  uint8_t pwmValue = map(percent, 0, 100, 0, 255);

  analogWrite(LED_PIN, pwmValue);

  Serial.print("Brightness: ");
  Serial.print(currentBrightness);
  Serial.print("% | PWM: ");
  Serial.println(pwmValue);
}

void startBlink(uint8_t percent, uint16_t onMs, uint16_t offMs, uint8_t count) {
  if (percent < 1) percent = 1;
  if (percent > 100) percent = 100;

  restoreBrightness = blinking ? restoreBrightness : currentBrightness;
  blinkBrightness = percent;
  blinkOnMs = onMs;
  blinkOffMs = offMs;
  blinkCount = count;
  blinkRemaining = count;
  blinking = true;
  blinkOutputOn = true;
  lastBlinkChange = millis();
  writeBrightness(blinkBrightness);

  Serial.printf("Blink: %u%% | on=%ums | off=%ums | count=%u\n",
                blinkBrightness, blinkOnMs, blinkOffMs, blinkCount);
}

void stopBlink() {
  if (!blinking) return;
  blinking = false;
  blinkOutputOn = false;
  currentBrightness = restoreBrightness;
  writeBrightness(currentBrightness);
  Serial.printf("Blink stopped | restored=%u%%\n", currentBrightness);
}

void update() {
  if (!blinking) return;

  const unsigned long now = millis();
  const uint16_t interval = blinkOutputOn ? blinkOnMs : blinkOffMs;
  if (now - lastBlinkChange < interval) return;
  lastBlinkChange = now;

  if (blinkOutputOn) {
    blinkOutputOn = false;
    writeBrightness(0);
    if (blinkCount > 0 && blinkRemaining > 0) blinkRemaining--;
    if (blinkCount > 0 && blinkRemaining == 0) {
      stopBlink();
    }
  } else {
    blinkOutputOn = true;
    writeBrightness(blinkBrightness);
  }
}

uint8_t getBrightness() { return currentBrightness; }

bool isOn() { return blinking ? blinkOutputOn : currentBrightness > 0; }

bool isBlinking() { return blinking; }

bool isBlinkOutputOn() { return blinkOutputOn; }

uint8_t getBlinkBrightness() { return blinkBrightness; }

uint16_t getBlinkOnMs() { return blinkOnMs; }

uint16_t getBlinkOffMs() { return blinkOffMs; }

uint8_t getBlinkCount() { return blinkCount; }

uint8_t getBlinkRemaining() { return blinkRemaining; }

} // namespace LedController
