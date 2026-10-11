import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_64, CS_GRP_JUMP, CS_GRP_CALL

pe = pefile.PE('logs/dotnet_dump/OnboardMemoryManager.embeddeddlls.logi_nethidppio.dll')
image_base = pe.OPTIONAL_HEADER.ImageBase
text_sec = [s for s in pe.sections if s.Name.startswith(b'.text')][0]
text_data = text_sec.get_data()
text_va = image_base + text_sec.VirtualAddress

md = Cs(CS_ARCH_X86, CS_MODE_64)
md.detail = True

# Target string RVAs
targets = {
    0x1B1558: 'Get onboard profiles info',
    0x1B1578: 'Set onboard mode',
    0x1B15A8: 'Get onboard mode',
    0x1B4C50: 'Get sensor DPI list',
    0x1B4EF0: 'Get sensor DPI parameters',
    0x1BB450: 'Get actual report rate list',
    0x1BB438: 'Get report rate',
}

target_vas = {image_base + rva: name for rva, name in targets.items()}

print("Scanning instructions...")
count = 0
for insn in md.disasm(text_data, text_va):
    # Check RIP relative operands
    for op in insn.operands:
        if op.type == 3: # X86_OP_MEM
            if op.mem.base == 21: # X86_REG_RIP
                target_addr = insn.address + insn.size + op.mem.disp
                if target_addr in target_vas:
                    count += 1
                    name = target_vas[target_addr]
                    print(f"\n[HIT] {name} referenced at 0x{insn.address:X}: {insn.mnemonic} {insn.op_str}")
                    # Disassemble around this address
                    start_va = max(text_va, insn.address - 0x50)
                    start_off = start_va - text_va
                    chunk = text_data[start_off:start_off + 0xC0]
                    print("--- Disassembly Context ---")
                    for sub in md.disasm(chunk, start_va):
                        flag = "===>" if sub.address == insn.address else "    "
                        print(f"{flag} 0x{sub.address:X}: {sub.mnemonic:7} {sub.op_str}")

print(f"Total hits: {count}")
