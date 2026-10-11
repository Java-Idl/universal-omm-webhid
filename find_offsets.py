import pefile

pe = pefile.PE('logs/dotnet_dump/OnboardMemoryManager.embeddeddlls.logi_nethidppio.dll')
image_base = pe.OPTIONAL_HEADER.ImageBase

with open('logs/dotnet_dump/OnboardMemoryManager.embeddeddlls.logi_nethidppio.dll', 'rb') as f:
    buf = f.read()

target_strs = [
    b'Get onboard profiles info',
    b'Set onboard mode',
    b'Get onboard mode',
    b'Get sensor DPI list',
    b'Get sensor DPI parameters',
    b'Get actual report rate list',
    b'Get report rate',
    b'Set report rate',
    b'Get info',
    b'Set zone effect',
]

for s in target_strs:
    pos = buf.find(s)
    if pos != -1:
        rva = pe.get_rva_from_offset(pos)
        va = image_base + rva
        print(f"String '{s.decode()}' at FileOffset=0x{pos:X}, RVA=0x{rva:X}, VA=0x{va:X}")
