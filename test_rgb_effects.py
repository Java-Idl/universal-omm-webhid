import hid
import time

devs = hid.enumerate(0x046D, 0xC08B)
col1 = next((d for d in devs if d['usage_page'] == 0xFF00 and d['usage'] == 1), None)
col2 = next((d for d in devs if d['usage_page'] == 0xFF00 and d['usage'] == 2), None)

d1 = hid.device()
d1.open_path(col1['path'])
d2 = hid.device()
d2.open_path(col2['path'])

# Discover 0x8070
d1.write(bytes([0x10, 0xFF, 0x00, 0x01, 0x80, 0x70, 0x00]))
res = bytes(d2.read(64, 200))
rgb_idx = res[4]
print(f"RGB feature runtime index: 0x{rgb_idx:02X}")

# Enable SW control
d1.write(bytes([0x10, 0xFF, rgb_idx, 0x81, 0x01, 0x00, 0x00]))
d2.read(64, 200)

print("\n--- Testing Effect 3 (Color Cycling) ---")
# Testing Color Cycling (effect 3, period = 3000ms = 0x0BB8, brightness = 100 = 0x64)
# Layout: [zone, effect_id(3), 0, 0, 0, 0, 0, period_hi, period_lo, intensity, 0, 0, persistence(1), 0, 0, 0]
payload_cycle = [0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0B, 0xB8, 0x64, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]
pkt_cycle = bytes([0x11, 0xFF, rgb_idx, 0x31] + payload_cycle)
d2.write(pkt_cycle)
ack = bytes(d2.read(64, 500))
print(f"Cycle Send: {pkt_cycle.hex()}")
print(f"Cycle Ack:  {ack.hex()}")

time.sleep(3)

print("\n--- Testing Effect 10 / 0x0A (Breathing) ---")
# Testing Breathing: color = cyan (0, 229, 255), period = 2000ms = 0x07D0, intensity = 100
payload_breath = [0x00, 0x0A, 0x00, 0xE5, 0xFF, 0x07, 0xD0, 0x00, 0x64, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]
pkt_breath = bytes([0x11, 0xFF, rgb_idx, 0x31] + payload_breath)
d2.write(pkt_breath)
ack = bytes(d2.read(64, 500))
print(f"Breath Send: {pkt_breath.hex()}")
print(f"Breath Ack:  {ack.hex()}")

# Also check effect 2 (legacy pulsing breathing)
payload_breath2 = [0x00, 0x02, 0x00, 0xE5, 0xFF, 0x07, 0xD0, 0x00, 0x64, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]
pkt_breath2 = bytes([0x11, 0xFF, rgb_idx, 0x32] + payload_breath2)
d2.write(pkt_breath2)
ack2 = bytes(d2.read(64, 500))
print(f"Breath2 Send: {pkt_breath2.hex()}")
print(f"Breath2 Ack:  {ack2.hex()}")

d1.close()
d2.close()
