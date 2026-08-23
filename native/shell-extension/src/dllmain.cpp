// Spec 038: classic COM in-proc server glue. The class factory and the command
// object are hand-rolled (no framework) so every exported entry point is a
// small, auditable SEH boundary — the containment contract (FR-011) is the
// reason this file exists at all.

#include "ExplorerCommand.h"

#include <windows.h>
#include <new>

namespace {

// Stateless factory; Explorer may hold it for the process lifetime.
class CommandFactory final : public IClassFactory {
public:
  CommandFactory() : ref_count_(1) {}

  IFACEMETHODIMP QueryInterface(REFIID riid, void **out_object) override {
    if (!out_object) return E_POINTER;
    __try {
      *out_object = nullptr;
      const IID targets[] = {IID_IUnknown, IID_IClassFactory};
      for (const IID &target : targets) {
        if (riid == target) {
          AddRef();
          *out_object = static_cast<IClassFactory *>(this);
          return S_OK;
        }
      }
      return E_NOINTERFACE;
    } __except (EXCEPTION_EXECUTE_HANDLER) {
      return E_FAIL;
    }
  }

  IFACEMETHODIMP_(ULONG) AddRef() override { return ++ref_count_; }

  IFACEMETHODIMP_(ULONG) Release() override {
    // The factory is a process-lifetime singleton; never actually destroyed.
    return ++ref_count_;
  }

  IFACEMETHODIMP CreateInstance(IUnknown *outer, REFIID riid, void **out_object) override {
    if (!out_object) return E_POINTER;
    if (outer) return CLASS_E_NOAGGREGATION;
    return CreateInstanceSeh(riid, out_object);
  }

  IFACEMETHODIMP LockServer(BOOL) override { return S_OK; }

private:
  ~CommandFactory() = default;

  // SEH boundary: the frame below must stay free of anything that can unwind,
  // so the implementation (which allocates) lives one call away.
  static HRESULT __stdcall CreateInstanceSeh(REFIID riid, void **out_object) {
    __try {
      return CreateInstanceImpl(riid, out_object);
    } __except (EXCEPTION_EXECUTE_HANDLER) {
      *out_object = nullptr;
      return E_FAIL;
    }
  }

  static HRESULT CreateInstanceImpl(REFIID riid, void **out_object) {
    *out_object = nullptr;
    auto command = new (std::nothrow) OpenInMarkdownMeisterCommand();
    if (!command) return E_OUTOFMEMORY;

    const HRESULT hr = command->QueryInterface(riid, out_object);
    // QI took its own reference; drop ours from construction.
    command->Release();
    if (FAILED(hr)) *out_object = nullptr;
    return hr;
  }

  ULONG ref_count_;
};

CommandFactory g_factory; // one per module, shared by all activations

} // namespace

// Exports are declared by combaseapi.h; the definitions below match those
// declarations and the .def file performs the actual exporting (a dllexport
// here would clash with the header's linkage).
extern "C" {

BOOL WINAPI DllMain(HINSTANCE, DWORD reason, LPVOID) {
  // No thread attach/detach work on purpose: the fewer OS callbacks this
  // module participates in, the less can go wrong inside Explorer.
  if (reason == DLL_PROCESS_ATTACH) DisableThreadLibraryCalls(GetModuleHandleW(nullptr));
  return TRUE;
}

// The two entry points a packaged-COM in-proc server needs (registration
// itself lives in the manifest, so there is deliberately no DllRegisterServer).
HRESULT WINAPI DllGetClassObject(REFCLSID clsid, REFIID riid, void **out_object) {
  if (!out_object) return E_POINTER;
  __try {
    if (clsid != CLSID_OpenInMarkdownMeisterCommand) return CLASS_E_CLASSNOTAVAILABLE;
    return g_factory.QueryInterface(riid, out_object);
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return E_FAIL;
  }
}

HRESULT WINAPI DllCanUnloadNow(void) {
  // Always S_FALSE: the factory singleton keeps an outstanding reference, so
  // the loader never unloads us while Explorer runs — the only safe choice
  // for a component that must never crash its host mid-call.
  __try {
    return S_FALSE;
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return S_FALSE;
  }
}
}
