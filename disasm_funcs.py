import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_64

pe = pefile.PE('logs/dotnet_dump/OnboardMemoryManager.embeddeddlls.logi_nethidppio.dll')
image_base = pe.OPTIONAL_HEADER.ImageBase
text_sec = [s for s in pe.sections if s.Name.startswith(b'.text')][0]
text_data = text_sec.get_data()
text_va = image_base + text_sec.VirtualAddress

md = Cs(CS_ARCH_X86, CS_MODE_64)

funcs_to_disasm = [
    0x1800E5490,
    0x1800E5520,
    0x1800E55B0,
    0x1800E56A0,
    0x1800E5790,
    0x1800766D0,
]

for f_va in funcs_to_disasm:
    print(f"\n==================== Function at 0x{f_va:X} ====================")
    offset = f_va - text_va
    chunk = text_data[offset:offset + 80]
    for insn in md.disasm(chunk, f_va):
        print(f"  0x{insn.address:X}: {insn.mnemonic:8} {insn.op_str}")
        if insn.mnemonic in ['ret', 'jmp']:
            break
