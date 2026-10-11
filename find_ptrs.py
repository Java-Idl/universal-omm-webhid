import pefile, struct

pe = pefile.PE('logs/dotnet_dump/OnboardMemoryManager.embeddeddlls.logi_nethidppio.dll')
image_base = pe.OPTIONAL_HEADER.ImageBase

with open('logs/dotnet_dump/OnboardMemoryManager.embeddeddlls.logi_nethidppio.dll', 'rb') as f:
    buf = f.read()

# Target VA
str_va = 0x1801B1558 # 'Get onboard profiles info'
str_rva = 0x1B1558

# Find 8-byte pointer in binary
packed_va = struct.pack('<Q', str_va)
matches = []
pos = 0
while True:
    p = buf.find(packed_va, pos)
    if p == -1:
        break
    matches.append(p)
    pos = p + 1

print(f"Direct pointer matches: {[hex(m) for m in matches]}")

# Also search for rip-relative lea / mov in text section
text_sec = [s for s in pe.sections if s.Name.startswith(b'.text')][0]
text_data = text_sec.get_data()
text_rva = text_sec.VirtualAddress

# In x86_64, LEA rdx, [rip + disp32] has opcode: 48 8D 15 [disp32]
# or LEA rcx, [rip + disp32]: 48 8D 0D [disp32]
# or LEA r8,  [rip + disp32]: 4C 8D 05 [disp32]
for i in range(len(text_data) - 7):
    # check disp32 at i+3
    b = text_data[i:i+3]
    if b in [b'\x48\x8d\x15', b'\x48\x8d\x0d', b'\x4c\x8d\x05', b'\x4c\x8d\x0d', b'\x48\x8d\x05']:
        disp = struct.unpack('<i', text_data[i+3:i+7])[0]
        curr_rva = text_rva + i + 7
        target = curr_rva + disp
        if target == str_rva:
            print(f"Found RIP-relative LEA to string at RVA 0x{text_rva + i:X} (VA 0x{image_base + text_rva + i:X})")
