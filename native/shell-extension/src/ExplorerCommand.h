// Spec 038: minimal in-process COM shell extension that places
// "Open in MarkdownMeister" in Windows 11's first-level folder context menu
// (MSIX windows.fileExplorerContextMenus -> Directory).
//
// Containment contract (spec US5 / FR-011): this module runs inside
// Explorer.exe. Every exported function and COM method capable of faulting
// sits inside an SEH boundary frame (the only exceptions are the trivial
// reference-count accessors and no-op LockServer/DllMain bodies); any fault
// degrades to a failure HRESULT (entry absent / inert), never a crash, hang,
// dialog, wait, or background thread.
//
// Hand-off contract (spec FR-012): Invoke launches the app's execution alias
// with the chosen folder as its sole argument and does nothing else — no
// filesystem browsing, no content reads, no persistence of observed paths.
// All validation happens inside the trusted application process.
//
// Registration is entirely via the package manifest (packaged COM); there are
// no DllRegisterServer-style self-registration exports on purpose.

#pragma once

#include <shobjidl_core.h>

// Fixed class ID registered in packaging/appx/extensions.xml; changing it is a
// breaking change for installed packages and the manifest must move together.
extern "C" __declspec(selectany) const CLSID CLSID_OpenInMarkdownMeisterCommand = {
    0xb86b8d21, 0x9a47, 0x4f7e, {0xa2, 0xc5, 0x3e, 0x1d, 0x9c, 0x6f, 0x08, 0xab}};

// Canonical command name handed out by GetCanonicalName (stable identity for
// the verb itself, independent of the COM class id).
extern "C" __declspec(selectany) const GUID GUID_CommandOpenFolder = {
    0xd4a17c33, 0x6f2b, 0x4c58, {0x9e, 0x01, 0x7a, 0x8b, 0x2d, 0x5f, 0x13, 0xc9}};

// Single menu command exposed by the factory. One product display name
// (FR-006, spec 035 D5): "Open in MarkdownMeister".
class OpenInMarkdownMeisterCommand final : public IExplorerCommand {
public:
  OpenInMarkdownMeisterCommand() : ref_count_(1) {}

  // IUnknown
  IFACEMETHODIMP QueryInterface(REFIID riid, void **out_object) override;
  IFACEMETHODIMP_(ULONG) AddRef() override;
  IFACEMETHODIMP_(ULONG) Release() override;

  // IExplorerCommand — every method body is wrapped in an SEH frame.
  IFACEMETHODIMP GetTitle(IShellItemArray *items, LPWSTR *out_name) override;
  IFACEMETHODIMP GetIcon(IShellItemArray *items, LPWSTR *out_icon) override;
  IFACEMETHODIMP GetToolTip(IShellItemArray *items, LPWSTR *out_tip) override;
  IFACEMETHODIMP GetCanonicalName(GUID *out_guid) override;
  IFACEMETHODIMP GetState(IShellItemArray *items, BOOL fOkToBeSlow,
                          EXPCMDSTATE *out_state) override;
  IFACEMETHODIMP Invoke(IShellItemArray *items, IBindCtx *bind_ctx) override;
  IFACEMETHODIMP GetFlags(EXPCMDFLAGS *out_flags) override;
  IFACEMETHODIMP EnumSubCommands(IEnumExplorerCommand **out_enum) override;

private:
  ~OpenInMarkdownMeisterCommand() = default;

  ULONG ref_count_;
};
