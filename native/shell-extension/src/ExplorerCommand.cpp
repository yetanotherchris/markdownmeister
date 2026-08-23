// Spec 038: IExplorerCommand implementation. See ExplorerCommand.h for the
// containment (FR-011) and hand-off (FR-012) contracts.

#include "ExplorerCommand.h"

#include <windows.h>
#include <objbase.h>
#include <shlobj_core.h>
#include <iterator>

namespace {

constexpr wchar_t kTitle[] = L"Open in MarkdownMeister";
constexpr wchar_t kAliasFileName[] = L"markdownmeister.exe";
// Where MSIX materialises execution aliases for the current user.
constexpr wchar_t kWindowsAppsSubdir[] = L"Microsoft\\WindowsApps\\";
// The packaged layout produced by electron-builder maps win-unpacked to `app\`
// inside the MSIX root, and scripts/copy-shell-extension.cjs places this DLL at
// app\resources\shell-extension\. Resolving the application icon therefore
// means walking up past the DLL file name plus two directory levels and
// appending the launcher binary name (research R6).
constexpr int kTrailingComponentsToStrip = 3;

// Copy `text` into a shell-allocated string; empty input yields an empty
// (non-null) allocation so callers never dereference null.
HRESULT CopyCoString(const wchar_t *text, LPWSTR *out) {
  *out = nullptr;
  const size_t characters = wcslen(text) + 1;
  auto buffer = static_cast<LPWSTR>(CoTaskMemAlloc(characters * sizeof(wchar_t)));
  if (!buffer) return E_OUTOFMEMORY;
  wcscpy_s(buffer, characters, text);
  *out = buffer;
  return S_OK;
}

// Resolve the module handle for an address inside this DLL without keeping a
// reference alive (a held handle would pin the DLL in Explorer forever).
HMODULE SelfModule() {
  HMODULE module = nullptr;
  GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS |
                         GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                     reinterpret_cast<LPCWSTR>(&SelfModule), &module);
  return module;
}

// "<pkg>\app\MarkdownMeister.exe" derived from this DLL's own location, or an
// empty string when unavailable (entry renders without icon — quiet, FR-011).
bool ResolvePackagedLauncher(wchar_t *launcher, size_t capacity) {
  launcher[0] = L'\0';
  HMODULE self = SelfModule();
  if (!self) return false;

  wchar_t dll_path[MAX_PATH * 2];
  if (GetModuleFileNameW(self, dll_path, static_cast<DWORD>(std::size(dll_path))) == 0)
    return false;

  // Strip kTrailingComponentsToStrip trailing components (name + dirs); each
  // pass leaves `cursor` sitting on the separator that was crossed.
  wchar_t *cursor = dll_path + lstrlenW(dll_path);
  for (int stripped = 0; stripped < kTrailingComponentsToStrip; ++stripped) {
    while (cursor > dll_path && *(cursor - 1) != L'\\') --cursor;
    if (cursor == dll_path) return false;
    --cursor;
    if (cursor == dll_path) return false;
  }

  const int written =
      _snwprintf_s(launcher, capacity, _TRUNCATE, L"%.*s\\" kAliasFileName,
                   static_cast<int>(cursor - dll_path), dll_path);
  return written > 0;
}

// Detached launch of the execution alias with the quoted folder as its only
// argument (contracts/handoff.md). Never waits on the child, never shows UI,
// never surfaces launch failure beyond a silent no-op.
void LaunchAlias(const wchar_t *folder_path) {
  PWSTR local_app = nullptr;
  if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &local_app))) return;

  wchar_t alias_path[MAX_PATH * 2];
  const int alias_written = _snwprintf_s(alias_path, static_cast<DWORD>(std::size(alias_path)),
                                         _TRUNCATE, L"%s%s%s", local_app, kWindowsAppsSubdir,
                                         kAliasFileName);
  CoTaskMemFree(local_app);
  if (alias_written <= 0) return;

  wchar_t command_line[MAX_PATH * 4];
  if (_snwprintf_s(command_line, static_cast<DWORD>(std::size(command_line)), _TRUNCATE,
                   L"\"%s\" \"%s\"", alias_path, folder_path) <= 0)
    return;

  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  PROCESS_INFORMATION process{};
  // The alias materialises only while the package is registered; when absent
  // fall back once to ShellExecuteEx resolution (PATH / App Paths).
  const bool alias_exists = GetFileAttributesW(alias_path) != INVALID_FILE_ATTRIBUTES;
  const BOOL launched =
      alias_exists
          ? CreateProcessW(alias_path, command_line, nullptr, nullptr, FALSE, CREATE_NO_WINDOW,
                           nullptr, nullptr, &startup, &process)
          : FALSE;
  if (launched) {
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return;
  }

  wchar_t parameters[MAX_PATH * 2];
  if (_snwprintf_s(parameters, static_cast<DWORD>(std::size(parameters)), _TRUNCATE, L"\"%s\"",
                   folder_path) <= 0)
    return;
  SHELLEXECUTEINFOW execute{};
  execute.cbSize = sizeof(execute);
  execute.fMask = SEE_MASK_NOASYNC | SEE_MASK_FLAG_DONTWAIT;
  execute.lpVerb = L"open";
  execute.lpFile = kAliasFileName;
  execute.lpParameters = parameters;
  execute.nShow = SW_SHOWNORMAL;
  ShellExecuteExW(&execute);
}

// Multi-selection is out of scope (spec 038 edge cases, spec 035 FR-013): act
// only when exactly one item arrives; otherwise do nothing.
HRESULT InvokeImpl(IShellItemArray *items) {
  DWORD count = 0;
  if (!items || FAILED(items->GetCount(&count)) || count != 1) return S_OK;

  IShellItem *item = nullptr;
  if (FAILED(items->GetItemAt(0, &item))) return S_OK;

  PWSTR folder_path = nullptr;
  // Non-filesystem locations (libraries, virtualised places) expose no
  // filesystem path: quietly decline rather than guess a substitute.
  const HRESULT hr = item->GetDisplayName(SIGDN_FILESYSPATH, &folder_path);
  item->Release();
  if (FAILED(hr) || !folder_path) return S_OK;

  LaunchAlias(folder_path);
  CoTaskMemFree(folder_path);
  return S_OK;
}

} // namespace

// SEH boundary frames. They intentionally contain no C++ objects (unwind would
// be rejected alongside __try) — implementations live above and are called
// through these frames so any fault collapses to a contained failure HRESULT.

IFACEMETHODIMP OpenInMarkdownMeisterCommand::QueryInterface(REFIID riid, void **out_object) {
  if (!out_object) return E_POINTER;
  __try {
    *out_object = nullptr;
    const IID targets[] = {IID_IUnknown, IID_IExplorerCommand};
    for (const IID &target : targets) {
      if (riid == target) {
        AddRef();
        *out_object = static_cast<IExplorerCommand *>(this);
        return S_OK;
      }
    }
    return E_NOINTERFACE;
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return E_FAIL;
  }
}

IFACEMETHODIMP_(ULONG) OpenInMarkdownMeisterCommand::AddRef() { return ++ref_count_; }

IFACEMETHODIMP_(ULONG) OpenInMarkdownMeisterCommand::Release() {
  const ULONG remaining = --ref_count_;
  if (remaining == 0) delete this;
  return remaining;
}

IFACEMETHODIMP OpenInMarkdownMeisterCommand::GetTitle(IShellItemArray *, LPWSTR *out_name) {
  if (!out_name) return E_POINTER;
  __try {
    return CopyCoString(kTitle, out_name);
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    *out_name = nullptr;
    return E_FAIL;
  }
}

IFACEMETHODIMP OpenInMarkdownMeisterCommand::GetIcon(IShellItemArray *, LPWSTR *out_icon) {
  if (!out_icon) return E_POINTER;
  __try {
    wchar_t launcher[MAX_PATH * 2] = L"";
    wchar_t display[MAX_PATH * 2 + 2] = L"";
    if (ResolvePackagedLauncher(launcher, std::size(launcher)) &&
        _snwprintf_s(display, static_cast<DWORD>(std::size(display)), _TRUNCATE, L"%s,0",
                     launcher) > 0) {
      return CopyCoString(display, out_icon);
    }
    return CopyCoString(L"", out_icon);
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    *out_icon = nullptr;
    return E_FAIL;
  }
}

IFACEMETHODIMP OpenInMarkdownMeisterCommand::GetToolTip(IShellItemArray *, LPWSTR *out_tip) {
  if (!out_tip) return E_POINTER;
  __try {
    return CopyCoString(L"", out_tip);
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    *out_tip = nullptr;
    return E_FAIL;
  }
}

IFACEMETHODIMP OpenInMarkdownMeisterCommand::GetCanonicalName(GUID *out_guid) {
  if (!out_guid) return E_POINTER;
  __try {
    *out_guid = GUID_CommandOpenFolder;
    return S_OK;
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return E_FAIL;
  }
}

IFACEMETHODIMP OpenInMarkdownMeisterCommand::GetState(IShellItemArray *, BOOL,
                                                      EXPCMDSTATE *out_state) {
  if (!out_state) return E_POINTER;
  __try {
    // Enabled unconditionally, without inspecting the item: menu presence
    // costs nothing (US5 scenario 3); validation belongs to the app (FR-012).
    *out_state = ECS_ENABLED;
    return S_OK;
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return E_FAIL;
  }
}

IFACEMETHODIMP OpenInMarkdownMeisterCommand::Invoke(IShellItemArray *items, IBindCtx *) {
  __try {
    return InvokeImpl(items);
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return E_FAIL;
  }
}

IFACEMETHODIMP OpenInMarkdownMeisterCommand::GetFlags(EXPCMDFLAGS *out_flags) {
  if (!out_flags) return E_POINTER;
  __try {
    *out_flags = ECF_DEFAULT;
    return S_OK;
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return E_FAIL;
  }
}

IFACEMETHODIMP OpenInMarkdownMeisterCommand::EnumSubCommands(IEnumExplorerCommand **out_enum) {
  if (!out_enum) return E_POINTER;
  __try {
    *out_enum = nullptr;
    return E_NOTIMPL;
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return E_FAIL;
  }
}
