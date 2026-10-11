import ctypes
from ctypes import wintypes
import time

kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)

GENERIC_READ = 0x80000000
GENERIC_WRITE = 0x40000000
FILE_SHARE_READ = 0x00000001
FILE_SHARE_WRITE = 0x00000002
OPEN_EXISTING = 3
FILE_FLAG_OVERLAPPED = 0x40000000

kernel32.CreateFileW.argtypes = [
    wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
    wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE
]
kernel32.CreateFileW.restype = wintypes.HANDLE

kernel32.WriteFile.argtypes = [
    wintypes.HANDLE, wintypes.LPCVOID, wintypes.DWORD,
    wintypes.LPDWORD, wintypes.LPVOID
]
kernel32.WriteFile.restype = wintypes.BOOL

kernel32.ReadFile.argtypes = [
    wintypes.HANDLE, wintypes.LPVOID, wintypes.DWORD,
    wintypes.LPDWORD, wintypes.LPVOID
]
kernel32.ReadFile.restype = wintypes.BOOL

kernel32.GetOverlappedResult.argtypes = [
    wintypes.HANDLE, wintypes.LPVOID, wintypes.LPDWORD, wintypes.BOOL
]
kernel32.GetOverlappedResult.restype = wintypes.BOOL

kernel32.CreateEventW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.BOOL, wintypes.LPCWSTR]
kernel32.CreateEventW.restype = wintypes.HANDLE

kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
kernel32.CloseHandle.restype = wintypes.BOOL

# Find path for UsagePage 0xFF00, Usage 0x0001
import hid
devs = hid.enumerate(0x046D, 0xC08B)
path = None
for d in devs:
    if d['usage_page'] == 0xFF00 and d['usage'] == 0x0001:
        path = d['path'].decode('utf-8') if isinstance(d['path'], bytes) else d['path']
        break

print(f"Opening path: {path}")

# Open with Overlapped
hDev = kernel32.CreateFileW(
    path,
    GENERIC_READ | GENERIC_WRITE,
    FILE_SHARE_READ | FILE_SHARE_WRITE,
    None,
    OPEN_EXISTING,
    FILE_FLAG_OVERLAPPED,
    None
)

if hDev == wintypes.HANDLE(-1).value or hDev == 0:
    print(f"CreateFile failed: {ctypes.get_last_error()}")
    exit(1)

print(f"[+] Device opened successfully! Handle: {hex(hDev)}")

# Prepare OVERLAPPED for Read
class OVERLAPPED(ctypes.Structure):
    _fields_ = [
        ("Internal", wintypes.LPVOID),
        ("InternalHigh", wintypes.LPVOID),
        ("Offset", wintypes.DWORD),
        ("OffsetHigh", wintypes.DWORD),
        ("hEvent", wintypes.HANDLE),
    ]

read_event = kernel32.CreateEventW(None, True, False, None)
ov_read = OVERLAPPED()
ov_read.hEvent = read_event

write_event = kernel32.CreateEventW(None, True, False, None)
ov_write = OVERLAPPED()
ov_write.hEvent = write_event

# Queue ReadFile
read_buf = (ctypes.c_ubyte * 20)()
bytes_read = wintypes.DWORD(0)
res = kernel32.ReadFile(hDev, read_buf, 20, ctypes.byref(bytes_read), ctypes.byref(ov_read))
print(f"Initial ReadFile returned: {res}, err={ctypes.get_last_error()}")

# Query Root Feature (0x0000) Function 0 for Feature 0x8100 (Onboard Profiles)
# 10 ff 00 00 81 00 00
req = bytes([0x10, 0xFF, 0x00, 0x00, 0x81, 0x00, 0x00])
req_buf = (ctypes.c_ubyte * 7)(*req)
bytes_written = wintypes.DWORD(0)

res_w = kernel32.WriteFile(hDev, req_buf, 7, ctypes.byref(bytes_written), ctypes.byref(ov_write))
print(f"WriteFile returned: {res_w}, err={ctypes.get_last_error()}")

# Wait for read
res_ov = kernel32.GetOverlappedResult(hDev, ctypes.byref(ov_read), ctypes.byref(bytes_read), True)
print(f"GetOverlappedResult returned: {res_ov}, bytes={bytes_read.value}")
if res_ov:
    resp_bytes = list(read_buf[:bytes_read.value])
    print(f"[+] Device response: {' '.join(f'{b:02x}' for b in resp_bytes)}")

kernel32.CloseHandle(read_event)
kernel32.CloseHandle(write_event)
kernel32.CloseHandle(hDev)
