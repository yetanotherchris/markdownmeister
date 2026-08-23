# Spec 038: minimal in-process COM shell extension for Windows 11's
# first-level folder context menu (IExplorerCommand, Directory items).
#
# Requirements to build: Visual Studio 2022 with the C++ workload and a
# Windows 11 (10.0.22621+) SDK. scripts/build-shell-extension.ps1 wraps this
# file and prints exactly what is missing when those prerequisites are absent.
cmake_minimum_required(VERSION 3.20)
project(MarkdownMeisterShellExtension LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(MarkdownMeisterShellExtension SHARED
  src/ExplorerCommand.cpp
  src/dllmain.cpp
  src/MarkdownMeisterShellExtension.def
)

target_compile_definitions(MarkdownMeisterShellExtension PRIVATE
  UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX
)

# SEH boundary frames require /EHsc; warnings stay visible but never fatal so
# toolchain drift across MSVC updates cannot silently break Store builds.
target_compile_options(MarkdownMeisterShellExtension PRIVATE
  /W4 /permissive- /EHsc
)

target_link_libraries(MarkdownMeisterShellExtension PRIVATE
  ole32    # CoTaskMemAlloc for shell-allocated strings
  shell32  # SHGetKnownFolderPath, ShellExecuteExW
)

set_target_properties(MarkdownMeisterShellExtension PROPERTIES
  OUTPUT_NAME "MarkdownMeisterShellExtension"
  PREFIX ""
)

install(TARGETS MarkdownMeisterShellExtension RUNTIME DESTINATION .)
