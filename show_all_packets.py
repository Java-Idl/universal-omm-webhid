import dump_packets

with open("logs/parsed_packets.txt", "w", encoding="utf-8") as out:
    for idx, e in enumerate(dump_packets.non_polling):
        line = f"{idx+1:03d}. [{e['dir']}] Len={e['len']:02d} {e['decoded']} => {e['bytes']}\n"
        out.write(line)

print(f"Wrote {len(dump_packets.non_polling)} non-polling packets to logs/parsed_packets.txt")
