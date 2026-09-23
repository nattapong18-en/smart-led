#pragma once

#include <Arduino.h>

namespace LedController {

constexpr uint8_t LED_PIN = 2;

// เริ่มต้น LED และ PWM
void begin();

// ตั้งความสว่าง 0-100%
void setBrightness(uint8_t percent);

// เริ่มกระพริบแบบไม่ block; count=0 หมายถึงกระพริบต่อเนื่อง
void startBlink(uint8_t percent, uint16_t onMs, uint16_t offMs, uint8_t count);

// หยุดกระพริบและคืนค่าความสว่างก่อนเริ่มกระพริบ
void stopBlink();

// เรียกทุก loop เพื่ออัปเดตจังหวะกระพริบ
void update();

// อ่านค่าความสว่างปัจจุบัน
uint8_t getBrightness();

// เช็กว่าไฟเปิดอยู่หรือไม่
bool isOn();

bool isBlinking();
bool isBlinkOutputOn();
uint8_t getBlinkBrightness();
uint16_t getBlinkOnMs();
uint16_t getBlinkOffMs();
uint8_t getBlinkCount();
uint8_t getBlinkRemaining();

} // namespace LedController
