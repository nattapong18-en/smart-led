#include <Arduino.h>
#include <WebServer.h>
#include <WiFi.h>

#include "led_controller.h"
#include "secrets.h"

WebServer server(80);
unsigned long lastReconnectAttempt = 0;

bool parseIntegerArg(const char *name, long minimum, long maximum, long &value) {
  if (!server.hasArg(name)) return false;
  const String raw = server.arg(name);
  if (raw.isEmpty()) return false;
  char *end = nullptr;
  value = strtol(raw.c_str(), &end, 10);
  return end != raw.c_str() && *end == '\0' && value >= minimum && value <= maximum;
}

String statusJson() {
  String response = "{";
  response += "\"brightness\":" + String(LedController::getBrightness());
  response += ",\"on\":";
  response += LedController::isOn() ? "true" : "false";
  response += ",\"blinking\":";
  response += LedController::isBlinking() ? "true" : "false";
  response += ",\"blinkOutputOn\":";
  response += LedController::isBlinkOutputOn() ? "true" : "false";
  response += ",\"blinkBrightness\":" + String(LedController::getBlinkBrightness());
  response += ",\"blinkOnMs\":" + String(LedController::getBlinkOnMs());
  response += ",\"blinkOffMs\":" + String(LedController::getBlinkOffMs());
  response += ",\"blinkCount\":" + String(LedController::getBlinkCount());
  response += ",\"blinkRemaining\":" + String(LedController::getBlinkRemaining());
  response += "}";
  return response;
}

void handleLight() {
  // เช็กว่ามี parameter brightness หรือไม่
  if (!server.hasArg("brightness")) {
    server.send(400, "application/json",
                "{\"error\":\"brightness is required\"}");

    return;
  }

  int brightness = server.arg("brightness").toInt();

  // กันค่าหลุด
  if (brightness < 0 || brightness > 100) {
    server.send(400, "application/json",
                "{\"error\":\"brightness must be between 0 and 100\"}");

    return;
  }

  // ส่งให้ led_controller จัดการ PWM
  LedController::setBrightness(brightness);

  server.send(200, "application/json", statusJson());
}

void handleStatus() {
  server.send(200, "application/json", statusJson());
}

void handleBlink() {
  long brightness, onMs, offMs, count;
  if (!parseIntegerArg("brightness", 1, 100, brightness) ||
      !parseIntegerArg("onMs", 50, 5000, onMs) ||
      !parseIntegerArg("offMs", 50, 5000, offMs) ||
      !parseIntegerArg("count", 0, 100, count)) {
    server.send(400, "application/json",
                "{\"error\":\"brightness=1..100, onMs/offMs=50..5000, count=0..100 are required\"}");
    return;
  }
  LedController::startBlink(brightness, onMs, offMs, count);
  server.send(200, "application/json", statusJson());
}

void handleBlinkStop() {
  LedController::stopBlink();
  server.send(200, "application/json", statusJson());
}

void setup() {
  Serial.begin(115200);

  // เริ่ม LED
  LedController::begin();

  // เชื่อม Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("Wi-Fi connected");

  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());

  // POST /light
  server.on("/light", HTTP_POST, handleLight);
  server.on("/blink", HTTP_POST, handleBlink);
  server.on("/blink/stop", HTTP_POST, handleBlinkStop);
  server.on("/status", HTTP_GET, handleStatus);

  server.begin();

  Serial.println("HTTP server started");
}

void loop() {
  server.handleClient();
  LedController::update();

  if (WiFi.status() != WL_CONNECTED && millis() - lastReconnectAttempt >= 10000) {
    lastReconnectAttempt = millis();
    Serial.println("Wi-Fi disconnected, reconnecting...");
    WiFi.reconnect();
  }
}
