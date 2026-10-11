import frida

mgr = frida.get_local_device()
procs = mgr.enumerate_processes()
for p in procs:
    if "onboard" in p.name.lower():
        print(f"Found OMM Process: PID={p.pid}, Name={p.name}")
