import pefile, struct

with open('logs/dotnet_dump/OnboardMemoryManager.embeddeddlls.logi_nethidppio.dll', 'rb') as f:
    buf = f.read()

pe = pefile.PE(data=buf)
image_base = pe.OPTIONAL_HEADER.ImageBase

target_rva = 0x1B1558 # 'Get onboard profiles info'
target_va = image_base + target_rva

print("Searching 4-byte RVA:", hex(target_rva))
pos = 0
rva_bytes = struct.pack('<I', target_rva)
while True:
    p = buf.find(rva_bytes, pos)
    if p == -1: break
    sec = pe.get_section_by_offset(p)
    sec_name = sec.Name.decode().strip() if sec else 'none'
    print(f"RVA match at file offset 0x{p:X} (section {sec_name})")
    pos = p + 1

print("Searching 8-byte VA:", hex(target_va))
pos = 0
va_bytes = struct.pack('<Q', target_va)
while True:
    p = buf.find(va_bytes, pos)
    if p == -1: break
    sec = pe.get_section_by_offset(p)
    sec_name = sec.Name.decode().strip() if sec else 'none'
    print(f"VA match at file offset 0x{p:X} (section {sec_name})")
    pos = p + 1
