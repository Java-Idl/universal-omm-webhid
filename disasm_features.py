import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_64

pe = pefile.PE('logs/dotnet_dump/OnboardMemoryManager.embeddeddlls.logi_nethidppio.dll')
image_base = pe.OPTIONAL_HEADER.ImageBase

# Find text section
text_sec = None
for s in pe.sections:
    if s.Name.startswith(b'.text'):
        text_sec = s
        break

text_data = text_sec.get_data()
text_va = image_base + text_sec.VirtualAddress
text_rva = text_sec.VirtualAddress

md = Cs(CS_ARCH_X86, CS_MODE_64)

# Targets
targets = {
    'Get onboard profiles info': 0x1801B1558,
    'Set onboard mode': 0x1801B1578,
    'Get onboard mode': 0x1801B15A8,
    'Get sensor DPI list': 0x1801B4C50,
    'Get sensor DPI parameters': 0x1801B4EF0,
    'Get actual report rate list': 0x1801BB450,
    'Get report rate': 0x1801BB438,
}

for name, str_va in targets.items():
    print(f"\n==================== {name} (String VA=0x{str_va:X}) ====================")
    # Search for rip-relative lea/mov referencing str_va
    # in x64, LEA reg, [rip + disp] where rip = instr_addr + instr_len
    # disp = str_va - (instr_addr + instr_len)
    for insn in md.disasm(text_data, text_va):
        # check if instruction references str_va
        disp = str_va - (insn.address + insn.size)
        # Check bytes or mnemonic
        if insn.mnemonic in ['lea', 'mov'] and hex(str_va).lower() in insn.op_str.lower():
            print(f"Match at 0x{insn.address:X}: {insn.mnemonic} {insn.op_str}")
            # Disassemble surrounding 30 instructions
            offset_in_sec = insn.address - text_va
            start_off = max(0, offset_in_sec - 60)
            chunk = text_data[start_off:start_off + 160]
            print("--- Context ---")
            for sub_insn in md.disasm(chunk, text_va + start_off):
                marker = "==>" if sub_insn.address == insn.address else "   "
                print(f"{marker} 0x{sub_insn.address:X}: {sub_insn.mnemonic:6} {sub_insn.op_str}")
            break
