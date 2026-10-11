import pefile, struct

with open('logs/dotnet_dump/OnboardMemoryManager.embeddeddlls.logi_nethidppio.dll', 'rb') as f:
    buf = f.read()

pe = pefile.PE(data=buf)
image_base = pe.OPTIONAL_HEADER.ImageBase

# Let's inspect the memory layout around 0x1AF600 to 0x1AF900
offset = 0x1AF600
end = 0x1B0000

print(f"=== Dumping structures around 0x{offset:X} ===")

# Print 8-byte integers or strings
p = offset
while p < end:
    # check if string
    # check if 8-byte pointer into .text
    val8 = struct.unpack('<Q', buf[p:p+8])[0]
    if 0x180001000 <= val8 <= 0x1801A6000: # pointer into .text
        rva = val8 - image_base
        print(f"0x{p:X} (RVA 0x{pe.get_rva_from_offset(p):X}): TEXT_PTR 0x{val8:X} (RVA 0x{rva:X})")
        p += 8
    elif 32 <= buf[p] < 127 and 32 <= buf[p+1] < 127: # ASCII string
        s_end = buf.find(b'\x00', p)
        if s_end != -1 and s_end - p >= 3:
            s = buf[p:s_end].decode('utf-8', errors='ignore')
            print(f"0x{p:X} (RVA 0x{pe.get_rva_from_offset(p):X}): STRING \"{s}\"")
            p = (s_end + 8) & ~7 # align to 8
        else:
            p += 8
    else:
        print(f"0x{p:X} (RVA 0x{pe.get_rva_from_offset(p):X}): DATA 0x{val8:016X}")
        p += 8
