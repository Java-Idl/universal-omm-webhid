/**
 * HID++ 2.0 API Observation Hook for Logitech Onboard Memory Manager
 * Intercepts HID.DLL and KERNEL32.DLL (including Overlapped I/O) to dump HID++ request/response buffers.
 */

function bufToHex(ptr, len) {
    if (!ptr || len <= 0) return "";
    try {
        const bytes = ptr.readByteArray(len);
        if (!bytes) return "";
        const u8 = new Uint8Array(bytes);
        return Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join(' ');
    } catch (e) {
        return "<read-error: " + e.message + ">";
    }
}

function decodeHidppHeader(bufStr) {
    const parts = bufStr.split(' ');
    if (parts.length < 4) return "";
    const reportId = parts[0];
    const devIdx = parts[1];
    const featIdx = parts[2];
    const fnSw = parseInt(parts[3], 16);
    if (isNaN(fnSw)) return "";
    const fnId = (fnSw >> 4).toString(16);
    const swId = (fnSw & 0x0F).toString(16);
    return `[ReportID=0x${reportId} Dev=0x${devIdx} FeatIdx=0x${featIdx} Fn=0x${fnId} Sw=0x${swId}]`;
}

function logEvent(api, direction, handle, length, hex) {
    const ts = new Date().toISOString();
    const decoded = decodeHidppHeader(hex);
    const msg = `[${ts}] [${api}] [${direction}] Handle=${handle} Len=${length} ${decoded}\n  Bytes: ${hex}\n`;
    send({ type: 'hid_event', message: msg });
}

const pendingReads = new Map();

function hookKernel32Apis() {
    const k32 = Process.findModuleByName('kernel32.dll');
    if (!k32) return;

    console.log("[+] Hooking KERNEL32.DLL file I/O exports...");

    const pWriteFile = k32.findExportByName('WriteFile');
    if (pWriteFile) {
        Interceptor.attach(pWriteFile, {
            onEnter(args) {
                this.hFile = args[0];
                this.pBuf = args[1];
                this.len = args[2].toInt32();
                if ((this.len === 7 || this.len === 20 || this.len === 64) && !this.pBuf.isNull()) {
                    try {
                        const firstByte = this.pBuf.readU8();
                        if (firstByte === 0x10 || firstByte === 0x11 || firstByte === 0x12) {
                            const hex = bufToHex(this.pBuf, this.len);
                            logEvent('WriteFile', 'SEND', this.hFile, this.len, hex);
                        }
                    } catch (e) {}
                }
            }
        });
        console.log("    Attached to WriteFile");
    }

    const pReadFile = k32.findExportByName('ReadFile');
    if (pReadFile) {
        Interceptor.attach(pReadFile, {
            onEnter(args) {
                this.hFile = args[0];
                this.pBuf = args[1];
                this.len = args[2].toInt32();
                this.lpBytesRead = args[3];
                this.lpOverlapped = args[4];

                if (!this.lpOverlapped.isNull()) {
                    pendingReads.set(this.lpOverlapped.toString(), {
                        pBuf: this.pBuf,
                        maxLen: this.len,
                        hFile: this.hFile
                    });
                }
            },
            onLeave(retval) {
                // Synchronous completion
                if (retval.toInt32() !== 0 && !this.pBuf.isNull()) {
                    try {
                        let actualLen = this.len;
                        if (!this.lpBytesRead.isNull()) {
                            actualLen = this.lpBytesRead.readU32();
                        }
                        if (actualLen === 7 || actualLen === 20 || actualLen === 64) {
                            const firstByte = this.pBuf.readU8();
                            if (firstByte === 0x10 || firstByte === 0x11 || firstByte === 0x12) {
                                const hex = bufToHex(this.pBuf, actualLen);
                                logEvent('ReadFile_SYNC', 'RECV', this.hFile, actualLen, hex);
                            }
                        }
                    } catch (e) {}
                }
            }
        });
        console.log("    Attached to ReadFile");
    }

    const pGetOverlappedResult = k32.findExportByName('GetOverlappedResult');
    if (pGetOverlappedResult) {
        Interceptor.attach(pGetOverlappedResult, {
            onEnter(args) {
                this.hFile = args[0];
                this.lpOverlapped = args[1];
                this.lpTransferred = args[2];
            },
            onLeave(retval) {
                if (retval.toInt32() !== 0 && !this.lpOverlapped.isNull()) {
                    const key = this.lpOverlapped.toString();
                    const entry = pendingReads.get(key);
                    if (entry) {
                        try {
                            const bytesTransferred = this.lpTransferred.readU32();
                            if (bytesTransferred === 7 || bytesTransferred === 20 || bytesTransferred === 64) {
                                const firstByte = entry.pBuf.readU8();
                                if (firstByte === 0x10 || firstByte === 0x11 || firstByte === 0x12) {
                                    const hex = bufToHex(entry.pBuf, bytesTransferred);
                                    logEvent('GetOverlappedResult', 'RECV', entry.hFile, bytesTransferred, hex);
                                }
                            }
                        } catch (e) {}
                    }
                }
            }
        });
        console.log("    Attached to GetOverlappedResult");
    }
}

function hookHidApis() {
    const hid = Process.findModuleByName('hid.dll');
    if (!hid) {
        console.log("[-] hid.dll not found in process.");
        return;
    }

    console.log("[+] Hooking HID.DLL exports...");

    const pSetFeature = hid.findExportByName('HidD_SetFeature');
    if (pSetFeature) {
        Interceptor.attach(pSetFeature, {
            onEnter(args) {
                this.hDev = args[0];
                this.pBuf = args[1];
                this.len = args[2].toInt32();
                if (this.len > 0 && !this.pBuf.isNull()) {
                    this.hex = bufToHex(this.pBuf, this.len);
                    logEvent('HidD_SetFeature', 'SEND', this.hDev, this.len, this.hex);
                }
            }
        });
        console.log("    Attached to HidD_SetFeature");
    }

    const pSetOutputReport = hid.findExportByName('HidD_SetOutputReport');
    if (pSetOutputReport) {
        Interceptor.attach(pSetOutputReport, {
            onEnter(args) {
                this.hDev = args[0];
                this.pBuf = args[1];
                this.len = args[2].toInt32();
                if (this.len > 0 && !this.pBuf.isNull()) {
                    this.hex = bufToHex(this.pBuf, this.len);
                    logEvent('HidD_SetOutputReport', 'SEND', this.hDev, this.len, this.hex);
                }
            }
        });
        console.log("    Attached to HidD_SetOutputReport");
    }

    const pGetFeature = hid.findExportByName('HidD_GetFeature');
    if (pGetFeature) {
        Interceptor.attach(pGetFeature, {
            onEnter(args) {
                this.hDev = args[0];
                this.pBuf = args[1];
                this.len = args[2].toInt32();
            },
            onLeave(retval) {
                if (retval.toInt32() !== 0 && this.len > 0 && !this.pBuf.isNull()) {
                    const hex = bufToHex(this.pBuf, this.len);
                    logEvent('HidD_GetFeature', 'RECV', this.hDev, this.len, hex);
                }
            }
        });
        console.log("    Attached to HidD_GetFeature");
    }
}

hookKernel32Apis();
hookHidApis();

console.log("[*] Logitech HID++ 2.0 instrumentation hooks ready with Overlapped I/O support.");
