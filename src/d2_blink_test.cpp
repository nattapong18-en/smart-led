#include <Arduino.h>

namespace {

constexpr uint8_t TEST_LED_PIN = 2;
constexpr unsigned long BLINK_INTERVAL_MS = 500;

bool ledOn = false;
unsigned long lastToggleMs = 0;

} // namespace

void setup() {
  Serial.begin(115200);
  pinMode(TEST_LED_PIN, OUTPUT);
  digitalWrite(TEST_LED_PIN, LOW);

  Serial.println();
  Serial.println("GPIO2 / D2 blink test started");
  Serial.println("The LED should toggle every 500 ms");
}

void loop() {
  const unsigned long now = millis();

  if (now - lastToggleMs < BLINK_INTERVAL_MS) {
    return;
  }

  lastToggleMs = now;
  ledOn = !ledOn;
  digitalWrite(TEST_LED_PIN, ledOn ? HIGH : LOW);

  Serial.println(ledOn ? "GPIO2 HIGH" : "GPIO2 LOW");
}
