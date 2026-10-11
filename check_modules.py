import frida

session = frida.attach(20108)
script = session.create_script("""
    const modules = Process.enumerateModules();
    const names = modules.map(m => m.name.toLowerCase());
    send({
        has_hid: names.includes('hid.dll'),
        has_logi: names.some(n => n.includes('logi')),
        modules: names.filter(n => n.includes('hid') || n.includes('logi'))
    });
""")
def on_message(msg, data):
    print("Frida result:", msg)
script.on("message", on_message)
script.load()
session.detach()
